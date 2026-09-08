from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional
import time
from pydantic import BaseModel, Field

from app.state.mission_state import MissionState


class AgentResult(BaseModel):
    status: str = Field(default="SUCCESS", description="Execution status: SUCCESS, FAILED, RETRY, SKIPPED")
    agent_name: str = Field(..., description="Unique agent name")
    data: Dict[str, Any] = Field(default_factory=dict, description="Structured agent payload")
    evidence: List[Dict[str, Any]] = Field(default_factory=list, description="Evidence items generated")
    errors: List[str] = Field(default_factory=list, description="Errors or warning messages")
    confidence: float = Field(default=1.0, ge=0.0, le=1.0, description="Agent confidence score")
    duration_ms: float = Field(default=0.0, description="Execution duration in milliseconds")


class BaseAgent(ABC):
    """Abstract base class defining the contract for all ORCA intelligent agents."""

    name: str = "base_agent"

    @abstractmethod
    async def run(self, state: MissionState) -> AgentResult:
        """Execute agent workflow against shared MissionState and return structured AgentResult."""
        pass

    async def execute(self, state: MissionState) -> AgentResult:
        """Wrapper around run that automatically captures duration and handles unexpected exceptions."""
        start_t = time.perf_counter()
        try:
            result = await self.run(state)
            duration_ms = (time.perf_counter() - start_t) * 1000.0
            result.duration_ms = round(duration_ms, 2)
            # Record trace in mission state if supported
            if hasattr(state, "agent_traces"):
                state.agent_traces.append({
                    "agent_name": self.name,
                    "status": result.status,
                    "duration_ms": result.duration_ms,
                    "confidence": result.confidence,
                    "errors_count": len(result.errors)
                })
            return result
        except Exception as exc:
            duration_ms = (time.perf_counter() - start_t) * 1000.0
            error_msg = f"Agent {self.name} raised unhandled exception: {str(exc)}"
            res = AgentResult(
                status="FAILED",
                agent_name=self.name,
                errors=[error_msg],
                confidence=0.0,
                duration_ms=round(duration_ms, 2)
            )
            if hasattr(state, "agent_traces"):
                state.agent_traces.append({
                    "agent_name": self.name,
                    "status": "FAILED",
                    "duration_ms": res.duration_ms,
                    "confidence": 0.0,
                    "errors_count": 1
                })
            return res
