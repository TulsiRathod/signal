"""Sending messages, reactions, read receipts and attachment uploads."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.users import _save_upload
from app.core.security import get_current_user
from app.database import get_db
from app.models import (
    Attachment,
    Conversation,
    ConversationMember,
    Message,
    MessageReceipt,
    Reaction,
    User,
)
from app.schemas.schemas import MessageCreate, MessageOut, ReactionCreate
from app.services.serializers import (
    get_member_ids,
    load_message,
    serialize_message,
)
from app.ws.manager import manager

router = APIRouter(tags=["messages"])


async def _ensure_member(db: AsyncSession, conv_id: int, user_id: int) -> None:
    member = (
        await db.execute(
            select(ConversationMember).where(
                ConversationMember.conversation_id == conv_id,
                ConversationMember.user_id == user_id,
            )
        )
    ).scalar_one_or_none()
    if member is None:
        raise HTTPException(403, "Not a member of this conversation")


@router.post("/messages", response_model=MessageOut, status_code=201)
async def send_message(
    body: MessageCreate,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
) -> MessageOut:
    await _ensure_member(db, body.conversation_id, current.id)

    msg = Message(
        conversation_id=body.conversation_id,
        sender_id=current.id,
        content=body.content,
        type=body.type,
        reply_to_id=body.reply_to_id,
        disappear_after=body.disappear_after,
        status="sent",
    )
    db.add(msg)
    await db.flush()

    for att in body.attachments:
        db.add(
            Attachment(
                message_id=msg.id,
                url=att.url,
                type=att.type,
                filename=att.filename,
                size=att.size,
            )
        )

    # Bump conversation activity for list ordering.
    conv = await db.get(Conversation, body.conversation_id)
    conv.updated_at = datetime.now(timezone.utc)

    member_ids = await get_member_ids(db, body.conversation_id)
    recipients = [uid for uid in member_ids if uid != current.id]

    # Auto delivery receipts for members currently online.
    delivered_to_someone = False
    for uid in recipients:
        if manager.is_online(uid):
            db.add(MessageReceipt(message_id=msg.id, user_id=uid, status="delivered"))
            delivered_to_someone = True
    if delivered_to_someone:
        msg.status = "delivered"

    await db.commit()

    full = await load_message(db, msg.id)
    payload = serialize_message(full)

    # Push to everyone (including sender's other devices) in real time.
    await manager.send_to_users(
        member_ids, {"type": "message.new", "payload": payload}
    )
    # Tell the sender the delivery status so their checkmarks update.
    if delivered_to_someone:
        await manager.send_to_user(
            current.id,
            {
                "type": "message.status",
                "payload": {"message_id": msg.id, "status": "delivered"},
            },
        )
    return MessageOut.model_validate(payload)


@router.post("/messages/{message_id}/read")
async def mark_read(
    message_id: int,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
) -> dict:
    """Mark a message (and everything before it in the conversation) as read."""
    msg = await db.get(Message, message_id)
    if msg is None:
        raise HTTPException(404, "Message not found")
    await _ensure_member(db, msg.conversation_id, current.id)

    # Advance this member's read pointer.
    member = (
        await db.execute(
            select(ConversationMember).where(
                ConversationMember.conversation_id == msg.conversation_id,
                ConversationMember.user_id == current.id,
            )
        )
    ).scalar_one()
    if not member.last_read_message_id or member.last_read_message_id < message_id:
        member.last_read_message_id = message_id

    # Create/upgrade read receipts for unread messages from others up to this one.
    unread = (
        await db.execute(
            select(Message).where(
                Message.conversation_id == msg.conversation_id,
                Message.id <= message_id,
                Message.sender_id != current.id,
            )
        )
    ).scalars().all()

    touched_senders: dict[int, list[int]] = {}
    for m in unread:
        receipt = (
            await db.execute(
                select(MessageReceipt).where(
                    MessageReceipt.message_id == m.id,
                    MessageReceipt.user_id == current.id,
                )
            )
        ).scalar_one_or_none()
        if receipt is None:
            db.add(
                MessageReceipt(message_id=m.id, user_id=current.id, status="read")
            )
        elif receipt.status != "read":
            receipt.status = "read"
        m.status = "read"
        touched_senders.setdefault(m.sender_id, []).append(m.id)

    await db.commit()

    # Notify each sender that their messages were read.
    for sender_id, ids in touched_senders.items():
        await manager.send_to_user(
            sender_id,
            {
                "type": "message.status",
                "payload": {
                    "message_ids": ids,
                    "status": "read",
                    "reader_id": current.id,
                    "conversation_id": msg.conversation_id,
                },
            },
        )
    return {"ok": True}


@router.post("/messages/{message_id}/reactions", response_model=MessageOut)
async def toggle_reaction(
    message_id: int,
    body: ReactionCreate,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
) -> MessageOut:
    msg = await db.get(Message, message_id)
    if msg is None:
        raise HTTPException(404, "Message not found")
    await _ensure_member(db, msg.conversation_id, current.id)

    existing = (
        await db.execute(
            select(Reaction).where(
                Reaction.message_id == message_id,
                Reaction.user_id == current.id,
                Reaction.emoji == body.emoji,
            )
        )
    ).scalar_one_or_none()
    if existing:
        await db.delete(existing)  # toggle off
    else:
        db.add(
            Reaction(message_id=message_id, user_id=current.id, emoji=body.emoji)
        )
    await db.commit()

    full = await load_message(db, message_id)
    payload = serialize_message(full)
    await manager.send_to_users(
        await get_member_ids(db, msg.conversation_id),
        {"type": "reaction.update", "payload": payload},
    )
    return MessageOut.model_validate(payload)


@router.delete("/messages/{message_id}", response_model=MessageOut)
async def delete_message(
    message_id: int,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
) -> MessageOut:
    msg = await db.get(Message, message_id)
    if msg is None:
        raise HTTPException(404, "Message not found")
    if msg.sender_id != current.id:
        raise HTTPException(403, "You can only delete your own messages")
    msg.is_deleted = True
    msg.content = ""
    await db.commit()

    full = await load_message(db, message_id)
    payload = serialize_message(full)
    await manager.send_to_users(
        await get_member_ids(db, msg.conversation_id),
        {"type": "message.new", "payload": payload},
    )
    return MessageOut.model_validate(payload)


@router.post("/attachments")
async def upload_attachment(
    file: UploadFile = File(...),
    current: User = Depends(get_current_user),
) -> dict:
    info = await _save_upload(file)
    content_type = file.content_type or ""
    info["type"] = "image" if content_type.startswith("image/") else "file"
    return info
