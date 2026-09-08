def test_root(client):
    response = client.get("/")
    assert response.status_code == 200
    assert "ORCA" in response.json()["message"]


def test_health(client):
    body = client.get("/health").json()
    assert body["status"] == "ok"
    assert "uptime_seconds" in body


def test_assess_demo_chennai_is_moderate(client):
    response = client.post("/api/assess", json={"latitude": 13.0827, "longitude": 80.2707})
    assert response.status_code == 200
    body = response.json()
    assert body["mode"] == "demo"
    assert body["weather"] is not None and body["ocean"] is not None
    assert body["risk"]["level"] == "MODERATE"
    assert len(body["risk"]["factors"]) == 5
    assert body["explanation"]["provider"] == "template"


def test_assess_demo_kochi_warning_override(client):
    body = client.post("/api/assess", json={"latitude": 9.9312, "longitude": 76.2673}).json()
    assert body["risk"]["level"] == "HIGH"
    assert body["risk"]["warning_override"] is True
    assert body["risk"]["score"] >= 85


def test_assess_response_headers(client):
    response = client.post("/api/assess", json={"latitude": 13.08, "longitude": 80.27})
    assert response.headers["X-Request-ID"]
    assert "X-Process-Time-Ms" in response.headers


def test_meta(client):
    body = client.get("/api/meta").json()
    assert body["factor_thresholds"]["wave_height"]["high"] == 3.5
    assert {"chennai", "kochi"} <= {loc["label"].lower() for loc in body["demo_locations"]}