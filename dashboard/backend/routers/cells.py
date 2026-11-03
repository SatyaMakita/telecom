"""
Cell-site management endpoints.

Manages the synthetic gNB / eNB / BTS sites used in the lab topology.
"""

import csv
import io
import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import AuditEvent, LabCell
from ..schemas import LabCellCreate, LabCellList, LabCellResponse

router = APIRouter(prefix="/api/cells", tags=["Cells"])


@router.get("", response_model=LabCellList, summary="List all lab cells")
async def list_cells(db: AsyncSession = Depends(get_db)) -> LabCellList:
    result = await db.execute(select(LabCell).order_by(LabCell.id))
    items = result.scalars().all()
    return LabCellList(count=len(items), items=items)  # type: ignore[arg-type]


@router.post(
    "",
    response_model=LabCellResponse,
    status_code=201,
    summary="Create a cell site",
)
async def create_cell(
    payload: LabCellCreate,
    db: AsyncSession = Depends(get_db),
) -> LabCellResponse:
    existing = await db.execute(
        select(LabCell).where(LabCell.site_id == payload.site_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail=f"site_id {payload.site_id} already exists")

    cell = LabCell(**payload.model_dump())
    db.add(cell)
    await db.flush()

    db.add(AuditEvent(
        actor="api",
        action="create",
        resource="cell",
        details=json.dumps({"site_id": cell.site_id, "id": cell.id}),
        timestamp=datetime.now(timezone.utc),
    ))
    await db.flush()

    return LabCellResponse.model_validate(cell)


@router.post(
    "/import-csv",
    response_model=LabCellList,
    summary="Import cell sites from a CSV file",
    description="CSV must have columns: site_id, technology, latitude, longitude, description.",
)
async def import_csv(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
) -> LabCellList:
    content = await file.read()
    text = content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))

    created: list[LabCell] = []
    for row in reader:
        site_id = row.get("site_id", "").strip()
        if not site_id:
            continue
        # Skip if already exists
        existing = await db.execute(
            select(LabCell).where(LabCell.site_id == site_id)
        )
        if existing.scalar_one_or_none():
            continue

        cell = LabCell(
            site_id=site_id,
            technology=row.get("technology", "NR").strip(),
            latitude=float(row.get("latitude", 0)),
            longitude=float(row.get("longitude", 0)),
            description=row.get("description", "").strip(),
        )
        db.add(cell)
        created.append(cell)

    await db.flush()

    if created:
        db.add(AuditEvent(
            actor="api",
            action="import_csv",
            resource="cell",
            details=json.dumps({"count": len(created)}),
            timestamp=datetime.now(timezone.utc),
        ))
        await db.flush()

    return LabCellList(count=len(created), items=created)  # type: ignore[arg-type]


@router.get("/{cell_id}", response_model=LabCellResponse, summary="Get a cell by ID")
async def get_cell(
    cell_id: int,
    db: AsyncSession = Depends(get_db),
) -> LabCellResponse:
    result = await db.execute(select(LabCell).where(LabCell.id == cell_id))
    cell = result.scalar_one_or_none()
    if not cell:
        raise HTTPException(status_code=404, detail="Cell not found")
    return LabCellResponse.model_validate(cell)


@router.delete("/{cell_id}", status_code=204, summary="Delete a cell site")
async def delete_cell(
    cell_id: int,
    db: AsyncSession = Depends(get_db),
) -> None:
    result = await db.execute(select(LabCell).where(LabCell.id == cell_id))
    cell = result.scalar_one_or_none()
    if not cell:
        raise HTTPException(status_code=404, detail="Cell not found")

    site_id = cell.site_id
    await db.delete(cell)

    db.add(AuditEvent(
        actor="api",
        action="delete",
        resource="cell",
        details=json.dumps({"site_id": site_id, "id": cell_id}),
        timestamp=datetime.now(timezone.utc),
    ))
    await db.flush()
