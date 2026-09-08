from typing import List, Tuple
from datetime import datetime
from app.mission.mission_graph import MissionDefinition


class MissionValidationError(ValueError):
    pass


class MissionValidator:
    """Validates structural and physical constraints of a MissionDefinition."""

    @staticmethod
    def validate(mission: MissionDefinition) -> Tuple[bool, List[str]]:
        errors: List[str] = []

        # 1. Coordinate check
        if not (-90.0 <= mission.origin.lat <= 90.0):
            errors.append(f"Invalid origin latitude: {mission.origin.lat}")
        if not (-180.0 <= mission.origin.lon <= 180.0):
            errors.append(f"Invalid origin longitude: {mission.origin.lon}")

        # 2. Duration check
        if mission.duration_hours <= 0:
            errors.append("Mission duration must be strictly positive (> 0 hours)")
        elif mission.duration_hours > 72:
            errors.append("Single-leg mission duration cannot exceed 72 hours without designated offshore support")

        # 3. Vessel check
        if mission.vessel.length_m < 1.0:
            errors.append(f"Vessel length ({mission.vessel.length_m}m) must be at least 1.0m")
        if mission.vessel.cruising_speed_knots <= 0:
            errors.append("Vessel cruising speed must be positive")

        # 4. Departure timestamp check
        try:
            # Check ISO format
            datetime.fromisoformat(mission.departure.replace("Z", "+00:00"))
        except Exception:
            errors.append(f"Invalid ISO-8601 departure timestamp: {mission.departure}")

        # 5. Objectives normalization check
        weights_sum = (
            mission.objectives.safety
            + mission.objectives.fishing_opportunity
            + mission.objectives.fuel
        )
        if abs(weights_sum - 1.0) > 0.05:
            errors.append(f"Mission objective weights must sum to 1.0 (currently {weights_sum:.2f})")

        return len(errors) == 0, errors

    @classmethod
    def enforce(cls, mission: MissionDefinition) -> None:
        valid, errors = cls.validate(mission)
        if not valid:
            raise MissionValidationError(f"Mission validation failed: {'; '.join(errors)}")
