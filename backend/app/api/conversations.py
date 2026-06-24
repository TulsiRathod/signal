"""Conversation listing, creation and group member administration."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.security import get_current_user
from app.database import get_db
from app.models import Conversation, ConversationMember, Message, User
from app.schemas.schemas import (
    AddMembers,
    ConversationCreate,
    ConversationOut,
    MessageOut,
    SetDisappearing,
)
from app.services.serializers import (
    get_member_ids,
    load_conversation,
    serialize_conversation,
    serialize_message,
)
from app.ws.manager import manager

router = APIRouter(prefix="/conversations", tags=["conversations"])


async def _require_member(
    db: AsyncSession, conv_id: int, user_id: int
) -> ConversationMember:
    member = (
        await db.execute(
            select(ConversationMember).where(
                ConversationMember.conversation_id == conv_id,
                ConversationMember.user_id == user_id,
            )
        )
    ).scalar_one_or_none()
    if member is None:
        raise HTTPException(403, "You are not a member of this conversation")
    return member


@router.get("", response_model=list[ConversationOut])
async def list_conversations(
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
) -> list[ConversationOut]:
    my_conv_ids = select(ConversationMember.conversation_id).where(
        ConversationMember.user_id == current.id
    )
    stmt = (
        select(Conversation)
        .where(Conversation.id.in_(my_conv_ids))
        .order_by(Conversation.updated_at.desc())
        .options(
            selectinload(Conversation.members).selectinload(ConversationMember.user)
        )
    )
    convs = (await db.execute(stmt)).scalars().all()
    return [
        ConversationOut.model_validate(
            await serialize_conversation(db, c, current.id)
        )
        for c in convs
    ]


@router.post("", response_model=ConversationOut, status_code=201)
async def create_conversation(
    body: ConversationCreate,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
) -> ConversationOut:
    member_ids = set(body.member_ids) | {current.id}

    if body.type == "direct":
        if len(member_ids) != 2:
            raise HTTPException(400, "A direct chat needs exactly one other member")
        other_id = next(uid for uid in member_ids if uid != current.id)
        existing = await _find_direct(db, current.id, other_id)
        if existing:
            conv = await load_conversation(db, existing)
            return ConversationOut.model_validate(
                await serialize_conversation(db, conv, current.id)
            )

    conv = Conversation(
        type=body.type,
        name=body.name if body.type == "group" else None,
        avatar_url=body.avatar_url,
        created_by=current.id,
        updated_at=datetime.now(timezone.utc),
    )
    db.add(conv)
    await db.flush()

    for uid in member_ids:
        role = "admin" if (body.type == "group" and uid == current.id) else "member"
        db.add(
            ConversationMember(conversation_id=conv.id, user_id=uid, role=role)
        )
    await db.commit()

    conv = await load_conversation(db, conv.id)
    payload = await serialize_conversation(db, conv, current.id)

    # Notify the other members so the conversation appears live for them too.
    others = member_ids - {current.id}
    await manager.send_to_users(
        others, {"type": "conversation.new", "payload": payload}
    )
    return ConversationOut.model_validate(payload)


@router.get("/{conv_id}/messages", response_model=list[MessageOut])
async def get_messages(
    conv_id: int,
    before: int | None = None,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
) -> list[MessageOut]:
    await _require_member(db, conv_id, current.id)
    stmt = (
        select(Message)
        .where(Message.conversation_id == conv_id)
        .options(
            selectinload(Message.reactions),
            selectinload(Message.attachments),
            selectinload(Message.receipts),
            selectinload(Message.reply_to),
        )
        .order_by(Message.created_at.desc())
        .limit(min(limit, 100))
    )
    if before:
        stmt = stmt.where(Message.id < before)
    msgs = (await db.execute(stmt)).scalars().all()
    # Return chronological (oldest first) for easy rendering.
    return [MessageOut.model_validate(serialize_message(m)) for m in reversed(msgs)]


@router.post("/{conv_id}/members", response_model=ConversationOut)
async def add_members(
    conv_id: int,
    body: AddMembers,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
) -> ConversationOut:
    member = await _require_member(db, conv_id, current.id)
    conv = await db.get(Conversation, conv_id)
    if conv.type != "group":
        raise HTTPException(400, "Can only add members to a group")
    if member.role != "admin":
        raise HTTPException(403, "Only admins can add members")

    existing_ids = set(await get_member_ids(db, conv_id))
    added_names = []
    for uid in body.user_ids:
        if uid in existing_ids:
            continue
        user = await db.get(User, uid)
        if user is None:
            continue
        db.add(ConversationMember(conversation_id=conv_id, user_id=uid, role="member"))
        added_names.append(user.display_name)

    if added_names:
        db.add(
            Message(
                conversation_id=conv_id,
                sender_id=current.id,
                type="system",
                content=f"{current.display_name} added {', '.join(added_names)}",
            )
        )
    await db.commit()
    return await _broadcast_member_update(db, conv_id, current.id)


@router.delete("/{conv_id}/members/{user_id}", response_model=ConversationOut)
async def remove_member(
    conv_id: int,
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
) -> ConversationOut:
    member = await _require_member(db, conv_id, current.id)
    conv = await db.get(Conversation, conv_id)
    if conv.type != "group":
        raise HTTPException(400, "Not a group")
    # Admins can remove anyone; members may remove only themselves (leave).
    if member.role != "admin" and user_id != current.id:
        raise HTTPException(403, "Only admins can remove other members")

    target = (
        await db.execute(
            select(ConversationMember).where(
                ConversationMember.conversation_id == conv_id,
                ConversationMember.user_id == user_id,
            )
        )
    ).scalar_one_or_none()
    if target is None:
        raise HTTPException(404, "Member not found")

    removed_user = await db.get(User, user_id)
    await db.delete(target)
    verb = "left" if user_id == current.id else "was removed"
    db.add(
        Message(
            conversation_id=conv_id,
            sender_id=current.id,
            type="system",
            content=f"{removed_user.display_name} {verb}",
        )
    )
    await db.commit()
    return await _broadcast_member_update(db, conv_id, current.id, extra_user=user_id)


@router.patch("/{conv_id}/disappearing", response_model=ConversationOut)
async def set_disappearing(
    conv_id: int,
    body: SetDisappearing,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
) -> ConversationOut:
    await _require_member(db, conv_id, current.id)
    conv = await db.get(Conversation, conv_id)
    seconds = body.seconds if body.seconds and body.seconds > 0 else None
    conv.disappear_seconds = seconds
    db.add(
        Message(
            conversation_id=conv_id,
            sender_id=current.id,
            type="system",
            content=(
                f"{current.display_name} set disappearing messages to "
                f"{_duration_label(seconds)}"
                if seconds
                else f"{current.display_name} turned off disappearing messages"
            ),
        )
    )
    await db.commit()
    return await _broadcast_member_update(db, conv_id, current.id)


def _duration_label(seconds: int) -> str:
    if seconds % 86400 == 0:
        return f"{seconds // 86400}d"
    if seconds % 3600 == 0:
        return f"{seconds // 3600}h"
    if seconds % 60 == 0:
        return f"{seconds // 60}m"
    return f"{seconds}s"


# --------------------------- helpers ---------------------------
async def _find_direct(db: AsyncSession, a: int, b: int) -> int | None:
    """Return the id of an existing direct conversation between two users."""
    a_convs = select(ConversationMember.conversation_id).where(
        ConversationMember.user_id == a
    )
    stmt = (
        select(Conversation.id)
        .join(ConversationMember, ConversationMember.conversation_id == Conversation.id)
        .where(
            Conversation.type == "direct",
            Conversation.id.in_(a_convs),
            ConversationMember.user_id == b,
        )
    )
    return (await db.execute(stmt)).scalar_one_or_none()


async def _broadcast_member_update(
    db: AsyncSession, conv_id: int, current_id: int, extra_user: int | None = None
) -> ConversationOut:
    conv = await load_conversation(db, conv_id)
    payload = await serialize_conversation(db, conv, current_id)
    recipients = set(await get_member_ids(db, conv_id))
    if extra_user:
        recipients.add(extra_user)
    await manager.send_to_users(
        recipients, {"type": "member.update", "payload": payload}
    )
    return ConversationOut.model_validate(payload)
