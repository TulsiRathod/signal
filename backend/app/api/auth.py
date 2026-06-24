"""Mocked authentication: phone number + fixed OTP, JWT sessions."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.security import create_access_token, get_current_user
from app.database import get_db
from app.models import User
from app.schemas.schemas import (
    CompleteProfile,
    RequestOTP,
    Token,
    UserOut,
    VerifyOTP,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/request-otp")
async def request_otp(body: RequestOTP) -> dict:
    """Pretend to send an OTP. The code is always ``settings.mock_otp``."""
    if not body.phone.strip():
        raise HTTPException(400, "Phone number required")
    # Returned only to make the demo obvious; a real app would never do this.
    return {"ok": True, "hint": f"Use OTP {settings.mock_otp} (mocked)"}


@router.post("/verify-otp", response_model=Token)
async def verify_otp(body: VerifyOTP, db: AsyncSession = Depends(get_db)) -> Token:
    if body.otp != settings.mock_otp:
        raise HTTPException(400, "Invalid OTP")

    user = (
        await db.execute(select(User).where(User.phone == body.phone))
    ).scalar_one_or_none()

    is_new_user = user is None
    if is_new_user:
        user = User(phone=body.phone, display_name="")
        db.add(user)
        await db.commit()
        await db.refresh(user)

    token = create_access_token(user.id)
    return Token(
        access_token=token,
        is_new_user=is_new_user or not user.display_name,
        user=UserOut.model_validate(user),
    )


@router.post("/complete-profile", response_model=UserOut)
async def complete_profile(
    body: CompleteProfile,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
) -> UserOut:
    current.display_name = body.display_name
    if body.avatar_url is not None:
        current.avatar_url = body.avatar_url
    if body.about is not None:
        current.about = body.about
    if body.username:
        clash = (
            await db.execute(
                select(User).where(
                    User.username == body.username, User.id != current.id
                )
            )
        ).scalar_one_or_none()
        if clash:
            raise HTTPException(409, "Username already taken")
        current.username = body.username
    await db.commit()
    await db.refresh(current)
    return UserOut.model_validate(current)


@router.get("/me", response_model=UserOut)
async def me(current: User = Depends(get_current_user)) -> UserOut:
    return UserOut.model_validate(current)


@router.post("/logout")
async def logout(current: User = Depends(get_current_user)) -> dict:
    # Stateless JWT: client just drops the token. Endpoint exists for symmetry.
    return {"ok": True}
