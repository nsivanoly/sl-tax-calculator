from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict


VALID_ADJUSTMENT_TYPES = [
    "paye_deducted",
    "self_assessment",
    "wht_credit",
    "other_credit",
    "other_deduction",
]

VALID_QUARTERS = ["Q1", "Q2", "Q3", "Q4"]


class AdjustmentCreate(BaseModel):
    label: str
    adjustment_type: str
    quarter: str | None = None  # Q1-Q4 for self_assessment
    amount: float
    description: str | None = None
    is_active: bool = True


class AdjustmentUpdate(BaseModel):
    label: str | None = None
    adjustment_type: str | None = None
    quarter: str | None = None
    amount: float | None = None
    description: str | None = None
    is_active: bool | None = None


class AdjustmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    filing_id: UUID
    label: str
    adjustment_type: str
    quarter: str | None = None
    amount: float
    description: str | None = None
    is_active: bool
    created_at: datetime
