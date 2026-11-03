"""
3GPP 5G Equipment Identity Register (EIR) & CEIR Anti-Theft Demonstration Router.

Simulates the N5g-eir service-based interface defined in 3GPP TS 29.511 and
3GPP TS 23.502 (Section 4.2.2.2.1: Registration procedure with ME identity check).

ALL data is 100% synthetic / educational.
"""

from datetime import datetime, timezone
import json
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import AuditEvent
from ..ws_manager import manager

router = APIRouter(prefix="/api/eir", tags=["EIR / CEIR"])

# In-memory simulated CEIR database (pre-seeded with synthetic devices)
SIMULATED_EIR_DATABASE = [
    {
        "imei": "355780160674584",
        "model": "User Real 5G Terminal (+91 89175 88693)",
        "status": "WHITELISTED",
        "reported_date": None,
        "fir_reference": None,
        "notes": "Verified authentic user terminal linked to real-time GPS beacon.",
    },
    {
        "imei": "356938035643801",
        "model": "Synthetic 5G Handset A",
        "status": "WHITELISTED",
        "reported_date": None,
        "fir_reference": None,
        "notes": "Verified clean consumer equipment.",
    },
    {
        "imei": "356938035643802",
        "model": "Synthetic 5G Handset B",
        "status": "GREYLISTED",
        "reported_date": "2026-10-15T08:30:00Z",
        "fir_reference": "MUM/CYBER/2026/8941",
        "notes": "Under surveillance / suspicious SIM churn flagged.",
    },
    {
        "imei": "356938035643803",
        "model": "Synthetic 5G Handset C (Lab UE)",
        "status": "BLACKLISTED",
        "reported_date": "2026-11-01T14:15:00Z",
        "fir_reference": "DEL/SOUTH/2026/10293",
        "notes": "Reported stolen via CEIR portal. Barred on all operators.",
    },
]


class IdentityCheckRequest(BaseModel):
    imei: str = Field(..., min_length=14, max_length=16, examples=["356938035643803"])
    supi: str = Field(..., examples=["imsi-999700000000001"])
    cell_id: str = Field(default="LAB_SITE_A")


class IdentityCheckResponse(BaseModel):
    imei: str
    status: str  # WHITELISTED, GREYLISTED, BLACKLISTED, UNKNOWN
    decision: str  # PERMIT_ATTACH, TRACE_AND_PERMIT, BAR_EQUIPMENT
    nas_cause_code: Optional[int] = None
    nas_cause_message: Optional[str] = None
    alert_dispatched: bool
    details: str
    signalling_flow: list[dict]


class UpdateEirStatusRequest(BaseModel):
    imei: str
    status: str = Field(..., pattern=r"^(WHITELISTED|GREYLISTED|BLACKLISTED)$")
    fir_reference: Optional[str] = None
    notes: Optional[str] = None


@router.get("/devices", summary="List simulated devices in the EIR register")
async def list_eir_devices():
    return SIMULATED_EIR_DATABASE


@router.post("/update-status", summary="Update equipment status in simulated CEIR")
async def update_device_status(
    req: UpdateEirStatusRequest,
    db: AsyncSession = Depends(get_db),
):
    dev = next((d for d in SIMULATED_EIR_DATABASE if d["imei"] == req.imei), None)
    if not dev:
        dev = {
            "imei": req.imei,
            "model": "Custom Test Terminal",
            "status": req.status,
            "reported_date": datetime.now(timezone.utc).isoformat(),
            "fir_reference": req.fir_reference,
            "notes": req.notes or "",
        }
        SIMULATED_EIR_DATABASE.append(dev)
    else:
        dev["status"] = req.status
        dev["fir_reference"] = req.fir_reference or dev["fir_reference"]
        dev["notes"] = req.notes or dev["notes"]
        if req.status == "BLACKLISTED" and not dev["reported_date"]:
            dev["reported_date"] = datetime.now(timezone.utc).isoformat()

    now = datetime.now(timezone.utc)
    db.add(
        AuditEvent(
            actor="ceir_portal",
            action="update_imei_status",
            resource=f"imei:{req.imei}",
            details=json.dumps({"status": req.status, "fir": req.fir_reference}),
            timestamp=now,
        )
    )
    await db.flush()

    return {"status": "updated", "device": dev}


@router.get("/check-imei", summary="Quick lookup of device status by IMEI")
async def get_imei_status(imei: str):
    dev = next((d for d in SIMULATED_EIR_DATABASE if d["imei"] == imei), None)
    if not dev:
        return {
            "imei": imei,
            "status": "UNKNOWN",
            "decision": "PERMIT_ATTACH",
            "notes": "IMEI clean / not blacklisted in CEIR database.",
        }
    return dev


@router.post("/check-identity", response_model=IdentityCheckResponse, summary="Simulate 3GPP N5g-eir identity check procedure")
async def check_identity(
    req: IdentityCheckRequest,
    db: AsyncSession = Depends(get_db),
) -> IdentityCheckResponse:
    dev = next((d for d in SIMULATED_EIR_DATABASE if d["imei"] == req.imei), None)
    now = datetime.now(timezone.utc)

    if not dev:
        status = "UNKNOWN"
        decision = "PERMIT_ATTACH"
        nas_cause = None
        nas_msg = None
        alert = False
        details = "IMEI not present in blacklist/greylist. Default network policy allows registration."
    elif dev["status"] == "BLACKLISTED":
        status = "BLACKLISTED"
        decision = "BAR_EQUIPMENT"
        nas_cause = 6  # 3GPP TS 24.501 5GMM Cause #6: Illegal ME (Mobile Equipment)
        nas_msg = "5GS Registration Reject — Cause #6 (Illegal ME)"
        alert = True
        details = f"Device reported stolen (Ref: {dev['fir_reference'] or 'CEIR-FLAG'}). All voice/data barred."
    elif dev["status"] == "GREYLISTED":
        status = "GREYLISTED"
        decision = "TRACE_AND_PERMIT"
        nas_cause = None
        nas_msg = None
        alert = True
        details = f"Device under tracking warrant (Ref: {dev['fir_reference']}). Registration accepted while generating law enforcement trace trigger."
    else:
        status = "WHITELISTED"
        decision = "PERMIT_ATTACH"
        nas_cause = None
        nas_msg = None
        alert = False
        details = "Verified equipment identity. Normal 5G Standalone registration proceed."

    # 3GPP Signalling sequence trace
    signalling_trace = [
        {
            "step": 1,
            "interface": "N1 (UE -> AMF)",
            "protocol": "5G-NAS (5GS Mobility Management)",
            "message": "Registration Request",
            "payload": f"SUPI: {req.supi}, 5GS-Registration-Type: Initial",
        },
        {
            "step": 2,
            "interface": "N1 (AMF -> UE)",
            "protocol": "5G-NAS",
            "message": "Identity Request",
            "payload": "Requested Identity Type: 5GS-IMEI-SV (0x03)",
        },
        {
            "step": 3,
            "interface": "N1 (UE -> AMF)",
            "protocol": "5G-NAS",
            "message": "Identity Response",
            "payload": f"Device IMEI: {req.imei}",
        },
        {
            "step": 4,
            "interface": "N5g-eir (AMF -> 5G-EIR)",
            "protocol": "HTTP/2 SBI (JSON)",
            "message": "N5g-eir_EquipmentIdentityCheck_Get Request",
            "payload": f"GET /n5g-eir-eic/v1/equipment-status?pei=imei-{req.imei}",
        },
        {
            "step": 5,
            "interface": "N5g-eir (5G-EIR -> AMF)",
            "protocol": "HTTP/2 SBI (JSON)",
            "message": "N5g-eir_EquipmentIdentityCheck_Get Response",
            "payload": f"HTTP 200 OK — Status: {status}, Action: {decision}",
        },
        {
            "step": 6,
            "interface": "N1 (AMF -> UE)",
            "protocol": "5G-NAS",
            "message": "Registration Outcome",
            "payload": (
                f"Registration Accept (PDU Session Granted)"
                if decision != "BAR_EQUIPMENT"
                else f"Registration Reject (5GMM Cause #6: Illegal ME)"
            ),
        },
    ]

    # Audit the check
    db.add(
        AuditEvent(
            actor="amf_core",
            action="eir_identity_check",
            resource=f"imei:{req.imei}",
            details=json.dumps({
                "supi": req.supi,
                "status": status,
                "decision": decision,
                "cell": req.cell_id,
                "alert": alert,
            }),
            timestamp=now,
        )
    )
    await db.flush()

    if alert:
        await manager.publish("ceir_alert", {
            "imei": req.imei,
            "status": status,
            "decision": decision,
            "cell": req.cell_id,
            "timestamp": now.isoformat(),
        })

    return IdentityCheckResponse(
        imei=req.imei,
        status=status,
        decision=decision,
        nas_cause_code=nas_cause,
        nas_cause_message=nas_msg,
        alert_dispatched=alert,
        details=details,
        signalling_flow=signalling_trace,
    )
