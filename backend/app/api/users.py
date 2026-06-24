"""User profile, search and avatar upload."""
import secrets
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.security import get_current_user
from app.database import get_db
from app.models import User
from app.schemas.schemas import UserOut, UserUpdate

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/search", response_model=list[UserOut])
async def search_users(
    q: str,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
) -> list[UserOut]:
    term = f"%{q.strip()}%"
    stmt = (
        select(User)
        .where(
            User.id != current.id,
            or_(
                User.display_name.ilike(term),
                User.phone.ilike(term),
                User.username.ilike(term),
            ),
        )
        .limit(20)
    )
    users = (await db.execute(stmt)).scalars().all()
    return [UserOut.model_validate(u) for u in users]


@router.patch("/me", response_model=UserOut)
async def update_me(
    body: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
) -> UserOut:
    if body.display_name is not None:
        current.display_name = body.display_name
    if body.avatar_url is not None:
        current.avatar_url = body.avatar_url
    if body.about is not None:
        current.about = body.about
    if body.username is not None:
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


@router.post("/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    current: User = Depends(get_current_user),
) -> dict:
    return await _save_upload(file)


async def _save_upload(file: UploadFile) -> dict:
    ext = Path(file.filename or "").suffix or ".bin"
    name = f"{secrets.token_hex(16)}{ext}"
    dest = settings.upload_dir / name
    data = await file.read()
    if len(data) > settings.max_upload_mb * 1024 * 1024:
        raise HTTPException(413, "File too large")
    dest.write_bytes(data)
    return {"url": f"/uploads/{name}", "filename": file.filename, "size": len(data)}
