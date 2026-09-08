"""ORCA Master Orchestrator: Executes multi-agent coordination, scientific engines, and replanning loops."""

import asyncio
import uuid
from typing import Any, Dict, List, Optional

from app.agents.planner import PlannerAgent
from app.agents.data_discovery import DataDiscoveryAgent
from app.agents.marine import MarineAgent
from app.agents.weather import WeatherAgent
from app.agents.geospatial import GeospatialAgent
from app.agents.vessel import VesselAgent
from app.agents.decision import DecisionAgent
from app.agents.verifier import VerifierAgent
from app.agents.explanation import ExplanationAgent
from app.engines.risk import RiskEngine
from app.engines.uncertainty import UncertaintyEngine
from app.schemas.requests import AssessmentRequest
from app.services.data_quality_service import DataQualityService
from app.services.location_service import LocationService
from app.services.session_service import session_service
from app.services.translation_service import TranslationService
from app.state.mission_state import MarineState
from app.utils.logging import log_event


class OrcaOrchestrator:
    def __init__(self):
        self.planner = PlannerAgent()
        self.data_discovery = DataDiscoveryAgent()
        self.marine_agent = MarineAgent()
        self.weather_agent = WeatherAgent()
        self.geo_agent = GeospatialAgent()
        self.vessel_agent = VesselAgent()
        self.decision_agent = DecisionAgent()
        self.verifier = VerifierAgent()
        self.explanation_agent = ExplanationAgent()

    async def run_assessment(
        self,
        request: AssessmentRequest,
        conversation_id: Optional[str] = None,
        raw_query: Optional[str] = None,
        preferred_lang: Optional[str] = None,
    ) -> MarineState:
        """
        Executes full deterministic and agentic pipeline:
        Plan -> Discover -> Marine & Weather Ingestion -> Spatial & Limits -> Risk -> Decision <-> Verifier Loop -> Explain -> Localize -> Cache
        """
        log_event("ORCHESTRATOR_STARTED", {"lat": request.latitude, "lon": request.longitude, "activity": request.activity})

        conv_id = conversation_id or str(uuid.uuid4())
        mission_id = f"MSN-{uuid.uuid4().hex[:8].upper()}"
        detected_lang = preferred_lang or (TranslationService.detect_language(raw_query) if raw_query else "en")

        # Resolve location metadata
        loc_name = LocationService.resolve_location_name(request.location_name, request.latitude, request.longitude)
        region = LocationService.resolve_region(loc_name, request.latitude, request.longitude)

        # 1. Plan
        mission_spec = self.planner.plan(request)
        state = MarineState(
            conversation_id=conv_id,
            mission_id=mission_id,
            query=raw_query,
            language=detected_lang,
            location={
                "name": loc_name,
                "latitude": request.latitude,
                "longitude": request.longitude,
                "coastal_region": region,
            },
            mission={
                "date": request.date,
                "departure_time": request.departure_time or "05:00",
                "duration_hours": request.duration_hours or 6.0,
                "activity": request.activity,
                "vessel": {
                    "vessel_id": request.vessel_id or "demo-vessel-01",
                    "length_m": request.vessel_length_m or 5.0,
                },
            },
        )
        state.add_audit_event("PLANNER_STARTED", "Formulated baseline MissionSpec", {"vessel_length_m": request.vessel_length_m})

        # 2. Data Discovery
        discovery_manifest = self.data_discovery.discover_required_datasets(mission_spec)
        state.add_audit_event("DATA_DISCOVERY_COMPLETED", f"Required datasets: {', '.join(discovery_manifest['required_datasets'])}")

        # 3. Concurrent Environmental Data Acquisition (Marine/PFZ/MOSDAC & Weather/Warnings)
        demo_profile = request.demo_profile
        await asyncio.gather(
            self.marine_agent.execute(state, demo_profile=demo_profile),
            self.weather_agent.execute(state, demo_profile=demo_profile),
        )

        # 4. Domain Modeling (Geospatial & Vessel Constraints)
        self.geo_agent.execute(state)
        self.vessel_agent.execute(state)

        # 5. Scientific Engines: Risk, Data Quality, Confidence
        risk_result = RiskEngine.calculate_risk(
            marine=state.marine,
            weather=state.weather,
            warnings=state.warnings,
        )
        state.risk = risk_result

        quality_status, missing_ratio = DataQualityService.evaluate_quality(
            state.marine, state.weather, state.warnings
        )
        conf_result = UncertaintyEngine.calculate_confidence(
            source_count=2,
            missing_ratio=missing_ratio,
            stale=False,
            disagreement=0.0,
            mode=state.marine.get("mode", "live"),
        )
        state.confidence = conf_result
        state.add_audit_event("RISK_CALCULATED", f"Risk score: {risk_result['score']} ({risk_result['level']}), Quality: {quality_status}")

        # 6. Agentic Re-planning Loop (Up to 3 iterations)
        excluded_zones: List[str] = []
        max_attempts = 3
        approved = False

        for attempt in range(1, max_attempts + 1):
            # Propose candidate
            self.decision_agent.execute(state, exclude_zone_ids=excluded_zones)

            if not state.selected_route:
                break

            # Verifier check
            verification = self.verifier.verify(state, candidate=state.selected_route)

            if verification["status"] == "APPROVED":
                state.verification = verification
                state.verification["replan_count"] = attempt - 1
                approved = True
                state.add_audit_event("VERIFIER_APPROVED", f"Candidate {state.selected_route['id']} passed all safety checks on attempt {attempt}")
                break
            else:
                # Verifier REJECTED -> Trigger Re-plan
                rejected_id = state.selected_route["id"]
                excluded_zones.append(rejected_id)
                state.replan_history.append({
                    "attempt": attempt,
                    "rejected_candidate_id": rejected_id,
                    "reasons": verification["reasons"],
                })
                state.add_audit_event(
                    "VERIFIER_REJECTED_ROUTE",
                    f"Candidate {rejected_id} rejected on attempt {attempt}: {'; '.join(verification['reasons'])}",
                )
                mission_spec = self.planner.replan(mission_spec, verification["reasons"], attempt)

        if not approved:
            final_verification = self.verifier.verify(state, candidate=state.selected_route)
            state.verification = final_verification
            state.verification["replan_count"] = len(state.replan_history)

        # Attach spatiotemporal route from chosen candidate
        if state.selected_route and "spatiotemporal_profile" in state.selected_route:
            state.spatiotemporal_route = state.selected_route["spatiotemporal_profile"]

        # 7. Explanation Agent & Multilingual Localization
        explanation = self.explanation_agent.generate_explanation(state)
        state.explanation = explanation

        # Localize explanation if Indic language requested/detected
        sel_name = state.selected_route.get("name", "Sea Sector") if state.selected_route else "Restricted Sector"
        state.localized_explanation = TranslationService.localize_explanation(
            english_explanation=explanation,
            target_lang=detected_lang,
            risk_level=state.risk.get("level", "MODERATE"),
            location_name=loc_name,
            selected_zone=sel_name,
        )

        state.add_audit_event("EXPLANATION_GENERATED", f"Synthesized explanation in {detected_lang}.")

        # 8. Persist in conversational memory
        session_service.save_state(conv_id, state)

        return state
