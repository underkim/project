import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user
from app.modules.ai.service import execute_delete, generate_weekly_report, parse_and_save

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


class HistoryMessage(BaseModel):
    role: str   # "user" | "ai"
    text: str


class ChatRequest(BaseModel):
    message: str
    history: list[HistoryMessage] = []


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


@router.post("/chat", response_model=ChatResponse)
async def chat(
    body: ChatRequest,
    session: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    if not body.message.strip():
        raise HTTPException(status_code=400, detail="메시지를 입력해주세요.")
    try:
        result = await parse_and_save(session, body.message.strip(), body.history)
        return result
    except Exception as e:
        raise _map_ai_exception(e, "AI 처리에 실패했습니다. 잠시 후 다시 시도해주세요.")


@router.get("/weekly-report")
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
    """삭제 확인 후 실제 실행 (프론트에서 확인 버튼 클릭 시 호출)"""
    try:
        deleted = await execute_delete(session, body.module, body.filter)
        if deleted:
            return ChatResponse(reply="삭제했어요.", saved=True, module=body.module, action="delete")
        return ChatResponse(reply="삭제할 기록을 찾지 못했어요.", saved=False)
    except Exception as e:
        raise _map_ai_exception(e, "삭제 실행에 실패했습니다. 잠시 후 다시 시도해주세요.")
