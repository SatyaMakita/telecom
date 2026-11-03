# Advanced Telecom Engineering Lab Kit
## GSM / UMTS / LTE / 5G architecture, Open5GS, UERANSIM and cellular positioning research

**Target environment:** Ubuntu 22.04/24.04 LTS, 16 GB RAM, software-only simulation.

**Primary milestone:** build an isolated 5G Standalone (SA) lab using Open5GS + UERANSIM, register a synthetic UE, inspect signalling, and study positioning mathematics with synthetic data.

> Safety boundary: this kit is for an isolated lab using synthetic subscriber identities and simulated network components. It does not locate real subscribers, access carrier networks, intercept third-party communications, or transmit cellular radio signals. Do not connect this lab to a public mobile network or use real SIM credentials.

## Package contents

- `docs/`: detailed course, architecture notes, installation, troubleshooting and practical exercises.
- `configs/`: lab-only example configuration templates. Review against the version of the software you install before use.
- `scripts/`: host diagnostics and safe setup helpers.
- `data/`: synthetic cell-site dataset for mapping and positioning exercises.
- `requirements.txt`: Python dependencies for optional simulations.

## Recommended order

1. Read `docs/00-safety-and-lab-scope.md`.
2. Run `scripts/host-diagnostics.sh`.
3. Install Docker Engine and Compose using `docs/02-docker-and-mongodb.md`.
4. Install Open5GS using `docs/03-open5gs-installation.md`.
5. Build UERANSIM using `docs/04-ueransim-build.md`.
6. Configure a synthetic subscriber and align PLMN/TAC/slice settings using `docs/05-lab-integration.md`.
7. Complete the registration and packet-analysis exercises in `docs/06-validation-and-packet-analysis.md`.
8. Study cellular positioning with `docs/07-positioning-engineering.md`.
9. Complete the capstone in `docs/09-capstone-dashboard.md`.

## Important compatibility note

Open5GS and UERANSIM evolve. Their current official documentation and example configuration files are authoritative. Treat the templates in this kit as learning examples, not a substitute for checking the exact version installed. Do not overwrite all `/etc/open5gs` configuration files blindly.

## Official project references

- Open5GS: https://open5gs.org/
- Open5GS documentation: https://open5gs.org/open5gs/docs/
- Open5GS source: https://github.com/open5gs/open5gs
- UERANSIM source and documentation: https://github.com/aligungr/UERANSIM
- Docker Engine installation: https://docs.docker.com/engine/install/ubuntu/
- Docker Compose: https://docs.docker.com/compose/install/linux/
- Wireshark: https://www.wireshark.org/docs/
- 3GPP specifications: https://www.3gpp.org/ftp/Specs/archive/

## Support workflow

When troubleshooting, collect:
- Ubuntu release and kernel
- CPU/RAM/disk
- `docker version` and `docker compose version`
- installed Open5GS package version
- UERANSIM commit hash and build output
- relevant service logs with secrets redacted

Never share subscriber keys, OP/OPc values, passwords, API tokens, or unredacted private subscriber data.
