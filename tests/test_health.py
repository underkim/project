from fastapi.testclient import TestClient

def test_health_returns_200(client: TestClient) -> None:
    response = client.get("/api/v1/health")
    assert response.status_code == 200

def test_health_returns_correct_payload(client: TestClient) -> None:
    response = client.get("/api/v1/health")
    data = response.json()
    assert data["status"] == "ok"
    assert data["app"] == "Life Dashboard"