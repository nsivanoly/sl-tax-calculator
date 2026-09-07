import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.filing import TaxFiling
from app.models.income import IncomeEntry
from app.schemas.income import IncomeCreate, IncomeResponse, IncomeSummary, IncomeUpdate
from app.services.csv_parser import parse_csv


async def _mark_draft(db: AsyncSession, filing_id: str) -> None:
    """Reset filing status to 'draft' when income data changes."""
    stmt = select(TaxFiling).where(TaxFiling.id == uuid.UUID(filing_id))
    result = await db.execute(stmt)
    filing = result.scalar_one_or_none()
    if filing and filing.status != "draft":
        filing.status = "draft"
        await db.flush()

router = APIRouter(prefix="/api/filings/{filing_id}/income", tags=["income"])


@router.post("/", response_model=IncomeResponse, status_code=201)
async def create_income(
    filing_id: str,
    income: IncomeCreate,
    db: AsyncSession = Depends(get_db),
):
    entry = IncomeEntry(
        filing_id=uuid.UUID(filing_id),
        **income.model_dump(),
    )
    db.add(entry)
    await db.flush()
    await db.refresh(entry)
    await _mark_draft(db, filing_id)
    return entry


@router.get("/summary", response_model=IncomeSummary)
async def get_income_summary(
    filing_id: str,
    db: AsyncSession = Depends(get_db),
):
    fid = uuid.UUID(filing_id)
    stmt = select(IncomeEntry).where(
        IncomeEntry.filing_id == fid,
        IncomeEntry.is_active == True,  # noqa: E712 — only active entries in summary
    )
    result = await db.execute(stmt)
    entries = result.scalars().all()

    from decimal import Decimal

    ZERO = Decimal("0")
    salary_total = ZERO
    interest_total = ZERO
    foreign_total = ZERO
    other_total = ZERO
    total_wht = ZERO
    total_paye = ZERO

    for e in entries:
        amt = e.amount_lkr or ZERO
        if e.category == "salary":
            salary_total += amt
            total_paye += e.paye_deducted or ZERO
        elif e.category == "interest":
            interest_total += amt
            total_wht += e.wht_deducted or ZERO
        elif e.category == "foreign_employment":
            foreign_total += amt
        elif e.category == "other":
            other_total += amt

    return IncomeSummary(
        salary_total=salary_total,
        interest_total=interest_total,
        foreign_total=foreign_total,
        other_total=other_total,
        grand_total=salary_total + interest_total + foreign_total + other_total,
        total_wht=total_wht,
        total_paye=total_paye,
    )


@router.get("/", response_model=list[IncomeResponse])
async def list_income(
    filing_id: str,
    category: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    fid = uuid.UUID(filing_id)
    stmt = select(IncomeEntry).where(IncomeEntry.filing_id == fid)
    if category:
        stmt = stmt.where(IncomeEntry.category == category)
    stmt = stmt.order_by(IncomeEntry.created_at)
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.get("/{income_id}", response_model=IncomeResponse)
async def get_income(
    filing_id: str,
    income_id: str,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(IncomeEntry).where(IncomeEntry.id == uuid.UUID(income_id))
    result = await db.execute(stmt)
    entry = result.scalar_one_or_none()
    if entry is None:
        raise HTTPException(status_code=404, detail="Income entry not found")
    return entry


@router.put("/{income_id}", response_model=IncomeResponse)
async def update_income(
    filing_id: str,
    income_id: str,
    update: IncomeUpdate,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(IncomeEntry).where(IncomeEntry.id == uuid.UUID(income_id))
    result = await db.execute(stmt)
    entry = result.scalar_one_or_none()
    if entry is None:
        raise HTTPException(status_code=404, detail="Income entry not found")

    update_data = update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(entry, field, value)

    await db.flush()
    await db.refresh(entry)
    await _mark_draft(db, filing_id)
    return entry


@router.patch("/{income_id}/toggle", response_model=IncomeResponse)
async def toggle_income(
    filing_id: str,
    income_id: str,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(IncomeEntry).where(IncomeEntry.id == uuid.UUID(income_id))
    result = await db.execute(stmt)
    entry = result.scalar_one_or_none()
    if entry is None:
        raise HTTPException(status_code=404, detail="Income entry not found")
    entry.is_active = not entry.is_active
    await db.flush()
    await db.refresh(entry)
    await _mark_draft(db, filing_id)
    return entry


@router.delete("/{income_id}", status_code=204)
async def delete_income(
    filing_id: str,
    income_id: str,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(IncomeEntry).where(IncomeEntry.id == uuid.UUID(income_id))
    result = await db.execute(stmt)
    entry = result.scalar_one_or_none()
    if entry is None:
        raise HTTPException(status_code=404, detail="Income entry not found")
    await db.delete(entry)
    await db.flush()
    await _mark_draft(db, filing_id)


@router.post("/bulk-csv")
async def bulk_upload_csv(
    filing_id: str,
    file: UploadFile,
    db: AsyncSession = Depends(get_db),
):
    content = await file.read()
    valid_entries, errors = parse_csv(content)

    fid = uuid.UUID(filing_id)
    created_count = 0

    for entry_data in valid_entries:
        entry = IncomeEntry(
            filing_id=fid,
            **entry_data.model_dump(),
        )
        db.add(entry)
        created_count += 1

    await db.flush()
    await _mark_draft(db, filing_id)

    return {
        "created": created_count,
        "errors": [{"row": row, "message": msg} for row, msg in errors],
    }
