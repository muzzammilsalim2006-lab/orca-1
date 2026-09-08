"""Scoring Engine: Generates recommendations, opportunity scores, and composite mission ranking."""

from typing import Any, Dict


class ScoringEngine:
    RECOMMENDATIONS = {
        "LOW": "Conditions appear favourable, but official advisories should still be followed.",
        "MODERATE": "Fishing may be possible with caution. Monitor official marine advisories and carry mandatory safety gear.",
        "HIGH": "Avoid unnecessary marine operations and review official warnings before departure. Small motorized craft should not venture into open sea.",
        "SEVERE": "Do not venture into the affected area. All maritime operations suspended due to severe weather/sea alert.",
    }

    @classmethod
    def recommendation_for_risk(cls, level: str) -> str:
        return cls.RECOMMENDATIONS.get(level.upper(), cls.RECOMMENDATIONS["MODERATE"])

    @staticmethod
    def calculate_ocean_opportunity(
        pfz_score: float = 0.85,
        chlorophyll_score: float = 0.75,
        sst_score: float = 0.80,
        current_score: float = 0.70,
    ) -> float:
        """Calculates oceanographic fishing opportunity index (0.0 to 1.0)."""
        score = (
            pfz_score * 0.50
            + chlorophyll_score * 0.20
            + sst_score * 0.15
            + current_score * 0.15
        )
        return round(score, 3)

    @staticmethod
    def calculate_mission_score(
        fishing_opportunity: float,
        safety_score: float,
        fuel_score: float,
        confidence_score: float,
    ) -> float:
        """
        Calculates composite mission score (0.0 to 1.0)
        Weights:
        - Fishing Opportunity: 40%
        - Safety: 35%
        - Fuel / Distance Efficiency: 15%
        - Confidence / Data Quality: 10%
        """
        composite = (
            fishing_opportunity * 0.40
            + safety_score * 0.35
            + fuel_score * 0.15
            + (confidence_score / 100.0) * 0.10
        )
        return round(composite, 3)
