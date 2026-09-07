"""Per-user dashboard: historical tax data across fiscal years."""
import uuid

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.filing import TaxFiling
from app.models.income import IncomeEntry
from app.models.user import User
from app.services.tax_calculator import calculate_tax

router = APIRouter(prefix="/api/users/{user_id}/dashboard", tags=["user-dashboard"])


class FilingSnapshot(BaseModel):
    filing_id: str
    fiscal_year: str
    status: str
    gross_income: float
    net_tax_payable: float
    effective_rate_pct: float
    total_credits: float
    gross_tax: float
    salary: float
    interest: float
    foreign_employment: float
    other: float


class UserDashboardResponse(BaseModel):
    user_id: str
    user_name: str
    filings: list[FilingSnapshot]
    total_tax_paid: float
    total_income_earned: float
    avg_effective_rate: float


@router.get("/", response_model=UserDashboardResponse)
async def get_user_dashboard(
    user_id: str,
    db: AsyncSession = Depends(get_db),
):
    # Verify user
    user_stmt = select(User).where(User.id == uuid.UUID(user_id))
    user_result = await db.execute(user_stmt)
    user = user_result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    # Get all filings for user, ordered by fiscal year
    filings_stmt = (
        select(TaxFiling)
        .where(TaxFiling.user_id == uuid.UUID(user_id))
        .order_by(TaxFiling.fiscal_year)
    )
    filings_result = await db.execute(filings_stmt)
    filings = list(filings_result.scalars().all())

    snapshots: list[FilingSnapshot] = []
    total_tax = 0.0
    total_income = 0.0

    for filing in filings:
        try:
            breakdown = await calculate_tax(db, str(filing.id), exempt_entry_ids=[], relief_on="local")
            snap = FilingSnapshot(
                filing_id=str(filing.id),
                fiscal_year=filing.fiscal_year,
                status=filing.status,
                gross_income=float(breakdown.gross_income.total),
                net_tax_payable=float(breakdown.net_tax_payable),
                effective_rate_pct=float(breakdown.effective_rate_pct),
                total_credits=float(breakdown.credits.total_credits),
                gross_tax=float(breakdown.gross_tax),
                salary=float(breakdown.gross_income.salary),
                interest=float(breakdown.gross_income.interest),
                foreign_employment=float(breakdown.gross_income.foreign_employment),
                other=float(breakdown.gross_income.other),
            )
            snapshots.append(snap)
            total_tax += snap.net_tax_payable
            total_income += snap.gross_income
        except Exception:
            # Filing may not have config or data — skip
            snapshots.append(FilingSnapshot(
                filing_id=str(filing.id),
                fiscal_year=filing.fiscal_year,
                status=filing.status,
                gross_income=0, net_tax_payable=0, effective_rate_pct=0,
                total_credits=0, gross_tax=0, salary=0, interest=0,
                foreign_employment=0, other=0,
            ))

    avg_rate = 0.0
    rate_count = sum(1 for s in snapshots if s.gross_income > 0)
    if rate_count > 0:
        avg_rate = sum(s.effective_rate_pct for s in snapshots if s.gross_income > 0) / rate_count

    return UserDashboardResponse(
        user_id=str(user.id),
        user_name=user.name,
        filings=snapshots,
        total_tax_paid=total_tax,
        total_income_earned=total_income,
        avg_effective_rate=avg_rate,
    )


@router.get("/export-history-pdf")
async def export_tax_history_pdf(
    user_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Export a multi-year Tax History PDF for a user."""
    from app.services.tax_history_pdf import generate_tax_history_pdf, FilingData

    # Verify user
    user_stmt = select(User).where(User.id == uuid.UUID(user_id))
    user_result = await db.execute(user_stmt)
    user = user_result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    # Get all filings, ordered by fiscal year
    filings_stmt = (
        select(TaxFiling)
        .where(TaxFiling.user_id == uuid.UUID(user_id))
        .order_by(TaxFiling.fiscal_year)
    )
    filings_result = await db.execute(filings_stmt)
    filings = list(filings_result.scalars().all())

    if not filings:
        raise HTTPException(status_code=404, detail="No filings found for this user")

    filing_data_list: list[FilingData] = []
    for filing in filings:
        try:
            breakdown = await calculate_tax(db, str(filing.id), exempt_entry_ids=[], relief_on="local")
            filing_data_list.append(FilingData(
                fiscal_year=filing.fiscal_year,
                status=filing.status,
                breakdown=breakdown,
            ))
        except Exception:
            pass  # skip filings without data

    if not filing_data_list:
        raise HTTPException(status_code=404, detail="No calculable filings found")

    pdf_buffer = generate_tax_history_pdf(
        taxpayer_name=user.name,
        filings=filing_data_list,
    )

    filename = f"tax_history_{user.name.replace(' ', '_')}.pdf"
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
