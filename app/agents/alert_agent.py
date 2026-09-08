"""Alert Agent: Continuous proactive monitoring of active voyages against environmental drift."""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from app.engines.risk import RiskEngine
from app.state.mission_state import MarineState


class AlertAgent:
    @classmethod
    def audit_active_mission(
        cls,
        active_state: MarineState,
        latest_wave_m: Optional[float] = None,
        latest_wind_kmh: Optional[float] = None,
        latest_warning: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Re-assesses an ongoing or planned voyage against newly arrived observations or bulletins.
        Triggers pro-active alert and re-planning flag if conditions cross threshold.
        """
        alerts = []
        action_required = False
        replan_recommended = False

        vessel_limits = active_state.vessel.get("limits", {})
        max_safe_wave = vessel_limits.get("max_safe_wave_m", 2.0)
        max_safe_wind = vessel_limits.get("max_safe_wind_kmh", 35.0)

        curr_wave = latest_wave_m if latest_wave_m is not None else active_state.marine.get("wave_height_m", 1.0)
        curr_wind = latest_wind_kmh if latest_wind_kmh is not None else active_state.weather.get("wind_speed_kmh", 15.0)
        curr_warning = latest_warning or active_state.warnings

        # Check 1: Wave surge
        if curr_wave > max_safe_wave:
            alerts.append({
                "severity": "CRITICAL",
                "hazard": "WAVE_HEIGHT_EXCEEDED",
                "message": f"Observed/forecast wave height ({curr_wave}m) exceeds craft limit ({max_safe_wave}m).",
                "action": "Immediate return to port or seek nearest sheltered landing center.",
            })
            action_required = True
            replan_recommended = True
        elif curr_wave >= max_safe_wave * 0.85:
            alerts.append({
                "severity": "ADVISORY",
                "hazard": "APPROACHING_WAVE_CEILING",
                "message": f"Wave height approaching safety threshold ({curr_wave}m / {max_safe_wave}m).",
                "action": "Reduce cruising throttle and prepare life jackets.",
            })

        # Check 2: Squall / Wind surge
        if curr_wind > max_safe_wind:
            alerts.append({
                "severity": "WARNING",
                "hazard": "SQUALL_ALERT",
                "message": f"Wind gust/speed ({curr_wind} km/h) exceeds safe operating ceiling ({max_safe_wind} km/h).",
                "action": "Discontinue open-deck gear hauling and head towards coast.",
            })
            action_required = True
            replan_recommended = True

        # Check 3: Official Warning Bulletin update
        w_sev = (curr_warning.get("severity") or "NONE").upper()
        if w_sev in ["HIGH", "SEVERE"] or curr_warning.get("status") == "SEVERE_ALERT":
            alerts.append({
                "severity": "CRITICAL",
                "hazard": "OFFICIAL_IMD_CYCLONIC_WARNING",
                "message": curr_warning.get("message", "Port and Fishermen Warning Issued by IMD."),
                "action": "Total suspension of operations. Abort mission.",
            })
            action_required = True
            replan_recommended = True

        # Recalculate Risk under updated conditions
        updated_marine = active_state.marine.copy()
        updated_marine["wave_height_m"] = curr_wave
        updated_weather = active_state.weather.copy()
        updated_weather["wind_speed_kmh"] = curr_wind

        new_risk = RiskEngine.calculate_risk(
            marine=updated_marine,
            weather=updated_weather,
            warnings=curr_warning,
        )

        audit_result = {
            "mission_id": active_state.mission_id or "active-mission-01",
            "audited_at": datetime.now(timezone.utc).isoformat(),
            "action_required": action_required,
            "replan_recommended": replan_recommended,
            "alerts_count": len(alerts),
            "alerts": alerts,
            "initial_risk_score": active_state.risk.get("score"),
            "current_risk_score": new_risk["score"],
            "current_risk_level": new_risk["level"],
            "status": "ALERT_TRIGGERED" if action_required else "MONITORING_NOMINAL",
        }

        active_state.proactive_alerts = alerts
        return audit_result
