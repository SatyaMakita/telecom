# 09 — Capstone: Telecom Network Research Dashboard

## Goal

Build a dashboard that visualizes only synthetic and authorized lab data.

## Suggested architecture

- Frontend: React + Tailwind CSS
- Backend: Python + FastAPI
- Database: PostgreSQL + PostGIS (optional for geospatial queries)
- Simulator: Open5GS + UERANSIM
- Analysis: Python + NumPy + SciPy
- Maps: Leaflet
- Live events: WebSockets
- Protocol analysis: Wireshark

## Modules

1. Lab health: service status, CPU, memory and simulator state.
2. Synthetic subscriber registry: fabricated SUPIs and test profile metadata.
3. Cell-site catalogue: fictional coordinates and technology generation.
4. Mobility event timeline: simulated cell association changes.
5. Positioning playground: synthetic TDOA/OTDOA-style math with uncertainty.
6. Protocol learning: user-imported lab captures and notes.
7. Audit: who ran a test, when, which synthetic data was used.
8. Report export: experiment setup, assumptions, results and limitations.

## Suggested database entities

- `lab_subscribers`: synthetic subscriber key/id, profile name, created_at
- `lab_cells`: cell identifier, technology, latitude, longitude, metadata
- `mobility_events`: synthetic subscriber reference, cell reference, timestamp
- `positioning_experiments`: experiment name, method, assumptions, created_at
- `positioning_results`: estimated coordinate, uncertainty, residual, experiment reference
- `audit_events`: actor, action, timestamp, lab resource

Never put real subscriber identifiers or real-time carrier location data into this project.

## Definition of done

- Dashboard shows the health of the local simulator.
- Synthetic UE profiles can be created and listed.
- Synthetic cell sites appear on a map.
- A simulated mobility timeline can be replayed.
- Positioning experiments show uncertainty and error, not just a point.
- Every experiment is traceable and reproducible.
- No component queries a public mobile operator or third-party subscriber.
