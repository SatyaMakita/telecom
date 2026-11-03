# 01 — Prerequisites and host checks

## Hardware

For a modest software-only lab:
- 4 CPU cores recommended;
- 16 GB RAM (your target);
- 40–60 GB free disk;
- x86-64 Ubuntu host recommended;
- internet access for package downloads.

16 GB is enough for a small Open5GS + UERANSIM setup if you avoid running many heavy services at once. Do not allocate all host memory to containers.

## Supported starting point

Use Ubuntu 22.04 LTS or 24.04 LTS. Other releases may work, but package availability and dependencies can differ.

## Host diagnostic commands

```bash
lsb_release -a
uname -a
lscpu
free -h
df -h /
ip -brief address
```

Check required tools:

```bash
command -v git
command -v gcc
command -v g++
command -v cmake
command -v pkg-config
```

Install baseline build tools:

```bash
sudo apt update
sudo apt install -y \
  ca-certificates curl wget gnupg git \
  build-essential cmake make gcc g++ pkg-config \
  libsctp-dev lksctp-tools \
  iproute2 iputils-ping net-tools tcpdump \
  python3 python3-venv python3-pip jq
```

Check versions:

```bash
gcc --version
g++ --version
cmake --version
python3 --version
```

UERANSIM's current build requirements are described in its upstream README. Check that source before building; dependency requirements can change.

## Create a working directory

```bash
mkdir -p ~/telecom-lab/{configs,logs,captures,data,scripts}
```

Keep the lab under your home directory. Avoid editing system configuration until you have backed up the original file.
