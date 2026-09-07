from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.filing import TaxFiling
from app.models.tax_config import TaxConfig
from app.schemas.calculation import OptimizationResult
from app.services.tax_calculator import calculate_tax


async def optimize_exemptions(
    db: AsyncSession,
    filing_id: str,
) -> OptimizationResult:
    """Find the relief placement (local vs foreign) that minimizes net tax.

    Interest is real earned income — WHT deducted at source is a credit,
    NOT an exemption.  The optimizer only decides where to apply the
    tax-free relief (local slabs vs foreign slabs).

    For fiscal years without separate foreign tax (e.g. 23/24, 24/25),
    there is no foreign option — only local slabs are used.
    """
    # Check if this FY has foreign tax
    filing_stmt = select(TaxFiling).where(TaxFiling.id.__eq__(filing_id))
    filing_result = await db.execute(filing_stmt)
    filing = filing_result.scalar_one_or_none()

    if filing:
        config_stmt = (
            select(TaxConfig)
            .options(selectinload(TaxConfig.slabs))
            .where(TaxConfig.fiscal_year == filing.fiscal_year)
        )
        config_result = await db.execute(config_stmt)
        config = config_result.scalar_one_or_none()
    else:
        config = None

    # If no foreign tax for this FY, just compute once with local relief
    if config and not config.has_foreign_tax:
        calc_local = await calculate_tax(db, filing_id, exempt_entry_ids=[], relief_on="local")
        return OptimizationResult(
            recommended_exempt_entry_ids=[],
            recommended_relief_on="local",
            partial_exemption_entry_id=None,
            partial_exempt_amount=None,
            baseline=calc_local,
            optimized=calc_local,
            tax_savings=0,
        )

    # Standard optimization: compare local vs foreign relief placement
    calc_local = await calculate_tax(db, filing_id, exempt_entry_ids=[], relief_on="local")
    calc_foreign = await calculate_tax(db, filing_id, exempt_entry_ids=[], relief_on="foreign")

    if calc_local.net_tax_payable <= calc_foreign.net_tax_payable:
        best = calc_local
        best_relief = "local"
        baseline = calc_foreign
    else:
        best = calc_foreign
        best_relief = "foreign"
        baseline = calc_local

    savings = baseline.net_tax_payable - best.net_tax_payable

    return OptimizationResult(
        recommended_exempt_entry_ids=[],
        recommended_relief_on=best_relief,
        partial_exemption_entry_id=None,
        partial_exempt_amount=None,
        baseline=baseline,
        optimized=best,
        tax_savings=savings,
    )
