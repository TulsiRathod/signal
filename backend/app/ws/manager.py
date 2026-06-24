"""In-memory WebSocket connection manager.

Maps ``user_id -> set[WebSocket]`` (a user may be connected from several
tabs/devices) and provides helpers to push JSON events to specific users.
Single-process only, which is fine for the assignment/demo scope.
"""
import asyncio
from collections import defaultdict

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        self._connections: dict[int, set[WebSocket]] = defaultdict(set)
        self._lock = asyncio.Lock()

    async def connect(self, user_id: int, ws: WebSocket) -> bool:
        """Register a socket. Returns True if this is the user's first socket."""
        await ws.accept()
        async with self._lock:
            was_offline = len(self._connections[user_id]) == 0
            self._connections[user_id].add(ws)
        return was_offline

    async def disconnect(self, user_id: int, ws: WebSocket) -> bool:
        """Remove a socket. Returns True if the user now has no sockets left."""
        async with self._lock:
            conns = self._connections.get(user_id)
            if conns and ws in conns:
                conns.discard(ws)
            now_offline = not self._connections.get(user_id)
            if now_offline:
                self._connections.pop(user_id, None)
        return now_offline

    def is_online(self, user_id: int) -> bool:
        return bool(self._connections.get(user_id))

    def online_users(self) -> list[int]:
        return list(self._connections.keys())

    async def send_to_user(self, user_id: int, message: dict) -> None:
        for ws in list(self._connections.get(user_id, set())):
            try:
                await ws.send_json(message)
            except Exception:
                # Drop dead sockets silently; disconnect handler will clean up.
                await self.disconnect(user_id, ws)

    async def send_to_users(self, user_ids, message: dict) -> None:
        for uid in set(user_ids):
            await self.send_to_user(uid, message)


manager = ConnectionManager()
