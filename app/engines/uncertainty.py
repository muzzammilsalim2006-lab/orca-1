"""Uncertainty and Confidence Engine: Quantifies forecast reliability and sensor confidence."""

from typing import Any, Dict


class UncertaintyEngine:
    @staticmethod
    def calculate_confidence(
        source_count: int = 2,
        missing_ratio: float = 0.0,
        stale: bool = False,
        disagreement: float = 0.0,
        mode: str = "live",
        conflict_penalty: float = 0.0,
    ) -> Dict[str, Any]:
        """Calculates confidence score from 0 to 100 and assigns level."""
        score = 100.0

        # Missing data penalty
        score -= missing_ratio * 30.0

        # Staleness penalty
        if stale:
            score -= 20.0

        # Multi-provider disagreement and conflict penalty
        score -= disagreement * 30.0
        score -= conflict_penalty * 100.0

        # Bonus for corroborating live sources
        if source_count >= 2:
            score += 5.0

        # Demo mode adjustments
        if "degraded" in mode:
            score -= 25.0
        elif "cached" in mode:
            score -= 10.0

        final_score = int(max(0.0, min(100.0, round(score))))

        if final_score >= 75:
            level = "HIGH"
        elif final_score >= 45:
            level = "MODERATE"
        else:
            level = "LOW"

        return {
            "score": final_score,
            "level": level,
            "factors": {
                "source_count": source_count,
                "missing_ratio": round(missing_ratio, 2),
                "is_stale": stale,
                "disagreement_factor": round(disagreement, 2),
                "mode": mode,
            },
        }
