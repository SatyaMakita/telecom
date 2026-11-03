"""
Live Device Tracker & Real-Time Trajectory Simulation Router.

Calculates dynamic radio propagation metrics (Path Loss, RSRP, RSRQ, SINR)
and serves simulated movement trajectories across the synthetic cell sites.
ALL data is 100% synthetic / fictional.
"""

import json
import math
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import AuditEvent, LabCell, LabMobilityEvent, LabSubscriber
from ..ws_manager import manager

router = APIRouter(prefix="/api/tracker", tags=["Tracker"])

# Realistic movement routes across the Mumbai lab cell topology (lat ~19.065 to 19.090, lon ~72.865 to 72.900)
PREDEFINED_ROUTES = [
    {
        "id": "bkc_corridor",
        "name": "Bandra Kurla Business Corridor",
        "description": "Transit route connecting Western Suburbs through BKC financial center into Kurla.",
        "waypoints": [
            [19.0600, 72.8600],
            [19.0635, 72.8665],
            [19.0670, 72.8710],
            [19.0710, 72.8755],
            [19.0755, 72.8780],  # Close to LAB_SITE_A
            [19.0790, 72.8820],
            [19.0830, 72.8870],
            [19.0870, 72.8920],
        ],
    },
    {
        "id": "airport_express",
        "name": "Airport & Santa Cruz Link",
        "description": "Traverse from Domestic Terminal area near Site B eastward towards Vidyanagari.",
        "waypoints": [
            [19.0920, 72.8620],
            [19.0895, 72.8655],  # Near LAB_SITE_B
            [19.0870, 72.8710],
            [19.0845, 72.8760],
            [19.0810, 72.8810],
            [19.0765, 72.8850],
            [19.0700, 72.8885],
            [19.0655, 72.8910],  # Near LAB_SITE_C
        ],
    },
    {
        "id": "eastern_traverse",
        "name": "Eastern Express Arterial",
        "description": "North-South traverse crossing GSM Site D and LTE Site C.",
        "waypoints": [
            [19.0950, 72.8980],
            [19.0880, 72.8990],
            [19.0825, 72.9000],  # Near LAB_SITE_D
            [19.0770, 72.8965],
            [19.0710, 72.8930],
            [19.0650, 72.8900],  # Near LAB_SITE_C
            [19.0600, 72.8870],
        ],
    },
]


class TelemetryRequest(BaseModel):
    latitude: float
    longitude: float
    serving_cell_id: Optional[int] = None
    subscriber_id: Optional[int] = None


class CellRadioMetric(BaseModel):
    cell_id: int
    site_id: str
    technology: str
    latitude: float
    longitude: float
    distance_meters: float
    path_loss_db: float
    rsrp_dbm: float
    rsrq_db: float
    sinr_db: float
    is_serving: bool


class TelemetryResponse(BaseModel):
    latitude: float
    longitude: float
    serving_cell: CellRadioMetric
    all_cells: list[CellRadioMetric]
    handover_recommended: bool
    handover_target_cell_id: Optional[int] = None
    estimated_speed_kmh: float = 38.5


class RecordHandoverRequest(BaseModel):
    subscriber_id: int
    from_cell_id: int
    to_cell_id: int
    latitude: float
    longitude: float
    reason: str = "A3-Event-RSRP-Threshold-Triggered"


@router.get("/routes", summary="List available simulated transit routes")
async def get_routes():
    return PREDEFINED_ROUTES


def _haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371000.0  # Earth radius in meters
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c


@router.post("/telemetry", response_model=TelemetryResponse, summary="Compute real-time radio metrics")
async def compute_telemetry(
    req: TelemetryRequest,
    db: AsyncSession = Depends(get_db),
) -> TelemetryResponse:
    cells = (await db.execute(select(LabCell))).scalars().all()
    if not cells:
        raise HTTPException(status_code=400, detail="No cells available in database")

    tx_power_dbm = 43.0  # standard macro gNB Tx power
    carrier_freq_ghz = 3.5  # 3.5 GHz n78 band

    metrics: list[CellRadioMetric] = []

    for c in cells:
        dist_m = max(_haversine_distance(req.latitude, req.longitude, c.latitude, c.longitude), 10.0)
        # 3GPP Urban Macro Path Loss: PL = 28.0 + 22*log10(d) + 20*log10(fc)
        pl = 28.0 + 22.0 * math.log10(dist_m) + 20.0 * math.log10(carrier_freq_ghz)
        rsrp = tx_power_dbm - pl
        rsrq = -10.0 - 5.0 * (dist_m / 2000.0)
        sinr = max(rsrp + 110.0, -15.0)  # simple noise floor model

        metrics.append(
            CellRadioMetric(
                cell_id=c.id,
                site_id=c.site_id,
                technology=c.technology,
                latitude=c.latitude,
                longitude=c.longitude,
                distance_meters=round(dist_m, 1),
                path_loss_db=round(pl, 1),
                rsrp_dbm=round(rsrp, 1),
                rsrq_db=round(rsrq, 1),
                sinr_db=round(sinr, 1),
                is_serving=False,
            )
        )

    # Sort by strongest RSRP
    metrics.sort(key=lambda m: m.rsrp_dbm, reverse=True)
    best_cell = metrics[0]

    # Current serving cell (or best if none specified)
    serving = best_cell
    if req.serving_cell_id is not None:
        curr = next((m for m in metrics if m.cell_id == req.serving_cell_id), None)
        if curr:
            serving = curr

    serving.is_serving = True

    # Check for 3GPP Event A3 Handover condition (best candidate exceeds serving by hysteresis of 3.0 dB)
    handover_needed = False
    target_id = None
    if best_cell.cell_id != serving.cell_id and (best_cell.rsrp_dbm - serving.rsrp_dbm) > 3.0:
        handover_needed = True
        target_id = best_cell.cell_id

    return TelemetryResponse(
        latitude=req.latitude,
        longitude=req.longitude,
        serving_cell=serving,
        all_cells=metrics,
        handover_recommended=handover_needed,
        handover_target_cell_id=target_id,
        estimated_speed_kmh=42.0,
    )


@router.post("/record-handover", summary="Record a simulated live handover event")
async def record_handover(
    req: RecordHandoverRequest,
    db: AsyncSession = Depends(get_db),
):
    # Verify subscriber
    sub = (await db.execute(select(LabSubscriber).where(LabSubscriber.id == req.subscriber_id))).scalar_one_or_none()
    if not sub:
        sub_any = (await db.execute(select(LabSubscriber))).scalars().first()
        sub_id = sub_any.id if sub_any else 1
    else:
        sub_id = sub.id

    now = datetime.now(timezone.utc)
    ev = LabMobilityEvent(
        subscriber_id=sub_id,
        cell_id=req.to_cell_id,
        event_type="handover",
        timestamp=now,
    )
    db.add(ev)

    audit = AuditEvent(
        actor="live_tracker",
        action="handover_executed",
        resource=f"cell:{req.to_cell_id}",
        details=json.dumps({
            "from_cell_id": req.from_cell_id,
            "to_cell_id": req.to_cell_id,
            "lat": req.latitude,
            "lon": req.longitude,
            "reason": req.reason,
        }),
        timestamp=now,
    )
    db.add(audit)
    await db.flush()

    await manager.publish("live_handover", {
        "event_id": ev.id,
        "from_cell_id": req.from_cell_id,
        "to_cell_id": req.to_cell_id,
        "timestamp": now.isoformat(),
        "lat": req.latitude,
        "lon": req.longitude,
    })

    return {"status": "recorded", "event_id": ev.id}


class DeviceTelemetryPayload(BaseModel):
    phone_number: str = "+91 89175 88693"
    imei: str = "355780160674584"
    latitude: float
    longitude: float
    accuracy: Optional[float] = 4.5
    speed: Optional[float] = 0.0
    heading: Optional[float] = None
    altitude: Optional[float] = None
    battery_level: Optional[float] = None
    network_type: Optional[str] = "5G-NR-SA"


# In-memory store for active live device telemetry stream
_LIVE_DEVICE_STATE = {
    "phone_number": "+91 89175 88693",
    "imei": "355780160674584",
    "latitude": 20.2961,
    "longitude": 85.8245,
    "accuracy": 4.5,
    "speed": 0.0,
    "updated_at": None,
    "is_active": True,
}


@router.post("/device-telemetry", summary="Stream live GPS telemetry from physical mobile device")
async def post_device_telemetry(payload: DeviceTelemetryPayload):
    now_iso = datetime.now(timezone.utc).isoformat()
    _LIVE_DEVICE_STATE.update({
        "phone_number": payload.phone_number,
        "imei": payload.imei,
        "latitude": payload.latitude,
        "longitude": payload.longitude,
        "accuracy": payload.accuracy,
        "speed": payload.speed,
        "heading": payload.heading,
        "altitude": payload.altitude,
        "network_type": payload.network_type,
        "updated_at": now_iso,
        "is_active": True,
    })

    # Broadcast live fix to all connected dashboard WebSockets
    await manager.publish("device_telemetry", _LIVE_DEVICE_STATE)

    return {
        "status": "received",
        "timestamp": now_iso,
        "coordinates": {"lat": payload.latitude, "lon": payload.longitude},
        "target": {"msisdn": payload.phone_number, "imei": payload.imei},
    }


@router.get("/device-telemetry", summary="Get latest uploaded physical device telemetry")
async def get_device_telemetry():
    return _LIVE_DEVICE_STATE

