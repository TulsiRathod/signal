"""WebSocket endpoint: presence + typing relay.

Message/reaction/receipt events are emitted from the REST handlers (which own
the DB writes); this endpoint handles the connection lifecycle, presence, and
ephemeral typing indicators that never need persistence.
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.security import decode_token
from app.database import AsyncSessionLocal
from app.models import User
from app.services.presence import peers_of, set_presence
from app.services.serializers import get_member_ids
from app.ws.manager import manager

router = APIRouter()


@router.websocket("/ws")
async def websocket_endpoint(ws: WebSocket, token: str = "") -> None:
    user_id = decode_token(token)
    if user_id is None:
        await ws.close(code=4401)
        return
    async with AsyncSessionLocal() as db:
        if await db.get(User, user_id) is None:
            await ws.close(code=4401)
            return

    became_online = await manager.connect(user_id, ws)

    if became_online:
        async with AsyncSessionLocal() as db:
            await set_presence(db, user_id, True)
            # Send the newly-connected client the current online peers.
            peers = await peers_of(db, user_id)
        online_peers = [uid for uid in peers if manager.is_online(uid)]
        await manager.send_to_user(
            user_id,
            {"type": "presence.bulk", "payload": {"online": online_peers}},
        )

    try:
        while True:
            data = await ws.receive_json()
            await _handle_event(user_id, data)
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        now_offline = await manager.disconnect(user_id, ws)
        if now_offline:
            async with AsyncSessionLocal() as db:
                await set_presence(db, user_id, False)


async def _handle_event(user_id: int, data: dict) -> None:
    event_type = data.get("type")
    payload = data.get("payload", {})

    if event_type in ("typing.start", "typing.stop"):
        conv_id = payload.get("conversation_id")
        if conv_id is None:
            return
        async with AsyncSessionLocal() as db:
            member_ids = await get_member_ids(db, conv_id)
        others = [uid for uid in member_ids if uid != user_id]
        await manager.send_to_users(
            others,
            {
                "type": event_type,
                "payload": {"conversation_id": conv_id, "user_id": user_id},
            },
        )
    # 'ping' and unknown events are ignored (keep-alive handled by the protocol).
