import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class TaxFiling(Base):
    __tablename__ = "tax_filings"
    __table_args__ = (
        UniqueConstraint("user_id", "fiscal_year", name="uq_user_fiscal_year"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    fiscal_year: Mapped[str] = mapped_column(String(10), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="draft")  # draft, calculated, paying, paid, filed, assessed
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    user = relationship("User", backref="filings")
    income_entries = relationship("IncomeEntry", back_populates="filing", cascade="all, delete-orphan")
    adjustments = relationship("TaxAdjustment", back_populates="filing", cascade="all, delete-orphan")
    payments = relationship("SelfAssessmentPayment", back_populates="filing", cascade="all, delete-orphan")
