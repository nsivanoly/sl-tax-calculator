from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.tax_config import TaxConfig, TaxSlab
from app.schemas.tax_config import TaxConfigResponse, TaxConfigUpdate, TaxSlabSchema

router = APIRouter(prefix="/api/tax-config", tags=["tax-config"])


async def _get_config(db: AsyncSession, fiscal_year: str) -> TaxConfig:
    stmt = (
        select(TaxConfig)
        .options(selectinload(TaxConfig.slabs))
        .where(TaxConfig.fiscal_year == fiscal_year)
    )
    result = await db.execute(stmt)
    config = result.scalar_one_or_none()
    if config is None:
        raise HTTPException(status_code=404, detail=f"Tax config not found for {fiscal_year}")
    return config


@router.get("/", response_model=TaxConfigResponse)
async def get_tax_config(
    fiscal_year: str = Query(default="2025/26"),
    db: AsyncSession = Depends(get_db),
):
    config = await _get_config(db, fiscal_year)
    local_slabs = sorted([s for s in config.slabs if s.slab_type == "local"], key=lambda s: s.slab_order)
    foreign_slabs = sorted([s for s in config.slabs if s.slab_type == "foreign"], key=lambda s: s.slab_order)
    return TaxConfigResponse(
        fiscal_year=config.fiscal_year,
        tax_free_threshold=config.tax_free_threshold,
        interest_exemption_limit=config.interest_exemption_limit,
        wht_rate_resident=config.wht_rate_resident,
        has_foreign_tax=config.has_foreign_tax,
        local_slabs=local_slabs,
        foreign_slabs=foreign_slabs,
    )


@router.put("/", response_model=TaxConfigResponse)
async def update_tax_config(
    update: TaxConfigUpdate,
    fiscal_year: str = Query(default="2025/26"),
    db: AsyncSession = Depends(get_db),
):
    config = await _get_config(db, fiscal_year)
    update_data = update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(config, field, value)
    await db.flush()
    await db.refresh(config)
    # Re-fetch with slabs loaded
    config = await _get_config(db, fiscal_year)
    local_slabs = sorted([s for s in config.slabs if s.slab_type == "local"], key=lambda s: s.slab_order)
    foreign_slabs = sorted([s for s in config.slabs if s.slab_type == "foreign"], key=lambda s: s.slab_order)
    return TaxConfigResponse(
        fiscal_year=config.fiscal_year,
        tax_free_threshold=config.tax_free_threshold,
        interest_exemption_limit=config.interest_exemption_limit,
        wht_rate_resident=config.wht_rate_resident,
        has_foreign_tax=config.has_foreign_tax,
        local_slabs=local_slabs,
        foreign_slabs=foreign_slabs,
    )


@router.get("/slabs", response_model=list[TaxSlabSchema])
async def get_slabs(
    fiscal_year: str = Query(default="2025/26"),
    db: AsyncSession = Depends(get_db),
):
    config = await _get_config(db, fiscal_year)
    return config.slabs


class CopyFromFYRequest(BaseModel):
    source_fiscal_year: str


@router.post("/copy-from", response_model=TaxConfigResponse)
async def copy_tax_config(
    req: CopyFromFYRequest,
    fiscal_year: str = Query(default="2025/26"),
    db: AsyncSession = Depends(get_db),
):
    """Copy tax config (settings + slabs) from one FY to another."""
    if req.source_fiscal_year == fiscal_year:
        raise HTTPException(status_code=400, detail="Source and target fiscal years must differ")

    source = await _get_config(db, req.source_fiscal_year)
    target = await _get_config(db, fiscal_year)

    # Copy settings
    target.tax_free_threshold = source.tax_free_threshold
    target.interest_exemption_limit = source.interest_exemption_limit
    target.wht_rate_resident = source.wht_rate_resident
    target.has_foreign_tax = source.has_foreign_tax

    # Delete existing target slabs
    for existing_slab in list(target.slabs):
        await db.delete(existing_slab)
    await db.flush()

    # Copy slabs
    for slab in source.slabs:
        db.add(TaxSlab(
            config_id=target.id,
            slab_order=slab.slab_order,
            lower_bound=slab.lower_bound,
            upper_bound=slab.upper_bound,
            rate=slab.rate,
            label=slab.label,
            slab_type=slab.slab_type,
        ))
    await db.flush()

    # Re-fetch with slabs
    config = await _get_config(db, fiscal_year)
    local_slabs = sorted([s for s in config.slabs if s.slab_type == "local"], key=lambda s: s.slab_order)
    foreign_slabs = sorted([s for s in config.slabs if s.slab_type == "foreign"], key=lambda s: s.slab_order)
    return TaxConfigResponse(
        fiscal_year=config.fiscal_year,
        tax_free_threshold=config.tax_free_threshold,
        interest_exemption_limit=config.interest_exemption_limit,
        wht_rate_resident=config.wht_rate_resident,
        has_foreign_tax=config.has_foreign_tax,
        local_slabs=local_slabs,
        foreign_slabs=foreign_slabs,
    )


class SlabsUpdate(BaseModel):
    local_slabs: list[TaxSlabSchema]
    foreign_slabs: list[TaxSlabSchema]


@router.put("/slabs", response_model=SlabsUpdate)
async def replace_slabs(
    update: SlabsUpdate,
    fiscal_year: str = Query(default="2025/26"),
    db: AsyncSession = Depends(get_db),
):
    config = await _get_config(db, fiscal_year)

    # Delete all existing slabs
    for existing_slab in list(config.slabs):
        await db.delete(existing_slab)
    await db.flush()

    all_new = []
    for slab_data in update.local_slabs:
        slab = TaxSlab(config_id=config.id, slab_type="local", **slab_data.model_dump(exclude={"slab_type"}))
        db.add(slab)
        all_new.append(slab)
    for slab_data in update.foreign_slabs:
        slab = TaxSlab(config_id=config.id, slab_type="foreign", **slab_data.model_dump(exclude={"slab_type"}))
        db.add(slab)
        all_new.append(slab)

    await db.flush()
    for s in all_new:
        await db.refresh(s)

    return SlabsUpdate(
        local_slabs=[s for s in all_new if s.slab_type == "local"],
        foreign_slabs=[s for s in all_new if s.slab_type == "foreign"],
    )
