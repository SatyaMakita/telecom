"""
Pydantic v2 schemas (request / response) for the Telecom Lab Dashboard API.

ALL data is synthetic / fictional.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


# ---------------------------------------------------------------------------
# LabSubscriber
# ---------------------------------------------------------------------------

class LabSubscriberCreate(BaseModel):
    """Create a synthetic subscriber. SUPI must start with 'imsi-'."""
    supi: str = Field(..., pattern=r"^imsi-\d{10,15}$", examples=["imsi-999700000000001"])
    profile_name: str = Field(default="default", max_length=128)
    ki: str = Field(..., min_length=32, max_length=64, examples=["00112233445566778899aabbccddeeff"])
    opc: str = Field(..., min_length=32, max_length=64, examples=["00112233445566778899aabbccddeeff"])
    amf_value: str = Field(default="8000", max_length=8)


class LabSubscriberResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    supi: str
    profile_name: str
    ki: str
    opc: str
    amf_value: str
    created_at: datetime


class LabSubscriberList(BaseModel):
    count: int
    items: list[LabSubscriberResponse]


# ---------------------------------------------------------------------------
# LabCell
# ---------------------------------------------------------------------------

class LabCellCreate(BaseModel):
    site_id: str = Field(..., max_length=64, examples=["LAB_SITE_E"])
    technology: str = Field(..., pattern=r"^(NR|LTE|GSM)$")
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    description: str = Field(default="", max_length=256)
    tac: str = Field(default="0001", max_length=16)


class LabCellResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    site_id: str
    technology: str
    latitude: float
    longitude: float
    description: str
    tac: str
    created_at: datetime


class LabCellList(BaseModel):
    count: int
    items: list[LabCellResponse]


# ---------------------------------------------------------------------------
# LabMobilityEvent
# ---------------------------------------------------------------------------

class LabMobilityEventCreate(BaseModel):
    subscriber_id: int
    cell_id: int
    event_type: str = Field(..., pattern=r"^(attach|handover|detach)$")
    timestamp: Optional[datetime] = None


class LabMobilityEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    subscriber_id: int
    cell_id: int
    timestamp: datetime
    event_type: str


class LabMobilityEventList(BaseModel):
    count: int
    items: list[LabMobilityEventResponse]


class MobilitySimulateRequest(BaseModel):
    """Request N random simulated mobility events."""
    count: int = Field(default=10, ge=1, le=1000)


# ---------------------------------------------------------------------------
# PositioningExperiment
# ---------------------------------------------------------------------------

class PositioningExperimentCreate(BaseModel):
    """Create and run a TDOA positioning experiment with synthetic data."""
    name: str = Field(default="TDOA Experiment", max_length=128)
    method: str = Field(default="TDOA", pattern=r"^(TDOA|OTDOA|E-CID)$")
    noise_sigma: float = Field(default=50.0, ge=0, description="Noise σ in metres")
    num_trials: int = Field(default=100, ge=1, le=10000)
    true_lat: Optional[float] = Field(default=None, ge=-90, le=90)
    true_lon: Optional[float] = Field(default=None, ge=-180, le=180)
    assumptions: str = Field(default="Flat-earth approximation, synthetic Gaussian noise")


class PositioningExperimentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    method: str
    noise_sigma: float
    num_trials: int
    assumptions: str
    created_at: datetime


class PositioningExperimentList(BaseModel):
    count: int
    items: list[PositioningExperimentResponse]


class PositioningResultResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    experiment_id: int
    trial_number: int
    true_lat: float
    true_lon: float
    est_lat: float
    est_lon: float
    error_meters: float
    cep50: Optional[float]
    cep95: Optional[float]
    created_at: datetime


class PositioningResultList(BaseModel):
    count: int
    items: list[PositioningResultResponse]


class PositioningExperimentDetail(BaseModel):
    """Full experiment with inline results and summary statistics."""
    experiment: PositioningExperimentResponse
    results: list[PositioningResultResponse]
    mean_error: Optional[float] = None
    median_error: Optional[float] = None
    cep50: Optional[float] = None
    cep95: Optional[float] = None


# ---------------------------------------------------------------------------
# AuditEvent
# ---------------------------------------------------------------------------

class AuditEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    actor: str
    action: str
    resource: str
    details: str
    timestamp: datetime


class AuditEventList(BaseModel):
    count: int
    items: list[AuditEventResponse]


# ---------------------------------------------------------------------------
# Reports / Summary
# ---------------------------------------------------------------------------

class LabSummary(BaseModel):
    subscribers: int
    cells: int
    experiments: int
    mobility_events: int
    audit_events: int


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

class SystemHealth(BaseModel):
    cpu_percent: float
    memory_percent: float
    disk_percent: float
    uptime_seconds: float


class ServiceStatus(BaseModel):
    name: str
    running: bool
    detail: str = ""


class ServicesHealth(BaseModel):
    services: list[ServiceStatus]
