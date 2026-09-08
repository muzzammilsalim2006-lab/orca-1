import json
from pathlib import Path

from app.schemas import DemoLocation, OceanData
from app.utils.geo import haversine_km

DEMO_DIR = Path(__file__).resolve().parent.parent / "demo"
DEMO_LOCATIONS: dict[str, dict] = {
    "chennai": {"label": "Chennai", "latitude": 13.0827, "longitude": 80.2707},
    "kochi": {"label": "Kochi", "latitude": 9.9312, "longitude": 76.2673},
}


def list_demo_locations() -> list[DemoLocation]:
    return [DemoLocation(**v) for v in DEMO_LOCATIONS.values()]


def nearest_demo_key(latitude: float, longitude: float) -> str:
    return min(DEMO_LOCATIONS, key=lambda k: haversine_km(
        latitude, longitude, DEMO_LOCATIONS[k]["latitude"], DEMO_LOCATIONS[k]["longitude"]))


def load_demo(key: str) -> dict:
    return json.loads((DEMO_DIR / f"{key}.json").read_text(encoding="utf-8"))


def demo_ocean_fallback(latitude: float, longitude: float) -> OceanData | None:
    """Fallback/demo sample when live ocean data is unavailable (Day-2 task)."""
    try:
        raw = load_demo(nearest_demo_key(latitude, longitude)).get("ocean")
        if not raw:
            return None
        ocean = OceanData(**raw)
        ocean.source = ocean.source.model_copy(update={
            "data_status": "demo",
            "note": "Demo fallback used because live ocean data was unavailable."})
        return ocean
    except Exception:
        return None