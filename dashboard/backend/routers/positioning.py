"""
Positioning experiment endpoints (TDOA / OTDOA / E-CID).

Performs synthetic multilateration simulations and records experimental results.
ALL data is synthetic / fictional — never use for locating real devices.
"""

import json
from datetime import datetime, timezone
from typing import Optional

import numpy as np
from fastapi import APIRouter, Depends, HTTPException
from scipy.optimize import least_squares
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..database import get_db
from ..models import AuditEvent, LabCell, PositioningExperiment, PositioningResult
from ..schemas import (
    PositioningExperimentCreate,
    PositioningExperimentDetail,
    PositioningExperimentList,
    PositioningExperimentResponse,
    PositioningResultList,
    PositioningResultResponse,
)
from ..ws_manager import manager

router = APIRouter(prefix="/api/positioning", tags=["Positioning"])

EARTH_RADIUS = 6_371_000.0  # meters
SPEED_OF_LIGHT = 299_792_458.0  # m/s


def _latlon_to_xy(lat: float, lon: float, lat0: float, lon0: float) -> tuple[float, float]:
    lat_r = np.radians(lat)
    lon_r = np.radians(lon)
    lat0_r = np.radians(lat0)
    lon0_r = np.radians(lon0)
    x = EARTH_RADIUS * (lon_r - lon0_r) * np.cos(lat0_r)
    y = EARTH_RADIUS * (lat_r - lat0_r)
    return float(x), float(y)


def _xy_to_latlon(x: float, y: float, lat0: float, lon0: float) -> tuple[float, float]:
    lat0_r = np.radians(lat0)
    lat = lat0 + np.degrees(y / EARTH_RADIUS)
    lon = lon0 + np.degrees(x / (EARTH_RADIUS * np.cos(lat0_r)))
    return float(lat), float(lon)


def _tdoa_residuals(params: np.ndarray, site_xys: np.ndarray, measured_diffs: np.ndarray) -> np.ndarray:
    px, py = params
    ranges = np.sqrt((site_xys[:, 0] - px) ** 2 + (site_xys[:, 1] - py) ** 2)
    modeled_diffs = ranges[1:] - ranges[0]
    return modeled_diffs - measured_diffs


@router.get("/experiments", response_model=PositioningExperimentList, summary="List all positioning experiments")
async def list_experiments(db: AsyncSession = Depends(get_db)) -> PositioningExperimentList:
    result = await db.execute(select(PositioningExperiment).order_by(PositioningExperiment.id.desc()))
    items = result.scalars().all()
    return PositioningExperimentList(count=len(items), items=items)  # type: ignore[arg-type]


@router.post("/experiment", response_model=PositioningExperimentDetail, status_code=201, summary="Run a positioning experiment")
async def run_experiment(
    payload: PositioningExperimentCreate,
    db: AsyncSession = Depends(get_db),
) -> PositioningExperimentDetail:
    # 1. Fetch cell sites
    result = await db.execute(select(LabCell).order_by(LabCell.id))
    cells = result.scalars().all()
    if len(cells) < 3:
        raise HTTPException(
            status_code=400,
            detail=f"At least 3 cell sites required for 2D positioning (found {len(cells)})",
        )

    site_lats = np.array([c.latitude for c in cells])
    site_lons = np.array([c.longitude for c in cells])
    lat0, lon0 = float(np.mean(site_lats)), float(np.mean(site_lons))

    site_xys = np.array([_latlon_to_xy(lat, lon, lat0, lon0) for lat, lon in zip(site_lats, site_lons)])

    # 2. Determine true device position
    true_lat = payload.true_lat if payload.true_lat is not None else float(site_lats[0] + 0.004)
    true_lon = payload.true_lon if payload.true_lon is not None else float(site_lons[0] + 0.003)
    true_x, true_y = _latlon_to_xy(true_lat, true_lon, lat0, lon0)

    # 3. True ranges and true range differences
    true_ranges = np.sqrt((site_xys[:, 0] - true_x) ** 2 + (site_xys[:, 1] - true_y) ** 2)
    true_diffs = true_ranges[1:] - true_ranges[0]

    # Create Experiment DB model
    exp = PositioningExperiment(
        name=payload.name,
        method=payload.method,
        noise_sigma=payload.noise_sigma,
        num_trials=payload.num_trials,
        assumptions=payload.assumptions,
    )
    db.add(exp)
    await db.flush()

    # 4. Run trials
    trial_errors = []
    result_models = []
    sigma_range = payload.noise_sigma  # meters

    for i in range(payload.num_trials):
        noise = np.random.normal(0, max(sigma_range, 0.001), size=true_diffs.shape)
        measured_diffs = true_diffs + noise

        # Solve non-linear least squares
        init_guess = np.mean(site_xys, axis=0)
        sol = least_squares(
            _tdoa_residuals,
            init_guess,
            args=(site_xys, measured_diffs),
            method="trf",
            ftol=1e-6,
            xtol=1e-6,
            max_nfev=300,
        )
        est_x, est_y = float(sol.x[0]), float(sol.x[1])
        err = float(np.sqrt((est_x - true_x) ** 2 + (est_y - true_y) ** 2))
        est_lat, est_lon = _xy_to_latlon(est_x, est_y, lat0, lon0)

        trial_errors.append(err)
        res = PositioningResult(
            experiment_id=exp.id,
            trial_number=i + 1,
            true_lat=true_lat,
            true_lon=true_lon,
            est_lat=est_lat,
            est_lon=est_lon,
            error_meters=round(err, 2),
        )
        result_models.append(res)
        db.add(res)

    trial_errors_arr = np.array(trial_errors)
    mean_err = float(np.mean(trial_errors_arr))
    med_err = float(np.median(trial_errors_arr))
    cep50_val = float(np.percentile(trial_errors_arr, 50))
    cep95_val = float(np.percentile(trial_errors_arr, 95))

    for res in result_models:
        res.cep50 = round(cep50_val, 2)
        res.cep95 = round(cep95_val, 2)

    # Audit event
    db.add(
        AuditEvent(
            actor="web-user",
            action="run_experiment",
            resource=f"positioning_experiment:{exp.id}",
            details=json.dumps({
                "name": exp.name,
                "trials": payload.num_trials,
                "sigma": payload.noise_sigma,
                "mean_error": round(mean_err, 2),
            }),
        )
    )
    await db.flush()

    await manager.publish(
        "positioning_completed",
        {
            "experiment_id": exp.id,
            "name": exp.name,
            "mean_error": round(mean_err, 2),
            "cep50": round(cep50_val, 2),
            "cep95": round(cep95_val, 2),
        },
    )

    return PositioningExperimentDetail(
        experiment=PositioningExperimentResponse.model_validate(exp),
        results=[PositioningResultResponse.model_validate(r) for r in result_models[:100]],  # cap inline to 100
        mean_error=round(mean_err, 2),
        median_error=round(med_err, 2),
        cep50=round(cep50_val, 2),
        cep95=round(cep95_val, 2),
    )


@router.get("/experiments/{experiment_id}", response_model=PositioningExperimentDetail, summary="Get positioning experiment detail")
async def get_experiment(experiment_id: int, db: AsyncSession = Depends(get_db)) -> PositioningExperimentDetail:
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
    mean_err = float(np.mean(errors)) if errors else None
    med_err = float(np.median(errors)) if errors else None
    c50 = float(np.percentile(errors, 50)) if errors else None
    c95 = float(np.percentile(errors, 95)) if errors else None

    return PositioningExperimentDetail(
        experiment=PositioningExperimentResponse.model_validate(exp),
        results=[PositioningResultResponse.model_validate(r) for r in exp.results],
        mean_error=round(mean_err, 2) if mean_err is not None else None,
        median_error=round(med_err, 2) if med_err is not None else None,
        cep50=round(c50, 2) if c50 is not None else None,
        cep95=round(c95, 2) if c95 is not None else None,
    )


@router.get("/experiments/{experiment_id}/results", response_model=PositioningResultList, summary="Get results for an experiment")
async def get_experiment_results(experiment_id: int, db: AsyncSession = Depends(get_db)) -> PositioningResultList:
    query = select(PositioningResult).where(PositioningResult.experiment_id == experiment_id).order_by(PositioningResult.trial_number)
    res = await db.execute(query)
    items = res.scalars().all()
    return PositioningResultList(count=len(items), items=items)  # type: ignore[arg-type]
