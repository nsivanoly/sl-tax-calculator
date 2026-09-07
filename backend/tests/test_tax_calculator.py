"""Test the tax calculator with sample data.

Uses fictional income data across salary, interest, and foreign employment
to verify the full 6-step tax calculation pipeline.
"""

import pytest
import pytest_asyncio
from datetime import date
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.income import IncomeEntry
from app.models.payment import SelfAssessmentPayment
from app.models.user import User
from app.seed.seed_tax_config import seed_tax_config
from app.services.tax_calculator import calculate_tax
from app.services.tax_optimizer import optimize_exemptions


@pytest_asyncio.fixture
async def seeded_user(db_session: AsyncSession) -> str:
    """Create a demo user with sample data and return user_id as string."""
    # Seed tax config first
    await seed_tax_config(db_session)

    # Create user
    user = User(name="Test User", fiscal_year="2025/26")
    db_session.add(user)
    await db_session.flush()
    uid = user.id

    # Salary
    db_session.add(IncomeEntry(
        user_id=uid,
        category="salary",
        source_name="Acme Corp",
        amount_lkr=Decimal("4800000.00"),
        paye_deducted=Decimal("720000.00"),
    ))

    # Interest entries (12 rows)
    interest_data = [
        ("Lanka Bank", "FD-100001", Decimal("85000.00"), Decimal("8500.00")),
        ("Lanka Bank", "FD-100002", Decimal("65000.00"), Decimal("6500.00")),
        ("Lanka Bank", "FD-100003", Decimal("45000.00"), Decimal("4500.00")),
        ("Island Finance", "FD-200001", Decimal("72000.00"), Decimal("7200.00")),
        ("Island Finance", "FD-200002", Decimal("55000.00"), Decimal("5500.00")),
        ("Island Finance", "FD-200003", Decimal("38000.00"), Decimal("3800.00")),
        ("Metro Bank", "SA-300001", Decimal("12500.00"), Decimal("1250.00")),
        ("Metro Bank", "FD-300002", Decimal("92000.00"), Decimal("9200.00")),
        ("Metro Bank", "FD-300003", Decimal("48000.00"), Decimal("4800.00")),
        ("Metro Bank", "FD-300004", Decimal("35000.00"), Decimal("3500.00")),
        ("Metro Bank", "FD-300005", Decimal("28000.00"), Decimal("2800.00")),
        ("Metro Bank", "FD-300006", Decimal("62000.00"), Decimal("6200.00")),
    ]

    for source, account, amount, wht in interest_data:
        db_session.add(IncomeEntry(
            user_id=uid,
            category="interest",
            source_name=source,
            account_number=account,
            amount_lkr=amount,
            wht_deducted=wht,
        ))

    # Foreign employment entries (12 rows)
    foreign_data = [
        (date(2025, 4, 15), Decimal("1200.00"), Decimal("291.67"), Decimal("350000.00")),
        (date(2025, 5, 15), Decimal("1250.00"), Decimal("292.00"), Decimal("365000.00")),
        (date(2025, 6, 15), Decimal("1300.00"), Decimal("292.31"), Decimal("380000.00")),
        (date(2025, 7, 15), Decimal("1350.00"), Decimal("292.59"), Decimal("395000.00")),
        (date(2025, 8, 15), Decimal("1400.00"), Decimal("292.86"), Decimal("410000.00")),
        (date(2025, 9, 15), Decimal("1425.00"), Decimal("294.74"), Decimal("420000.00")),
        (date(2025, 10, 15), Decimal("1450.00"), Decimal("296.55"), Decimal("430000.00")),
        (date(2025, 11, 15), Decimal("1475.00"), Decimal("298.31"), Decimal("440000.00")),
        (date(2025, 12, 15), Decimal("1490.00"), Decimal("298.66"), Decimal("445000.00")),
        (date(2026, 1, 15), Decimal("1500.00"), Decimal("300.00"), Decimal("450000.00")),
        (date(2026, 2, 15), Decimal("1510.00"), Decimal("301.32"), Decimal("455000.00")),
        (date(2026, 3, 15), Decimal("1520.00"), Decimal("302.63"), Decimal("460000.00")),
    ]

    for recv_date, amount_usd, rate, amount_lkr in foreign_data:
        db_session.add(IncomeEntry(
            user_id=uid,
            category="foreign_employment",
            source_name="Overseas Consulting",
            amount_lkr=amount_lkr,
            amount_foreign=amount_usd,
            foreign_currency="USD",
            exchange_rate=rate,
            received_date=recv_date,
        ))

    # Self-assessment payments
    for quarter, amount in [("Q1", Decimal("15000.00")), ("Q2", Decimal("18000.00")),
                            ("Q3", Decimal("12000.00")), ("Q4", Decimal("0"))]:
        db_session.add(SelfAssessmentPayment(
            user_id=uid,
            quarter=quarter,
            amount=amount,
        ))

    await db_session.flush()
    await db_session.commit()
    return str(uid)


# ── Expected values (computed from sample data) ──

# Interest total: 85000 + 65000 + 45000 + 72000 + 55000 + 38000
#               + 12500 + 92000 + 48000 + 35000 + 28000 + 62000 = 637,500
EXPECTED_INTEREST = Decimal("637500.00")

# Foreign total: 350000 + 365000 + 380000 + 395000 + 410000 + 420000
#              + 430000 + 440000 + 445000 + 450000 + 455000 + 460000 = 5,000,000
EXPECTED_FOREIGN = Decimal("5000000.00")

# Salary
EXPECTED_SALARY = Decimal("4800000.00")

# Gross total: 4,800,000 + 637,500 + 5,000,000 = 10,437,500
EXPECTED_GROSS = Decimal("10437500.00")

# WHT total: 8500 + 6500 + 4500 + 7200 + 5500 + 3800
#           + 1250 + 9200 + 4800 + 3500 + 2800 + 6200 = 63,750
EXPECTED_WHT = Decimal("63750.00")

# Self-assessment: 15000 + 18000 + 12000 = 45,000
EXPECTED_SA = Decimal("45000.00")


@pytest.mark.asyncio
async def test_gross_income_totals(db_session: AsyncSession, seeded_user: str):
    """Verify that gross income components sum correctly."""
    result = await calculate_tax(db_session, seeded_user)

    assert result.gross_income.salary == EXPECTED_SALARY
    assert result.gross_income.interest == EXPECTED_INTEREST
    assert result.gross_income.foreign_employment == EXPECTED_FOREIGN
    assert result.gross_income.total == EXPECTED_GROSS


@pytest.mark.asyncio
async def test_default_exemption_capped(db_session: AsyncSession, seeded_user: str):
    """Default exemption should exempt interest up to 1,500,000 cap."""
    result = await calculate_tax(db_session, seeded_user)

    # Total interest is 637,500 which is under the 1.5M cap
    # So all interest should be exempt
    assert result.exemptions.interest_exempt_amount == EXPECTED_INTEREST


@pytest.mark.asyncio
async def test_no_exemption_calculation(db_session: AsyncSession, seeded_user: str):
    """With no exemptions, all interest is taxable."""
    result = await calculate_tax(db_session, seeded_user, exempt_entry_ids=[])

    assert result.exemptions.interest_exempt_amount == Decimal("0")
    assert result.assessable_income == result.gross_income.total


@pytest.mark.asyncio
async def test_tax_slab_breakdown(db_session: AsyncSession, seeded_user: str):
    """Verify tax slabs are applied correctly."""
    result = await calculate_tax(db_session, seeded_user)

    # With default exemption (all interest exempt since < 1.5M):
    # assessable = gross - exempt = 10,437,500 - 637,500 = 9,800,000
    # taxable = assessable - tax_free_allowance (1,800,000) = 8,000,000
    # Note: tax_free_allowance depends on the seeded config
    taxable = result.taxable_income
    assert taxable > 0

    # Verify slabs are applied in order
    assert len(result.slab_breakdown) >= 1
    # First slab should be the lowest rate
    for i in range(len(result.slab_breakdown) - 1):
        assert result.slab_breakdown[i].rate <= result.slab_breakdown[i + 1].rate


@pytest.mark.asyncio
async def test_gross_tax(db_session: AsyncSession, seeded_user: str):
    """Verify gross tax equals sum of slab taxes."""
    result = await calculate_tax(db_session, seeded_user)

    slab_tax_sum = sum(s.tax for s in result.slab_breakdown)
    assert result.gross_tax == slab_tax_sum
    assert result.gross_tax > 0


@pytest.mark.asyncio
async def test_credits(db_session: AsyncSession, seeded_user: str):
    """Verify credits are summed correctly."""
    result = await calculate_tax(db_session, seeded_user)

    assert result.credits.wht_on_interest == EXPECTED_WHT
    assert result.credits.self_assessment_paid == EXPECTED_SA
    assert result.credits.total_credits >= EXPECTED_WHT + EXPECTED_SA


@pytest.mark.asyncio
async def test_net_tax_payable(db_session: AsyncSession, seeded_user: str):
    """Verify final net tax payable."""
    result = await calculate_tax(db_session, seeded_user)

    assert result.net_tax_payable == result.gross_tax - result.credits.total_credits
    assert result.net_tax_payable > 0  # With this income, tax should be positive


@pytest.mark.asyncio
async def test_optimizer(db_session: AsyncSession, seeded_user: str):
    """Verify optimizer returns savings."""
    result = await optimize_exemptions(db_session, seeded_user)

    # Optimized should have lower or equal tax than baseline (no exemptions)
    assert result.optimized.net_tax_payable <= result.baseline.net_tax_payable
    assert result.tax_savings >= Decimal("0")
    # With interest total < 1.5M, all entries should be recommended
    assert len(result.recommended_exempt_entry_ids) > 0
