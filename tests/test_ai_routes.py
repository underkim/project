"""AI 라우터 통합 테스트 (Gemini 호출 모킹)."""
from unittest.mock import MagicMock, patch

import pytest


def _mock_gemini(reply: str, action=None, module=None, data=None, filter_=None):
    """Gemini 응답 객체를 흉내내는 mock 반환."""
    import json
    payload = {"reply": reply, "action": action, "module": module, "data": data, "filter": filter_}
    mock = MagicMock()
    mock.text = json.dumps(payload)
    return mock


def test_ai_routes_registered(app):
    routes = {r.path for r in app.routes}
    assert "/api/v1/ai/chat" in routes
    assert "/api/v1/ai/execute" in routes


@pytest.mark.asyncio
async def test_chat_requires_auth(client):
    resp = await client.post("/api/v1/ai/chat", json={"message": "안녕"})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_chat_general_conversation(auth_client):
    with patch("app.modules.ai.service.settings") as mock_settings, \
         patch("app.modules.ai.service.genai") as mock_genai:
        mock_settings.gemini_api_key = "test-key"
        mock_genai.Client.return_value.models.generate_content.return_value = \
            _mock_gemini("안녕하세요! 무엇을 도와드릴까요?")

        resp = await auth_client.post("/api/v1/ai/chat", json={"message": "안녕", "history": []})

    assert resp.status_code == 200
    data = resp.json()
    assert data["saved"] is False
    assert data["action"] is None
    assert "안녕" in data["reply"]


@pytest.mark.asyncio
async def test_chat_create_exercise(auth_client):
    with patch("app.modules.ai.service.settings") as mock_settings, \
         patch("app.modules.ai.service.genai") as mock_genai:
        mock_settings.gemini_api_key = "test-key"
        mock_genai.Client.return_value.models.generate_content.return_value = _mock_gemini(
            reply="운동 기록을 저장했어요!",
            action="create",
            module="health_exercise",
            data={"log_date": "2026-06-21", "exercise_type": "러닝", "duration_minutes": 30},
        )
        resp = await auth_client.post("/api/v1/ai/chat", json={"message": "러닝 30분 했어"})

    assert resp.status_code == 200
    data = resp.json()
    assert data["saved"] is True
    assert data["module"] == "health_exercise"
    assert data["action"] == "create"


@pytest.mark.asyncio
async def test_chat_delete_returns_pending(auth_client):
    with patch("app.modules.ai.service.settings") as mock_settings, \
         patch("app.modules.ai.service.genai") as mock_genai:
        mock_settings.gemini_api_key = "test-key"
        mock_genai.Client.return_value.models.generate_content.return_value = _mock_gemini(
            reply="삭제할까요?",
            action="delete",
            module="health_exercise",
            filter_={"log_date": "2026-06-21", "exercise_type": "러닝"},
        )
        resp = await auth_client.post("/api/v1/ai/chat", json={"message": "러닝 기록 지워줘"})

    assert resp.status_code == 200
    data = resp.json()
    assert data["action"] == "delete_pending"
    assert data["saved"] is False
    assert data["pending_filter"] is not None


@pytest.mark.asyncio
async def test_execute_delete(auth_client):
    # 먼저 운동 기록 생성
    await auth_client.post("/api/v1/health/exercise", json={
        "log_date": "2026-06-15", "exercise_type": "수영", "duration_minutes": 40,
    })

    resp = await auth_client.post("/api/v1/ai/execute", json={
        "module": "health_exercise",
        "filter": {"log_date": "2026-06-15", "exercise_type": "수영"},
    })
    assert resp.status_code == 200
    assert resp.json()["saved"] is True
    assert resp.json()["action"] == "delete"


@pytest.mark.asyncio
async def test_execute_delete_not_found(auth_client):
    resp = await auth_client.post("/api/v1/ai/execute", json={
        "module": "health_exercise",
        "filter": {"log_date": "2000-01-01"},
    })
    assert resp.status_code == 200
    assert resp.json()["saved"] is False


@pytest.mark.asyncio
async def test_chat_planner_no_categories(auth_client):
    """카테고리 없을 때 플래너 아이템 추가 → saved: False, 친절한 메시지."""
    with patch("app.modules.ai.service.settings") as mock_settings, \
         patch("app.modules.ai.service.genai") as mock_genai:
        mock_settings.gemini_api_key = "test-key"
        mock_genai.Client.return_value.models.generate_content.return_value = _mock_gemini(
            reply="플래너에 추가할게요!",
            action="create",
            module="planner_item",
            data={"category_id": None, "text": "포트폴리오 만들기", "offset": 0},
        )
        resp = await auth_client.post("/api/v1/ai/chat", json={"message": "플래너에 추가해줘"})

    assert resp.status_code == 200
    data = resp.json()
    assert data["saved"] is False
    assert "카테고리" in data["reply"]


@pytest.mark.asyncio
async def test_chat_empty_message(auth_client):
    resp = await auth_client.post("/api/v1/ai/chat", json={"message": "   "})
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_weekly_report_requires_auth(client):
    resp = await client.get("/api/v1/ai/weekly-report")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_weekly_report_no_api_key(auth_client):
    with patch("app.modules.ai.router.settings") as mock_settings:
        mock_settings.gemini_api_key = None
        resp = await auth_client.get("/api/v1/ai/weekly-report")
    assert resp.status_code == 503


@pytest.mark.asyncio
async def test_weekly_report_success(auth_client):
    with patch("app.modules.ai.router.settings") as mock_settings, \
         patch("app.modules.ai.service.settings") as mock_svc_settings, \
         patch("app.modules.ai.service.genai") as mock_genai, \
         patch("asyncio.to_thread") as mock_to_thread:
        mock_settings.gemini_api_key = "test-key"
        mock_svc_settings.gemini_api_key = "test-key"

        mock_response = MagicMock()
        mock_response.text = "## 이번 주 요약\n잘 하셨어요!"
        mock_to_thread.return_value = mock_response

        resp = await auth_client.get("/api/v1/ai/weekly-report")

    assert resp.status_code == 200
    data = resp.json()
    assert "report" in data
    assert isinstance(data["report"], str)


@pytest.mark.asyncio
async def test_weekly_report_route_registered(app):
    routes = {r.path for r in app.routes}
    assert "/api/v1/ai/weekly-report" in routes
