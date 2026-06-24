"""Background sweep that deletes expired disappearing messages.

A message disappears ``disappear_after`` seconds after it was created. The loop
runs periodically, hard-deletes anything past its lifetime, and broadcasts a
``message.gone`` event so every connected client removes it in real time.
"""
import asyncio
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models import Message
from app.services.serializers import get_member_ids
from app.ws.manager import manager

SWEEP_INTERVAL_SECONDS = 5


def _as_aware(dt: datetime) -> datetime:
    """SQLite may return naive datetimes; treat those as UTC."""
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


async def _sweep_once() -> None:
    async with AsyncSessionLocal() as db:
        now = datetime.now(timezone.utc)
        candidates = (
            await db.execute(
                select(Message).where(Message.disappear_after.is_not(None))
            )
        ).scalars().all()

        events: list[tuple[list[int], int, int]] = []
        for m in candidates:
            expires_at = _as_aware(m.created_at) + timedelta(seconds=m.disappear_after)
            if expires_at <= now:
                member_ids = await get_member_ids(db, m.conversation_id)
                events.append((member_ids, m.id, m.conversation_id))
                await db.delete(m)
        if events:
            await db.commit()

    for member_ids, message_id, conv_id in events:
        await manager.send_to_users(
            member_ids,
            {
                "type": "message.gone",
                "payload": {"message_id": message_id, "conversation_id": conv_id},
            },
        )


async def expiry_loop() -> None:
    while True:
        try:
            await _sweep_once()
        except Exception:
            # Never let a transient error kill the loop.
            pass
        await asyncio.sleep(SWEEP_INTERVAL_SECONDS)
