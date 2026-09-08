from typing import Any, Dict, Optional
import copy

from app.engines.routing import RoutingEngine
from app.engines.risk import RiskEngine


class ScenarioEngine:
    """
    Parametric Scenario & What-If Engine.
    Executes counterfactual evaluations without re-querying external APIs:
    - Departure time shifts
    - Wave surge multipliers
    - Wind gust multipliers
    - Fuel constraints
    - Multi-objective weight recalibration
    """

    @classmethod
    def evaluate_scenario(
        cls,
        base_state_dict: Dict[str, Any],
        departure_time_shift: Optional[str] = None,
        wave_multiplier: float = 1.0,
        wind_multiplier: float = 1.0,
        safety_weight: float = 0.45,
        fishing_weight: float = 0.35,
        fuel_weight: float = 0.20,
    ) -> Dict[str, Any]:
        """Runs comparative scenario simulation and returns baseline vs scenario diff."""
        scenario_marine = copy.deepcopy(base_state_dict.get("marine", {}))
        scenario_weather = copy.deepcopy(base_state_dict.get("weather", {}))
        scenario_warnings = copy.deepcopy(base_state_dict.get("warnings", {}))
        origin = base_state_dict.get("location", {"latitude": 9.9312, "longitude": 76.2673})

        # Apply multipliers
        base_wave = float(scenario_marine.get("wave_height_m", 1.2))
        scenario_wave = round(base_wave * wave_multiplier, 2)
        scenario_marine["wave_height_m"] = scenario_wave

        base_wind = float(scenario_weather.get("wind_speed_kmh", 18.0))
        scenario_wind = round(base_wind * wind_multiplier, 1)
        scenario_weather["wind_speed_kmh"] = scenario_wind

        # Re-calculate risk
        base_risk = base_state_dict.get("risk", {"score": 25.0, "level": "LOW"})
        new_risk = RiskEngine.calculate_risk(
            marine=scenario_marine,
            weather=scenario_weather,
            warnings=scenario_warnings,
        )

        # Re-calculate Pareto routes
        dep_time = departure_time_shift or base_state_dict.get("mission", {}).get("departure_time", "05:00")
        weights = {"safety": safety_weight, "fishing_opportunity": fishing_weight, "fuel": fuel_weight}
        pareto = RoutingEngine.generate_pareto_routes(
            origin_lat=origin.get("latitude", 9.9312),
            origin_lon=origin.get("longitude", 76.2673),
            departure_time_str=dep_time,
            objective_weights=weights
        )

        risk_delta = round(new_risk["score"] - base_risk.get("score", 0), 1)

        return {
            "parameters": {
                "departure_time": dep_time,
                "wave_multiplier": wave_multiplier,
                "wind_multiplier": wind_multiplier,
                "objective_weights": weights
            },
            "baseline": {
                "wave_height_m": base_wave,
                "wind_speed_kmh": base_wind,
                "risk_score": base_risk.get("score", 0),
                "risk_level": base_risk.get("level", "LOW")
            },
            "scenario": {
                "wave_height_m": scenario_wave,
                "wind_speed_kmh": scenario_wind,
                "risk_score": new_risk["score"],
                "risk_level": new_risk["level"]
            },
            "delta": {
                "risk_score_delta": risk_delta,
                "wave_height_delta_m": round(scenario_wave - base_wave, 2),
                "wind_speed_delta_kmh": round(scenario_wind - base_wind, 1),
                "status_shift": "ESCALATED" if risk_delta > 15.0 else ("REDUCED" if risk_delta < -15.0 else "NOMINAL")
            },
            "pareto_routes": pareto
        }
