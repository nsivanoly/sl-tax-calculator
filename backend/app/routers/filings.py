import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.filing import TaxFiling
from app.models.user import User
from app.services.tax_calculator import calculate_tax

router = APIRouter(prefix="/api/filings", tags=["filings"])

VALID_STATUSES = ["draft", "calculated", "paying", "paid", "filed", "assessed"]

# Allowed transitions: current status -> set of valid next statuses
STATUS_TRANSITIONS: dict[str, set[str]] = {
    "draft": {"calculated"},
    "calculated": {"draft", "paying", "paid", "filed"},
    "paying": {"draft", "calculated", "paid", "filed"},
    "paid": {"draft", "calculated", "filed"},
    "filed": {"draft", "assessed"},
    "assessed": {"draft", "filed"},
}


class FilingResponse(BaseModel):
    id: str
    user_id: str
    user_name: str
    fiscal_year: str
    status: str
    gross_income: float | None = None
    gross_tax: float | None = None
    total_credits: float | None = None
    wht_credits: float | None = None        # WHT + PAYE (deducted at source)
    self_assessment_paid: float | None = None  # quarterly self-assessment payments
    net_tax_payable: float | None = None
    effective_rate_pct: float | None = None

    model_config = {"from_attributes": True}


class FilingCreate(BaseModel):
    user_id: str
    fiscal_year: str


class FilingUpdate(BaseModel):
    status: str | None = None


def _to_response(
    f: TaxFiling,
    gross_income: float | None = None,
    gross_tax: float | None = None,
    total_credits: float | None = None,
    wht_credits: float | None = None,
    self_assessment_paid: float | None = None,
    net_tax_payable: float | None = None,
    effective_rate_pct: float | None = None,
) -> FilingResponse:
    return FilingResponse(
        id=str(f.id),
        user_id=str(f.user_id),
        user_name=f.user.name if f.user else "Unknown",
        fiscal_year=f.fiscal_year,
        status=f.status,
        gross_income=gross_income,
        gross_tax=gross_tax,
        total_credits=total_credits,
        wht_credits=wht_credits,
        self_assessment_paid=self_assessment_paid,
        net_tax_payable=net_tax_payable,
        effective_rate_pct=effective_rate_pct,
    )


@router.get("/", response_model=list[FilingResponse])
async def list_filings(db: AsyncSession = Depends(get_db)):
    stmt = (
        select(TaxFiling)
        .options(selectinload(TaxFiling.user))
        .order_by(TaxFiling.created_at.desc())
    )
    result = await db.execute(stmt)
    filings = list(result.scalars().all())

    responses = []
    for f in filings:
        gross_income = None
        gross_tax = None
        total_credits = None
        wht_credits = None
        self_assessment_paid = None
        net_tax_payable = None
        effective_rate_pct = None
        try:
            breakdown = await calculate_tax(db, str(f.id), exempt_entry_ids=[], relief_on="local")
            gross_income = float(breakdown.gross_income.total)
            gross_tax = float(breakdown.gross_tax)
            total_credits = float(breakdown.credits.total_credits)
            wht_credits = float(breakdown.credits.wht_on_interest + breakdown.credits.paye_deducted)
            self_assessment_paid = float(breakdown.credits.self_assessment_paid)
            net_tax_payable = float(breakdown.net_tax_payable)
            effective_rate_pct = float(breakdown.effective_rate_pct)
        except Exception:
            pass  # filing may lack config or income data
        responses.append(_to_response(f, gross_income, gross_tax, total_credits, wht_credits, self_assessment_paid, net_tax_payable, effective_rate_pct))
    return responses


@router.post("/", response_model=FilingResponse, status_code=201)
async def create_filing(data: FilingCreate, db: AsyncSession = Depends(get_db)):
    # Verify user exists
    user_stmt = select(User).where(User.id == uuid.UUID(data.user_id))
    user_result = await db.execute(user_stmt)
    user = user_result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    # Check for duplicate
    dup_stmt = select(TaxFiling).where(
        TaxFiling.user_id == uuid.UUID(data.user_id),
        TaxFiling.fiscal_year == data.fiscal_year,
    )
    dup_result = await db.execute(dup_stmt)
    if dup_result.scalar_one_or_none() is not None:
        raise HTTPException(status_code=409, detail="Filing already exists for this user and fiscal year")

    filing = TaxFiling(
        user_id=uuid.UUID(data.user_id),
        fiscal_year=data.fiscal_year,
        status="draft",
    )
    db.add(filing)
    await db.flush()
    await db.refresh(filing, attribute_names=["user"])
    return _to_response(filing)


@router.get("/{filing_id}", response_model=FilingResponse)
async def get_filing(filing_id: str, db: AsyncSession = Depends(get_db)):
    filing = await _get_or_404(filing_id, db)
    return _to_response(filing)


@router.put("/{filing_id}", response_model=FilingResponse)
async def update_filing(filing_id: str, update: FilingUpdate, db: AsyncSession = Depends(get_db)):
    filing = await _get_or_404(filing_id, db)

    update_data = update.model_dump(exclude_unset=True)

    # Validate status transition
    if "status" in update_data:
        new_status = update_data["status"]
        if new_status not in VALID_STATUSES:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid status '{new_status}'. Must be one of: {VALID_STATUSES}",
            )
        allowed = STATUS_TRANSITIONS.get(filing.status, set())
        if new_status != filing.status and new_status not in allowed:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot transition from '{filing.status}' to '{new_status}'. Allowed: {sorted(allowed)}",
            )

    for field, value in update_data.items():
        setattr(filing, field, value)

    await db.flush()
    await db.refresh(filing, attribute_names=["user"])
    return _to_response(filing)


@router.delete("/{filing_id}", status_code=204)
async def delete_filing(filing_id: str, db: AsyncSession = Depends(get_db)):
    filing = await _get_or_404(filing_id, db)
    await db.delete(filing)
    await db.flush()


async def _get_or_404(filing_id: str, db: AsyncSession) -> TaxFiling:
    stmt = (
        select(TaxFiling)
        .options(selectinload(TaxFiling.user))
        .where(TaxFiling.id == uuid.UUID(filing_id))
    )
    result = await db.execute(stmt)
    filing = result.scalar_one_or_none()
    if filing is None:
        raise HTTPException(status_code=404, detail="Filing not found")
    return filing
