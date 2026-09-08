import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.providers.marine.pfz_incois import INCOISPFZProvider
from app.providers.marine.mosdac import MOSDACSatelliteProvider

client = TestClient(app)


@pytest.mark.asyncio
async def test_incois_pfz_provider():
    provider = INCOISPFZProvider()
    advisories = await provider.fetch_advisories("Kerala Coast", 9.9312, 76.2673)
    assert len(advisories) >= 1
    sec = advisories[0]
    assert "bearing_deg" in sec
    assert "distance_km" in sec
    assert sec["opportunity_index"] >= 0.8
    assert "target_species" in sec


@pytest.mark.asyncio
async def test_mosdac_satellite_provider():
    provider = MOSDACSatelliteProvider()
    data = await provider.fetch_ocean_features(9.9312, 76.2673)
    assert data["chlorophyll_a_mg_m3"] > 0
    assert data["sst_thermal_gradient_c_km"] > 0
    assert data["quality_flag"] == "QC_PASSED_HIGH_CONFIDENCE"


def test_pfz_endpoint():
    response = client.get("/api/pfz?port_name=Kochi")
    assert response.status_code == 200
    data = response.json()
    assert data["port"] == "Kochi"
    assert data["pfz_sectors_count"] >= 1
    assert len(data["advisories"]) >= 1
