"""
SQLAlchemy ORM models for the Telecom Engineering Lab Kit dashboard.

All 6 entities from the capstone specification are defined here.
ALL data is synthetic / fictional — these models must NEVER hold real subscriber info.
"""

from datetime import datetime, timezone

from sqlalchemy import (
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from .database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class LabSubscriber(Base):
    """A synthetic 5G subscriber used for lab testing."""

    __tablename__ = "lab_subscribers"

    id = Column(Integer, primary_key=True, index=True)
    supi = Column(String(32), unique=True, nullable=False, index=True)
    profile_name = Column(String(128), nullable=False, default="default")
    ki = Column(String(64), nullable=False)        # synthetic authentication key
    opc = Column(String(64), nullable=False)        # synthetic operator key
    amf_value = Column(String(8), nullable=False, default="8000")
    created_at = Column(DateTime(timezone=True), default=_utcnow)

    mobility_events = relationship(
        "LabMobilityEvent", back_populates="subscriber", cascade="all, delete-orphan"
    )


class LabCell(Base):
    """A synthetic cell site (gNB / eNB / BTS) in the lab topology."""

    __tablename__ = "lab_cells"

    id = Column(Integer, primary_key=True, index=True)
    site_id = Column(String(64), unique=True, nullable=False, index=True)
    technology = Column(String(8), nullable=False)   # NR, LTE, GSM
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    description = Column(String(256), default="")
    tac = Column(String(16), default="0001")
    created_at = Column(DateTime(timezone=True), default=_utcnow)

    mobility_events = relationship(
        "LabMobilityEvent", back_populates="cell", cascade="all, delete-orphan"
    )


class LabMobilityEvent(Base):
    """A simulated attach / handover / detach event."""

    __tablename__ = "lab_mobility_events"

    id = Column(Integer, primary_key=True, index=True)
    subscriber_id = Column(Integer, ForeignKey("lab_subscribers.id"), nullable=False)
    cell_id = Column(Integer, ForeignKey("lab_cells.id"), nullable=False)
    timestamp = Column(DateTime(timezone=True), default=_utcnow)
    event_type = Column(String(16), nullable=False)  # attach, handover, detach

    subscriber = relationship("LabSubscriber", back_populates="mobility_events")
    cell = relationship("LabCell", back_populates="mobility_events")


class PositioningExperiment(Base):
    """Metadata for a positioning (TDOA / OTDOA / E-CID) experiment run."""

    __tablename__ = "positioning_experiments"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(128), nullable=False)
    method = Column(String(16), nullable=False)    # TDOA, OTDOA, E-CID
    noise_sigma = Column(Float, nullable=False, default=50.0)
    num_trials = Column(Integer, nullable=False, default=100)
    assumptions = Column(Text, default="")
    created_at = Column(DateTime(timezone=True), default=_utcnow)

    results = relationship(
        "PositioningResult", back_populates="experiment", cascade="all, delete-orphan"
    )


class PositioningResult(Base):
    """One trial result from a positioning experiment."""

    __tablename__ = "positioning_results"

    id = Column(Integer, primary_key=True, index=True)
    experiment_id = Column(
        Integer, ForeignKey("positioning_experiments.id"), nullable=False
    )
    trial_number = Column(Integer, nullable=False)
    true_lat = Column(Float, nullable=False)
    true_lon = Column(Float, nullable=False)
    est_lat = Column(Float, nullable=False)
    est_lon = Column(Float, nullable=False)
    error_meters = Column(Float, nullable=False)
    cep50 = Column(Float, nullable=True)
    cep95 = Column(Float, nullable=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow)

    experiment = relationship("PositioningExperiment", back_populates="results")


class AuditEvent(Base):
    """Immutable audit log entry for dashboard actions."""

    __tablename__ = "audit_events"

    id = Column(Integer, primary_key=True, index=True)
    actor = Column(String(64), nullable=False, default="system")
    action = Column(String(32), nullable=False)
    resource = Column(String(64), nullable=False)
    details = Column(Text, default="{}")  # JSON-encoded details
    timestamp = Column(DateTime(timezone=True), default=_utcnow)
