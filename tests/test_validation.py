def test_latitude_out_of_range(client):
    response = client.post("/api/assess", json={"latitude": 123.0, "longitude": 80.0})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"


def test_location_outside_india_rejected(client):
    response = client.post("/api/assess",
                           json={"latitude": 51.5074, "longitude": -0.1278, "demo": False})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "location_out_of_scope"


def test_missing_longitude(client):
    response = client.post("/api/assess", json={"latitude": 13.08})
    assert response.status_code == 422