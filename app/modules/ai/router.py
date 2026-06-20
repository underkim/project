from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.modules.ai.service import parse_and_save

router = APIRouter(prefix="/api/v1/ai", tags=["ai"])


class ChatRequest(BaseModel):
    message: str


class ChatResponse(BaseModel):
    message: str
    saved: bool
    module: str | None = None
    action: str | None = None


@router.post("/chat", response_model=ChatResponse)
async def chat(
    body: ChatRequest,
    session: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    if not body.message.strip():
        raise HTTPException(status_code=400, detail="메시지를 입력해주세요.")
    try:
        result = await parse_and_save(session, body.message.strip())
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI 처리 중 오류: {str(e)}")
