import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, ForeignKey, Numeric, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ExemptionSelection(Base):
    __tablename__ = "exemption_selections"
    __table_args__ = (
        UniqueConstraint("filing_id", "income_entry_id", name="uq_filing_income_entry"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    filing_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tax_filings.id", ondelete="CASCADE"), nullable=False)
    income_entry_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("income_entries.id"), nullable=False
    )
    exempt_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    is_optimizer_suggested: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
