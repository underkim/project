import pytest
from pydantic import ValidationError
from app.modules.finance.schemas import AssetRecordCreate, AssetRecordUpdate
from app.modules.finance.service import _to_response
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
async def test_update_finance_record_not_found_returns_404(auth_client):
    resp = await auth_client.put("/api/v1/finance/records/99999", json={"total_assets": 5000})
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_finance_record_not_found_returns_404(auth_client):
    resp = await auth_client.delete("/api/v1/finance/records/99999")
    assert resp.status_code == 404
