"""Initial schema

Revision ID: 001
Revises:
Create Date: 2025-01-01 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Users table
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), nullable=False, primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("fiscal_year", sa.String(10), nullable=False, server_default="2025/26"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint("email", name="uq_users_email"),
    )

    # Fiscal years table
    op.create_table(
        "fiscal_years",
        sa.Column("id", sa.Uuid(), nullable=False, primary_key=True),
        sa.Column("year_code", sa.String(10), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint("year_code", name="uq_fiscal_years_year_code"),
    )

    # Tax filings table (user + fiscal year pair)
    op.create_table(
        "tax_filings",
        sa.Column("id", sa.Uuid(), nullable=False, primary_key=True),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("fiscal_year", sa.String(10), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="draft"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint("user_id", "fiscal_year", name="uq_user_fiscal_year"),
    )
    op.create_index("ix_tax_filings_user_id", "tax_filings", ["user_id"])

    # Income entries table (scoped to filing)
    op.create_table(
        "income_entries",
        sa.Column("id", sa.Uuid(), nullable=False, primary_key=True),
        sa.Column("filing_id", sa.Uuid(), sa.ForeignKey("tax_filings.id", ondelete="CASCADE"), nullable=False),
        sa.Column("category", sa.String(50), nullable=False),
        sa.Column("source_name", sa.String(255), nullable=True),
        sa.Column("account_number", sa.String(100), nullable=True),
        sa.Column("amount_lkr", sa.Numeric(15, 2), nullable=False),
        sa.Column("amount_foreign", sa.Numeric(15, 2), nullable=True),
        sa.Column("foreign_currency", sa.String(3), nullable=True),
        sa.Column("exchange_rate", sa.Numeric(10, 4), nullable=True),
        sa.Column("received_date", sa.Date(), nullable=True),
        sa.Column("wht_deducted", sa.Numeric(15, 2), nullable=False, server_default="0"),
        sa.Column("paye_deducted", sa.Numeric(15, 2), nullable=False, server_default="0"),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_income_entries_filing_id", "income_entries", ["filing_id"])
    op.create_index("ix_income_entries_category", "income_entries", ["category"])

    # Tax configs table
    op.create_table(
        "tax_configs",
        sa.Column("id", sa.Uuid(), nullable=False, primary_key=True),
        sa.Column("fiscal_year", sa.String(10), nullable=False),
        sa.Column("tax_free_threshold", sa.Numeric(15, 2), nullable=False),
        sa.Column("interest_exemption_limit", sa.Numeric(15, 2), nullable=False),
        sa.Column("wht_rate_resident", sa.Numeric(5, 4), nullable=False),
        sa.Column("has_foreign_tax", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint("fiscal_year", name="uq_tax_configs_fiscal_year"),
    )

    # Tax slabs table
    op.create_table(
        "tax_slabs",
        sa.Column("id", sa.Uuid(), nullable=False, primary_key=True),
        sa.Column("config_id", sa.Uuid(), sa.ForeignKey("tax_configs.id"), nullable=False),
        sa.Column("slab_order", sa.Integer(), nullable=False),
        sa.Column("lower_bound", sa.Numeric(15, 2), nullable=False),
        sa.Column("upper_bound", sa.Numeric(15, 2), nullable=True),
        sa.Column("rate", sa.Numeric(5, 4), nullable=False),
        sa.Column("label", sa.String(100), nullable=False),
        sa.Column("slab_type", sa.String(10), nullable=False, server_default="local"),
        sa.UniqueConstraint("config_id", "slab_order", "slab_type", name="uq_config_slab_order_type"),
    )
    op.create_index("ix_tax_slabs_config_id", "tax_slabs", ["config_id"])

    # Self assessment payments table (scoped to filing)
    op.create_table(
        "self_assessment_payments",
        sa.Column("id", sa.Uuid(), nullable=False, primary_key=True),
        sa.Column("filing_id", sa.Uuid(), sa.ForeignKey("tax_filings.id", ondelete="CASCADE"), nullable=False),
        sa.Column("quarter", sa.String(5), nullable=False),
        sa.Column("amount", sa.Numeric(15, 2), nullable=False),
        sa.Column("paid_date", sa.Date(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint("filing_id", "quarter", name="uq_filing_quarter"),
    )
    op.create_index("ix_self_assessment_payments_filing_id", "self_assessment_payments", ["filing_id"])

    # Tax adjustments table (scoped to filing)
    op.create_table(
        "tax_adjustments",
        sa.Column("id", sa.Uuid(), nullable=False, primary_key=True),
        sa.Column("filing_id", sa.Uuid(), sa.ForeignKey("tax_filings.id", ondelete="CASCADE"), nullable=False),
        sa.Column("label", sa.String(100), nullable=False),
        sa.Column("adjustment_type", sa.String(30), nullable=False),
        sa.Column("amount", sa.Numeric(15, 2), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_tax_adjustments_filing_id", "tax_adjustments", ["filing_id"])

    # Exemption selections table (scoped to filing)
    op.create_table(
        "exemption_selections",
        sa.Column("id", sa.Uuid(), nullable=False, primary_key=True),
        sa.Column("filing_id", sa.Uuid(), sa.ForeignKey("tax_filings.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "income_entry_id", sa.Uuid(), sa.ForeignKey("income_entries.id"), nullable=False
        ),
        sa.Column("exempt_amount", sa.Numeric(15, 2), nullable=False),
        sa.Column("is_optimizer_suggested", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint("filing_id", "income_entry_id", name="uq_filing_income_entry"),
    )
    op.create_index("ix_exemption_selections_filing_id", "exemption_selections", ["filing_id"])


def downgrade() -> None:
    op.drop_table("exemption_selections")
    op.drop_table("tax_adjustments")
    op.drop_table("self_assessment_payments")
    op.drop_table("tax_slabs")
    op.drop_table("tax_configs")
    op.drop_table("income_entries")
    op.drop_table("tax_filings")
    op.drop_table("fiscal_years")
    op.drop_table("users")
