# 07 — Cellular positioning engineering

## Core principle

A phone number does not emit GPS coordinates. A carrier can associate a subscriber identity with a serving network context, then use authorized radio measurements and positioning infrastructure to estimate a device position.

A serving cell identifier alone usually describes a cell/sector or coverage area, not an exact device coordinate.

## Generational overview

### GSM / 2G
- CGI: Cell Global Identity
- LAI: Location Area Identity
- Timing Advance: timing-related radio measurement
- Cell-based location estimates

### UMTS / 3G
- Cell identity methods
- Radio measurements
- Assisted GNSS and network-assisted positioning, depending on deployment

### LTE / 4G
- E-CID
- OTDOA
- Assisted GNSS
- E-SMLC and GMLC roles in applicable architectures

### 5G NR
- NR E-CID
- DL-TDOA
- UL-TDOA
- Multi-RTT
- DL-AoD
- UL-AoA
- Network-assisted GNSS
- LMF and GMLC roles

Not every method is deployed by every operator or supported by every handset.

## TDOA mathematics (synthetic only)

For a two-dimensional point `p = (x, y)` and measurement site `i = (xi, yi)`:

`di = sqrt((x - xi)^2 + (y - yi)^2)`

A time-difference measurement maps to a path-length difference:

`delta_d = c * delta_t`

where `c` is the speed of light and `delta_t` is a time difference.

A single difference defines a hyperbola in 2D. Multiple independent measurements can constrain an estimated point. Real systems must account for clock synchronization, multipath, NLOS propagation, antenna geometry, measurement uncertainty, network configuration and standards-specific procedures.

## Safe practical exercise

Use `data/synthetic_sites.csv` and generate a fictional device point. Add noise to synthetic range/time measurements and compare:
- true simulated coordinate;
- estimated coordinate;
- residual error;
- confidence/uncertainty region.

Do not interpret this as a method for locating a real subscriber. UERANSIM does not provide genuine radio TDOA, AoA or RF measurements.

## Standards to study

Look up the latest applicable releases in the official 3GPP specification archive:
- TS 23.271 — Location Services (legacy generations)
- TS 23.273 — 5G System Location Services
- TS 36.305 — Stage 2 functional specification of UE positioning in LTE
- TS 38.305 — Stage 2 functional specification of UE positioning in NR
- TS 29.515 — 5G GMLC services

Always verify release/version and applicability from the official 3GPP archive.
