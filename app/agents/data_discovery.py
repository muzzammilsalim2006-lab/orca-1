"""Data Discovery Agent: Determines which environmental datasets are necessary for mission objectives."""

from typing import Any, Dict, List
from app.schemas.mission import MissionSpec


class DataDiscoveryAgent:
    DATASET_CATALOG = {
        "FISHING": [
            {"dataset": "wave", "frequency": "hourly", "source": "Open-Meteo / INCOIS"},
            {"dataset": "wind", "frequency": "hourly", "source": "Open-Meteo / IMD"},
            {"dataset": "current", "frequency": "hourly", "source": "Open-Meteo / INCOIS"},
            {"dataset": "SST", "frequency": "daily", "source": "Open-Meteo / MOSDAC"},
            {"dataset": "PFZ", "frequency": "daily", "source": "INCOIS Operational Advisory"},
            {"dataset": "warnings", "frequency": "realtime", "source": "IMD Fishermen Bulletins"},
            {"dataset": "boundaries", "frequency": "static", "source": "Indian Maritime Zones"},
        ],
        "PATROLLING": [
            {"dataset": "wave", "frequency": "hourly", "source": "Open-Meteo"},
            {"dataset": "wind", "frequency": "hourly", "source": "Open-Meteo"},
            {"dataset": "current", "frequency": "hourly", "source": "Open-Meteo"},
            {"dataset": "warnings", "frequency": "realtime", "source": "IMD"},
            {"dataset": "boundaries", "frequency": "static", "source": "Indian Maritime Zones"},
        ],
    }

    @classmethod
    def discover_required_datasets(cls, mission: MissionSpec) -> Dict[str, Any]:
        mission_type = mission.mission_type.upper()
        catalog = cls.DATASET_CATALOG.get(mission_type, cls.DATASET_CATALOG["FISHING"])

        required_names = [item["dataset"] for item in catalog]

        return {
            "mission_type": mission_type,
            "required_datasets": required_names,
            "catalog": catalog,
            "resolution_status": "READY_FOR_ACQUISITION",
        }
