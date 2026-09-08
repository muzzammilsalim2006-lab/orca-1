import math

from app.utils.errors import LocationOutOfScopeError

# India bounding box (prototype assumption)
INDIA_BBOX = {"min_lat": 6.0, "max_lat": 37.5, "min_lon": 68.0, "max_lon": 97.5}


def is_in_india(latitude: float, longitude: float) -> bool:
    return (
        INDIA_BBOX["min_lat"] <= latitude <= INDIA_BBOX["max_lat"]
        and INDIA_BBOX["min_lon"] <= longitude <= INDIA_BBOX["max_lon"]
    )


def ensure_supported_location(latitude: float, longitude: float, restrict_to_india: bool = True) -> None:
    if restrict_to_india and not is_in_india(latitude, longitude):
        raise LocationOutOfScopeError(
            f"({latitude}, {longitude}) is outside the supported India region.",
            details={"supported_bbox": INDIA_BBOX},
        )


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))