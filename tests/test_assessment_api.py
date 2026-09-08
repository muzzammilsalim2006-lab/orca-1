from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_assess_endpoint_normal_demo():
    payload = {
        "location_name": "Kochi",
        "latitude": 9.9312,
        "longitude": 76.2673,
        "date": "2026-09-09",
        "activity": "fishing",
        "departure_time": "05:00",
        "duration_hours": 6.0,
        "vessel_length_m": 5.0,
        "demo_profile": "normal",
    }
    response = client.post("/api/assess", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["location"]["name"] == "Kochi"
    assert data["location"]["coastal_region"] == "Kerala Coast"
    assert data["risk"]["level"] == "LOW"
    assert data["verification"]["status"] == "APPROVED"
    assert len(data["evidence"]) >= 5
    assert len(data["candidate_routes"]) >= 1
    assert data["selected_candidate"] is not None
    assert "explanation" in data


def test_assess_endpoint_cyclone_demo():
    payload = {
        "location_name": "Kochi",
        "latitude": 9.9312,
        "longitude": 76.2673,
        "date": "2026-09-09",
        "activity": "fishing",
        "departure_time": "05:00",
        "duration_hours": 6.0,
        "vessel_length_m": 5.0,
        "demo_profile": "cyclone",
    }
    response = client.post("/api/assess", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["risk"]["level"] == "SEVERE"
    assert data["risk"]["score"] >= 95
    assert data["warnings"]["status"] == "SEVERE_ALERT"
    assert data["verification"]["status"] == "REJECTED"
    assert "MISSION REJECTED" in data["explanation"]
