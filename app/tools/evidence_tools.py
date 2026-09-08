from typing import Any, Dict, List
import uuid
from datetime import datetime, timezone


class EvidenceTools:
    """Utilities for structuring and creating evidence provenance items."""

    @staticmethod
    def create_evidence_item(
        source_id: str,
        variable_name: str,
        observed_value: Any,
        unit: str,
        timestamp_iso: str,
        confidence_weight: float = 1.0,
        notes: str = ""
    ) -> Dict[str, Any]:
        return {
            "evidence_id": f"EV-{uuid.uuid4().hex[:6].upper()}",
            "source_id": source_id,
            "variable_name": variable_name,
            "observed_value": observed_value,
            "unit": unit,
            "timestamp": timestamp_iso,
            "confidence_weight": confidence_weight,
            "notes": notes,
            "created_at": datetime.now(timezone.utc).isoformat()
        }

    @staticmethod
    def link_evidence_chain(
        parent_evidence_ids: List[str],
        conclusion: str,
        confidence: float
    ) -> Dict[str, Any]:
        return {
            "chain_id": f"CHN-{uuid.uuid4().hex[:6].upper()}",
            "parent_evidence_ids": parent_evidence_ids,
            "conclusion": conclusion,
            "confidence": confidence,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
