"""Conversational Multi-Turn Chat Router: POST /api/chat."""

from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from app.api.dependencies import get_orchestrator
from app.agents.orchestrator import OrcaOrchestrator
from app.agents.planner import PlannerAgent
from app.schemas.requests import ChatRequest
from app.services.session_service import session_service
from app.services.translation_service import TranslationService

router = APIRouter(prefix="/api/chat", tags=["Conversational AI"])


@router.post("")
async def conversational_chat(
    chat_req: ChatRequest,
    orchestrator: OrcaOrchestrator = Depends(get_orchestrator),
) -> Dict[str, Any]:
    """
    Multi-turn conversational maritime mission planner.
    Accepts natural language queries in English, Hindi, Malayalam, Tamil, or Marathi,
    parses intents, evaluates scientific oceanographic conditions, and provides localized advice.
    """
    try:
        session = session_service.get_or_create_session(chat_req.conversation_id)
        cid = session["conversation_id"]

        # Parse natural language query into structured AssessmentRequest
        assessment_req = PlannerAgent.parse_natural_language(
            query=chat_req.query,
            target_date=chat_req.target_date,
        )

        # Execute multi-agent orchestration
        state = await orchestrator.run_assessment(
            request=assessment_req,
            conversation_id=cid,
            raw_query=chat_req.query,
            preferred_lang=chat_req.preferred_language,
        )

        reply_text = state.localized_explanation or state.explanation

        # Record conversation history
        session_service.add_message(cid, role="user", content=chat_req.query)
        session_service.add_message(cid, role="assistant", content=reply_text)

        return {
            "conversation_id": cid,
            "mission_id": state.mission_id,
            "detected_language": state.language,
            "reply": reply_text,
            "english_explanation": state.explanation,
            "location": state.location,
            "risk": state.risk,
            "selected_zone": state.selected_route,
            "spatiotemporal_route": state.spatiotemporal_route,
            "pfz_advisories": state.pfz_advisories,
            "verification": state.verification,
            "evidence_count": len(state.evidence),
        }

    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Conversational planning error: {str(exc)}",
        )
