#!/usr/bin/env bash
# =============================================================================
# Telecom Engineering Lab Kit — Environment Setup Script
# =============================================================================
#
# Creates the lab directory tree, checks prerequisites, provisions the Python
# virtual-environment, and copies the Docker Compose file into place.
#
# SAFETY
#   • All network services bind to 127.0.0.1 (loopback) only.
#   • All credentials and identifiers are SYNTHETIC — never connect to a real
#     mobile network.
#
# IDEMPOTENCY
#   Every step is guarded so re-running this script is safe.
#
# USAGE
#   chmod +x scripts/setup-lab.sh
#   ./scripts/setup-lab.sh
# =============================================================================

set -euo pipefail

# ── Colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'  # No Colour

# ── Paths ────────────────────────────────────────────────────────────────────
LAB_HOME="${HOME}/telecom-lab"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
VENV_DIR="${LAB_HOME}/venv"

# ── Helpers ──────────────────────────────────────────────────────────────────
info()    { printf "${CYAN}[INFO]${NC}  %s\n" "$*"; }
success() { printf "${GREEN}[  OK]${NC}  %s\n" "$*"; }
warn()    { printf "${YELLOW}[WARN]${NC}  %s\n" "$*"; }
fail()    { printf "${RED}[FAIL]${NC}  %s\n" "$*"; }

separator() {
  printf "${BOLD}────────────────────────────────────────────────────────────${NC}\n"
}

# Track what is missing so we can summarise at the end.
MISSING_PACKAGES=()

# ── 1. Create directory structure ────────────────────────────────────────────
separator
info "Creating lab directory tree under ${LAB_HOME} …"

for dir in configs logs captures data scripts; do
  mkdir -p "${LAB_HOME}/${dir}"
done
success "Directory tree ready."

# ── 2. Check required packages ───────────────────────────────────────────────
separator
info "Checking required system packages …"

REQUIRED_CMDS=(git gcc g++ cmake pkg-config docker python3)

for cmd in "${REQUIRED_CMDS[@]}"; do
  if command -v "$cmd" &>/dev/null; then
    success "${cmd} found: $(command -v "$cmd")"
  else
    fail "${cmd} — NOT FOUND"
    MISSING_PACKAGES+=("$cmd")
  fi
done

# ── 3. Copy compose.yaml ────────────────────────────────────────────────────
separator
info "Provisioning Docker Compose file …"

COMPOSE_SRC="${PROJECT_ROOT}/compose.yaml"
COMPOSE_DST="${LAB_HOME}/compose.yaml"

if [[ -f "${COMPOSE_DST}" ]]; then
  success "compose.yaml already present at ${COMPOSE_DST} — skipping."
else
  if [[ -f "${COMPOSE_SRC}" ]]; then
    cp "${COMPOSE_SRC}" "${COMPOSE_DST}"
    success "Copied compose.yaml → ${COMPOSE_DST}"
  else
    warn "compose.yaml not found at ${COMPOSE_SRC} — please copy it manually."
  fi
fi

# ── 4. Python virtual-environment ───────────────────────────────────────────
separator
info "Setting up Python virtual-environment …"

REQUIREMENTS="${PROJECT_ROOT}/requirements.txt"

if command -v python3 &>/dev/null; then
  if [[ ! -d "${VENV_DIR}" ]]; then
    python3 -m venv "${VENV_DIR}"
    success "Created venv at ${VENV_DIR}"
  else
    success "venv already exists at ${VENV_DIR} — skipping creation."
  fi

  # Activate and install requirements (if the file exists).
  # shellcheck disable=SC1091
  source "${VENV_DIR}/bin/activate"

  if [[ -f "${REQUIREMENTS}" ]]; then
    pip install --quiet --upgrade pip
    pip install --quiet -r "${REQUIREMENTS}"
    success "Python dependencies installed from requirements.txt."
  else
    warn "requirements.txt not found at ${REQUIREMENTS} — skipping pip install."
  fi

  deactivate
else
  warn "python3 not available — skipping venv setup."
fi

# ── 5. Summary ───────────────────────────────────────────────────────────────
separator
printf "\n${BOLD}Lab Setup Summary${NC}\n\n"

success "Lab directory:  ${LAB_HOME}"
success "Docker Compose: ${COMPOSE_DST}"
if command -v python3 &>/dev/null; then
  success "Python venv:    ${VENV_DIR}"
fi

if [[ ${#MISSING_PACKAGES[@]} -gt 0 ]]; then
  printf "\n"
  warn "The following packages were NOT found and must be installed manually:"
  for pkg in "${MISSING_PACKAGES[@]}"; do
    printf "       • %s\n" "$pkg"
  done
fi

printf "\n${BOLD}Manual steps still required:${NC}\n"
echo   "  1. Install Open5GS (https://open5gs.org/open5gs/docs/guide/01-quickstart/)"
echo   "     Then edit /etc/open5gs/{amf,smf,upf}.yaml using the reference"
echo   "     templates in ${PROJECT_ROOT}/configs/."
echo   "  2. Build UERANSIM (https://github.com/aligungr/UERANSIM/wiki/Installation)"
echo   "     Then use the gNB and UE configs from ${PROJECT_ROOT}/configs/."
echo   "  3. Start MongoDB:  cd ${LAB_HOME} && docker compose up -d"
echo   "  4. Provision a test subscriber in Open5GS WebUI with the credentials"
echo   "     from configs/ueransim-ue.yaml."
printf "\n${GREEN}${BOLD}Setup complete.${NC}\n"
