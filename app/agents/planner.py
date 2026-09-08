import re
from datetime import datetime, date
from typing import Any, Dict, Optional, Tuple
from app.schemas.requests import AssessmentRequest
from app.schemas.mission import MissionSpec, VesselSpec
from app.services.location_service import INDIAN_COASTAL_PORTS, LocationService
from app.services.translation_service import TranslationService


class PlannerAgent:
    @classmethod
    def parse_natural_language(cls, query: str, target_date: Optional[str] = None) -> AssessmentRequest:
        """
        Translates unstructured natural language into a canonical AssessmentRequest.
        Supports English and major Indic languages (Hindi, Malayalam, Tamil, Marathi).
        """
        lang = TranslationService.detect_language(query)
        q_lower = query.lower()

        # 1. Resolve Location
        port_name = TranslationService.canonicalize_port(query)
        if not port_name:
            # Fallback scan over registered port names
            for port in INDIAN_COASTAL_PORTS.keys():
                if port.lower() in q_lower:
                    port_name = port
                    break
        port_name = port_name or "Kochi"

        port_meta = INDIAN_COASTAL_PORTS.get(port_name, INDIAN_COASTAL_PORTS["Kochi"])
        lat = port_meta["latitude"]
        lon = port_meta["longitude"]

        # 2. Resolve Departure Time (e.g. 5 am, 05:00, 6:30, 8 am, 5 बजे, 5 മണിക്ക്)
        dep_time = "05:00"
        time_match = re.search(r"(\d{1,2})(?::(\d{2}))?\s*(am|pm|बजे|മണിക്ക്|மணி)?", q_lower)
        if time_match:
            hr = int(time_match.group(1))
            mn = int(time_match.group(2) or 0)
            meridiem = (time_match.group(3) or "").strip()
            if meridiem == "pm" and hr < 12:
                hr += 12
            elif meridiem == "am" and hr == 12:
                hr = 0
            dep_time = f"{hr:02d}:{mn:02d}"

        # 3. Resolve Duration (e.g. 6 hours, 8 hrs, 4 घंटे)
        duration = 6.0
        dur_match = re.search(r"(\d+)\s*(?:hours|hrs|घंटे|മണിക്കൂർ|மணிநேரம்)", q_lower)
        if dur_match:
            duration = float(dur_match.group(1))

        # 4. Resolve Vessel Length (e.g. 5m, 10 meter, 8m boat)
        vessel_len = 5.0
        vessel_match = re.search(r"(\d+(?:\.\d+)?)\s*(?:m|meter|meters|मीटर)", q_lower)
        if vessel_match:
            vessel_len = float(vessel_match.group(1))

        # 5. Resolve Activity (fishing, patrolling, transport)
        activity = "fishing"
        if any(w in q_lower for w in ["patrol", "surveillance", "सुरक्षा", "गश्त"]):
            activity = "patrolling"
        elif any(w in q_lower for w in ["cargo", "transport", "परिवहन"]):
            activity = "transport"

        # Target date
        d_str = target_date or datetime.now().date().isoformat()

        return AssessmentRequest(
            location_name=port_name,
            latitude=lat,
            longitude=lon,
            date=d_str,
            activity=activity,
            departure_time=dep_time,
            duration_hours=duration,
            vessel_length_m=vessel_len,
        )

    @staticmethod
    def plan(request: AssessmentRequest) -> MissionSpec:
        """Converts incoming request into a structured MissionSpec."""
        start_time = request.departure_time or "05:00"
        duration = request.duration_hours or 6.0

        # Calculate end hour
        try:
            start_h = int(start_time.split(":")[0])
            end_h = (start_h + int(duration)) % 24
            end_time = f"{end_h:02d}:00"
        except Exception:
            end_time = "11:00"

        vessel = VesselSpec(
            vessel_id=request.vessel_id or "demo-vessel-01",
            length_m=request.vessel_length_m or 5.0,
        )

        return MissionSpec(
            mission_type=request.activity.upper(),
            origin={"lat": request.latitude, "lon": request.longitude},
            time_window={"start": start_time, "end": end_time},
            duration_hours=duration,
            objectives=["safety", "fishing_opportunity", "fuel_efficiency"],
            constraints=["vessel_range", "restricted_zones", "weather_limits", "coastal_warnings"],
            vessel=vessel,
        )

    @staticmethod
    def replan(mission: MissionSpec, failed_reasons: list, attempt: int) -> MissionSpec:
        """
        Generates modified constraints or adjusted route priorities based on rejection reasons.
        For example: tighter range constraint or switching destination zone strategy.
        """
        # Create a copy with adjusted constraints
        updated_constraints = list(mission.constraints)
        if "avoid_zone_conflict" not in updated_constraints:
            updated_constraints.append("avoid_zone_conflict")

        mission.constraints = updated_constraints
        return mission
