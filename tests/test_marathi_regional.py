import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.utils.geo import detect_regional_language

client = TestClient(app)


def test_detect_regional_language_geo():
    # Mumbai Coast
    assert detect_regional_language(18.9438, 72.8360, "Mumbai Harbor") == "mr"
    assert detect_regional_language(19.0760, 72.8777, "Mumbai Coast") == "mr"

    # Goa Coast
    assert detect_regional_language(15.4989, 73.8278, "Goa Coast") == "mr"
    assert detect_regional_language(15.2993, 73.9855, "Margao Goa") == "mr"

    # Other regions
    assert detect_regional_language(13.0827, 80.2707, "Chennai Coast") == "en"
    assert detect_regional_language(9.9312, 76.2673, "Kochi Port") == "en"
    assert detect_regional_language(17.6868, 83.2185, "Visakhapatnam") == "en"


def test_assess_mumbai_auto_marathi():
    payload = {
        "latitude": 18.9438,
        "longitude": 72.8360,
        "label": "Mumbai Harbor",
        "language": "auto",
        "demo": True,
    }
    response = client.post("/api/assess", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["explanation"] is not None
    assert data["explanation"]["language"] == "mr"
    # Verify Devanagari text in explanation
    assert any(ord(char) >= 0x0900 and ord(char) <= 0x097F for char in data["explanation"]["text"])


def test_assess_goa_auto_marathi():
    payload = {
        "latitude": 15.4989,
        "longitude": 73.8278,
        "label": "Goa Coast (Panaji)",
        "language": "auto",
        "demo": True,
    }
    response = client.post("/api/assess", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["explanation"] is not None
    assert data["explanation"]["language"] == "mr"
    assert any(ord(char) >= 0x0900 and ord(char) <= 0x097F for char in data["explanation"]["text"])


def test_assess_chennai_auto_english():
    payload = {
        "latitude": 13.0827,
        "longitude": 80.2707,
        "label": "Chennai Coast",
        "language": "auto",
        "demo": True,
    }
    response = client.post("/api/assess", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["explanation"] is not None
    assert data["explanation"]["language"] == "en"


def test_assess_manual_language_override():
    # Force Marathi for Chennai
    payload_mr = {
        "latitude": 13.0827,
        "longitude": 80.2707,
        "label": "Chennai Coast",
        "language": "mr",
        "demo": True,
    }
    resp_mr = client.post("/api/assess", json=payload_mr)
    assert resp_mr.status_code == 200
    data_mr = resp_mr.json()
    assert data_mr["explanation"]["language"] == "mr"

    # Force English for Mumbai
    payload_en = {
        "latitude": 18.9438,
        "longitude": 72.8360,
        "label": "Mumbai Harbor",
        "language": "en",
        "demo": True,
    }
    resp_en = client.post("/api/assess", json=payload_en)
    assert resp_en.status_code == 200
    data_en = resp_en.json()
    assert data_en["explanation"]["language"] == "en"
    # Ensure risk score is unchanged between language switches
    assert data_mr["risk"]["score"] == data_mr["risk"]["score"]
