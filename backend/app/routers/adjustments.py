import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.adjustment import TaxAdjustment
from app.models.filing import TaxFiling
from app.schemas.adjustment import (
    VALID_ADJUSTMENT_TYPES,
    VALID_QUARTERS,
    AdjustmentCreate,
    AdjustmentResponse,
    AdjustmentUpdate,
)


async def _mark_draft(db: AsyncSession, filing_id: str) -> None:
    """Reset filing status to 'draft' when adjustment data changes."""
    stmt = select(TaxFiling).where(TaxFiling.id == uuid.UUID(filing_id))
    result = await db.execute(stmt)
    filing = result.scalar_one_or_none()
    if filing and filing.status != "draft":
        filing.status = "draft"
        await db.flush()

router = APIRouter(prefix="/api/filings/{filing_id}/adjustments", tags=["adjustments"])


@router.post("/", response_model=AdjustmentResponse, status_code=201)
async def create_adjustment(
    filing_id: str,
    adjustment: AdjustmentCreate,
    db: AsyncSession = Depends(get_db),
):
    if adjustment.adjustment_type not in VALID_ADJUSTMENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid adjustment_type '{adjustment.adjustment_type}'. Must be one of: {VALID_ADJUSTMENT_TYPES}",
        )
    # Validate quarter for self_assessment
    if adjustment.adjustment_type == "self_assessment":
        if adjustment.quarter and adjustment.quarter not in VALID_QUARTERS:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid quarter '{adjustment.quarter}'. Must be one of: {VALID_QUARTERS}",
            )
        # Auto-generate label from quarter if not provided or generic
        if adjustment.quarter:
            adjustment.label = f"{adjustment.quarter} Self-Assessment"
    elif adjustment.quarter:
        # Clear quarter for non-self_assessment types
        adjustment.quarter = None

    entry = TaxAdjustment(
        filing_id=uuid.UUID(filing_id),
        **adjustment.model_dump(),
    )
    db.add(entry)
    await db.flush()
    await db.refresh(entry)
    await _mark_draft(db, filing_id)
    return entry


@router.get("/", response_model=list[AdjustmentResponse])
async def list_adjustments(
    filing_id: str,
    db: AsyncSession = Depends(get_db),
):
    fid = uuid.UUID(filing_id)
    stmt = (
        select(TaxAdjustment)
        .where(TaxAdjustment.filing_id == fid)
        .order_by(TaxAdjustment.created_at)
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.put("/{adjustment_id}", response_model=AdjustmentResponse)
async def update_adjustment(
    filing_id: str,
    adjustment_id: str,
    update: AdjustmentUpdate,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(TaxAdjustment).where(TaxAdjustment.id == uuid.UUID(adjustment_id))
    result = await db.execute(stmt)
    entry = result.scalar_one_or_none()
    if entry is None:
        raise HTTPException(status_code=404, detail="Adjustment not found")

    update_data = update.model_dump(exclude_unset=True)

    if "adjustment_type" in update_data and update_data["adjustment_type"] not in VALID_ADJUSTMENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid adjustment_type '{update_data['adjustment_type']}'. Must be one of: {VALID_ADJUSTMENT_TYPES}",
        )

    for field, value in update_data.items():
        setattr(entry, field, value)

    await db.flush()
    await db.refresh(entry)
    await _mark_draft(db, filing_id)
    return entry


@router.patch("/{adjustment_id}/toggle", response_model=AdjustmentResponse)
async def toggle_adjustment(
    filing_id: str,
    adjustment_id: str,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(TaxAdjustment).where(TaxAdjustment.id == uuid.UUID(adjustment_id))
    result = await db.execute(stmt)
    entry = result.scalar_one_or_none()
    if entry is None:
        raise HTTPException(status_code=404, detail="Adjustment not found")
    entry.is_active = not entry.is_active
    await db.flush()
    await db.refresh(entry)
    await _mark_draft(db, filing_id)
    return entry


@router.delete("/{adjustment_id}", status_code=204)
async def delete_adjustment(
    filing_id: str,
    adjustment_id: str,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(TaxAdjustment).where(TaxAdjustment.id == uuid.UUID(adjustment_id))
    result = await db.execute(stmt)
    entry = result.scalar_one_or_none()
    if entry is None:
        raise HTTPException(status_code=404, detail="Adjustment not found")
    await db.delete(entry)
    await db.flush()
    await _mark_draft(db, filing_id)
