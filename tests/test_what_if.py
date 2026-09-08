from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_what_if_wave_surge():
    payload = {
        "wave_delta_m": 1.5,
        "priority_mode": "safety_first",
    }
    response = client.post("/api/mission/what-if", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert "simulation" in data
    sim = data["simulation"]
    assert sim["risk_delta_score"] > 0
    assert len(sim["re_ranked_candidates"]) >= 1
    assert "impact_summary" in sim
    assert "safety_first" in sim["impact_summary"]


def test_what_if_catch_maximizer():
    payload = {
        "priority_mode": "catch_maximizer",
    }
    response = client.post("/api/mission/what-if", json=payload)
    assert response.status_code == 200
    data = response.json()

    sim = data["simulation"]
    assert sim["new_selected_candidate"] is not None
