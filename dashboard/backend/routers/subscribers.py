"""
Synthetic subscriber management endpoints.

ALL subscriber data (SUPI, Ki, OPc) is fictional and generated for lab use only.
"""

import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import AuditEvent, LabSubscriber
from ..schemas import LabSubscriberCreate, LabSubscriberList, LabSubscriberResponse

router = APIRouter(prefix="/api/subscribers", tags=["Subscribers"])


@router.get(
    "",
    response_model=LabSubscriberList,
    summary="List all synthetic subscribers",
)
async def list_subscribers(db: AsyncSession = Depends(get_db)) -> LabSubscriberList:
    result = await db.execute(select(LabSubscriber).order_by(LabSubscriber.id))
    items = result.scalars().all()
    return LabSubscriberList(count=len(items), items=items)  # type: ignore[arg-type]


@router.post(
    "",
    response_model=LabSubscriberResponse,
    status_code=201,
    summary="Create a synthetic subscriber",
    description="SUPI must match the pattern imsi-XXXX (10–15 digits). All keys are synthetic.",
)
async def create_subscriber(
    payload: LabSubscriberCreate,
    db: AsyncSession = Depends(get_db),
) -> LabSubscriberResponse:
    # Check for duplicate SUPI
    existing = await db.execute(
        select(LabSubscriber).where(LabSubscriber.supi == payload.supi)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail=f"SUPI {payload.supi} already exists")

    subscriber = LabSubscriber(**payload.model_dump())
    db.add(subscriber)
    await db.flush()

    # Audit
    db.add(AuditEvent(
        actor="api",
        action="create",
        resource="subscriber",
        details=json.dumps({"supi": subscriber.supi, "id": subscriber.id}),
        timestamp=datetime.now(timezone.utc),
    ))
    await db.flush()

    return LabSubscriberResponse.model_validate(subscriber)


@router.get(
    "/{subscriber_id}",
    response_model=LabSubscriberResponse,
    summary="Get a subscriber by ID",
)
async def get_subscriber(
    subscriber_id: int,
    db: AsyncSession = Depends(get_db),
) -> LabSubscriberResponse:
    result = await db.execute(
        select(LabSubscriber).where(LabSubscriber.id == subscriber_id)
    )
    subscriber = result.scalar_one_or_none()
    if not subscriber:
        raise HTTPException(status_code=404, detail="Subscriber not found")
    return LabSubscriberResponse.model_validate(subscriber)


@router.delete(
    "/{subscriber_id}",
    status_code=204,
    summary="Delete a synthetic subscriber",
)
async def delete_subscriber(
    subscriber_id: int,
    db: AsyncSession = Depends(get_db),
) -> None:
    result = await db.execute(
        select(LabSubscriber).where(LabSubscriber.id == subscriber_id)
    )
    subscriber = result.scalar_one_or_none()
    if not subscriber:
        raise HTTPException(status_code=404, detail="Subscriber not found")

    supi = subscriber.supi
    await db.delete(subscriber)

    db.add(AuditEvent(
        actor="api",
        action="delete",
        resource="subscriber",
        details=json.dumps({"supi": supi, "id": subscriber_id}),
        timestamp=datetime.now(timezone.utc),
    ))
    await db.flush()
