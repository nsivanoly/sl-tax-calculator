import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.fiscal_year import FiscalYear

router = APIRouter(prefix="/api/fiscal-years", tags=["fiscal-years"])


class FiscalYearResponse(BaseModel):
    id: str
    year_code: str
    start_date: str
    end_date: str
    is_active: bool
    is_default: bool

    model_config = {"from_attributes": True}


class FiscalYearCreate(BaseModel):
    year_code: str
    start_date: date
    end_date: date
    is_active: bool = True
    is_default: bool = False


class FiscalYearUpdate(BaseModel):
    year_code: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    is_active: bool | None = None
    is_default: bool | None = None


def _to_response(fy: FiscalYear) -> FiscalYearResponse:
    return FiscalYearResponse(
        id=str(fy.id),
        year_code=fy.year_code,
        start_date=fy.start_date.isoformat(),
        end_date=fy.end_date.isoformat(),
        is_active=fy.is_active,
        is_default=fy.is_default,
    )


@router.get("/", response_model=list[FiscalYearResponse])
async def list_fiscal_years(db: AsyncSession = Depends(get_db)):
    stmt = select(FiscalYear).order_by(FiscalYear.year_code)
    result = await db.execute(stmt)
    return [_to_response(fy) for fy in result.scalars().all()]


@router.post("/", response_model=FiscalYearResponse, status_code=201)
async def create_fiscal_year(fy: FiscalYearCreate, db: AsyncSession = Depends(get_db)):
    # If setting as default, clear existing default
    if fy.is_default:
        await _clear_default(db)

    entry = FiscalYear(
        year_code=fy.year_code,
        start_date=fy.start_date,
        end_date=fy.end_date,
        is_active=fy.is_active,
        is_default=fy.is_default,
    )
    db.add(entry)
    await db.flush()
    await db.refresh(entry)
    return _to_response(entry)


@router.get("/{fy_id}", response_model=FiscalYearResponse)
async def get_fiscal_year(fy_id: str, db: AsyncSession = Depends(get_db)):
    fy = await _get_or_404(fy_id, db)
    return _to_response(fy)


@router.put("/{fy_id}", response_model=FiscalYearResponse)
async def update_fiscal_year(fy_id: str, update: FiscalYearUpdate, db: AsyncSession = Depends(get_db)):
    fy = await _get_or_404(fy_id, db)

    update_data = update.model_dump(exclude_unset=True)

    # If setting as default, clear existing default first
    if update_data.get("is_default"):
        await _clear_default(db)

    for field, value in update_data.items():
        setattr(fy, field, value)

    await db.flush()
    await db.refresh(fy)
    return _to_response(fy)


@router.delete("/{fy_id}", status_code=204)
async def delete_fiscal_year(fy_id: str, db: AsyncSession = Depends(get_db)):
    fy = await _get_or_404(fy_id, db)
    await db.delete(fy)
    await db.flush()


async def _get_or_404(fy_id: str, db: AsyncSession) -> FiscalYear:
    stmt = select(FiscalYear).where(FiscalYear.id == uuid.UUID(fy_id))
    result = await db.execute(stmt)
    fy = result.scalar_one_or_none()
    if fy is None:
        raise HTTPException(status_code=404, detail="Fiscal year not found")
    return fy


async def _clear_default(db: AsyncSession) -> None:
    stmt = select(FiscalYear).where(FiscalYear.is_default == True)
    result = await db.execute(stmt)
    for existing in result.scalars().all():
        existing.is_default = False
