from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class IncomeCreate(BaseModel):
    category: str
    source_name: str | None = None
    account_number: str | None = None
    amount_lkr: float
    amount_foreign: float | None = None
    foreign_currency: str | None = None
    exchange_rate: float | None = None
    received_date: date | None = None
    wht_deducted: float = 0.0
    paye_deducted: float = 0.0
    description: str | None = None
    is_active: bool = True


class IncomeUpdate(BaseModel):
    category: str | None = None
    source_name: str | None = None
    account_number: str | None = None
    amount_lkr: float | None = None
    amount_foreign: float | None = None
    foreign_currency: str | None = None
    exchange_rate: float | None = None
    received_date: date | None = None
    wht_deducted: float | None = None
    paye_deducted: float | None = None
    description: str | None = None
    is_active: bool | None = None


class IncomeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    filing_id: UUID
    category: str
    source_name: str | None = None
    account_number: str | None = None
    amount_lkr: float
    amount_foreign: float | None = None
    foreign_currency: str | None = None
    exchange_rate: float | None = None
    received_date: date | None = None
    wht_deducted: float
    paye_deducted: float
    description: str | None = None
    is_active: bool
    created_at: datetime


class IncomeSummary(BaseModel):
    salary_total: float
    interest_total: float
    foreign_total: float
    other_total: float
    grand_total: float
    total_wht: float
    total_paye: float
