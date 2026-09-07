import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class TaxConfig(Base):
    __tablename__ = "tax_configs"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    fiscal_year: Mapped[str] = mapped_column(String(10), unique=True, nullable=False)
    tax_free_threshold: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    interest_exemption_limit: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    wht_rate_resident: Mapped[Decimal] = mapped_column(Numeric(5, 4), nullable=False)
    has_foreign_tax: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    slabs: Mapped[list["TaxSlab"]] = relationship(
        back_populates="config", cascade="all, delete-orphan", order_by="TaxSlab.slab_order"
    )


class TaxSlab(Base):
    __tablename__ = "tax_slabs"
    __table_args__ = (UniqueConstraint("config_id", "slab_order", "slab_type", name="uq_config_slab_order_type"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    config_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tax_configs.id"), nullable=False)
    slab_order: Mapped[int] = mapped_column(Integer, nullable=False)
    lower_bound: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    upper_bound: Mapped[Decimal | None] = mapped_column(Numeric(15, 2), nullable=True)
    rate: Mapped[Decimal] = mapped_column(Numeric(5, 4), nullable=False)
    label: Mapped[str] = mapped_column(String(100), nullable=False)
    slab_type: Mapped[str] = mapped_column(String(10), nullable=False, default="local")

    config: Mapped["TaxConfig"] = relationship(back_populates="slabs")
