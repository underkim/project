import asyncio
import hashlib
import json
import logging
import time

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user
from app.modules.ai.service import LEGACY_AI_MODULES, execute_delete, generate_weekly_report, parse_and_save

router = APIRouter(prefix="/api/v1/ai", tags=["ai"])
logger = logging.getLogger(__name__)


def _map_ai_exception(e: Exception, generic_detail: str) -> HTTPException:
    """AI 라우터 공통 예외 매핑 helper.

    알려진 provider 오류는 적절한 상태코드로 변환하고,
    그 외 예외는 server-side 로깅 후 generic detail로 500을 반환한다.
    """
    err = str(e)
    if "RESOURCE_EXHAUSTED" in err or "quota" in err.lower():
        return HTTPException(status_code=429, detail="API 할당량 초과입니다. 잠시 후 다시 시도해주세요.")
    if "API_KEY_INVALID" in err or "PERMISSION_DENIED" in err:
        return HTTPException(status_code=401, detail="Gemini API 키가 올바르지 않습니다.")
    logger.exception("AI router unexpected error: %s", generic_detail)
    return HTTPException(status_code=500, detail=generic_detail)


# 동일한 (module, filter) 삭제 실행 요청이 짧은 시간 안에 중복 전송돼도(더블클릭,
# 네트워크 재시도 등) 실제 삭제를 두 번 실행하지 않고 최초 결과를 그대로 반환한다.
# 단일 프로세스 in-memory 캐시로 충분 — 이 앱은 단일 사용자, 단일 인스턴스로 배포된다.
# key별 asyncio.Lock으로 check-then-act 구간 전체를 직렬화한다 — 락 없이 "캐시 확인 →
# execute_delete await → 캐시 기록" 순서만 쓰면, execute_delete가 대기하는 동안 두 번째
# 동시 요청이 캐시 미스를 그대로 통과해 삭제가 두 번 실행되는 TOCTOU 레이스가 생긴다.
# _execution_locks는 만료 시켜 정리하지 않는다 — 단일 사용자 기준 distinct (module,
# filter) 조합 수가 작고, 락이 걸려 있는 도중 삭제하면 새 요청이 새 Lock을 만들어
# 대기 중인 락을 우회하는 또 다른 레이스가 생기기 때문이다.
_recent_executions: dict[str, tuple[float, dict]] = {}
_execution_locks: dict[str, asyncio.Lock] = {}
_EXECUTE_IDEMPOTENCY_WINDOW_SECONDS = 5.0


def _execution_key(module: str, filter_: dict) -> str:
    normalized = json.dumps({"module": module, "filter": filter_}, sort_keys=True, default=str)
    return hashlib.sha256(normalized.encode()).hexdigest()


def _get_execution_lock(key: str) -> asyncio.Lock:
    lock = _execution_locks.get(key)
    if lock is None:
        lock = asyncio.Lock()
        _execution_locks[key] = lock
    return lock


def _prune_expired_executions(now: float) -> None:
    expired = [
        k for k, (ts, _) in _recent_executions.items()
        if now - ts > _EXECUTE_IDEMPOTENCY_WINDOW_SECONDS
    ]
    for k in expired:
        del _recent_executions[k]


class HistoryMessage(BaseModel):
    role: str   # "user" | "ai"
    text: str


class ChatRequest(BaseModel):
    message: str
    history: list[HistoryMessage] = []
    context_enabled: bool = True


class ExecuteRequest(BaseModel):
    """삭제 확인 후 실제 실행 요청"""
    module: str
    filter: dict


class ChatResponse(BaseModel):
    reply: str
    saved: bool
    saved_count: int = 0
    module: str | None = None
    modules: list[str] | None = None
    action: str | None = None
    pending_filter: dict | None = None
    suggestions: list[str] | None = None


class WeeklyReportResponse(BaseModel):
    report: str


@router.post("/chat", response_model=ChatResponse)
async def chat(
    body: ChatRequest,
    session: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    if not body.message.strip():
        raise HTTPException(status_code=400, detail="메시지를 입력해주세요.")
    try:
        result = await parse_and_save(
            session, body.message.strip(), body.history, context_enabled=body.context_enabled
        )
        return result
    except Exception as e:
        raise _map_ai_exception(e, "AI 처리에 실패했습니다. 잠시 후 다시 시도해주세요.")


@router.get("/weekly-report", response_model=WeeklyReportResponse)
async def weekly_report(
    _: str = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """이번 주 데이터 기반 AI 주간 리포트 생성"""
    if not settings.gemini_api_key:
        raise HTTPException(status_code=503, detail="AI 기능이 설정되지 않았습니다.")
    try:
        report = await generate_weekly_report(session)
        return {"report": report}
    except Exception as e:
        raise _map_ai_exception(e, "리포트 생성에 실패했습니다. 잠시 후 다시 시도해주세요.")


@router.post("/execute", response_model=ChatResponse)
async def execute(
    body: ExecuteRequest,
    session: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    """삭제 확인 후 실제 실행 (프론트에서 확인 버튼 클릭 시 호출)

    더블클릭이나 네트워크 재시도로 동일한 (module, filter) 요청이 짧은 시간 안에
    중복 도착해도 실제 삭제는 한 번만 실행하고 최초 결과를 그대로 반환한다.
    """
    if body.module in LEGACY_AI_MODULES:
        raise HTTPException(
            status_code=409,
            detail="이전 자기계발/커리어 기록은 AI에서 변경할 수 없습니다. 나의 기록 Tracker를 사용해 주세요.",
        )
    key = _execution_key(body.module, body.filter)
    lock = _get_execution_lock(key)
    async with lock:
        now = time.monotonic()
        _prune_expired_executions(now)
        cached = _recent_executions.get(key)
        if cached is not None:
            return ChatResponse(**cached[1])

        try:
            deleted = await execute_delete(session, body.module, body.filter)
            if deleted:
                result = ChatResponse(
                    reply="삭제했어요.", saved=True, module=body.module, action="delete"
                )
            else:
                result = ChatResponse(reply="삭제할 기록을 찾지 못했어요.", saved=False)
            _recent_executions[key] = (now, result.model_dump())
            return result
        except Exception as e:
            raise _map_ai_exception(e, "삭제 실행에 실패했습니다. 잠시 후 다시 시도해주세요.")
