"""Presence helpers: flip a user's online flag and notify their contacts.

We notify everyone who shares at least one conversation with the user.
"""
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import ConversationMember, User
from app.ws.manager import manager


async def peers_of(db: AsyncSession, user_id: int) -> set[int]:
    """All user ids that share a conversation with the given user."""
    conv_ids = select(ConversationMember.conversation_id).where(
        ConversationMember.user_id == user_id
    )
    rows = await db.execute(
        select(ConversationMember.user_id).where(
            ConversationMember.conversation_id.in_(conv_ids)
        )
    )
    peers = {row[0] for row in rows.all()}
    peers.discard(user_id)
    return peers


async def set_presence(db: AsyncSession, user_id: int, online: bool) -> None:
    user = await db.get(User, user_id)
    if user is None:
        return
    user.is_online = online
    user.last_seen = datetime.now(timezone.utc)
    await db.commit()

    event = {
        "type": "presence.update",
        "payload": {
            "user_id": user_id,
            "is_online": online,
            "last_seen": user.last_seen.isoformat(),
        },
    }
    await manager.send_to_users(await peers_of(db, user_id), event)
