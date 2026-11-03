"""
FastAPI Main Application for Telecom Engineering Lab Dashboard.

Provides REST and WebSocket endpoints for managing synthetic subscribers, cell sites,
simulated mobility events, positioning experiments, and system health.

SAFETY NOTICE:
All identities, cell sites, subscribers, and measurements are 100% SYNTHETIC.
This application must never be connected to real telecommunication operator infrastructure.
"""

import csv
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select

from .database import async_session_factory, engine
from .models import AuditEvent, Base, LabCell, LabSubscriber
from .routers import audit, cells, eir, health, mobility, positioning, reports, subscribers, tracker, websocket

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("telecom_dashboard")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure tables exist
    logger.info("Initializing database schema...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Seed cell sites and sample subscriber if needed
    async with async_session_factory() as session:
        # Check cells
        cell_res = await session.execute(select(LabCell))
        if not cell_res.scalars().first():
            csv_path = Path(__file__).resolve().parents[2] / "data" / "synthetic_sites.csv"
            if csv_path.exists():
                logger.info("Seeding synthetic cell sites from %s...", csv_path)
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

        # Check subscribers
        sub_res = await session.execute(select(LabSubscriber))
        if not sub_res.scalars().first():
            logger.info("Seeding default synthetic test subscriber...")
            default_sub = LabSubscriber(
                supi="imsi-999700000000001",
                profile_name="Synthetic Lab Profile 1",
                ki="465B5CE8B199B49FAA5F0A2EE238A6BC",
                opc="E8ED289DEBA952E4283B54E88E6183CA",
                amf_value="8000",
            )
            session.add(default_sub)

        # Record initial system startup audit
        session.add(
            AuditEvent(
                actor="system",
                action="server_startup",
                resource="telecom_dashboard",
                details='{"status": "initialized", "mode": "synthetic_lab"}',
            )
        )
        await session.commit()

    logger.info("Database initialization completed.")
    yield
    logger.info("Shutting down Telecom Engineering Dashboard.")


app = FastAPI(
    title="Telecom Engineering Lab Dashboard",
    description="Educational laboratory dashboard for 5G SA (Open5GS + UERANSIM) with synthetic data and positioning simulations.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health.router)
app.include_router(subscribers.router)
app.include_router(cells.router)
app.include_router(mobility.router)
app.include_router(positioning.router)
app.include_router(audit.router)
app.include_router(reports.router)
app.include_router(tracker.router)
app.include_router(eir.router)
app.include_router(websocket.router)

# Mount frontend build if available
frontend_dist = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if frontend_dist.exists() and frontend_dist.is_dir():
    from fastapi.responses import FileResponse

    assets_dir = frontend_dist / "assets"
    if assets_dir.exists() and assets_dir.is_dir():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file_path = frontend_dist / full_path
        if file_path.is_file():
            return FileResponse(file_path)
        index_file = frontend_dist / "index.html"
        if index_file.is_file():
            return FileResponse(index_file)
        return FileResponse(file_path)

