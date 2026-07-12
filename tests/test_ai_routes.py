"""AI 라우터 통합 테스트 (Gemini 호출 모킹)."""
from unittest.mock import AsyncMock, MagicMock, patch

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
async def test_chat_forwards_disabled_context_to_service(auth_client):
    mocked = AsyncMock(return_value={"reply": "ok", "saved": False})
    with patch("app.modules.ai.router.parse_and_save", mocked):
        response = await auth_client.post(
            "/api/v1/ai/chat",
            json={"message": "hello", "context_enabled": False},
        )
    assert response.status_code == 200
    assert mocked.await_args.kwargs["context_enabled"] is False


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
async def test_execute_delete_duplicate_request_is_idempotent(auth_client):
    """더블클릭 등으로 동일한 (module, filter) 삭제 요청이 짧은 시간 안에
    두 번 도착해도, 두 번째 요청은 실제로 재실행되지 않고 최초 결과(saved: True)를
    그대로 반환해야 한다 (재실행되면 이미 지워진 뒤라 saved: False가 나와야 정상)."""
    await auth_client.post("/api/v1/health/exercise", json={
        "log_date": "2026-06-16", "exercise_type": "요가", "duration_minutes": 20,
    })
    payload = {
        "module": "health_exercise",
        "filter": {"log_date": "2026-06-16", "exercise_type": "요가"},
    }

    first = await auth_client.post("/api/v1/ai/execute", json=payload)
    assert first.status_code == 200
    assert first.json()["saved"] is True

    second = await auth_client.post("/api/v1/ai/execute", json=payload)
    assert second.status_code == 200
    assert second.json()["saved"] is True
    assert second.json() == first.json()


@pytest.mark.asyncio
async def test_execute_delete_concurrent_duplicate_requests_only_delete_once(auth_client):
    """진짜 동시(await 없이 나란히 dispatch된) 요청 두 개가 같은 (module, filter)를
    가리키면, 락으로 직렬화되어 실제 삭제는 한 번만 일어나야 한다 — 두 응답 모두
    saved: True(첫 실행 결과 재사용)이거나 saved: True/False 조합이 아니라
    반드시 동일해야 한다. 락이 없으면 둘 다 saved: True가 나올 수 있는 레이스가 생긴다."""
    import asyncio

    await auth_client.post("/api/v1/health/exercise", json={
        "log_date": "2026-06-17", "exercise_type": "필라테스", "duration_minutes": 25,
    })
    payload = {
        "module": "health_exercise",
        "filter": {"log_date": "2026-06-17", "exercise_type": "필라테스"},
    }

    r1, r2 = await asyncio.gather(
        auth_client.post("/api/v1/ai/execute", json=payload),
        auth_client.post("/api/v1/ai/execute", json=payload),
    )
    assert r1.status_code == 200
    assert r2.status_code == 200
    assert r1.json() == r2.json()
    assert r1.json()["saved"] is True

    # 실제로 딱 한 번만 삭제됐는지 백엔드 상태로도 확인 (레이스가 있었다면
    # 두 번째 실행이 "찾지 못함"으로 끝나거나, 존재하지 않을 레코드를 또 지우려 했을 것)
    remaining = await auth_client.get("/api/v1/health/exercise")
    assert not any(
        r["log_date"] == "2026-06-17" and r["exercise_type"] == "필라테스"
        for r in remaining.json()
    )


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
async def test_execute_delete_finance_record(auth_client):
    """execute — finance_record 삭제 시 saved: True."""
    await auth_client.post("/api/v1/finance/records", json={
        "record_date": "2026-05-01", "total_assets": 3000,
        "monthly_income": 300, "monthly_expense": 200,
    })
    resp = await auth_client.post("/api/v1/ai/execute", json={
        "module": "finance_record",
        "filter": {"record_date": "2026-05-01"},
    })
    assert resp.status_code == 200
    assert resp.json()["saved"] is True
    assert resp.json()["action"] == "delete"


@pytest.mark.asyncio
async def test_execute_delete_growth_book(auth_client):
    """execute — growth_book 삭제 시 saved: True."""
    await auth_client.post("/api/v1/growth/books", json={"title": "삭제될 책", "status": "planned"})
    resp = await auth_client.post("/api/v1/ai/execute", json={
        "module": "growth_book",
        "filter": {"title": "삭제될 책"},
    })
    assert resp.status_code == 200
    assert resp.json()["saved"] is True
    assert resp.json()["action"] == "delete"


@pytest.mark.asyncio
async def test_execute_delete_sleep_log(auth_client):
    """execute — health_sleep 삭제 시 saved: True."""
    await auth_client.post("/api/v1/health/sleep", json={
        "log_date": "2026-04-10", "sleep_hours": 7.0, "quality": 4,
    })
    resp = await auth_client.post("/api/v1/ai/execute", json={
        "module": "health_sleep",
        "filter": {"log_date": "2026-04-10"},
    })
    assert resp.status_code == 200
    assert resp.json()["saved"] is True
    assert resp.json()["action"] == "delete"


@pytest.mark.asyncio
async def test_chat_multi_actions_trip_and_plan(auth_client):
    """actions 배열 — travel_trip 생성 후 travel_plan 생성 (flush 패턴) 테스트."""
    import json
    mock_payload = {
        "reply": "제주 여행이랑 1일차 일정 추가했어요!",
        "actions": [
            {
                "action": "create", "module": "travel_trip",
                "data": {
                    "name": "AI 제주 여행", "destination": "제주도",
                    "start_date": "2026-09-01", "end_date": "2026-09-03",
                },
            },
            {
                "action": "create", "module": "travel_plan",
                "data": {
                    "trip_name": "AI 제주 여행", "day": 1,
                    "title": "성산일출봉 등반", "time": "09:00",
                },
            },
        ],
    }
    with patch("app.modules.ai.service.settings") as mock_settings, \
         patch("app.modules.ai.service.genai") as mock_genai:
        mock_settings.gemini_api_key = "test-key"
        mock = MagicMock()
        mock.text = json.dumps(mock_payload)
        mock_genai.Client.return_value.models.generate_content.return_value = mock

        resp = await auth_client.post("/api/v1/ai/chat", json={"message": "제주 여행이랑 일정 추가해줘"})

    assert resp.status_code == 200
    data = resp.json()
    assert data["saved"] is True
    assert data["saved_count"] == 2

    # 실제로 trip과 plan이 DB에 저장되어 있어야 함
    trips = (await auth_client.get("/api/v1/travel/trips")).json()
    ai_trip = next((t for t in trips if t["name"] == "AI 제주 여행"), None)
    assert ai_trip is not None
    assert any(p["title"] == "성산일출봉 등반" for p in ai_trip["plan_items"])


@pytest.mark.asyncio
async def test_chat_followup_question_blocks_duplicate_save(auth_client):
    """이전 저장 후 '방금 뭐 저장했어?' 같은 후속 질문은 같은 create를 다시 저장하지 않아야 한다."""
    with patch("app.modules.ai.service.settings") as mock_settings, \
         patch("app.modules.ai.service.genai") as mock_genai:
        mock_settings.gemini_api_key = "test-key"
        # 모델이 히스토리 때문에 동일 create 액션을 잘못 반복 반환
        mock_genai.Client.return_value.models.generate_content.return_value = _mock_gemini(
            reply="방금 러닝 30분을 저장했어요!",
            action="create",
            module="health_exercise",
            data={"log_date": "2026-06-21", "exercise_type": "러닝", "duration_minutes": 30},
        )
        resp = await auth_client.post("/api/v1/ai/chat", json={
            "message": "방금 뭐 저장했어?",
            "history": [
                {"role": "user", "text": "러닝 30분 했어"},
                {"role": "ai", "text": "러닝 30분 기록했어요! [저장: health_exercise]"},
            ],
        })

    assert resp.status_code == 200
    data = resp.json()
    assert data["saved"] is False
    assert data["action"] is None
    # 실제로 운동 기록이 저장되지 않았어야 함
    logs = (await auth_client.get("/api/v1/health/exercise")).json()
    assert not any(e["log_date"] == "2026-06-21" and e["exercise_type"] == "러닝" for e in logs)


@pytest.mark.asyncio
async def test_chat_followup_question_blocks_multi_action_duplicate(auth_client):
    """후속 질문이면 actions 배열의 create도 모두 차단되어야 한다."""
    import json
    mock_payload = {
        "reply": "방금 여행이랑 일정 저장했어요!",
        "actions": [
            {"action": "create", "module": "travel_trip",
             "data": {"name": "후속질문 여행", "destination": "강릉",
                      "start_date": "2026-09-10", "end_date": "2026-09-12"}},
            {"action": "create", "module": "travel_plan",
             "data": {"trip_name": "후속질문 여행", "day": 1, "title": "경포대"}},
        ],
    }
    with patch("app.modules.ai.service.settings") as mock_settings, \
         patch("app.modules.ai.service.genai") as mock_genai:
        mock_settings.gemini_api_key = "test-key"
        mock = MagicMock()
        mock.text = json.dumps(mock_payload)
        mock_genai.Client.return_value.models.generate_content.return_value = mock

        resp = await auth_client.post("/api/v1/ai/chat", json={
            "message": "방금 저장한 거 보여줘",
            "history": [
                {"role": "user", "text": "강릉 여행 추가하고 일정 넣어줘"},
                {"role": "ai", "text": "강릉 여행 추가했어요! [저장: travel_trip]"},
            ],
        })

    assert resp.status_code == 200
    data = resp.json()
    assert data["saved"] is False
    assert data["saved_count"] == 0
    trips = (await auth_client.get("/api/v1/travel/trips")).json()
    assert not any(t["name"] == "후속질문 여행" for t in trips)


@pytest.mark.asyncio
async def test_chat_new_record_command_after_followup_still_saves(auth_client):
    """후속 질문 가드가 실제 신규 기록 명령(자연어 로그)을 막지 않아야 한다."""
    with patch("app.modules.ai.service.settings") as mock_settings, \
         patch("app.modules.ai.service.genai") as mock_genai:
        mock_settings.gemini_api_key = "test-key"
        mock_genai.Client.return_value.models.generate_content.return_value = _mock_gemini(
            reply="수영 40분 기록했어요!",
            action="create",
            module="health_exercise",
            data={"log_date": "2026-06-22", "exercise_type": "수영", "duration_minutes": 40},
        )
        resp = await auth_client.post("/api/v1/ai/chat", json={"message": "오늘 수영 40분 했어"})

    assert resp.status_code == 200
    data = resp.json()
    assert data["saved"] is True
    assert data["module"] == "health_exercise"


@pytest.mark.asyncio
async def test_chat_travel_planning_question_blocks_save(auth_client):
    """여행 계획 중 AI가 되묻는 응답이면 travel 생성 액션을 저장하지 않아야 한다."""
    import json
    mock_payload = {
        "reply": "제주 여행 좋네요! 언제 출발하고 며칠 동안 다녀오실 예정인가요?",
        "actions": [
            {"action": "create", "module": "travel_trip",
             "data": {"name": "질문 제주 여행", "destination": "제주도",
                      "start_date": "2026-09-01", "end_date": "2026-09-03"}},
            {"action": "create", "module": "travel_plan",
             "data": {"trip_name": "질문 제주 여행", "day": 1, "title": "성산일출봉"}},
        ],
    }
    with patch("app.modules.ai.service.settings") as mock_settings, \
         patch("app.modules.ai.service.genai") as mock_genai:
        mock_settings.gemini_api_key = "test-key"
        mock = MagicMock()
        mock.text = json.dumps(mock_payload)
        mock_genai.Client.return_value.models.generate_content.return_value = mock

        resp = await auth_client.post("/api/v1/ai/chat", json={"message": "제주 여행 계획 짜줘"})

    assert resp.status_code == 200
    data = resp.json()
    assert data["saved"] is False
    assert data["saved_count"] == 0
    # 실제로 trip이 저장되지 않았어야 함
    trips = (await auth_client.get("/api/v1/travel/trips")).json()
    assert not any(t["name"] == "질문 제주 여행" for t in trips)


@pytest.mark.asyncio
async def test_chat_travel_exploratory_action_null(auth_client):
    """탐색 단계 여행 계획은 action: null이며 저장되지 않아야 한다."""
    with patch("app.modules.ai.service.settings") as mock_settings, \
         patch("app.modules.ai.service.genai") as mock_genai:
        mock_settings.gemini_api_key = "test-key"
        mock_genai.Client.return_value.models.generate_content.return_value = _mock_gemini(
            reply="여행 계획 도와드릴게요! 어떤 분위기의 여행을 원하세요?",
            action=None,
        )
        resp = await auth_client.post("/api/v1/ai/chat", json={"message": "여행 가고 싶어"})

    assert resp.status_code == 200
    data = resp.json()
    assert data["saved"] is False
    assert data["action"] is None


@pytest.mark.asyncio
async def test_chat_travel_single_create_question_blocks_save(auth_client):
    """단일 travel_trip create도 되묻는 응답이면 저장하지 않아야 한다."""
    with patch("app.modules.ai.service.settings") as mock_settings, \
         patch("app.modules.ai.service.genai") as mock_genai:
        mock_settings.gemini_api_key = "test-key"
        mock_genai.Client.return_value.models.generate_content.return_value = _mock_gemini(
            reply="어떤 날짜로 추가할까요?",
            action="create",
            module="travel_trip",
            data={"name": "단일 질문 여행", "destination": "부산",
                  "start_date": "2026-10-01", "end_date": "2026-10-03"},
        )
        resp = await auth_client.post("/api/v1/ai/chat", json={"message": "부산 여행 추가해줘"})

    assert resp.status_code == 200
    data = resp.json()
    assert data["saved"] is False
    trips = (await auth_client.get("/api/v1/travel/trips")).json()
    assert not any(t["name"] == "단일 질문 여행" for t in trips)


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
async def test_chat_context_includes_finance_goal(auth_client):
    """자산 목표 설정 시 AI 시스템 프롬프트(컨텍스트)에 목표 정보가 포함되어야 한다."""
    await auth_client.post("/api/v1/finance/records", json={
        "record_date": "2026-06-01", "total_assets": 3000,
        "monthly_income": 400, "monthly_expense": 250,
    })
    await auth_client.put("/api/v1/finance/goal", json={
        "target_amount": 10000, "target_date": "2030-01-01", "expected_annual_return_rate": 5.0,
    })

    with patch("app.modules.ai.service.settings") as mock_settings, \
         patch("app.modules.ai.service.genai") as mock_genai:
        mock_settings.gemini_api_key = "test-key"
        mock_genai.Client.return_value.models.generate_content.return_value = \
            _mock_gemini("목표까지 잘 가고 있어요!")

        resp = await auth_client.post(
            "/api/v1/ai/chat", json={"message": "내 자산 목표 진행 상황 알려줘", "history": []}
        )

    assert resp.status_code == 200
    config_call = mock_genai.types.GenerateContentConfig.call_args
    system_prompt = config_call.kwargs["system_instruction"]
    assert "자산 목표" in system_prompt
    assert "10,000만원" in system_prompt


@pytest.mark.asyncio
async def test_weekly_report_includes_finance_goal(auth_client):
    """자산 목표 설정 시 주간 리포트 프롬프트에 목표 진행률이 포함되어야 한다."""
    await auth_client.post("/api/v1/finance/records", json={
        "record_date": "2026-06-01", "total_assets": 4000,
        "monthly_income": 400, "monthly_expense": 250,
    })
    await auth_client.put("/api/v1/finance/goal", json={
        "target_amount": 8000, "target_date": "2029-01-01",
    })

    with patch("app.modules.ai.router.settings") as mock_settings, \
         patch("app.modules.ai.service.settings") as mock_svc_settings, \
         patch("app.modules.ai.service.genai") as mock_genai, \
         patch("asyncio.to_thread") as mock_to_thread:
        mock_settings.gemini_api_key = "test-key"
        mock_svc_settings.gemini_api_key = "test-key"
        mock_response = MagicMock()
        mock_response.text = "## 요약\n좋아요"
        mock_to_thread.return_value = mock_response

        resp = await auth_client.get("/api/v1/ai/weekly-report")

    assert resp.status_code == 200
    prompt = mock_to_thread.call_args.kwargs["contents"]
    assert "자산 목표 진행률" in prompt
    assert "8,000만원" in prompt


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
async def test_chat_multi_actions_create_and_update(auth_client):
    """actions 배열 — create + update 혼합 처리 시 saved_count가 정확해야 한다."""
    import json
    # 먼저 수정할 운동 기록 생성
    await auth_client.post("/api/v1/health/exercise", json={
        "log_date": "2026-07-10", "exercise_type": "러닝", "duration_minutes": 30,
    })

    mock_payload = {
        "reply": "오늘 운동 추가하고 어제 기록도 수정했어요!",
        "actions": [
            {
                "action": "create", "module": "health_exercise",
                "data": {"log_date": "2026-07-11", "exercise_type": "수영", "duration_minutes": 45},
            },
            {
                "action": "update", "module": "health_exercise",
                "filter": {"log_date": "2026-07-10", "exercise_type": "러닝"},
                "data": {"duration_minutes": 60},
            },
        ],
    }
    with patch("app.modules.ai.service.settings") as mock_settings, \
         patch("app.modules.ai.service.genai") as mock_genai:
        mock_settings.gemini_api_key = "test-key"
        mock = MagicMock()
        mock.text = json.dumps(mock_payload)
        mock_genai.Client.return_value.models.generate_content.return_value = mock

        resp = await auth_client.post("/api/v1/ai/chat", json={"message": "운동 기록 추가하고 수정해줘"})

    assert resp.status_code == 200
    data = resp.json()
    assert data["saved"] is True
    assert data["saved_count"] == 2


@pytest.mark.asyncio
async def test_chat_create_growth_english(auth_client):
    """create 액션 — growth_english 저장 시 saved: True."""
    import json
    mock_payload = {
        "reply": "영어 학습 기록했어요!",
        "action": "create",
        "module": "growth_english",
        "data": {"log_date": "2026-06-15", "activity_type": "listening", "duration_minutes": 30},
    }
    with patch("app.modules.ai.service.settings") as mock_settings, \
         patch("app.modules.ai.service.genai") as mock_genai:
        mock_settings.gemini_api_key = "test-key"
        mock = MagicMock()
        mock.text = json.dumps(mock_payload)
        mock_genai.Client.return_value.models.generate_content.return_value = mock

        resp = await auth_client.post("/api/v1/ai/chat", json={"message": "영어 듣기 30분 했어"})

    assert resp.status_code == 200
    data = resp.json()
    assert data["saved"] is True
    assert data["module"] == "growth_english"


@pytest.mark.asyncio
async def test_chat_create_career_cf_rating(auth_client):
    """create 액션 — career_cf_rating 저장 시 saved: True."""
    import json
    mock_payload = {
        "reply": "CF 레이팅 기록했어요!",
        "action": "create",
        "module": "career_cf_rating",
        "data": {"log_date": "2026-06-20", "rating": 1600, "rank_name": "expert"},
    }
    with patch("app.modules.ai.service.settings") as mock_settings, \
         patch("app.modules.ai.service.genai") as mock_genai:
        mock_settings.gemini_api_key = "test-key"
        mock = MagicMock()
        mock.text = json.dumps(mock_payload)
        mock_genai.Client.return_value.models.generate_content.return_value = mock

        resp = await auth_client.post("/api/v1/ai/chat", json={"message": "CF 레이팅 1600 기록해줘"})

    assert resp.status_code == 200
    data = resp.json()
    assert data["saved"] is True
    assert data["module"] == "career_cf_rating"


@pytest.mark.asyncio
async def test_chat_unexpected_exception_returns_sanitized_500(auth_client):
    """/chat — 예기치 못한 예외 시 raw exception text가 detail에 포함되지 않아야 한다."""
    sensitive = "database password leaked postgresql://user:secret@host/db"
    with patch("app.modules.ai.router.parse_and_save", side_effect=RuntimeError(sensitive)):
        resp = await auth_client.post("/api/v1/ai/chat", json={"message": "안녕"})
    assert resp.status_code == 500
    detail = resp.json().get("detail", "")
    assert sensitive not in detail
    assert "database password" not in detail


@pytest.mark.asyncio
async def test_weekly_report_unexpected_exception_returns_sanitized_500(auth_client):
    """/weekly-report — 예기치 못한 예외 시 raw exception text가 detail에 포함되지 않아야 한다."""
    sensitive = "connection string postgresql://admin:hunter2@internal-db/prod"
    with patch("app.modules.ai.router.settings") as mock_settings, \
         patch("app.modules.ai.router.generate_weekly_report", side_effect=RuntimeError(sensitive)):
        mock_settings.gemini_api_key = "test-key"
        resp = await auth_client.get("/api/v1/ai/weekly-report")
    assert resp.status_code == 500
    detail = resp.json().get("detail", "")
    assert sensitive not in detail
    assert "postgresql" not in detail


@pytest.mark.asyncio
async def test_execute_unexpected_exception_returns_sanitized_500(auth_client):
    """/execute — 예기치 못한 예외 시 raw exception text가 detail에 포함되지 않아야 한다."""
    sensitive = "internal db error: relation 'secret_table' does not exist"
    with patch("app.modules.ai.router.execute_delete", side_effect=RuntimeError(sensitive)):
        resp = await auth_client.post("/api/v1/ai/execute", json={
            "module": "health_exercise",
            "filter": {"log_date": "2026-01-01"},
        })
    assert resp.status_code == 500
    detail = resp.json().get("detail", "")
    assert sensitive not in detail
    assert "secret_table" not in detail


@pytest.mark.asyncio
async def test_chat_quota_exhausted_returns_429(auth_client):
    """/chat — quota 초과 예외는 429를 반환해야 한다."""
    with patch("app.modules.ai.router.parse_and_save",
               side_effect=Exception("RESOURCE_EXHAUSTED: quota exceeded")):
        resp = await auth_client.post("/api/v1/ai/chat", json={"message": "안녕"})
    assert resp.status_code == 429


@pytest.mark.asyncio
async def test_chat_invalid_key_returns_401(auth_client):
    """/chat — API 키 오류는 401을 반환해야 한다."""
    with patch("app.modules.ai.router.parse_and_save",
               side_effect=Exception("API_KEY_INVALID: key not valid")):
        resp = await auth_client.post("/api/v1/ai/chat", json={"message": "안녕"})
    assert resp.status_code == 401


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


# ── TASK-044: AI 액션 확인 커버리지 매트릭스 보강 ──────────────────────


@pytest.mark.asyncio
async def test_chat_create_health_sleep(auth_client):
    """create 액션 — health_sleep 저장 시 saved: True."""
    import json
    mock_payload = {
        "reply": "수면 기록했어요!",
        "action": "create",
        "module": "health_sleep",
        "data": {"log_date": "2026-06-22", "sleep_hours": 7.5, "quality": 4},
    }
    with patch("app.modules.ai.service.settings") as mock_settings, \
         patch("app.modules.ai.service.genai") as mock_genai:
        mock_settings.gemini_api_key = "test-key"
        mock = MagicMock()
        mock.text = json.dumps(mock_payload)
        mock_genai.Client.return_value.models.generate_content.return_value = mock

        resp = await auth_client.post("/api/v1/ai/chat", json={"message": "어제 7시간 반 잤어"})

    assert resp.status_code == 200
    data = resp.json()
    assert data["saved"] is True
    assert data["module"] == "health_sleep"
    assert data["action"] == "create"


@pytest.mark.asyncio
async def test_execute_delete_career_cf_rating(auth_client):
    """execute — career_cf_rating 삭제 시 saved: True."""
    await auth_client.post("/api/v1/career/cf-ratings", json={
        "log_date": "2026-04-15", "rating": 1500, "rank_name": "specialist",
    })
    resp = await auth_client.post("/api/v1/ai/execute", json={
        "module": "career_cf_rating",
        "filter": {"log_date": "2026-04-15"},
    })
    assert resp.status_code == 200
    assert resp.json()["saved"] is True
    assert resp.json()["action"] == "delete"


@pytest.mark.asyncio
async def test_execute_delete_travel_trip(auth_client):
    """execute — travel_trip 삭제 시 saved: True (name 매치)."""
    await auth_client.post("/api/v1/travel/trips", json={
        "name": "삭제될 여행", "destination": "부산",
        "start_date": "2026-09-01", "end_date": "2026-09-03", "status": "planned",
    })
    resp = await auth_client.post("/api/v1/ai/execute", json={
        "module": "travel_trip",
        "filter": {"name": "삭제될 여행"},
    })
    assert resp.status_code == 200
    assert resp.json()["saved"] is True
    assert resp.json()["action"] == "delete"


@pytest.mark.asyncio
async def test_chat_multi_action_delete_is_excluded(auth_client):
    """다중 액션 배열에 delete가 있어도 실행되지 않고 create만 저장된다 (삭제는 개별 확인)."""
    import json
    # 먼저 삭제 대상이 될 운동 기록을 만든다.
    await auth_client.post("/api/v1/health/exercise", json={
        "log_date": "2026-06-19", "exercise_type": "수영", "duration_minutes": 40,
    })
    mock_payload = {
        "reply": "처리했어요!",
        "actions": [
            {"action": "create", "module": "health_exercise",
             "data": {"log_date": "2026-06-20", "exercise_type": "러닝", "duration_minutes": 20}},
            {"action": "delete", "module": "health_exercise",
             "filter": {"log_date": "2026-06-19"}},
        ],
    }
    with patch("app.modules.ai.service.settings") as mock_settings, \
         patch("app.modules.ai.service.genai") as mock_genai:
        mock_settings.gemini_api_key = "test-key"
        mock = MagicMock()
        mock.text = json.dumps(mock_payload)
        mock_genai.Client.return_value.models.generate_content.return_value = mock

        resp = await auth_client.post("/api/v1/ai/chat", json={"message": "러닝 추가하고 어제 수영 지워줘"})

    assert resp.status_code == 200
    data = resp.json()
    # create는 저장됐지만 delete는 실행되지 않아야 한다.
    assert data["saved"] is True
    # 삭제 대상이었던 2026-06-19 수영 기록은 그대로 남아 있어야 한다.
    listing = await auth_client.get("/api/v1/health/exercise")
    dates = [e["log_date"] for e in listing.json()]
    assert "2026-06-19" in dates
