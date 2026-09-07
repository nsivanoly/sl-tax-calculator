import csv
import io
from datetime import date
from decimal import Decimal, InvalidOperation

from app.schemas.income import IncomeCreate

VALID_CATEGORIES = {"salary", "interest", "foreign_employment", "other"}

EXPECTED_COLUMNS = [
    "category",
    "source_name",
    "account_number",
    "amount_lkr",
    "amount_foreign",
    "foreign_currency",
    "exchange_rate",
    "received_date",
    "wht_deducted",
    "description",
]


def _parse_decimal(value: str) -> Decimal | None:
    value = value.strip()
    if not value:
        return None
    try:
        return Decimal(value)
    except InvalidOperation:
        raise ValueError(f"Invalid decimal value: {value}")


def _parse_date(value: str) -> date | None:
    value = value.strip()
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise ValueError(f"Invalid date format: {value}. Expected YYYY-MM-DD.")


def parse_csv(
    file_content: bytes,
) -> tuple[list[IncomeCreate], list[tuple[int, str]]]:
    """Parse a CSV file and return valid IncomeCreate objects and error rows.

    Returns:
        Tuple of (valid_entries, errors) where errors is a list of (row_number, error_message).
    """
    valid_entries: list[IncomeCreate] = []
    errors: list[tuple[int, str]] = []

    try:
        text = file_content.decode("utf-8")
    except UnicodeDecodeError:
        try:
            text = file_content.decode("latin-1")
        except Exception:
            return [], [(0, "Unable to decode file. Please use UTF-8 encoding.")]

    reader = csv.DictReader(io.StringIO(text))

    for row_num, row in enumerate(reader, start=2):  # row 1 is header
        try:
            category = row.get("category", "").strip().lower()
            if category not in VALID_CATEGORIES:
                raise ValueError(
                    f"Invalid category '{category}'. Must be one of: {', '.join(VALID_CATEGORIES)}"
                )

            amount_lkr = _parse_decimal(row.get("amount_lkr", ""))
            if amount_lkr is None:
                raise ValueError("amount_lkr is required")

            entry = IncomeCreate(
                category=category,
                source_name=row.get("source_name", "").strip() or None,
                account_number=row.get("account_number", "").strip() or None,
                amount_lkr=amount_lkr,
                amount_foreign=_parse_decimal(row.get("amount_foreign", "")),
                foreign_currency=row.get("foreign_currency", "").strip() or None,
                exchange_rate=_parse_decimal(row.get("exchange_rate", "")),
                received_date=_parse_date(row.get("received_date", "")),
                wht_deducted=_parse_decimal(row.get("wht_deducted", "")) or Decimal("0"),
                description=row.get("description", "").strip() or None,
            )
            valid_entries.append(entry)

        except (ValueError, KeyError) as e:
            errors.append((row_num, str(e)))

    return valid_entries, errors
