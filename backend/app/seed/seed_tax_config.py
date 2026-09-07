from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tax_config import TaxConfig, TaxSlab


# ──────────────────────────────────────────────────────────────
# FY 2023/24 & 2024/25  —  Old system (no separate foreign tax)
# All income goes through one slab set.  Foreign employment is
# lumped together with domestic income.
# ──────────────────────────────────────────────────────────────

OLD_LOCAL_SLABS = [
    (1, Decimal("0"),       Decimal("1200000"),  Decimal("0"),    "Relief (first 1.2M)"),
    (2, Decimal("1200000"), Decimal("1700000"),  Decimal("0.06"), "Next 500K @ 6%"),
    (3, Decimal("1700000"), Decimal("2200000"),  Decimal("0.12"), "Next 500K @ 12%"),
    (4, Decimal("2200000"), Decimal("2700000"),  Decimal("0.18"), "Next 500K @ 18%"),
    (5, Decimal("2700000"), Decimal("3200000"),  Decimal("0.24"), "Next 500K @ 24%"),
    (6, Decimal("3200000"), Decimal("3700000"),  Decimal("0.30"), "Next 500K @ 30%"),
    (7, Decimal("3700000"), None,                Decimal("0.36"), "Balance @ 36%"),
]

# ──────────────────────────────────────────────────────────────
# FY 2025/26 & 2026/27  —  New system (separate foreign tax)
# Different slab structure: 1.8M relief, 1M@6%, then 500K bands
# at 18%/24%/30%, balance at 36%.  Foreign income uses the same
# slab structure, taxed independently.
# ──────────────────────────────────────────────────────────────

NEW_LOCAL_SLABS = [
    (1, Decimal("0"),       Decimal("1800000"),  Decimal("0"),    "Relief (first 1.8M)"),
    (2, Decimal("1800000"), Decimal("2800000"),  Decimal("0.06"), "Next 1M @ 6%"),
    (3, Decimal("2800000"), Decimal("3300000"),  Decimal("0.18"), "Next 500K @ 18%"),
    (4, Decimal("3300000"), Decimal("3800000"),  Decimal("0.24"), "Next 500K @ 24%"),
    (5, Decimal("3800000"), Decimal("4300000"),  Decimal("0.30"), "Next 500K @ 30%"),
    (6, Decimal("4300000"), None,                Decimal("0.36"), "Balance @ 36%"),
]

NEW_FOREIGN_SLABS = [
    (1, Decimal("0"),       Decimal("1800000"),  Decimal("0"),    "Relief (first 1.8M)"),
    (2, Decimal("1800000"), Decimal("2800000"),  Decimal("0.06"), "Next 1M @ 6%"),
    (3, Decimal("2800000"), None,                Decimal("0.15"), "Balance @ 15%"),
]


# Each entry: (fiscal_year, threshold, interest_exemption_limit,
#              wht_rate, has_foreign_tax, local_slabs, foreign_slabs)
CONFIGS = [
    # --- Old system: no separate foreign income tax ---
    (
        "2023/24",
        Decimal("1200000"),
        Decimal("1500000"),
        Decimal("0.05"),
        False,
        OLD_LOCAL_SLABS,
        [],  # no foreign slabs
    ),
    (
        "2024/25",
        Decimal("1200000"),
        Decimal("1500000"),
        Decimal("0.05"),
        False,
        OLD_LOCAL_SLABS,
        [],  # no foreign slabs
    ),
    # --- New system: separate foreign income tax, different slabs, WHT 10% ---
    (
        "2025/26",
        Decimal("1800000"),
        Decimal("1500000"),
        Decimal("0.10"),
        True,
        NEW_LOCAL_SLABS,
        NEW_FOREIGN_SLABS,
    ),
    (
        "2026/27",
        Decimal("1800000"),
        Decimal("1500000"),
        Decimal("0.10"),
        True,
        NEW_LOCAL_SLABS,
        NEW_FOREIGN_SLABS,
    ),
]


async def seed_tax_config(db: AsyncSession) -> None:
    """Seed tax configurations for all fiscal years if they don't exist."""
    for fy, threshold, interest_limit, wht_rate, has_foreign, local_slabs, foreign_slabs in CONFIGS:
        stmt = select(TaxConfig).where(TaxConfig.fiscal_year == fy)
        result = await db.execute(stmt)
        if result.scalar_one_or_none() is not None:
            continue

        config = TaxConfig(
            fiscal_year=fy,
            tax_free_threshold=threshold,
            interest_exemption_limit=interest_limit,
            wht_rate_resident=wht_rate,
            has_foreign_tax=has_foreign,
        )
        db.add(config)
        await db.flush()

        for slab_order, lower, upper, rate, label in local_slabs:
            db.add(TaxSlab(
                config_id=config.id,
                slab_order=slab_order,
                lower_bound=lower,
                upper_bound=upper,
                rate=rate,
                label=label,
                slab_type="local",
            ))

        for slab_order, lower, upper, rate, label in foreign_slabs:
            db.add(TaxSlab(
                config_id=config.id,
                slab_order=slab_order,
                lower_bound=lower,
                upper_bound=upper,
                rate=rate,
                label=label,
                slab_type="foreign",
            ))

        await db.flush()
