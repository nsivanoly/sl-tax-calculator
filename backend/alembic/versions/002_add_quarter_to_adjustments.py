"""Add quarter column to tax_adjustments.

Revision ID: 002
Revises: 001
Create Date: 2026-09-04
"""
from typing import Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, None] = None
depends_on: Union[str, None] = None


def upgrade() -> None:
    op.add_column(
        "tax_adjustments",
        sa.Column("quarter", sa.String(10), nullable=True),
    )
    # Back-fill existing self-assessment rows that have Q1/Q2/Q3/Q4 in the label
    conn = op.get_bind()
    for q in ("Q1", "Q2", "Q3", "Q4"):
        conn.execute(
            sa.text(
                "UPDATE tax_adjustments SET quarter = :q "
                "WHERE adjustment_type = 'self_assessment' AND label ILIKE :pattern"
            ),
            {"q": q, "pattern": f"%{q}%"},
        )


def downgrade() -> None:
    op.drop_column("tax_adjustments", "quarter")
