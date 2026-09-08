from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_chat_english_query():
    payload = {
        "query": "I want to go fishing from Kochi tomorrow at 5 AM for 6 hours.",
    }
    response = client.post("/api/chat", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["conversation_id"] is not None
    assert data["mission_id"] is not None
    assert data["detected_language"] == "en"
    assert "reply" in data
    assert data["risk"] is not None
    assert "spatiotemporal_route" in data
    assert len(data["pfz_advisories"]) >= 1


def test_chat_hindi_query_with_session_memory():
    # Turn 1: Hindi mission planning
    payload_turn1 = {
        "query": "कोच्चि से सुबह 5 बजे मछली पकड़ने जाना है",
    }
    resp1 = client.post("/api/chat", json=payload_turn1)
    assert resp1.status_code == 200
    data1 = resp1.json()
    cid = data1["conversation_id"]
    assert data1["detected_language"] == "hi"
    assert "कोच्चि" in data1["reply"]

    # Turn 2: Follow-up query reusing conversation_id
    payload_turn2 = {
        "query": "सुरक्षा और मौसम कैसा है?",
        "conversation_id": cid,
    }
    resp2 = client.post("/api/chat", json=payload_turn2)
    assert resp2.status_code == 200
    data2 = resp2.json()
    assert data2["conversation_id"] == cid
    assert data2["detected_language"] == "hi"
