#!/usr/bin/env bash
#
# Installs what the machine is missing, builds Acon, serves it, and stays in the
# foreground with a menu for updating and restarting. This is the whole deploy
# story for a single box, from bare OS:
#
#   git clone … && cd A-con && ./start.sh
#
# Pass -y to skip the confirmation before installing system packages.
#
# Everything is wrapped in main() so that bash parses the entire script before
# running any of it. Otherwise pulling a new version of this file mid-run would
# leave bash reading the rest of it from a changed offset.
set -euo pipefail

main() {
  ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  cd "$ROOT"

  STATE="$ROOT/.acon"
  LOG="$STATE/server.log"
  PORT="${PORT:-4173}"
  HOST="${HOST:-0.0.0.0}"
  SERVER_PID=""
  mkdir -p "$STATE"

  if [ -t 1 ]; then
    BOLD=$'\033[1m'; DIM=$'\033[2m'; RED=$'\033[31m'; GREEN=$'\033[32m'
    YELLOW=$'\033[33m'; RESET=$'\033[0m'
  else
    BOLD=""; DIM=""; RED=""; GREEN=""; YELLOW=""; RESET=""
  fi

  trap cleanup EXIT
  trap on_interrupt INT

  ASSUME_YES="${ACON_ASSUME_YES:-0}"
  case "${1:-}" in
    -y | --yes) ASSUME_YES=1 ;;
  esac

  bootstrap
  require_free_port
  install_deps
  build
  start_server

  while true; do
    show_menu
    local choice
    read -rsn1 choice || choice="q"
    echo
    case "$choice" in
      1) do_update ;;
      2) do_rebuild ;;
      3) do_restart ;;
      4) follow_logs ;;
      5) show_status ;;
      q|Q) info "Shutting down."; exit 0 ;;
      *) warn "Unknown key. Pick 1-5 or q." ;;
    esac
  done
}

# ── output ───────────────────────────────────────────────────────────────────

info()  { printf '%s\n' "$1"; }
step()  { printf '%s==>%s %s\n' "$BOLD" "$RESET" "$1"; }
ok()    { printf '%s✓%s %s\n' "$GREEN" "$RESET" "$1"; }
warn()  { printf '%s!%s %s\n' "$YELLOW" "$RESET" "$1"; }
fail()  { printf '%s✗%s %s\n' "$RED" "$RESET" "$1" >&2; }

# ── preflight ────────────────────────────────────────────────────────────────

NODE_MAJOR=24
NVM_VERSION=v0.40.1

# Installs whatever the machine is missing, so a bare box needs this script and
# nothing else. Everything here is a no-op once the box is set up.
bootstrap() {
  local missing=()
  have curl || missing+=("curl")
  have git || missing+=("git")
  node_runs_typescript || missing+=("node${NODE_MAJOR}")

  if [ "${#missing[@]}" -eq 0 ]; then
    warn_if_not_a_checkout
    return
  fi

  step "This machine is missing: ${missing[*]}"
  if have node && ! node_runs_typescript; then
    info "  Node $(node -v) is too old — Acon runs its server from .ts sources,"
    info "  which needs 22.18 or newer."
  fi
  describe_install_plan
  confirm_install || exit 1

  have curl || install_packages curl ca-certificates
  have git || install_packages git
  node_runs_typescript || install_node

  # Re-check rather than assume: a failed install that still exits 0 would
  # otherwise surface much later as a confusing build error.
  if ! have curl; then fail "curl is still missing after the install."; exit 1; fi
  if ! node_runs_typescript; then
    fail "Node is still not able to run TypeScript after the install."
    fail "Install Node $NODE_MAJOR by hand and run this again."
    exit 1
  fi
  ok "Prerequisites ready — node $(node -v), npm $(npm -v)"
  warn_if_not_a_checkout
}

have() { command -v "$1" >/dev/null 2>&1; }

# The server runs straight from .ts sources, so rather than parse version numbers
# and track which releases strip types, just ask this Node to run some.
node_runs_typescript() {
  have node && have npm || return 1
  local probe="$STATE/probe.ts"
  printf 'const ok: string = "ok";\n' > "$probe"
  if node "$probe" >/dev/null 2>&1; then
    rm -f "$probe"
    return 0
  fi
  rm -f "$probe"
  return 1
}

describe_install_plan() {
  info ""
  case "$(package_manager)" in
    apt) info "  Plan: apt-get, plus NodeSource for Node $NODE_MAJOR (needs sudo)" ;;
    dnf | yum) info "  Plan: $(package_manager), plus NodeSource for Node $NODE_MAJOR (needs sudo)" ;;
    pacman | zypper) info "  Plan: $(package_manager) (needs sudo)" ;;
    *) info "  Plan: nvm, into your home directory (no root needed)" ;;
  esac
  if ! can_be_root; then
    info "  No root available, so Node will go in via nvm under \$HOME instead."
  fi
  info ""
}

confirm_install() {
  if [ "$ASSUME_YES" = "1" ]; then
    return 0
  fi
  if [ ! -t 0 ]; then
    fail "Nothing to read a confirmation from. Re-run with -y to install unattended."
    return 1
  fi
  printf 'Install these now? [Y/n] '
  local answer
  read -r answer || answer="n"
  case "$answer" in
    "" | y | Y | yes | YES) return 0 ;;
    *) fail "Stopped. Install the prerequisites yourself, then run this again."; return 1 ;;
  esac
}

package_manager() {
  for candidate in apt-get dnf yum pacman zypper; do
    if have "$candidate"; then
      printf '%s' "${candidate%-get}"
      return
    fi
  done
  printf 'none'
}

can_be_root() {
  [ "$(id -u)" = "0" ] && return 0
  have sudo
}

as_root() {
  if [ "$(id -u)" = "0" ]; then
    "$@"
  else
    sudo "$@"
  fi
}

install_packages() {
  step "Installing: $*"
  case "$(package_manager)" in
    apt)
      as_root apt-get update
      as_root apt-get install -y "$@"
      ;;
    dnf) as_root dnf install -y "$@" ;;
    yum) as_root yum install -y "$@" ;;
    pacman) as_root pacman -Sy --noconfirm "$@" ;;
    zypper) as_root zypper install -y "$@" ;;
    *)
      fail "No supported package manager found. Install these by hand: $*"
      exit 1
      ;;
  esac
}

install_node() {
  # NodeSource where we can: distro packages are routinely years behind, and
  # anything before 22.18 cannot run the server at all. nvm is the fallback for
  # boxes with no root.
  if can_be_root && [ "$(package_manager)" = "apt" ]; then
    step "Installing Node $NODE_MAJOR from NodeSource"
    curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" -o "$STATE/nodesource.sh"
    as_root bash "$STATE/nodesource.sh"
    rm -f "$STATE/nodesource.sh"
    install_packages nodejs
    return
  fi
  if can_be_root && { [ "$(package_manager)" = "dnf" ] || [ "$(package_manager)" = "yum" ]; }; then
    step "Installing Node $NODE_MAJOR from NodeSource"
    curl -fsSL "https://rpm.nodesource.com/setup_${NODE_MAJOR}.x" -o "$STATE/nodesource.sh"
    as_root bash "$STATE/nodesource.sh"
    rm -f "$STATE/nodesource.sh"
    install_packages nodejs
    return
  fi
  install_node_via_nvm
}

install_node_via_nvm() {
  step "Installing Node $NODE_MAJOR with nvm"
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  if [ ! -s "$NVM_DIR/nvm.sh" ]; then
    curl -fsSL "https://raw.githubusercontent.com/nvm-sh/nvm/$NVM_VERSION/install.sh" | bash
  fi
  # nvm's script reads variables this script would otherwise treat as fatal.
  set +u
  # shellcheck disable=SC1091
  . "$NVM_DIR/nvm.sh"
  nvm install "$NODE_MAJOR"
  nvm use "$NODE_MAJOR"
  set -u
  warn "Node is installed under \$HOME via nvm. New terminals pick it up"
  warn "automatically; this one already has it."
}

warn_if_not_a_checkout() {
  if ! git rev-parse --git-dir >/dev/null 2>&1; then
    warn "Not a git checkout, so updating from git is unavailable."
    warn "Clone the repo instead of copying it if you want the update option."
  fi
}

# Checked before the build rather than after it, so a port clash costs a second
# instead of a full compile.
require_free_port() {
  if port_busy; then
    fail "Something is already serving on port $PORT."
    fail "Stop it, or pick another port: PORT=4174 ./start.sh"
    exit 1
  fi
}

install_deps() {
  # npm rewrites node_modules/.package-lock.json on every install, so an older
  # copy of it means the tree predates the current lockfile.
  if [ ! -d node_modules ] || [ package-lock.json -nt node_modules/.package-lock.json ]; then
    step "Installing dependencies"
    npm ci
  fi
}

build() {
  step "Building"
  if ! npm run build; then
    fail "Build failed. Fix the errors above, then press 2 to rebuild."
    return 1
  fi
  ok "Built"
}

# ── the server ───────────────────────────────────────────────────────────────

start_server() {
  if port_busy; then
    fail "Port $PORT is taken by something else — not restarting."
    return 1
  fi

  step "Starting server"
  : > "$LOG"
  # Job control gives the server its own process group. Without it the server
  # shares this script's group, so the Ctrl-C that exits the log viewer reaches
  # the server too and quietly kills the app.
  set -m
  HOST="$HOST" PORT="$PORT" node server/serve.ts >> "$LOG" 2>&1 &
  SERVER_PID=$!
  set +m

  if ! wait_until_healthy; then
    fail "Server did not come up. Last lines:"
    tail -n 20 "$LOG" >&2
    SERVER_PID=""
    return 1
  fi

  ok "Listening on http://$(lan_address):$PORT"
  grep -m1 "Vision model:" "$LOG" || true
}

stop_server() {
  [ -n "$SERVER_PID" ] || return 0
  kill "$SERVER_PID" 2>/dev/null || true
  # serve.ts closes its listener on SIGTERM; give it a moment before insisting.
  local waited=0
  while kill -0 "$SERVER_PID" 2>/dev/null && [ "$waited" -lt 50 ]; do
    sleep 0.1
    waited=$((waited + 1))
  done
  kill -9 "$SERVER_PID" 2>/dev/null || true
  wait "$SERVER_PID" 2>/dev/null || true
  SERVER_PID=""
}

wait_until_healthy() {
  local waited=0
  while [ "$waited" -lt 100 ]; do
    if ! kill -0 "$SERVER_PID" 2>/dev/null; then
      return 1
    fi
    if curl -fsS -o /dev/null --max-time 2 "http://127.0.0.1:$PORT/api/agent" 2>/dev/null; then
      return 0
    fi
    sleep 0.1
    waited=$((waited + 1))
  done
  return 1
}

port_busy() {
  curl -fsS -o /dev/null --max-time 2 "http://127.0.0.1:$PORT/" 2>/dev/null
}

cleanup() {
  stop_server
}

# Ctrl-C at the menu means quit, and should shut the server down on the way out
# rather than leaving it orphaned on the port.
on_interrupt() {
  echo
  info "Shutting down."
  exit 0
}

# ── menu actions ─────────────────────────────────────────────────────────────

show_menu() {
  local state="running"
  kill -0 "${SERVER_PID:-0}" 2>/dev/null || state="${RED}stopped${RESET}"
  printf '\n%sAcon%s  ·  http://%s:%s  ·  %s\n' \
    "$BOLD" "$RESET" "$(lan_address)" "$PORT" "$state"
  printf '%s  1 update from git   2 rebuild   3 restart   4 logs   5 status   q quit%s\n' \
    "$DIM" "$RESET"
  printf 'Press a key: '
}

do_update() {
  if ! git rev-parse --git-dir >/dev/null 2>&1; then
    fail "This is not a git checkout — nothing to pull. Press 2 to rebuild instead."
    return
  fi

  step "Pulling"
  local before after
  before="$(git rev-parse HEAD)"
  if ! git pull --ff-only; then
    fail "Pull failed — the working tree has local changes or has diverged."
    fail "Sort it out with git, then press 1 again."
    return
  fi
  after="$(git rev-parse HEAD)"

  if [ "$before" = "$after" ]; then
    ok "Already up to date at $(git log --oneline -1)"
    return
  fi

  # This script may itself have just changed. Re-exec so the new version is what
  # runs the build, rather than the copy bash already has in memory.
  if ! git diff --quiet "$before" "$after" -- start.sh; then
    warn "start.sh changed — restarting the script."
    stop_server
    trap - EXIT
    exec "$ROOT/start.sh"
  fi

  if ! git diff --quiet "$before" "$after" -- package-lock.json; then
    step "Lockfile changed — installing"
    npm ci
  fi

  stop_server
  build && start_server
  ok "Updated to $(git log --oneline -1)"
}

do_rebuild() {
  stop_server
  build && start_server
}

do_restart() {
  stop_server
  start_server
}

follow_logs() {
  info "${DIM}Following the log — press Ctrl-C to come back to the menu.${RESET}"
  # Ctrl-C must stop tail without taking the script down with it, so swallow the
  # interrupt for as long as the viewer is up.
  trap 'true' INT
  tail -n 40 -f "$LOG" || true
  trap on_interrupt INT
  echo
}

show_status() {
  local body
  if ! body="$(curl -fsS --max-time 5 "http://127.0.0.1:$PORT/api/agent" 2>/dev/null)"; then
    fail "The server is not answering on port $PORT. Press 3 to restart."
    return
  fi

  if printf '%s' "$body" | grep -q '"local":{"up":true'; then
    ok "Vision model reachable"
  else
    warn "Vision model is NOT reachable — chat will fall back or fail."
    warn "Check llama.cpp is serving: curl localhost:8080/v1/models"
  fi
  printf '%s%s%s\n' "$DIM" "$body" "$RESET"
}

lan_address() {
  if [ "$HOST" != "0.0.0.0" ] && [ "$HOST" != "::" ]; then
    printf '%s' "$HOST"
    return
  fi
  # 0.0.0.0 is not an address anyone can type into a browser, so show the one
  # they would actually use from another machine on the LAN.
  local found=""
  if command -v hostname >/dev/null 2>&1; then
    found="$(hostname -I 2>/dev/null | awk '{print $1}')"
  fi
  if [ -z "$found" ] && command -v ipconfig >/dev/null 2>&1; then
    found="$(ipconfig getifaddr en0 2>/dev/null || true)"
  fi
  printf '%s' "${found:-localhost}"
}

main "$@"
