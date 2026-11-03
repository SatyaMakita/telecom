"""
Audit log endpoints.

Provides an immutable trail of actions performed within the lab dashboard.
ALL data is synthetic / fictional.
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import AuditEvent
from ..schemas import AuditEventList, AuditEventResponse

router = APIRouter(prefix="/api/audit", tags=["Audit"])


@router.get("", response_model=AuditEventList, summary="List audit events with pagination")
async def list_audit_events(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
) -> AuditEventList:
    query = select(AuditEvent).order_by(AuditEvent.id.desc()).offset(skip).limit(limit)
    res = await db.execute(query)
    items = res.scalars().all()

    total_query = select(AuditEvent)
    total_res = await db.execute(total_query)
    total = len(total_res.scalars().all())

    return AuditEventList(count=total, items=items)  # type: ignore[arg-type]


@router.get("/export", summary="Export full audit log as JSON")
async def export_audit_events(db: AsyncSession = Depends(get_db)) -> list[dict]:
    query = select(AuditEvent).order_by(AuditEvent.id.asc())
    res = await db.execute(query)
    events = res.scalars().all()
    return [
        {
            "id": e.id,
            "actor": e.actor,
            "action": e.action,
            "resource": e.resource,
            "details": e.details,
            "timestamp": e.timestamp.isoformat() if e.timestamp else None,
        }
        for e in events
    ]
