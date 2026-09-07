import uuid
from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class IncomeEntry(Base):
    __tablename__ = "income_entries"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    filing_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tax_filings.id", ondelete="CASCADE"), nullable=False)
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    source_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    account_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    amount_lkr: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    amount_foreign: Mapped[Decimal | None] = mapped_column(Numeric(15, 2), nullable=True)
    foreign_currency: Mapped[str | None] = mapped_column(String(3), nullable=True)
    exchange_rate: Mapped[Decimal | None] = mapped_column(Numeric(10, 4), nullable=True)
    received_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    wht_deducted: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=Decimal("0"))
    paye_deducted: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=Decimal("0"))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    filing = relationship("TaxFiling", back_populates="income_entries")
