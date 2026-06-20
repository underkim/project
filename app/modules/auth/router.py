from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm

from app.modules.auth import service
from app.modules.auth.schemas import TokenResponse

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


@router.post("/token", response_model=TokenResponse)
async def login(form: OAuth2PasswordRequestForm = Depends()):
    result = service.authenticate(form.username, form.password)
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return result
