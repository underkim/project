import traceback

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.modules.ai.service import execute_delete, parse_and_save

router = APIRouter(prefix="/api/v1/ai", tags=["ai"])


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
    module: str | None = None
    action: str | None = None
    pending_filter: dict | None = None   # delete_pending일 때만


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
        err = str(e)
        if "RESOURCE_EXHAUSTED" in err or "quota" in err.lower():
            raise HTTPException(status_code=429, detail="API 할당량 초과입니다. Google AI Studio에서 키를 재발급해주세요.")
        if "API_KEY_INVALID" in err or "invalid" in err.lower():
            raise HTTPException(status_code=401, detail="Gemini API 키가 올바르지 않습니다.")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"AI 처리 중 오류: {err}")


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
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"삭제 중 오류: {str(e)}")
