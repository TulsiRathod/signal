"""Contact management."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.security import get_current_user
from app.database import get_db
from app.models import Contact, User
from app.schemas.schemas import ContactCreate, ContactOut

router = APIRouter(prefix="/contacts", tags=["contacts"])


@router.get("", response_model=list[ContactOut])
async def list_contacts(
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
) -> list[ContactOut]:
    stmt = (
        select(Contact)
        .where(Contact.owner_id == current.id)
        .options(selectinload(Contact.contact_user))
    )
    contacts = (await db.execute(stmt)).scalars().all()
    return [ContactOut.model_validate(c) for c in contacts]


@router.post("", response_model=ContactOut, status_code=201)
async def add_contact(
    body: ContactCreate,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
) -> ContactOut:
    target: User | None = None
    if body.user_id:
        target = await db.get(User, body.user_id)
    elif body.phone:
        target = (
            await db.execute(select(User).where(User.phone == body.phone))
        ).scalar_one_or_none()
    if target is None:
        raise HTTPException(404, "No user found with that phone/id")
    if target.id == current.id:
        raise HTTPException(400, "You cannot add yourself")

    existing = (
        await db.execute(
            select(Contact).where(
                Contact.owner_id == current.id,
                Contact.contact_user_id == target.id,
            )
        )
    ).scalar_one_or_none()
    if existing:
        contact = existing
    else:
        contact = Contact(
            owner_id=current.id,
            contact_user_id=target.id,
            nickname=body.nickname,
        )
        db.add(contact)
        await db.commit()

    # Reload with relationship for serialization.
    contact = (
        await db.execute(
            select(Contact)
            .where(Contact.id == contact.id)
            .options(selectinload(Contact.contact_user))
        )
    ).scalar_one()
    return ContactOut.model_validate(contact)
