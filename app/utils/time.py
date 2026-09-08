"""Time manipulation and slicing utilities for hourly forecasts."""

from datetime import datetime, date, time
from typing import List, Tuple, Optional


def parse_date_str(date_str: str) -> date:
    """Parses YYYY-MM-DD or ISO string to date object."""
    try:
        return datetime.fromisoformat(date_str.replace("Z", "+00:00")).date()
    except Exception:
        return datetime.strptime(date_str[:10], "%Y-%m-%d").date()


def find_time_index(
    hourly_timestamps: List[str],
    target_date: str,
    target_time: Optional[str] = None,
) -> int:
    """
    Finds index in hourly time series closest to requested date and departure time.
    If target_time is None, defaults to current/midday (12:00) or first matching hour of target_date.
    If date is not found, falls back to 0.
    """
    if not hourly_timestamps:
        return 0

    target_hour_str = target_time if target_time else "08:00"
    if len(target_hour_str) == 5:
        target_iso_prefix = f"{target_date}T{target_hour_str}"
    else:
        target_iso_prefix = f"{target_date}T08:00"

    # Exact or closest prefix match
    best_idx = 0
    best_diff = float("inf")

    try:
        target_dt = datetime.fromisoformat(target_iso_prefix)
    except Exception:
        target_dt = datetime.now()

    for idx, ts in enumerate(hourly_timestamps):
        try:
            curr_dt = datetime.fromisoformat(ts)
            diff = abs((curr_dt - target_dt).total_seconds())
            if diff < best_diff:
                best_diff = diff
                best_idx = idx
        except Exception:
            continue

    return best_idx


def get_hourly_slice_indices(
    hourly_timestamps: List[str],
    target_date: str,
    departure_time: Optional[str] = None,
    duration_hours: Optional[float] = None,
) -> Tuple[int, int]:
    """Returns (start_idx, end_idx) for a mission duration window."""
    start_idx = find_time_index(hourly_timestamps, target_date, departure_time)
    hours = int(duration_hours or 6)
    end_idx = min(len(hourly_timestamps), start_idx + max(1, hours))
    return start_idx, end_idx
