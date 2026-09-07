"""Seed data from CSV files.

Supports two data sources controlled by the SEED_MODE env var:
  - "sample" (default) — fictional demo users from seed_data/
  - "user"             — real user data from user_data/users.json
  - "both"             — sample first, then user data
  - "none"             — skip seeding entirely
"""
import csv
import json
import logging
import os
import uuid
from datetime import date
from decimal import Decimal
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.adjustment import TaxAdjustment
from app.models.filing import TaxFiling
from app.models.income import IncomeEntry
from app.models.user import User

logger = logging.getLogger(__name__)

# ── Paths ──
SEED_DATA_DIR = Path(__file__).resolve().parent.parent.parent / "seed_data"
# user_data/ is mounted at /user_data in Docker; fall back to sibling of backend/ for local dev
USER_DATA_DIR = Path("/user_data") if Path("/user_data").exists() else Path(__file__).resolve().parent.parent.parent.parent / "user_data"

# Fixed UUIDs for deterministic sample-data seeding
_SAMPLE_UUIDS = {
    "alice": uuid.UUID("00000000-0000-0000-0000-000000000001"),
    "bob": uuid.UUID("00000000-0000-0000-0000-000000000002"),
}
# ── Sample data definitions ──
SAMPLE_USERS = [
    {
        "key": "alice",
        "name": "Alice",
        "email": "alice@example.com",
        "fiscal_year": "2025/26",
        "filings": [
            {"fiscal_year": "2023/24", "income": "fy_2023_24_income.csv", "adjustments": "fy_2023_24_adjustments.csv"},
            {"fiscal_year": "2024/25", "income": "fy_2024_25_income.csv", "adjustments": "fy_2024_25_adjustments.csv"},
            {"fiscal_year": "2025/26", "income": "fy_2025_26_income.csv", "adjustments": "fy_2025_26_adjustments.csv"},
        ],
    },
    {
        "key": "bob",
        "name": "Bob",
        "email": "bob@example.com",
        "fiscal_year": "2025/26",
        "filings": [
            {"fiscal_year": "2025/26", "income": "fy_2025_26_income_bob.csv", "adjustments": "fy_2025_26_adjustments_bob.csv"},
        ],
    },
]


# ── CSV helpers ──

def _dec(value: str) -> Decimal | None:
    v = value.strip()
    return Decimal(v) if v else None


def _date(value: str) -> date | None:
    v = value.strip()
    if not v:
        return None
    parts = v.split("-")
    return date(int(parts[0]), int(parts[1]), int(parts[2]))


def _str_or_none(value: str) -> str | None:
    v = value.strip()
    return v if v else None


def _load_income_csv(filepath: Path, filing_id: uuid.UUID) -> list[IncomeEntry]:
    entries: list[IncomeEntry] = []
    with open(filepath, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            entries.append(IncomeEntry(
                filing_id=filing_id,
                category=row["category"].strip(),
                source_name=_str_or_none(row.get("source_name", "")),
                account_number=_str_or_none(row.get("account_number", "")),
                amount_lkr=_dec(row["amount_lkr"]) or Decimal("0"),
                amount_foreign=_dec(row.get("amount_foreign", "")),
                foreign_currency=_str_or_none(row.get("foreign_currency", "")),
                exchange_rate=_dec(row.get("exchange_rate", "")),
                received_date=_date(row.get("received_date", "")),
                wht_deducted=_dec(row.get("wht_deducted", "")) or Decimal("0"),
                paye_deducted=_dec(row.get("paye_deducted", "")) or Decimal("0"),
                description=_str_or_none(row.get("description", "")),
            ))
    return entries


def _load_adjustment_csv(filepath: Path, filing_id: uuid.UUID) -> list[TaxAdjustment]:
    entries: list[TaxAdjustment] = []
    with open(filepath, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            entries.append(TaxAdjustment(
                filing_id=filing_id,
                label=row["label"].strip(),
                adjustment_type=row["adjustment_type"].strip(),
                quarter=_str_or_none(row.get("quarter", "")),
                amount=_dec(row["amount"]) or Decimal("0"),
                description=_str_or_none(row.get("description", "")),
            ))
    return entries


# ── Core seeding logic ──

async def _seed_user_from_filings(
    db: AsyncSession,
    user_id: uuid.UUID,
    name: str,
    email: str,
    fiscal_year: str,
    filings: list[dict],
    data_dir: Path,
) -> bool:
    """Seed a single user with filings. Returns True if created, False if skipped."""
    # Check by email to avoid duplicates across sample + user data
    stmt = select(User).where(User.email == email)
    result = await db.execute(stmt)
    if result.scalar_one_or_none() is not None:
        logger.info("  ⏭  Skipped %s (%s) — already exists", name, email)
        return False

    user = User(id=user_id, name=name, email=email, fiscal_year=fiscal_year)
    db.add(user)
    await db.flush()

    for filing_def in filings:
        fy = filing_def["fiscal_year"]
        filing_id = uuid.uuid4()  # Random UUID for user data
        filing = TaxFiling(id=filing_id, user_id=user_id, fiscal_year=fy, status="draft")
        db.add(filing)
        await db.flush()

        income_file = filing_def.get("income")
        if income_file:
            income_path = data_dir / income_file
            if income_path.exists():
                for entry in _load_income_csv(income_path, filing_id):
                    db.add(entry)
                logger.info("  📄 Loaded %s → %s (%s)", income_file, name, fy)
            else:
                logger.warning("  ⚠  Income file not found: %s", income_path)

        adj_file = filing_def.get("adjustments")
        if adj_file:
            adj_path = data_dir / adj_file
            if adj_path.exists():
                for entry in _load_adjustment_csv(adj_path, filing_id):
                    db.add(entry)
            else:
                logger.warning("  ⚠  Adjustments file not found: %s", adj_path)

        await db.flush()

    logger.info("  ✅ Created %s (%s) with %d filing(s)", name, email, len(filings))
    return True


async def _seed_sample_users(db: AsyncSession) -> int:
    """Seed the built-in demo users (Alice, Bob). Returns count created."""
    count = 0
    for user_def in SAMPLE_USERS:
        user_id = _SAMPLE_UUIDS[user_def["key"]]
        created = await _seed_user_from_filings(
            db,
            user_id=user_id,
            name=user_def["name"],
            email=user_def["email"],
            fiscal_year=user_def["fiscal_year"],
            filings=user_def["filings"],
            data_dir=SEED_DATA_DIR,
        )
        if created:
            count += 1
    return count


async def _seed_user_data(db: AsyncSession) -> int:
    """Seed users from user_data/users.json. Returns count created."""
    manifest_path = USER_DATA_DIR / "users.json"
    if not manifest_path.exists():
        logger.info("  ℹ  No user_data/users.json found — skipping user data")
        return 0

    with open(manifest_path, encoding="utf-8") as f:
        manifest = json.load(f)

    users = manifest.get("users", [])
    if not users:
        logger.info("  ℹ  users.json has no users defined")
        return 0

    count = 0
    for user_def in users:
        name = user_def["name"]
        email = user_def.get("email", f"{name.lower().replace(' ', '.')}@example.com")
        fiscal_year = user_def.get("fiscal_year")
        filings = user_def.get("filings", [])

        # Use the last filing's FY as default if not specified
        if not fiscal_year and filings:
            fiscal_year = filings[-1]["fiscal_year"]
        fiscal_year = fiscal_year or "2025/26"

        created = await _seed_user_from_filings(
            db,
            user_id=uuid.uuid4(),
            name=name,
            email=email,
            fiscal_year=fiscal_year,
            filings=filings,
            data_dir=USER_DATA_DIR,
        )
        if created:
            count += 1
    return count


async def seed_sample_data(db: AsyncSession) -> None:
    """Seed users based on SEED_MODE env var. Idempotent (skips existing users)."""
    mode = os.environ.get("SEED_MODE", "sample").lower().strip()

    if mode == "none":
        logger.info("🌱 SEED_MODE=none — skipping all data seeding")
        return

    logger.info("🌱 SEED_MODE=%s", mode)

    if mode in ("sample", "both"):
        logger.info("📦 Seeding sample data (Alice, Bob)…")
        count = await _seed_sample_users(db)
        logger.info("   → %d sample user(s) created", count)

    if mode in ("user", "both"):
        logger.info("📂 Seeding user data from user_data/…")
        count = await _seed_user_data(db)
        logger.info("   → %d user(s) created from user_data/", count)

    if mode not in ("sample", "user", "both", "none"):
        logger.warning("⚠  Unknown SEED_MODE=%s — defaulting to 'sample'", mode)
        count = await _seed_sample_users(db)
        logger.info("   → %d sample user(s) created", count)
