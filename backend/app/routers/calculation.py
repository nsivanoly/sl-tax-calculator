import uuid

from pydantic import BaseModel
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.filing import TaxFiling
from app.schemas.calculation import OptimizationResult, TaxBreakdown
from app.services.tax_calculator import calculate_tax
from app.services.tax_optimizer import optimize_exemptions


async def _mark_calculated(db: AsyncSession, filing_id: str) -> None:
    """Auto-set filing status to 'calculated' after a successful tax computation.
    Only promotes from 'draft' — never regresses from paid/filed/assessed etc."""
    stmt = select(TaxFiling).where(TaxFiling.id == uuid.UUID(filing_id))
    result = await db.execute(stmt)
    filing = result.scalar_one_or_none()
    if filing and filing.status == "draft":
        filing.status = "calculated"
        await db.flush()

router = APIRouter(prefix="/api/filings/{filing_id}/calculate", tags=["calculation"])


class CalculateRequest(BaseModel):
    exempt_entry_ids: list[str] | None = None
    relief_on: str = "local"  # 'local' or 'foreign'


class CompareResponse(BaseModel):
    local: TaxBreakdown
    foreign: TaxBreakdown


@router.post("/", response_model=TaxBreakdown)
async def calculate(
    filing_id: str,
    req: CalculateRequest,
    db: AsyncSession = Depends(get_db),
):
    result = await calculate_tax(db, filing_id, req.exempt_entry_ids, req.relief_on)
    await _mark_calculated(db, filing_id)
    return result


@router.post("/optimize", response_model=OptimizationResult)
async def optimize(
    filing_id: str,
    db: AsyncSession = Depends(get_db),
):
    result = await optimize_exemptions(db, filing_id)
    await _mark_calculated(db, filing_id)
    return result


@router.post("/compare", response_model=CompareResponse)
async def compare(
    filing_id: str,
    db: AsyncSession = Depends(get_db),
):
    local = await calculate_tax(db, filing_id, exempt_entry_ids=[], relief_on="local")
    foreign = await calculate_tax(db, filing_id, exempt_entry_ids=[], relief_on="foreign")

    await _mark_calculated(db, filing_id)
    return CompareResponse(
        local=local,
        foreign=foreign,
    )
