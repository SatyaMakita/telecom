"""
Mobility-event endpoints.

Tracks synthetic attach / handover / detach events across the lab topology.
"""

import json
import random
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import AuditEvent, LabCell, LabMobilityEvent, LabSubscriber
from ..schemas import (
    LabMobilityEventCreate,
    LabMobilityEventList,
    LabMobilityEventResponse,
    MobilitySimulateRequest,
)
from ..ws_manager import manager

router = APIRouter(prefix="/api/mobility", tags=["Mobility"])


@router.get("", response_model=LabMobilityEventList, summary="List mobility events")
async def list_mobility_events(
    subscriber_id: Optional[int] = Query(None),
    cell_id: Optional[int] = Query(None),
    start: Optional[datetime] = Query(None, description="Start of time range (UTC)"),
    end: Optional[datetime] = Query(None, description="End of time range (UTC)"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
) -> LabMobilityEventList:
    stmt = select(LabMobilityEvent)

    if subscriber_id is not None:
        stmt = stmt.where(LabMobilityEvent.subscriber_id == subscriber_id)
    if cell_id is not None:
        stmt = stmt.where(LabMobilityEvent.cell_id == cell_id)
    if start is not None:
        stmt = stmt.where(LabMobilityEvent.timestamp >= start)
    if end is not None:
        stmt = stmt.where(LabMobilityEvent.timestamp <= end)

    stmt = stmt.order_by(LabMobilityEvent.timestamp.desc()).offset(skip).limit(limit)
    result = await db.execute(stmt)
    items = result.scalars().all()
    return LabMobilityEventList(count=len(items), items=items)  # type: ignore[arg-type]


@router.post(
    "",
    response_model=LabMobilityEventResponse,
    status_code=201,
    summary="Create a mobility event",
)
async def create_mobility_event(
    payload: LabMobilityEventCreate,
    db: AsyncSession = Depends(get_db),
) -> LabMobilityEventResponse:
    # Validate FK references
    sub = await db.execute(
        select(LabSubscriber).where(LabSubscriber.id == payload.subscriber_id)
    )
    if not sub.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Subscriber not found")

    cell = await db.execute(
        select(LabCell).where(LabCell.id == payload.cell_id)
    )
    if not cell.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Cell not found")

    event = LabMobilityEvent(
        subscriber_id=payload.subscriber_id,
        cell_id=payload.cell_id,
        event_type=payload.event_type,
        timestamp=payload.timestamp or datetime.now(timezone.utc),
    )
    db.add(event)
    await db.flush()

    # Broadcast via WebSocket
    await manager.publish("mobility_event", {
        "id": event.id,
        "subscriber_id": event.subscriber_id,
        "cell_id": event.cell_id,
        "event_type": event.event_type,
        "timestamp": event.timestamp.isoformat(),
    })

    return LabMobilityEventResponse.model_validate(event)


@router.post(
    "/simulate",
    response_model=LabMobilityEventList,
    summary="Simulate random mobility events",
    description="Generates N random attach/handover/detach events across existing subscribers and cells.",
)
async def simulate_mobility(
    payload: MobilitySimulateRequest,
    db: AsyncSession = Depends(get_db),
) -> LabMobilityEventList:
    subs = (await db.execute(select(LabSubscriber))).scalars().all()
    cells = (await db.execute(select(LabCell))).scalars().all()

    if not subs:
        raise HTTPException(status_code=400, detail="No subscribers in database — create one first")
    if not cells:
        raise HTTPException(status_code=400, detail="No cells in database — seed or create cells first")

    event_types = ["attach", "handover", "detach"]
    now = datetime.now(timezone.utc)
    created: list[LabMobilityEvent] = []

    for i in range(payload.count):
        ts = now - timedelta(seconds=random.randint(0, 3600 * 24))
        event = LabMobilityEvent(
            subscriber_id=random.choice(subs).id,
            cell_id=random.choice(cells).id,
            event_type=random.choice(event_types),
            timestamp=ts,
        )
        db.add(event)
        created.append(event)

    await db.flush()

    # Audit the simulation
    db.add(AuditEvent(
        actor="api",
        action="simulate",
        resource="mobility",
        details=json.dumps({"count": len(created)}),
        timestamp=datetime.now(timezone.utc),
    ))
    await db.flush()

    # Broadcast summary
    await manager.publish("mobility_simulation", {"count": len(created)})

    return LabMobilityEventList(count=len(created), items=created)  # type: ignore[arg-type]


@router.get(
    "/timeline/{subscriber_id}",
    response_model=LabMobilityEventList,
    summary="Mobility timeline for a subscriber",
    description="Returns all mobility events for a subscriber, ordered chronologically.",
)
async def subscriber_timeline(
    subscriber_id: int,
    db: AsyncSession = Depends(get_db),
) -> LabMobilityEventList:
    # Verify subscriber exists
    sub = await db.execute(
        select(LabSubscriber).where(LabSubscriber.id == subscriber_id)
    )
    if not sub.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Subscriber not found")

    result = await db.execute(
        select(LabMobilityEvent)
        .where(LabMobilityEvent.subscriber_id == subscriber_id)
        .order_by(LabMobilityEvent.timestamp.asc())
    )
    items = result.scalars().all()
    return LabMobilityEventList(count=len(items), items=items)  # type: ignore[arg-type]
