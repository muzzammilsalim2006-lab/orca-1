from typing import Any, Callable, Dict, List, Optional
from pydantic import BaseModel, Field

from app.tools.marine_tools import MarineTools
from app.tools.weather_tools import WeatherTools
from app.tools.warning_tools import WarningTools
from app.tools.geo_tools import GeoTools
from app.tools.vessel_tools import VesselTools
from app.tools.pfz_tools import PFZTools
from app.tools.satellite_tools import SatelliteTools
from app.tools.routing_tools import RoutingTools
from app.tools.evidence_tools import EvidenceTools


class ToolMetadata(BaseModel):
    name: str
    category: str
    description: str
    parameters: Dict[str, Any] = Field(default_factory=dict)
    returns: str = "dict"


class ToolRegistry:
    """Central registry of executable tools accessible to ORCA agents."""

    def __init__(self):
        self._tools: Dict[str, Callable] = {}
        self._metadata: Dict[str, ToolMetadata] = {}
        self._register_default_tools()

    def register(self, name: str, category: str, description: str, func: Callable, parameters: Optional[Dict[str, Any]] = None):
        self._tools[name] = func
        self._metadata[name] = ToolMetadata(
            name=name,
            category=category,
            description=description,
            parameters=parameters or {}
        )

    def get_tool(self, name: str) -> Optional[Callable]:
        return self._tools.get(name)

    def get_metadata(self, name: str) -> Optional[ToolMetadata]:
        return self._metadata.get(name)

    def list_tools(self, category: Optional[str] = None) -> List[ToolMetadata]:
        if category:
            return [m for m in self._metadata.values() if m.category.lower() == category.lower()]
        return list(self._metadata.values())

    async def execute(self, name: str, **kwargs) -> Any:
        tool = self.get_tool(name)
        if not tool:
            raise ValueError(f"Tool '{name}' not found in registry")
        import inspect
        if inspect.iscoroutinefunction(tool):
            return await tool(**kwargs)
        return tool(**kwargs)

    def _register_default_tools(self):
        # Marine tools
        self.register(
            name="get_wave_forecast",
            category="marine",
            description="Retrieve hourly wave height, period, and direction forecast",
            func=MarineTools.get_wave_forecast,
            parameters={"lat": "float", "lon": "float", "days": "int"}
        )
        self.register(
            name="get_sst",
            category="marine",
            description="Retrieve sea surface temperature",
            func=MarineTools.get_sst,
            parameters={"lat": "float", "lon": "float"}
        )

        # Weather tools
        self.register(
            name="get_weather",
            category="weather",
            description="Retrieve surface wind speed, gusts, precipitation probability, and weather code",
            func=WeatherTools.get_surface_wind,
            parameters={"lat": "float", "lon": "float"}
        )

        # Warning tools
        self.register(
            name="get_warnings",
            category="warnings",
            description="Retrieve active coastal, cyclone, and fishermen warnings from IMD / INCOIS",
            func=WarningTools.get_coastal_warnings,
            parameters={"state_name": "str"}
        )

        # Geo tools
        self.register(
            name="check_boundary",
            category="geospatial",
            description="Check proximity to Indian EEZ and maritime boundaries",
            func=GeoTools.check_eez_proximity,
            parameters={"lat": "float", "lon": "float"}
        )
        self.register(
            name="check_mpa",
            category="geospatial",
            description="Verify if coordinates intersect with marine protected areas or naval restricted polygons",
            func=GeoTools.is_restricted_zone,
            parameters={"lat": "float", "lon": "float"}
        )
        self.register(
            name="calculate_distance",
            category="geospatial",
            description="Calculate exact nautical and km geodesic distance between two points",
            func=GeoTools.calculate_haversine_distance,
            parameters={"lat1": "float", "lon1": "float", "lat2": "float", "lon2": "float"}
        )

        # PFZ & Satellite tools
        self.register(
            name="get_pfz",
            category="fisheries",
            description="Retrieve INCOIS potential fishing zone advisories and sector coordinates",
            func=PFZTools.get_pfz_advisory,
            parameters={"region": "str"}
        )
        self.register(
            name="get_chlorophyll",
            category="satellite",
            description="Retrieve satellite chlorophyll-a concentration and anomaly features",
            func=SatelliteTools.get_ocean_color_features,
            parameters={"lat": "float", "lon": "float"}
        )

        # Vessel tools
        self.register(
            name="assess_vessel_limits",
            category="vessel",
            description="Assess wave, wind, and endurance operational limits for a vessel",
            func=VesselTools.assess_vessel_limits,
            parameters={"vessel_type": "str", "length_m": "float"}
        )

        # Routing tools
        self.register(
            name="calculate_fuel_burn",
            category="routing",
            description="Estimate fuel burn and travel time for a distance and engine spec",
            func=RoutingTools.calculate_fuel_burn,
            parameters={"distance_km": "float", "cruising_speed_knots": "float", "lph": "float"}
        )

        # Evidence tools
        self.register(
            name="create_evidence_item",
            category="evidence",
            description="Create structured provenance tracking item for ocean observation",
            func=EvidenceTools.create_evidence_item,
            parameters={"source_id": "str", "variable_name": "str", "observed_value": "Any", "unit": "str", "timestamp_iso": "str"}
        )


# Global singleton
registry = ToolRegistry()
