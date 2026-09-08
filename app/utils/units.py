"""Unit conversion utilities for marine and weather variables."""


def ms_to_kmh(ms: float | None) -> float | None:
    if ms is None:
        return None
    return round(ms * 3.6, 2)


def kmh_to_knots(kmh: float | None) -> float | None:
    if kmh is None:
        return None
    return round(kmh / 1.852, 2)


def ms_to_knots(ms: float | None) -> float | None:
    if ms is None:
        return None
    return round(ms * 1.94384, 2)


def knots_to_kmh(knots: float | None) -> float | None:
    if knots is None:
        return None
    return round(knots * 1.852, 2)


def nm_to_km(nautical_miles: float | None) -> float | None:
    if nautical_miles is None:
        return None
    return round(nautical_miles * 1.852, 2)


def km_to_nm(km: float | None) -> float | None:
    if km is None:
        return None
    return round(km / 1.852, 2)


def degrees_to_compass(deg: float | None) -> str | None:
    if deg is None:
        return None
    val = int((deg / 22.5) + 0.5)
    directions = [
        "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
        "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"
    ]
    return directions[val % 16]
