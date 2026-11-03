"""
Simple async WebSocket connection manager for broadcasting lab events.
"""

import asyncio
import json
from typing import Any

from fastapi import WebSocket


class ConnectionManager:
    """Manages WebSocket connections and broadcasts messages."""

    def __init__(self) -> None:
        self._active: list[WebSocket] = []
        self._queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue()

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self._active.append(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        if websocket in self._active:
            self._active.remove(websocket)

    async def broadcast(self, message: dict[str, Any]) -> None:
        """Send a JSON message to every connected client."""
        payload = json.dumps(message, default=str)
        stale: list[WebSocket] = []
        for ws in self._active:
            try:
                await ws.send_text(payload)
            except Exception:
                stale.append(ws)
        for ws in stale:
            self.disconnect(ws)

    async def publish(self, event_type: str, data: dict[str, Any]) -> None:
        """High-level helper: broadcast a typed event."""
        await self.broadcast({"event": event_type, "data": data})


# Singleton used by the app
manager = ConnectionManager()
