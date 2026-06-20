async def test_health_returns_200(client):
    response = await client.get("/api/v1/health")
    assert response.status_code == 200


async def test_health_returns_correct_payload(client):
    response = await client.get("/api/v1/health")
    data = response.json()
    assert data["status"] == "ok"
    assert data["app"] == "Life Dashboard"
