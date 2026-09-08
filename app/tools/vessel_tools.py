"""Vessel engineering tools and operational limit models."""

from typing import Any, Dict


class VesselTools:
    @staticmethod
    def evaluate_vessel_limits(
        vessel_length_m: float = 5.0,
        fuel_capacity_l: float = 40.0,
        cruising_speed_knots: float = 8.0,
    ) -> Dict[str, Any]:
        """
        Derives operational marine safety limits for small/medium craft.
        (Configured as operational prototype parameters).
        """
        # Baseline limits scaled to vessel LOA (Length Overall)
        if vessel_length_m <= 6.0:  # Traditional motorized country craft / small FRP boat
            max_range_km = 35.0
            max_safe_wave_m = 2.0
            max_safe_wind_kmh = 35.0
            fuel_reserve_ratio = 0.20
        elif vessel_length_m <= 12.0:  # Medium mechanized gillnetter / trawler
            max_range_km = 80.0
            max_safe_wave_m = 2.8
            max_safe_wind_kmh = 45.0
            fuel_reserve_ratio = 0.25
        else:  # Deep sea multi-day vessel
            max_range_km = 200.0
            max_safe_wave_m = 3.5
            max_safe_wind_kmh = 55.0
            fuel_reserve_ratio = 0.30

        fuel_budget = fuel_capacity_l * (1.0 - fuel_reserve_ratio)

        return {
            "vessel_class": "Small Coastal Craft" if vessel_length_m <= 6.0 else "Mechanized Craft",
            "max_operational_range_km": max_range_km,
            "max_safe_wave_m": max_safe_wave_m,
            "max_safe_wind_kmh": max_safe_wind_kmh,
            "fuel_budget_l": round(fuel_budget, 1),
            "cruising_speed_knots": cruising_speed_knots,
        }
