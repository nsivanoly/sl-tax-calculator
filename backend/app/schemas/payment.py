from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class PaymentCreate(BaseModel):
    quarter: str
    amount: float
    paid_date: date | None = None


class PaymentUpdate(BaseModel):
    quarter: str | None = None
    amount: float | None = None
    paid_date: date | None = None


class PaymentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    filing_id: UUID
    quarter: str
    amount: float
    paid_date: date | None = None
    created_at: datetime
