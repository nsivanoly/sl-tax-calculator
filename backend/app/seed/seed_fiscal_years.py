from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.fiscal_year import FiscalYear


FISCAL_YEARS = [
    ("2023/24", date(2023, 4, 1), date(2024, 3, 31), True, False),
    ("2024/25", date(2024, 4, 1), date(2025, 3, 31), True, False),
    ("2025/26", date(2025, 4, 1), date(2026, 3, 31), True, True),   # default
    ("2026/27", date(2026, 4, 1), date(2027, 3, 31), True, False),
]


async def seed_fiscal_years(db: AsyncSession) -> None:
    """Seed fiscal years if none exist."""
    stmt = select(FiscalYear).limit(1)
    result = await db.execute(stmt)
    if result.scalar_one_or_none() is not None:
        return

    for year_code, start, end, is_active, is_default in FISCAL_YEARS:
        db.add(FiscalYear(
            year_code=year_code,
            start_date=start,
            end_date=end,
            is_active=is_active,
            is_default=is_default,
        ))

    await db.flush()
