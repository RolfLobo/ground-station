"""add station metadata to locations

Revision ID: b9d2e4f6a1c3
Revises: a8b5d2f3c7e1
Create Date: 2026-06-09 19:10:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b9d2e4f6a1c3"
down_revision: Union[str, None] = "a8b5d2f3c7e1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "locations",
        sa.Column("station_type", sa.String(), nullable=False, server_default="stationary"),
    )
    op.add_column(
        "locations",
        sa.Column("horizon_mask", sa.Float(), nullable=False, server_default=sa.text("0")),
    )

    # Canonicalize legacy rows and any unexpected values while migrating.
    op.execute("UPDATE locations SET station_type = 'stationary' WHERE station_type IS NULL")
    op.execute("UPDATE locations SET station_type = 'stationary' WHERE TRIM(station_type) = ''")
    op.execute(
        "UPDATE locations SET station_type = 'stationary' "
        "WHERE LOWER(station_type) NOT IN ('stationary', 'mobile')"
    )
    op.execute("UPDATE locations SET station_type = LOWER(station_type)")
    op.execute("UPDATE locations SET horizon_mask = 0 WHERE horizon_mask IS NULL")
    op.execute("UPDATE locations SET horizon_mask = 0 WHERE horizon_mask < 0")
    op.execute("UPDATE locations SET horizon_mask = 90 WHERE horizon_mask > 90")


def downgrade() -> None:
    op.drop_column("locations", "horizon_mask")
    op.drop_column("locations", "station_type")
