import pytest
from pydantic import ValidationError
from app.modules.finance.schemas import AssetRecordCreate, AssetRecordUpdate, FinanceGoalUpdate
from app.modules.finance.service import _to_response, compute_goal_projection
from app.modules.finance.models import AssetRecord
from datetime import date


def _make_record(**kwargs) -> AssetRecord:
    defaults = {
        "id": 1,
        "record_date": date(2026, 1, 1),
        "total_assets": 1000,
        "monthly_income": 300,
        "monthly_expense": 200,
        "note": None,
    }
    defaults.update(kwargs)
    r = AssetRecord()
    for k, v in defaults.items():
        setattr(r, k, v)
    return r


def test_savings_amount_calculation():
    record = _make_record(monthly_income=300, monthly_expense=200)
    response = _to_response(record)
    assert response.savings_amount == 100


def test_savings_rate_calculation():
    record = _make_record(monthly_income=300, monthly_expense=210)
    response = _to_response(record)
    assert response.savings_rate == 30.0


def test_savings_rate_none_when_income_zero():
    record = _make_record(monthly_income=0, monthly_expense=0)
    response = _to_response(record)
    assert response.savings_rate is None


def test_create_schema_validates_negative_amount():
    with pytest.raises(ValidationError):
        AssetRecordCreate(
            record_date=date(2026, 1, 1),
            total_assets=-1,
            monthly_income=300,
            monthly_expense=200,
        )


def test_update_schema_validates_negative_amount():
    with pytest.raises(ValidationError):
        AssetRecordUpdate(total_assets=-1)
    with pytest.raises(ValidationError):
        AssetRecordUpdate(monthly_income=-100)


def test_finance_routes_registered(app):
    routes = {route.path for route in app.routes}
    assert "/api/v1/finance/records" in routes
    assert "/api/v1/finance/summary" in routes


@pytest.mark.asyncio
async def test_update_record_note_clear_with_null(auth_client):
    payload = {"record_date": "2026-04-01", "total_assets": 2000, "monthly_income": 400, "monthly_expense": 300, "note": "초기 메모"}
    create = await auth_client.post("/api/v1/finance/records", json=payload)
    assert create.status_code == 201
    record_id = create.json()["id"]
    assert create.json()["note"] == "초기 메모"

    update = await auth_client.put(f"/api/v1/finance/records/{record_id}", json={"note": None})
    assert update.status_code == 200
    assert update.json()["note"] is None


@pytest.mark.asyncio
async def test_create_record_duplicate_date_returns_409(auth_client):
    payload = {"record_date": "2026-05-01", "total_assets": 5000, "monthly_income": 300, "monthly_expense": 200}
    resp1 = await auth_client.post("/api/v1/finance/records", json=payload)
    assert resp1.status_code == 201
    resp2 = await auth_client.post("/api/v1/finance/records", json=payload)
    assert resp2.status_code == 409


@pytest.mark.asyncio
async def test_get_finance_record_by_id(auth_client):
    create = await auth_client.post("/api/v1/finance/records", json={
        "record_date": "2026-02-01", "total_assets": 4500, "monthly_income": 350, "monthly_expense": 200,
    })
    assert create.status_code == 201
    record_id = create.json()["id"]

    get_resp = await auth_client.get(f"/api/v1/finance/records/{record_id}")
    assert get_resp.status_code == 200
    assert get_resp.json()["total_assets"] == 4500
    assert get_resp.json()["savings_amount"] == 150


@pytest.mark.asyncio
async def test_get_finance_record_not_found(auth_client):
    resp = await auth_client.get("/api/v1/finance/records/99999")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_finance_record(auth_client):
    create = await auth_client.post("/api/v1/finance/records", json={
        "record_date": "2026-03-01", "total_assets": 3000, "monthly_income": 250, "monthly_expense": 180,
    })
    assert create.status_code == 201
    record_id = create.json()["id"]

    del_resp = await auth_client.delete(f"/api/v1/finance/records/{record_id}")
    assert del_resp.status_code == 204

    list_resp = await auth_client.get("/api/v1/finance/records")
    assert all(r["id"] != record_id for r in list_resp.json())


@pytest.mark.asyncio
async def test_create_record_negative_assets_returns_422(auth_client):
    resp = await auth_client.post("/api/v1/finance/records", json={
        "record_date": "2026-07-01", "total_assets": -1000,
        "monthly_income": 300, "monthly_expense": 200,
    })
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_update_finance_record_not_found_returns_404(auth_client):
    resp = await auth_client.put("/api/v1/finance/records/99999", json={"total_assets": 5000})
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_finance_record_not_found_returns_404(auth_client):
    resp = await auth_client.delete("/api/v1/finance/records/99999")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_list_finance_records_returns_list(auth_client):
    """재테크 기록 목록이 리스트로 반환되어야 한다."""
    await auth_client.post("/api/v1/finance/records", json={
        "record_date": "2026-07-10", "total_assets": 6000,
        "monthly_income": 400, "monthly_expense": 250,
    })
    resp = await auth_client.get("/api/v1/finance/records")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)
    assert len(resp.json()) >= 1
    assert resp.json()[0]["total_assets"] == 6000


@pytest.mark.asyncio
async def test_update_finance_record_negative_value_returns_422(auth_client):
    """자산/수입/지출에 음수 값으로 수정하면 422여야 한다."""
    create = await auth_client.post("/api/v1/finance/records", json={
        "record_date": "2026-07-01", "total_assets": 3000,
        "monthly_income": 300, "monthly_expense": 200,
    })
    record_id = create.json()["id"]
    resp = await auth_client.put(f"/api/v1/finance/records/{record_id}", json={"monthly_income": -1})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_finance_records_ordered_newest_first(auth_client):
    """재테크 기록 목록은 최신 날짜 순으로 반환되어야 한다."""
    await auth_client.post("/api/v1/finance/records", json={
        "record_date": "2026-01-01", "total_assets": 1000,
        "monthly_income": 200, "monthly_expense": 100,
    })
    await auth_client.post("/api/v1/finance/records", json={
        "record_date": "2026-06-01", "total_assets": 3000,
        "monthly_income": 350, "monthly_expense": 180,
    })
    resp = await auth_client.get("/api/v1/finance/records")
    assert resp.status_code == 200
    records = resp.json()
    assert len(records) >= 2
    # 최신(6월)이 먼저 와야 함
    assert records[0]["record_date"] > records[1]["record_date"]


@pytest.mark.asyncio
async def test_finance_summary_accuracy(auth_client):
    """summary가 최신 자산과 평균 저축률을 정확하게 계산해야 한다."""
    await auth_client.post("/api/v1/finance/records", json={
        "record_date": "2026-03-01", "total_assets": 1000,
        "monthly_income": 200, "monthly_expense": 100,
    })
    await auth_client.post("/api/v1/finance/records", json={
        "record_date": "2026-04-01", "total_assets": 2000,
        "monthly_income": 400, "monthly_expense": 200,
    })
    resp = await auth_client.get("/api/v1/finance/summary")
    assert resp.status_code == 200
    data = resp.json()
    # 최신 기록(2026-04)의 총자산이 반영되어야 함
    assert data["latest_total_assets"] == 2000
    # 두 기록 모두 저축률 50% → 평균 50.0
    assert data["avg_savings_rate"] == 50.0


@pytest.mark.asyncio
async def test_finance_list_pagination(auth_client):
    """limit 파라미터로 페이지네이션이 동작해야 한다."""
    for i in range(1, 6):
        await auth_client.post("/api/v1/finance/records", json={
            "record_date": f"2026-0{i}-01", "total_assets": i * 1000,
            "monthly_income": 300, "monthly_expense": 200,
        })
    resp = await auth_client.get("/api/v1/finance/records?limit=3")
    assert resp.status_code == 200
    records = resp.json()
    assert len(records) == 3


@pytest.mark.asyncio
async def test_finance_summary_zero_income_savings_rate_none(auth_client):
    """수입이 0이면 저축률은 None이어야 한다."""
    await auth_client.post("/api/v1/finance/records", json={
        "record_date": "2026-02-01", "total_assets": 1000,
        "monthly_income": 0, "monthly_expense": 0,
    })
    resp = await auth_client.get("/api/v1/finance/summary")
    assert resp.status_code == 200
    data = resp.json()
    assert data["avg_savings_rate"] is None


@pytest.mark.asyncio
async def test_finance_summary_asset_change(auth_client):
    """summary에 asset_change(직전 기록 대비 자산 증감)가 반영되어야 한다."""
    await auth_client.post("/api/v1/finance/records", json={
        "record_date": "2026-03-01", "total_assets": 5000,
        "monthly_income": 300, "monthly_expense": 200,
    })
    await auth_client.post("/api/v1/finance/records", json={
        "record_date": "2026-04-01", "total_assets": 5500,
        "monthly_income": 350, "monthly_expense": 200,
    })
    resp = await auth_client.get("/api/v1/finance/summary")
    assert resp.status_code == 200
    data = resp.json()
    assert data["asset_change"] == 500  # 5500 - 5000


@pytest.mark.asyncio
async def test_finance_summary_asset_change_negative(auth_client):
    """자산이 감소하면 asset_change가 음수여야 한다."""
    await auth_client.post("/api/v1/finance/records", json={
        "record_date": "2026-05-01", "total_assets": 8000,
        "monthly_income": 400, "monthly_expense": 250,
    })
    await auth_client.post("/api/v1/finance/records", json={
        "record_date": "2026-06-01", "total_assets": 7500,
        "monthly_income": 400, "monthly_expense": 450,
    })
    resp = await auth_client.get("/api/v1/finance/summary")
    assert resp.status_code == 200
    data = resp.json()
    assert data["asset_change"] == -500  # 7500 - 8000


@pytest.mark.asyncio
async def test_update_record_date(auth_client):
    """record_date를 수정하면 새 날짜로 변경되어야 한다."""
    create = await auth_client.post("/api/v1/finance/records", json={
        "record_date": "2026-08-01", "total_assets": 3000, "monthly_income": 300, "monthly_expense": 200,
    })
    assert create.status_code == 201
    record_id = create.json()["id"]

    update = await auth_client.put(f"/api/v1/finance/records/{record_id}", json={"record_date": "2026-08-15"})
    assert update.status_code == 200
    assert update.json()["record_date"] == "2026-08-15"


@pytest.mark.asyncio
async def test_update_record_date_duplicate_returns_409(auth_client):
    """다른 기록과 날짜가 겹치는 수정은 409를 반환해야 한다."""
    await auth_client.post("/api/v1/finance/records", json={
        "record_date": "2026-09-01", "total_assets": 1000, "monthly_income": 200, "monthly_expense": 100,
    })
    create2 = await auth_client.post("/api/v1/finance/records", json={
        "record_date": "2026-09-02", "total_assets": 2000, "monthly_income": 200, "monthly_expense": 100,
    })
    assert create2.status_code == 201
    record_id = create2.json()["id"]

    resp = await auth_client.put(f"/api/v1/finance/records/{record_id}", json={"record_date": "2026-09-01"})
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_finance_summary_single_record_asset_change_none(auth_client):
    """기록이 1개뿐이면 asset_change는 None이어야 한다."""
    await auth_client.post("/api/v1/finance/records", json={
        "record_date": "2026-07-01", "total_assets": 3000,
        "monthly_income": 200, "monthly_expense": 100,
    })
    resp = await auth_client.get("/api/v1/finance/summary")
    assert resp.status_code == 200
    data = resp.json()
    assert data["asset_change"] is None


# --- 재테크 목표(finance goal) ---

def test_compute_goal_projection_no_goal_returns_none():
    result = compute_goal_projection(1000, None, None, 0.0, date(2026, 1, 1))
    assert result == (None, None, None, False)


def test_compute_goal_projection_already_achieved():
    progress, months, required, achieved = compute_goal_projection(
        12000, 10000, date(2027, 1, 1), 5.0, date(2026, 1, 1)
    )
    assert achieved is True
    assert progress == 100.0
    assert required == 0


def test_compute_goal_projection_zero_rate_is_linear():
    # 연 수익률 0%면 단순히 (목표 - 현재) / 남은 개월
    progress, months, required, achieved = compute_goal_projection(
        0, 1200, date(2027, 1, 1), 0.0, date(2026, 1, 1)
    )
    assert achieved is False
    assert months == 12
    assert required == 100  # 1200 / 12


def test_compute_goal_projection_higher_return_rate_lowers_required_saving():
    # 예상 수익률이 높을수록 월 필요 저축액이 줄어들어야 한다 (복리 효과 반영)
    _, _, required_no_rate, _ = compute_goal_projection(
        1000, 5000, date(2031, 1, 1), 0.0, date(2026, 1, 1)
    )
    _, _, required_with_rate, _ = compute_goal_projection(
        1000, 5000, date(2031, 1, 1), 6.0, date(2026, 1, 1)
    )
    assert required_with_rate < required_no_rate


def test_finance_goal_routes_registered(app):
    routes = {route.path for route in app.routes}
    assert "/api/v1/finance/goal" in routes


def test_finance_goal_update_schema_rejects_non_positive_amount():
    with pytest.raises(ValidationError):
        FinanceGoalUpdate(target_amount=0)


def test_finance_goal_update_schema_rejects_negative_rate():
    with pytest.raises(ValidationError):
        FinanceGoalUpdate(expected_annual_return_rate=-1.0)


@pytest.mark.asyncio
async def test_get_goal_default_is_empty(auth_client):
    resp = await auth_client.get("/api/v1/finance/goal")
    assert resp.status_code == 200
    data = resp.json()
    assert data["target_amount"] is None
    assert data["achieved"] is False
    assert data["scenarios"] == []


@pytest.mark.asyncio
async def test_update_and_get_goal(auth_client):
    await auth_client.post("/api/v1/finance/records", json={
        "record_date": "2026-10-01", "total_assets": 2000,
        "monthly_income": 300, "monthly_expense": 200,
    })
    update = await auth_client.put("/api/v1/finance/goal", json={
        "target_amount": 10000,
        "target_date": "2030-01-01",
        "expected_annual_return_rate": 4.0,
    })
    assert update.status_code == 200
    data = update.json()
    assert data["target_amount"] == 10000
    assert data["progress_pct"] == 20.0  # 2000 / 10000
    assert data["required_monthly_saving"] is not None
    assert data["achieved"] is False

    get_resp = await auth_client.get("/api/v1/finance/goal")
    assert get_resp.status_code == 200
    assert get_resp.json()["target_amount"] == 10000


@pytest.mark.asyncio
async def test_goal_scenarios_are_monotonically_decreasing(auth_client):
    """수익률이 높은 시나리오일수록 필요 월 저축액이 작거나 같아야 한다."""
    await auth_client.post("/api/v1/finance/records", json={
        "record_date": "2026-01-01", "total_assets": 1000,
        "monthly_income": 300, "monthly_expense": 200,
    })
    resp = await auth_client.put("/api/v1/finance/goal", json={
        "target_amount": 5000, "target_date": "2031-01-01",
    })
    assert resp.status_code == 200
    scenarios = resp.json()["scenarios"]
    assert len(scenarios) == 5
    rates = [s["annual_return_rate"] for s in scenarios]
    assert rates == sorted(rates)
    requireds = [s["required_monthly_saving"] for s in scenarios]
    assert requireds == sorted(requireds, reverse=True)


@pytest.mark.asyncio
async def test_update_goal_partial_keeps_existing_fields(auth_client):
    await auth_client.put("/api/v1/finance/goal", json={
        "target_amount": 5000, "target_date": "2028-01-01", "expected_annual_return_rate": 3.0,
    })
    resp = await auth_client.put("/api/v1/finance/goal", json={"target_amount": 8000})
    assert resp.status_code == 200
    data = resp.json()
    assert data["target_amount"] == 8000
    assert data["target_date"] == "2028-01-01"
    assert data["expected_annual_return_rate"] == 3.0
