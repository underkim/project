import pytest
from fastapi.testclient import TestClient

from app.main import app

@pytest.fixture
def client() -> TestClient:
    """FastAPI 앱을 감싼 테스트 클라이언트. 모든 테스트에서 재사용."""
    return TestClient(app)