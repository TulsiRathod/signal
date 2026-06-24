"""Loaders + serializers shared by REST endpoints and the WebSocket layer.

Async SQLAlchemy does not lazy-load relationships, so every loader here uses
``selectinload`` to eagerly fetch what the serializers need.
"""
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import (
    Conversation,
    ConversationMember,
    Message,
    MessageReceipt,
)


async def load_message(db: AsyncSession, message_id: int) -> Message | None:
    stmt = (
        select(Message)
        .where(Message.id == message_id)
        .options(
            selectinload(Message.reactions),
            selectinload(Message.attachments),
            selectinload(Message.receipts),
            selectinload(Message.reply_to),
        )
    )
    return (await db.execute(stmt)).scalar_one_or_none()


def serialize_message(msg: Message) -> dict:
    reply = None
    if msg.reply_to is not None:
        reply = {
            "id": msg.reply_to.id,
            "sender_id": msg.reply_to.sender_id,
            "content": msg.reply_to.content,
            "type": msg.reply_to.type,
        }
    return {
        "id": msg.id,
        "conversation_id": msg.conversation_id,
        "sender_id": msg.sender_id,
        "content": "" if msg.is_deleted else msg.content,
        "type": msg.type,
        "status": msg.status,
        "reply_to_id": msg.reply_to_id,
        "disappear_after": msg.disappear_after,
        "is_deleted": msg.is_deleted,
        "edited_at": msg.edited_at.isoformat() if msg.edited_at else None,
        "created_at": msg.created_at.isoformat(),
        "reactions": [{"emoji": r.emoji, "user_id": r.user_id} for r in msg.reactions],
        "attachments": [
            {
                "id": a.id,
                "url": a.url,
                "type": a.type,
                "filename": a.filename,
                "size": a.size,
            }
            for a in msg.attachments
        ],
        "reply_to": reply,
        "read_by": [r.user_id for r in msg.receipts if r.status == "read"],
    }


async def get_member_ids(db: AsyncSession, conversation_id: int) -> list[int]:
    stmt = select(ConversationMember.user_id).where(
        ConversationMember.conversation_id == conversation_id
    )
    return [row[0] for row in (await db.execute(stmt)).all()]


async def load_conversation(db: AsyncSession, conversation_id: int) -> Conversation | None:
    stmt = (
        select(Conversation)
        .where(Conversation.id == conversation_id)
        .options(
            selectinload(Conversation.members).selectinload(ConversationMember.user)
        )
    )
    return (await db.execute(stmt)).scalar_one_or_none()


async def _unread_count(db: AsyncSession, conv_id: int, user_id: int) -> int:
    """Count messages in a conversation newer than the member's last_read pointer
    and not sent by the user themselves."""
    member = (
        await db.execute(
            select(ConversationMember).where(
                ConversationMember.conversation_id == conv_id,
                ConversationMember.user_id == user_id,
            )
        )
    ).scalar_one_or_none()
    last_read = member.last_read_message_id if member else None
    stmt = select(func.count(Message.id)).where(
        Message.conversation_id == conv_id,
        Message.sender_id != user_id,
    )
    if last_read:
        stmt = stmt.where(Message.id > last_read)
    return (await db.execute(stmt)).scalar_one()


async def serialize_conversation(
    db: AsyncSession, conv: Conversation, current_user_id: int
) -> dict:
    members = [
        {
            "id": m.id,
            "role": m.role,
            "user": {
                "id": m.user.id,
                "phone": m.user.phone,
                "username": m.user.username,
                "display_name": m.user.display_name,
                "avatar_url": m.user.avatar_url,
                "about": m.user.about,
                "is_online": m.user.is_online,
                "last_seen": m.user.last_seen.isoformat(),
            },
        }
        for m in conv.members
    ]

    last_msg_obj = (
        await db.execute(
            select(Message)
            .where(Message.conversation_id == conv.id)
            .order_by(Message.created_at.desc())
            .limit(1)
            .options(
                selectinload(Message.reactions),
                selectinload(Message.attachments),
                selectinload(Message.receipts),
                selectinload(Message.reply_to),
            )
        )
    ).scalar_one_or_none()

    return {
        "id": conv.id,
        "type": conv.type,
        "name": conv.name,
        "avatar_url": conv.avatar_url,
        "created_by": conv.created_by,
        "updated_at": conv.updated_at.isoformat(),
        "disappear_seconds": conv.disappear_seconds,
        "members": members,
        "last_message": serialize_message(last_msg_obj) if last_msg_obj else None,
        "unread_count": await _unread_count(db, conv.id, current_user_id),
    }
