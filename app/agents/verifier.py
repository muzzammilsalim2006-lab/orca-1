"""Verifier Agent: Independent safety validator with authority to reject mission plans."""

from typing import Any, Dict, List, Optional
from app.state.mission_state import MarineState


class VerifierAgent:
    @classmethod
    def verify(cls, state: MarineState, candidate: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Executes strict multi-factor verification checks.
        Returns validation status APPROVED or REJECTED with explicit reasons.
        """
        checks = []
        reasons = []

        cand = candidate or state.selected_route
        vessel_limits = state.vessel.get("limits", {})
        marine = state.marine
        weather = state.weather
        warnings = state.warnings

        # Check 1: Restricted zone intersection
        zone_conflicts = cand.get("zone_conflicts", []) if cand else []
        if zone_conflicts:
            reasons.append(f"Route intersects restricted zone: {zone_conflicts[0].get('zone_name')}")
            checks.append({
                "check_name": "RESTRICTED_ZONE_CLEARANCE",
                "passed": False,
                "details": f"Conflict with {zone_conflicts[0].get('zone_name')}",
            })
        else:
            checks.append({
                "check_name": "RESTRICTED_ZONE_CLEARANCE",
                "passed": True,
                "details": "No military, ecological or infrastructure polygon intersections detected.",
            })

        # Check 2: Severe warning bulletins
        warning_severity = (warnings.get("severity") or "NONE").upper()
        if warning_severity == "SEVERE" or warnings.get("status") == "SEVERE_ALERT":
            reasons.append("Official IMD severe maritime warning/cyclonic storm bulletin in effect")
            checks.append({
                "check_name": "OFFICIAL_WARNING_COMPLIANCE",
                "passed": False,
                "details": f"Active alert: {warnings.get('message', 'High Seas Advisory')}",
            })
        else:
            checks.append({
                "check_name": "OFFICIAL_WARNING_COMPLIANCE",
                "passed": True,
                "details": f"Advisory level {warning_severity} permits operation subject to standard precautions.",
            })

        # Check 3: Wave height vs vessel limit
        wave_height = marine.get("wave_height_m", 0.0) or 0.0
        max_safe_wave = vessel_limits.get("max_safe_wave_m", 2.5)
        if wave_height > max_safe_wave:
            reasons.append(f"Forecast wave height ({wave_height}m) exceeds vessel design limit ({max_safe_wave}m)")
            checks.append({
                "check_name": "VESSEL_WAVE_TOLERANCE",
                "passed": False,
                "details": f"Wave {wave_height}m > Limit {max_safe_wave}m",
            })
        else:
            checks.append({
                "check_name": "VESSEL_WAVE_TOLERANCE",
                "passed": True,
                "details": f"Wave {wave_height}m is within vessel tolerance ({max_safe_wave}m).",
            })

        # Check 4: Wind speed vs vessel limit
        wind_speed = weather.get("wind_speed_kmh", 0.0) or 0.0
        max_safe_wind = vessel_limits.get("max_safe_wind_kmh", 40.0)
        if wind_speed > max_safe_wind:
            reasons.append(f"Wind speed ({wind_speed} km/h) exceeds safe operating ceiling ({max_safe_wind} km/h)")
            checks.append({
                "check_name": "VESSEL_WIND_TOLERANCE",
                "passed": False,
                "details": f"Wind {wind_speed} km/h > Ceiling {max_safe_wind} km/h",
            })
        else:
            checks.append({
                "check_name": "VESSEL_WIND_TOLERANCE",
                "passed": True,
                "details": f"Wind {wind_speed} km/h is within safe operating ceiling ({max_safe_wind} km/h).",
            })

        # Check 5: Range and fuel budget
        dist_km = cand.get("distance_km", 0.0) if cand else 0.0
        fuel_needed = cand.get("estimated_fuel_liters", dist_km * 0.75) if cand else 0.0
        fuel_budget = vessel_limits.get("fuel_budget_l", 32.0)
        max_range = vessel_limits.get("max_operational_range_km", 40.0)

        if dist_km > max_range or fuel_needed > fuel_budget:
            reasons.append(f"Distance ({dist_km} km) or fuel ({fuel_needed} L) exceeds vessel budget ({fuel_budget} L)")
            checks.append({
                "check_name": "FUEL_AND_RANGE_FEASIBILITY",
                "passed": False,
                "details": f"Distance {dist_km} km (Max {max_range} km), Fuel {fuel_needed} L (Budget {fuel_budget} L)",
            })
        else:
            checks.append({
                "check_name": "FUEL_AND_RANGE_FEASIBILITY",
                "passed": True,
                "details": f"Distance {dist_km} km and fuel {fuel_needed} L conform to safety reserves.",
            })

        status = "REJECTED" if reasons else "APPROVED"

        return {
            "status": status,
            "checks": checks,
            "reasons": reasons,
            "candidate_id": cand.get("id") if cand else None,
        }
