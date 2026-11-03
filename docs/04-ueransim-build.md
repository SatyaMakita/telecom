# 04 — Build UERANSIM

UERANSIM is an open-source 5G UE and gNB simulator:
https://github.com/aligungr/UERANSIM

It is suitable for protocol and core-network integration exercises. It is not a physical RF simulator.

## Install build dependencies

```bash
sudo apt update
sudo apt install -y git make gcc g++ cmake libsctp-dev lksctp-tools
```

Check CMake:

```bash
cmake --version
```

Compare the installed version with the minimum stated by the current UERANSIM README.

## Clone source

```bash
cd ~
git clone https://github.com/aligungr/UERANSIM.git
cd UERANSIM
```

Record the source revision:

```bash
git rev-parse --short HEAD
```

## Build

```bash
make -j4
```

If compilation fails, preserve the complete error output. Do not install random libraries until the first missing dependency is identified.

## Verify binaries

```bash
ls -lh build/
./build/nr-gnb --help
./build/nr-ue --help
./build/nr-cli --help
```

Expected binaries typically include:
- `nr-gnb`
- `nr-ue`
- `nr-cli`
- `nr-binder`

Names and options can vary by source revision.

## Inspect upstream examples

```bash
ls -1 config/
```

The repository includes example configuration files for integration with Open5GS. Read the comments and match their parameters to the installed Open5GS configuration. Do not assume examples from different releases are interchangeable.
