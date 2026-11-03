"""
Database initialization and reset utility script.

Usage:
    python -m dashboard.backend.init_db
    OR
    python dashboard/backend/init_db.py
"""

import asyncio
import csv
from pathlib import Path

from sqlalchemy import select

from .database import async_session_factory, engine
from .models import AuditEvent, Base, LabCell, LabSubscriber


async def init():
    print("Recreating database tables...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    async with async_session_factory() as session:
        csv_path = Path(__file__).resolve().parents[2] / "data" / "synthetic_sites.csv"
        if csv_path.exists():
            print(f"Seeding cell sites from {csv_path}...")
            with open(csv_path, mode="r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    cell = LabCell(
                        site_id=row["site_id"].strip(),
                        technology=row["technology"].strip(),
                        latitude=float(row["latitude"]),
                        longitude=float(row["longitude"]),
                        description=row.get("description", "").strip(),
                        tac="0001",
                    )
                    session.add(cell)

        print("Seeding synthetic test subscriber...")
        subscriber = LabSubscriber(
            supi="imsi-999700000000001",
            profile_name="Synthetic Lab Profile 1",
            ki="465B5CE8B199B49FAA5F0A2EE238A6BC",
            opc="E8ED289DEBA952E4283B54E88E6183CA",
            amf_value="8000",
        )
        session.add(subscriber)

        session.add(
            AuditEvent(
                actor="admin",
                action="init_database",
                resource="dashboard_lab.db",
                details='{"source": "init_db.py"}',
            )
        )
        await session.commit()
    print("Database successfully initialized!")


if __name__ == "__main__":
    asyncio.run(init())
