import uuid
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.adjustment import TaxAdjustment
from app.models.filing import TaxFiling
from app.models.income import IncomeEntry
from app.models.payment import SelfAssessmentPayment
from app.models.tax_config import TaxConfig, TaxSlab
from app.schemas.calculation import (
    AdjustmentDetail,
    Credits,
    DomesticTaxDetail,
    ExemptionDetail,
    ForeignTaxDetail,
    GrossIncome,
    SlabDetail,
    TaxBreakdown,
    WhtWarning,
)

ZERO = Decimal("0")


def _apply_slabs(taxable: Decimal, slabs: list[TaxSlab]) -> tuple[list[SlabDetail], Decimal]:
    """Apply progressive slabs and return (breakdown, total_tax)."""
    breakdown: list[SlabDetail] = []
    remaining = taxable
    total_tax = ZERO

    for slab in sorted(slabs, key=lambda s: s.slab_order):
        if remaining <= ZERO:
            breakdown.append(SlabDetail(label=slab.label, taxable_in_slab=ZERO, tax=ZERO, rate=slab.rate))
            continue

        if slab.upper_bound is not None:
            slab_width = slab.upper_bound - slab.lower_bound
        else:
            slab_width = remaining

        taxable_in_slab = min(remaining, slab_width)
        tax_in_slab = taxable_in_slab * slab.rate
        total_tax += tax_in_slab
        remaining -= taxable_in_slab

        breakdown.append(SlabDetail(
            label=slab.label, taxable_in_slab=taxable_in_slab, tax=tax_in_slab, rate=slab.rate
        ))

    return breakdown, total_tax


async def _get_tax_config(db: AsyncSession, fiscal_year: str = "2025/26") -> TaxConfig:
    stmt = (
        select(TaxConfig)
        .options(selectinload(TaxConfig.slabs))
        .where(TaxConfig.fiscal_year == fiscal_year)
    )
    result = await db.execute(stmt)
    config = result.scalar_one_or_none()
    if config is None:
        raise ValueError(f"Tax config not found for fiscal year {fiscal_year}")
    return config


async def _get_filing(db: AsyncSession, filing_id: uuid.UUID) -> TaxFiling:
    stmt = select(TaxFiling).where(TaxFiling.id == filing_id)
    result = await db.execute(stmt)
    filing = result.scalar_one_or_none()
    if filing is None:
        raise ValueError(f"Filing not found: {filing_id}")
    return filing


async def _get_income_entries(db: AsyncSession, filing_id: uuid.UUID) -> list[IncomeEntry]:
    stmt = select(IncomeEntry).where(
        IncomeEntry.filing_id == filing_id,
        IncomeEntry.is_active == True,  # noqa: E712
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def _get_adjustments(db: AsyncSession, filing_id: uuid.UUID) -> list[TaxAdjustment]:
    stmt = (
        select(TaxAdjustment)
        .where(
            TaxAdjustment.filing_id == filing_id,
            TaxAdjustment.is_active == True,  # noqa: E712
        )
        .order_by(TaxAdjustment.created_at)
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


def _validate_wht(entries: list[IncomeEntry], wht_rate: Decimal) -> list[WhtWarning]:
    """Check that WHT deducted on interest entries matches the expected rate.

    Returns warnings for entries where the actual WHT differs from
    amount × wht_rate by more than LKR 1 (to allow rounding).
    """
    warnings: list[WhtWarning] = []
    if wht_rate <= ZERO:
        return warnings

    for entry in entries:
        if entry.category != "interest":
            continue
        amt = entry.amount_lkr or ZERO
        wht = entry.wht_deducted or ZERO
        if amt <= ZERO:
            continue

        expected = amt * wht_rate
        diff = abs(wht - expected)
        # Allow LKR 1 tolerance for rounding
        if diff > Decimal("1"):
            actual_pct = (wht / amt * 100) if amt > ZERO else ZERO
            if wht < expected:
                msg = (
                    f"WHT under-deducted: LKR {float(wht):,.2f} vs expected "
                    f"LKR {float(expected):,.2f} ({float(wht_rate * 100):.0f}%). "
                    f"You may owe the difference."
                )
            else:
                msg = (
                    f"WHT over-deducted: LKR {float(wht):,.2f} vs expected "
                    f"LKR {float(expected):,.2f} ({float(wht_rate * 100):.0f}%). "
                    f"Excess will be credited."
                )
            warnings.append(WhtWarning(
                entry_id=str(entry.id),
                source_name=entry.source_name,
                account_number=entry.account_number,
                amount_lkr=float(amt),
                wht_deducted=float(wht),
                expected_wht=float(expected),
                expected_rate_pct=float(wht_rate * 100),
                message=msg,
            ))
    return warnings


async def calculate_tax(
    db: AsyncSession,
    filing_id: str,
    exempt_entry_ids: list[str] | None = None,
    relief_on: str = "local",
) -> TaxBreakdown:
    fid = uuid.UUID(filing_id)
    filing = await _get_filing(db, fid)
    config = await _get_tax_config(db, filing.fiscal_year)
    entries = await _get_income_entries(db, fid)
    adjustments = await _get_adjustments(db, fid)

    # --- Validate WHT on interest entries ---
    wht_rate = config.wht_rate_resident
    wht_warnings = _validate_wht(entries, wht_rate)

    # --- Aggregate by category ---
    salary_total = ZERO
    interest_total = ZERO
    foreign_total = ZERO
    other_total = ZERO
    total_wht = ZERO
    total_paye = ZERO

    interest_entries: list[IncomeEntry] = []

    for entry in entries:
        amt = entry.amount_lkr or ZERO
        wht = entry.wht_deducted or ZERO
        paye = entry.paye_deducted or ZERO

        if entry.category == "salary":
            salary_total += amt
            total_paye += paye
        elif entry.category == "interest":
            interest_total += amt
            total_wht += wht
            interest_entries.append(entry)
        elif entry.category == "foreign_employment":
            foreign_total += amt
        elif entry.category == "other":
            other_total += amt

    gross_total = salary_total + interest_total + foreign_total + other_total

    # --- Exemptions (interest only — opt-in) ---
    exempt_limit = config.interest_exemption_limit
    exempt_amount = ZERO
    actual_exempt_ids: list[str] = []

    if exempt_entry_ids:
        exempt_id_set = {uuid.UUID(eid) for eid in exempt_entry_ids}
        for ie in interest_entries:
            if ie.id in exempt_id_set:
                can_exempt = min(ie.amount_lkr, exempt_limit - exempt_amount)
                if can_exempt > ZERO:
                    exempt_amount += can_exempt
                    actual_exempt_ids.append(str(ie.id))

    # --- Separate slabs by type ---
    local_slabs = [s for s in config.slabs if s.slab_type == "local"]
    foreign_slabs = [s for s in config.slabs if s.slab_type == "foreign"]

    tax_free = config.tax_free_threshold

    # ──────────────────────────────────────────────────────────
    # NO FOREIGN TAX MODE (old FYs like 23/24, 24/25)
    # All income is pooled together and taxed through local slabs
    # ──────────────────────────────────────────────────────────
    if not config.has_foreign_tax:
        # Everything goes into "domestic" — including foreign employment
        all_income = salary_total + (interest_total - exempt_amount) + foreign_total + other_total
        domestic_slab_breakdown, domestic_tax_amount = _apply_slabs(all_income, local_slabs)

        # No foreign tax computation at all
        foreign_slab_breakdown: list[SlabDetail] = []
        foreign_tax_amount = ZERO

        gross_tax = domestic_tax_amount

        # Credits from adjustments
        adjustment_details: list[AdjustmentDetail] = []
        adjustment_credits = ZERO
        for adj in adjustments:
            adjustment_details.append(AdjustmentDetail(
                label=adj.label, adjustment_type=adj.adjustment_type, amount=adj.amount,
            ))
            if adj.adjustment_type in ("paye_deducted", "self_assessment", "wht_credit", "other_credit"):
                adjustment_credits += adj.amount
            elif adj.adjustment_type == "other_deduction":
                adjustment_credits -= adj.amount

        total_credits = total_wht + total_paye + adjustment_credits
        net_tax = gross_tax - total_credits
        effective_rate = (gross_tax / gross_total * 100) if gross_total > ZERO else ZERO

        return TaxBreakdown(
            gross_income=GrossIncome(
                salary=salary_total, interest=interest_total,
                foreign_employment=foreign_total, other=other_total, total=gross_total,
            ),
            exemptions=ExemptionDetail(
                interest_exempt_amount=exempt_amount, exempt_entry_ids=actual_exempt_ids,
            ),
            relief_applied_to="local",  # only option when no foreign tax
            tax_free_allowance=tax_free,
            domestic_tax=DomesticTaxDetail(
                domestic_income=all_income, relief_applied=tax_free,
                taxable_income=all_income, slab_breakdown=domestic_slab_breakdown,
                tax=domestic_tax_amount,
            ),
            foreign_tax=ForeignTaxDetail(
                foreign_income=ZERO, relief_applied=ZERO,
                taxable_income=ZERO, slab_breakdown=[],
                tax=ZERO,
            ),
            gross_tax=gross_tax,
            credits=Credits(
                wht_on_interest=total_wht, paye_deducted=total_paye,
                self_assessment_paid=ZERO, adjustments=adjustment_details,
                total_credits=total_credits,
            ),
            net_tax_payable=net_tax,
            effective_rate_pct=effective_rate,
            wht_warnings=wht_warnings,
        )

    # ──────────────────────────────────────────────────────────
    # FOREIGN TAX MODE (new FYs like 25/26, 26/27)
    # Domestic and foreign income are taxed separately
    # ──────────────────────────────────────────────────────────

    # Split domestic vs foreign
    domestic_income = salary_total + (interest_total - exempt_amount) + other_total

    if relief_on == "local":
        # Domestic income gets progressive slabs (relief is built into the first slab)
        domestic_slab_breakdown, domestic_tax_amount = _apply_slabs(domestic_income, local_slabs)
        domestic_relief = tax_free

        # Foreign income — no relief, taxed at top marginal rate
        if foreign_slabs and foreign_total > ZERO:
            max_rate = max(s.rate for s in foreign_slabs if s.rate > ZERO)
            foreign_tax_amount = foreign_total * max_rate
            foreign_slab_breakdown = [SlabDetail(
                label=f"Foreign @ {max_rate * 100:.0f}%",
                taxable_in_slab=foreign_total,
                tax=foreign_tax_amount,
                rate=max_rate,
            )]
        else:
            foreign_tax_amount = ZERO
            foreign_slab_breakdown = []
        foreign_relief = ZERO
    else:
        # Domestic income — no relief, taxed at top marginal rate
        if local_slabs and domestic_income > ZERO:
            max_rate = max(s.rate for s in local_slabs if s.rate > ZERO)
            domestic_tax_amount = domestic_income * max_rate
            domestic_slab_breakdown = [SlabDetail(
                label=f"Domestic @ {max_rate * 100:.0f}%",
                taxable_in_slab=domestic_income,
                tax=domestic_tax_amount,
                rate=max_rate,
            )]
        else:
            domestic_tax_amount = ZERO
            domestic_slab_breakdown = []
        domestic_relief = ZERO

        # Foreign income gets progressive slabs (relief is built into the first slab)
        foreign_slab_breakdown, foreign_tax_amount = _apply_slabs(foreign_total, foreign_slabs)
        foreign_relief = tax_free

    # --- Gross tax ---
    gross_tax = domestic_tax_amount + foreign_tax_amount

    # --- Credits from adjustments ---
    adjustment_details = []
    adjustment_credits = ZERO

    for adj in adjustments:
        adjustment_details.append(AdjustmentDetail(
            label=adj.label,
            adjustment_type=adj.adjustment_type,
            amount=adj.amount,
        ))
        if adj.adjustment_type in ("paye_deducted", "self_assessment", "wht_credit", "other_credit"):
            adjustment_credits += adj.amount
        elif adj.adjustment_type == "other_deduction":
            adjustment_credits -= adj.amount

    # --- Total credits ---
    total_credits = total_wht + total_paye + adjustment_credits
    net_tax = gross_tax - total_credits

    effective_rate = (gross_tax / gross_total * 100) if gross_total > ZERO else ZERO

    return TaxBreakdown(
        gross_income=GrossIncome(
            salary=salary_total,
            interest=interest_total,
            foreign_employment=foreign_total,
            other=other_total,
            total=gross_total,
        ),
        exemptions=ExemptionDetail(
            interest_exempt_amount=exempt_amount,
            exempt_entry_ids=actual_exempt_ids,
        ),
        relief_applied_to=relief_on,
        tax_free_allowance=tax_free,
        domestic_tax=DomesticTaxDetail(
            domestic_income=domestic_income,
            relief_applied=domestic_relief,
            taxable_income=domestic_income,
            slab_breakdown=domestic_slab_breakdown,
            tax=domestic_tax_amount,
        ),
        foreign_tax=ForeignTaxDetail(
            foreign_income=foreign_total,
            relief_applied=foreign_relief,
            taxable_income=foreign_total,
            slab_breakdown=foreign_slab_breakdown,
            tax=foreign_tax_amount,
        ),
        gross_tax=gross_tax,
        credits=Credits(
            wht_on_interest=total_wht,
            paye_deducted=total_paye,
            self_assessment_paid=ZERO,
            adjustments=adjustment_details,
            total_credits=total_credits,
        ),
        net_tax_payable=net_tax,
        effective_rate_pct=effective_rate,
        wht_warnings=wht_warnings,
    )
