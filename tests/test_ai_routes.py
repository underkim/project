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


@pytest.mark.asyncio
async def test_chat_update_action(auth_client):
    """update 액션 — 기존 기록 수정 시 saved: True."""
    # 먼저 실제 운동 기록 생성 (update 대상)
    await auth_client.post("/api/v1/health/exercise", json={
        "log_date": "2026-06-20", "exercise_type": "러닝", "duration_minutes": 30,
    })

    import json
    mock_payload = {
        "reply": "러닝 60분으로 수정했어요!",
        "action": "update",
        "module": "health_exercise",
        "filter": {"log_date": "2026-06-20", "exercise_type": "러닝"},
        "data": {"duration_minutes": 60},
    }

    with patch("app.modules.ai.service.settings") as mock_settings, \
         patch("app.modules.ai.service.genai") as mock_genai:
        mock_settings.gemini_api_key = "test-key"
        mock = MagicMock()
        mock.text = json.dumps(mock_payload)
        mock_genai.Client.return_value.models.generate_content.return_value = mock

        resp = await auth_client.post("/api/v1/ai/chat", json={"message": "러닝 60분으로 수정해줘"})

    assert resp.status_code == 200
    data = resp.json()
    assert data["saved"] is True
    assert data["action"] == "update"


@pytest.mark.asyncio
async def test_chat_multi_actions_create(auth_client):
    """actions 배열 — 여러 create 액션이 한 번에 처리되어야 한다."""
    import json
    mock_payload = {
        "reply": "운동 2개 기록했어요!",
        "actions": [
            {"action": "create", "module": "health_exercise",
             "data": {"log_date": "2026-07-01", "exercise_type": "러닝", "duration_minutes": 30}},
            {"action": "create", "module": "health_exercise",
             "data": {"log_date": "2026-07-02", "exercise_type": "수영", "duration_minutes": 45}},
        ],
    }

    with patch("app.modules.ai.service.settings") as mock_settings, \
         patch("app.modules.ai.service.genai") as mock_genai:
        mock_settings.gemini_api_key = "test-key"
        mock = MagicMock()
        mock.text = json.dumps(mock_payload)
        mock_genai.Client.return_value.models.generate_content.return_value = mock

        resp = await auth_client.post("/api/v1/ai/chat", json={"message": "이틀치 운동 기록해줘"})

    assert resp.status_code == 200
    data = resp.json()
    assert data["saved"] is True
    assert data["saved_count"] == 2


@pytest.mark.asyncio
async def test_chat_no_api_key(auth_client):
    """Gemini API 키 없을 때 → saved: False, 친절한 안내 메시지."""
    with patch("app.modules.ai.service.settings") as mock_settings:
        mock_settings.gemini_api_key = None
        resp = await auth_client.post("/api/v1/ai/chat", json={"message": "안녕"})

    assert resp.status_code == 200
    data = resp.json()
    assert data["saved"] is False
    assert "GEMINI_API_KEY" in data["reply"] or "API" in data["reply"]


@pytest.mark.asyncio
async def test_chat_create_finance_record(auth_client):
    """create 액션 — finance_record 모듈 저장 시 saved: True."""
    import json
    mock_payload = {
        "reply": "자산 기록 완료!",
        "action": "create",
        "module": "finance_record",
        "data": {
            "record_date": "2026-06-01",
            "total_assets": 5000,
            "monthly_income": 400,
            "monthly_expense": 250,
        },
    }
    with patch("app.modules.ai.service.settings") as mock_settings, \
         patch("app.modules.ai.service.genai") as mock_genai:
        mock_settings.gemini_api_key = "test-key"
        mock = MagicMock()
        mock.text = json.dumps(mock_payload)
        mock_genai.Client.return_value.models.generate_content.return_value = mock

        resp = await auth_client.post("/api/v1/ai/chat", json={"message": "6월 자산 기록해줘"})

    assert resp.status_code == 200
    data = resp.json()
    assert data["saved"] is True
    assert data["module"] == "finance_record"
    assert data["action"] == "create"


@pytest.mark.asyncio
async def test_chat_create_growth_book(auth_client):
    """create 액션 — growth_book 모듈 저장 시 saved: True."""
    import json
    mock_payload = {
        "reply": "독서 목록에 추가했어요!",
        "action": "create",
        "module": "growth_book",
        "data": {"title": "클린 코드", "status": "planned"},
    }
    with patch("app.modules.ai.service.settings") as mock_settings, \
         patch("app.modules.ai.service.genai") as mock_genai:
        mock_settings.gemini_api_key = "test-key"
        mock = MagicMock()
        mock.text = json.dumps(mock_payload)
        mock_genai.Client.return_value.models.generate_content.return_value = mock

        resp = await auth_client.post("/api/v1/ai/chat", json={"message": "클린 코드 읽을 예정이야"})

    assert resp.status_code == 200
    data = resp.json()
    assert data["saved"] is True
    assert data["module"] == "growth_book"


@pytest.mark.asyncio
async def test_chat_update_record_not_found(auth_client):
    """update 액션 — 대상 기록이 없으면 saved: False."""
    import json
    mock_payload = {
        "reply": "수정할게요!",
        "action": "update",
        "module": "growth_book",
        "filter": {"title": "존재하지않는책제목XXXYYY"},
        "data": {"status": "completed"},
    }

    with patch("app.modules.ai.service.settings") as mock_settings, \
         patch("app.modules.ai.service.genai") as mock_genai:
        mock_settings.gemini_api_key = "test-key"
        mock = MagicMock()
        mock.text = json.dumps(mock_payload)
        mock_genai.Client.return_value.models.generate_content.return_value = mock

        resp = await auth_client.post("/api/v1/ai/chat", json={"message": "책 완독했어"})

    assert resp.status_code == 200
    data = resp.json()
    assert data["saved"] is False
    assert data["action"] == "update"
