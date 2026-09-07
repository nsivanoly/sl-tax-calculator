import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.payment import SelfAssessmentPayment
from app.schemas.payment import PaymentCreate, PaymentResponse, PaymentUpdate

router = APIRouter(prefix="/api/filings/{filing_id}/payments", tags=["payments"])


@router.post("/", response_model=PaymentResponse, status_code=201)
async def create_payment(
    filing_id: str,
    payment: PaymentCreate,
    db: AsyncSession = Depends(get_db),
):
    entry = SelfAssessmentPayment(
        filing_id=uuid.UUID(filing_id),
        **payment.model_dump(),
    )
    db.add(entry)
    await db.flush()
    await db.refresh(entry)
    return entry


@router.get("/", response_model=list[PaymentResponse])
async def list_payments(
    filing_id: str,
    db: AsyncSession = Depends(get_db),
):
    fid = uuid.UUID(filing_id)
    stmt = (
        select(SelfAssessmentPayment)
        .where(SelfAssessmentPayment.filing_id == fid)
        .order_by(SelfAssessmentPayment.quarter)
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.get("/{payment_id}", response_model=PaymentResponse)
async def get_payment(
    filing_id: str,
    payment_id: str,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(SelfAssessmentPayment).where(
        SelfAssessmentPayment.id == uuid.UUID(payment_id)
    )
    result = await db.execute(stmt)
    entry = result.scalar_one_or_none()
    if entry is None:
        raise HTTPException(status_code=404, detail="Payment not found")
    return entry


@router.put("/{payment_id}", response_model=PaymentResponse)
async def update_payment(
    filing_id: str,
    payment_id: str,
    update: PaymentUpdate,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(SelfAssessmentPayment).where(
        SelfAssessmentPayment.id == uuid.UUID(payment_id)
    )
    result = await db.execute(stmt)
    entry = result.scalar_one_or_none()
    if entry is None:
        raise HTTPException(status_code=404, detail="Payment not found")

    update_data = update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(entry, field, value)

    await db.flush()
    await db.refresh(entry)
    return entry


@router.delete("/{payment_id}", status_code=204)
async def delete_payment(
    filing_id: str,
    payment_id: str,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(SelfAssessmentPayment).where(
        SelfAssessmentPayment.id == uuid.UUID(payment_id)
    )
    result = await db.execute(stmt)
    entry = result.scalar_one_or_none()
    if entry is None:
        raise HTTPException(status_code=404, detail="Payment not found")
    await db.delete(entry)
    await db.flush()
