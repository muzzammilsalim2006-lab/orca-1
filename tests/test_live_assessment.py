from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_assess_endpoint_live():
    # Live call to Open-Meteo marine & weather with fallback guarantee
    payload = {
        "location_name": "Kochi",
        "latitude": 9.9312,
        "longitude": 76.2673,
        "date": "2026-09-09",
        "activity": "fishing",
        "departure_time": "05:00",
        "duration_hours": 6.0,
        "vessel_length_m": 8.0,
    }
    response = client.post("/api/assess", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["location"]["name"] == "Kochi"
    assert "risk" in data
    assert "score" in data["risk"]
    assert "confidence" in data
    assert "verification" in data
    assert "explanation" in data
    assert len(data["evidence"]) >= 4
