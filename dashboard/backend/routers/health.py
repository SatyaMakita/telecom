"""
Health & service-status endpoints.

Returns system metrics (CPU, RAM, disk) and checks whether core lab services
(Open5GS, UERANSIM, MongoDB) are reachable.  ALL data is synthetic.
"""

import asyncio
import time

import psutil
from fastapi import APIRouter

from ..schemas import ServiceStatus, ServicesHealth, SystemHealth

router = APIRouter(prefix="/api/health", tags=["Health"])

_BOOT_TIME = time.time()


@router.get(
    "",
    response_model=SystemHealth,
    summary="System health snapshot",
    description="CPU %, memory %, disk %, and uptime of the dashboard host.",
)
async def system_health() -> SystemHealth:
    disk = psutil.disk_usage("/")
    return SystemHealth(
        cpu_percent=psutil.cpu_percent(interval=0.3),
        memory_percent=psutil.virtual_memory().percent,
        disk_percent=disk.percent,
        uptime_seconds=round(time.time() - psutil.boot_time(), 1),
    )


async def _check_systemctl(service: str) -> ServiceStatus:
    """Try to query a systemd unit; gracefully handle missing systemctl."""
    try:
        proc = await asyncio.create_subprocess_exec(
            "systemctl", "is-active", service,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=5)
        status = stdout.decode().strip()
        return ServiceStatus(name=service, running=(status == "active"), detail=status)
    except FileNotFoundError:
        return ServiceStatus(name=service, running=False, detail="systemctl not found")
    except asyncio.TimeoutError:
        return ServiceStatus(name=service, running=False, detail="timeout")
    except Exception as exc:
        return ServiceStatus(name=service, running=False, detail=str(exc))


async def _check_docker_container(name: str) -> ServiceStatus:
    """Check whether a Docker container with the given name is running."""
    try:
        proc = await asyncio.create_subprocess_exec(
            "docker", "inspect", "-f", "{{.State.Running}}", name,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=5)
        running = stdout.decode().strip().lower() == "true"
        return ServiceStatus(
            name=f"docker:{name}", running=running, detail="container running" if running else "not running"
        )
    except FileNotFoundError:
        return ServiceStatus(name=f"docker:{name}", running=False, detail="docker not found")
    except asyncio.TimeoutError:
        return ServiceStatus(name=f"docker:{name}", running=False, detail="timeout")
    except Exception as exc:
        return ServiceStatus(name=f"docker:{name}", running=False, detail=str(exc))


@router.get(
    "/services",
    response_model=ServicesHealth,
    summary="Lab service health",
    description="Checks Open5GS core NFs, UERANSIM, and MongoDB via systemctl / docker.",
)
async def services_health() -> ServicesHealth:
    # Check common Open5GS NF services and supporting infra
    systemd_units = [
        "open5gs-amfd",
        "open5gs-smfd",
        "open5gs-upfd",
        "open5gs-nrfd",
        "open5gs-ausfd",
        "mongod",
    ]
    docker_containers = ["mongodb", "open5gs", "ueransim"]

    checks = [_check_systemctl(u) for u in systemd_units]
    checks += [_check_docker_container(c) for c in docker_containers]
    results = await asyncio.gather(*checks)
    return ServicesHealth(services=list(results))
