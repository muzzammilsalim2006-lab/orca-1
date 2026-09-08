"""Session and multi-turn conversational memory service."""

from datetime import datetime, timezone
import uuid
from typing import Any, Dict, List, Optional
from app.state.mission_state import MarineState


class SessionService:
    def __init__(self):
        # Maps conversation_id -> session dict
        self._sessions: Dict[str, Dict[str, Any]] = {}

    def get_or_create_session(self, conversation_id: Optional[str] = None) -> Dict[str, Any]:
        cid = conversation_id or str(uuid.uuid4())
        if cid not in self._sessions:
            self._sessions[cid] = {
                "conversation_id": cid,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "last_active": datetime.now(timezone.utc).isoformat(),
                "history": [],
                "current_state": None,
                "current_mission_id": None,
            }
        self._sessions[cid]["last_active"] = datetime.now(timezone.utc).isoformat()
        return self._sessions[cid]

    def save_state(self, conversation_id: str, state: MarineState) -> None:
        session = self.get_or_create_session(conversation_id)
        session["current_state"] = state
        session["current_mission_id"] = state.mission_id or str(uuid.uuid4())

    def get_last_state(self, conversation_id: str) -> Optional[MarineState]:
        if conversation_id in self._sessions:
            return self._sessions[conversation_id].get("current_state")
        return None

    def add_message(self, conversation_id: str, role: str, content: str, meta: Optional[Dict[str, Any]] = None) -> None:
        session = self.get_or_create_session(conversation_id)
        session["history"].append({
            "role": role,
            "content": content,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "metadata": meta or {},
        })


session_service = SessionService()
