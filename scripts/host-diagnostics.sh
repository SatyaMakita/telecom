#!/usr/bin/env bash
set -u

echo "========== OS =========="
lsb_release -ds 2>/dev/null || cat /etc/os-release
echo
echo "========== KERNEL =========="
uname -r
echo
echo "========== CPU =========="
nproc
lscpu | grep -E 'Model name|Architecture|Virtualization' || true
echo
echo "========== MEMORY =========="
free -h
echo
echo "========== ROOT DISK =========="
df -h /
echo
echo "========== BUILD TOOLS =========="
for cmd in git gcc g++ cmake make pkg-config python3 docker; do
  if command -v "$cmd" >/dev/null 2>&1; then
    printf '%-12s %s\n' "$cmd" "$(command -v "$cmd")"
  else
    printf '%-12s %s\n' "$cmd" "NOT INSTALLED"
  fi
done
echo
echo "========== DOCKER =========="
if command -v docker >/dev/null 2>&1; then
  docker --version
  docker compose version 2>/dev/null || true
  sudo docker ps 2>/dev/null || true
fi
echo
echo "========== OPEN5GS PACKAGES =========="
dpkg -l 2>/dev/null | grep open5gs || true
echo
echo "========== UERANSIM =========="
if [ -d "$HOME/UERANSIM/build" ]; then
  ls -lh "$HOME/UERANSIM/build/" 2>/dev/null || true
else
  echo "No $HOME/UERANSIM/build directory"
fi
