import pytest
from pydantic import ValidationError
from app.modules.finance.schemas import AssetRecordCreate
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


def test_finance_routes_registered(app):
    routes = {route.path for route in app.routes}
    assert "/api/v1/finance/records" in routes
    assert "/api/v1/finance/summary" in routes
