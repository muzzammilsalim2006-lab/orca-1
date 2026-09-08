from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_monitor_nominal_conditions():
    payload = {
        "current_wave_height_m": 0.8,
        "current_wind_speed_kmh": 14.0,
    }
    response = client.post("/api/mission/monitor", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "MONITORING_NOMINAL"
    assert data["action_required"] is False
    assert data["replan_recommended"] is False


def test_monitor_hazard_alert_wave_surge():
    payload = {
        "current_wave_height_m": 3.8,  # Exceeds 2.0m small craft limit
        "current_wind_speed_kmh": 45.0,
        "incoming_warning_severity": "SEVERE",
    }
    response = client.post("/api/mission/monitor", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ALERT_TRIGGERED"
    assert data["action_required"] is True
    assert data["replan_recommended"] is True
    assert data["alerts_count"] >= 2
