"""
Report export and laboratory summary endpoints.

Generates structured analysis summaries of synthetic lab experiments.
ALL data is synthetic / fictional.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..database import get_db
from ..models import (
    AuditEvent,
    LabCell,
    LabMobilityEvent,
    LabSubscriber,
    PositioningExperiment,
)
from ..schemas import LabSummary

router = APIRouter(prefix="/api/reports", tags=["Reports"])


@router.get("/summary", response_model=LabSummary, summary="Get summary statistics for the lab")
async def get_lab_summary(db: AsyncSession = Depends(get_db)) -> LabSummary:
    subscribers_count = (await db.execute(select(func.count(LabSubscriber.id)))).scalar() or 0
    cells_count = (await db.execute(select(func.count(LabCell.id)))).scalar() or 0
    experiments_count = (await db.execute(select(func.count(PositioningExperiment.id)))).scalar() or 0
    mobility_count = (await db.execute(select(func.count(LabMobilityEvent.id)))).scalar() or 0
    audit_count = (await db.execute(select(func.count(AuditEvent.id)))).scalar() or 0

    return LabSummary(
        subscribers=subscribers_count,
        cells=cells_count,
        experiments=experiments_count,
        mobility_events=mobility_count,
        audit_events=audit_count,
    )


@router.get("/export/{experiment_id}", summary="Export positioning experiment as a structured report")
async def export_experiment_report(
    experiment_id: int,
    db: AsyncSession = Depends(get_db),
) -> dict:
    query = (
        select(PositioningExperiment)
        .where(PositioningExperiment.id == experiment_id)
        .options(selectinload(PositioningExperiment.results))
    )
    res = await db.execute(query)
    exp = res.scalar_one_or_none()
    if not exp:
        raise HTTPException(status_code=404, detail="Experiment not found")

    errors = [r.error_meters for r in exp.results]
    mean_err = sum(errors) / len(errors) if errors else 0.0
    sorted_err = sorted(errors)
    p50 = sorted_err[len(sorted_err) // 2] if sorted_err else 0.0
    p95_idx = int(len(sorted_err) * 0.95)
    p95 = sorted_err[min(p95_idx, len(sorted_err) - 1)] if sorted_err else 0.0

    return {
        "report_type": "Positioning Experiment Analysis Report",
        "disclaimer": "ALL DATA IS SYNTHETIC / FICTIONAL FOR EDUCATIONAL LAB USE ONLY.",
        "experiment_id": exp.id,
        "name": exp.name,
        "method": exp.method,
        "noise_sigma_meters": exp.noise_sigma,
        "num_trials": exp.num_trials,
        "assumptions": exp.assumptions,
        "created_at": exp.created_at.isoformat() if exp.created_at else None,
        "metrics": {
            "mean_error_meters": round(mean_err, 2),
            "median_error_meters": round(p50, 2),
            "cep50_meters": round(p50, 2),
            "cep95_meters": round(p95, 2),
            "min_error_meters": round(min(errors), 2) if errors else 0.0,
            "max_error_meters": round(max(errors), 2) if errors else 0.0,
        },
        "results_sample": [
            {
                "trial": r.trial_number,
                "true_lat": r.true_lat,
                "true_lon": r.true_lon,
                "est_lat": r.est_lat,
                "est_lon": r.est_lon,
                "error_meters": r.error_meters,
            }
            for r in exp.results[:50]
        ],
    }
