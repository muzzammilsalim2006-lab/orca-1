from typing import Any, Dict, Optional
from app.state.mission_state import MarineState
from app.tools.marine_tools import MarineTools
from app.tools.pfz_tools import PFZTools
from app.tools.satellite_tools import SatelliteTools


class MarineAgent:
    def __init__(
        self,
        marine_tools: Optional[MarineTools] = None,
        pfz_tools: Optional[PFZTools] = None,
        satellite_tools: Optional[SatelliteTools] = None,
    ):
        self.marine_tools = marine_tools or MarineTools()
        self.pfz_tools = pfz_tools or PFZTools()
        self.satellite_tools = satellite_tools or SatelliteTools()

    async def execute(self, state: MarineState, demo_profile: Optional[str] = None) -> MarineState:
        """Executes marine intelligence gathering (sea state, INCOIS PFZ, MOSDAC satellite)."""
        lat = state.location.get("latitude", 9.9312)
        lon = state.location.get("longitude", 76.2673)
        region = state.location.get("coastal_region", "Kerala Coast")
        date_str = state.mission.get("date", "2026-09-09")
        departure_time = state.mission.get("departure_time", "05:00")
        duration = state.mission.get("duration_hours", 6.0)

        # 1. Sea State Conditions
        marine_conditions = await self.marine_tools.get_marine_conditions(
            latitude=lat,
            longitude=lon,
            date_str=date_str,
            departure_time=departure_time,
            duration_hours=duration,
            demo_profile=demo_profile,
        )
        state.marine = marine_conditions

        # 2. INCOIS PFZ Advisories
        pfz_advisories = await self.pfz_tools.get_pfz_advisories(
            coastal_region=region,
            origin_lat=lat,
            origin_lon=lon,
        )
        state.pfz_advisories = pfz_advisories

        # 3. MOSDAC Satellite Ocean Color & Thermal Gradients
        sat_data = await self.satellite_tools.get_ocean_features(lat, lon)
        state.satellite_data = sat_data

        # Add evidence
        if marine_conditions.get("wave_height_m") is not None:
            state.add_evidence(
                source=marine_conditions.get("source", "Marine Provider"),
                dataset="significant_wave_height",
                value=marine_conditions["wave_height_m"],
                location={"lat": lat, "lon": lon},
                unit="m",
            )

        if marine_conditions.get("sea_surface_temperature_c") is not None:
            state.add_evidence(
                source=marine_conditions.get("source", "Marine Provider"),
                dataset="sea_surface_temperature",
                value=marine_conditions["sea_surface_temperature_c"],
                location={"lat": lat, "lon": lon},
                unit="degC",
            )

        if marine_conditions.get("ocean_current_velocity_ms") is not None:
            state.add_evidence(
                source=marine_conditions.get("source", "Marine Provider"),
                dataset="ocean_surface_current",
                value=marine_conditions["ocean_current_velocity_ms"],
                location={"lat": lat, "lon": lon},
                unit="m/s",
            )

        if pfz_advisories:
            state.add_evidence(
                source="INCOIS",
                dataset="potential_fishing_zone_advisory",
                value=pfz_advisories[0]["name"],
                location={"lat": pfz_advisories[0]["latitude"], "lon": pfz_advisories[0]["longitude"]},
                unit=f"{pfz_advisories[0]['distance_km']} km {pfz_advisories[0].get('bearing_compass', '')}",
                quality_status="OFFICIAL_PFZ",
            )

        state.add_audit_event(
            "MARINE_AGENT_COMPLETED",
            f"Retrieved wave {marine_conditions.get('wave_height_m')}m, {len(pfz_advisories)} INCOIS PFZ advisories, satellite chlorophyll {sat_data.get('chlorophyll_a_mg_m3')} mg/m3",
            {"source": marine_conditions.get("source"), "pfz_sectors": len(pfz_advisories)},
        )

        return state
