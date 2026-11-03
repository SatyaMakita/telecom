# 03 — Install and inspect Open5GS

Open5GS is an open-source implementation of mobile packet-core functions. It supports EPC (LTE) and 5GC (5G Core) functions. Follow the upstream installation guide for the Ubuntu release you are running:
https://open5gs.org/open5gs/docs/

## Installation approach

The Open5GS project documents package-based installation for supported Ubuntu versions. Use the exact current repository and package instructions from the official documentation rather than copying an old third-party command.

After installation, inspect package state:

```bash
dpkg -l | grep open5gs
```

Inspect installed services:

```bash
systemctl list-unit-files 'open5gs*'
systemctl --no-pager --type=service --all | grep open5gs
```

Common 5GC service names include:
- `open5gs-nrfd`
- `open5gs-scpd` (if included/enabled in the deployment)
- `open5gs-amfd`
- `open5gs-smfd`
- `open5gs-upfd`
- `open5gs-ausfd`
- `open5gs-udmd`
- `open5gs-udrd`
- `open5gs-pcfd`
- `open5gs-nssfd`
- `open5gs-bsfd`

Exact services and names vary by package version and configuration.

## Inspect configuration

Configuration is normally under `/etc/open5gs/`.

```bash
ls -1 /etc/open5gs/
```

Inspect only relevant non-secret fields:

```bash
sudo grep -nE 'mcc:|mnc:|tac:|addr:|address:|port:|sst:' \
  /etc/open5gs/amf.yaml
```

Back up before editing:

```bash
sudo cp -a /etc/open5gs /etc/open5gs.backup.$(date +%Y%m%d-%H%M%S)
```

## Check MongoDB URI

```bash
sudo grep -R -n 'mongodb://' /etc/open5gs/
```

For the local MongoDB container in this kit, the intended local URI is usually:

```text
mongodb://127.0.0.1/open5gs
```

Confirm the exact configuration syntax and file used by your installed version. Do not blindly replace every URI in every file.

## Service health and logs

```bash
sudo systemctl status open5gs-amfd
sudo systemctl status open5gs-smfd
sudo systemctl status open5gs-upfd
sudo journalctl -u open5gs-amfd -n 100 --no-pager
```

If a unit is not found, list installed units and consult the package documentation. Do not assume every network function is installed or enabled.

## WebUI (optional)

Open5GS has a WebUI for subscriber management. Follow the current official WebUI installation guide. Keep it bound to localhost or behind a properly secured local reverse proxy. Never expose the WebUI or subscriber database to the public internet.
