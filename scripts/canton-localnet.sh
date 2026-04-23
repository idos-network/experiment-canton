#!/usr/bin/env bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK_ROOT="${CANTON_LOCALNET_ROOT:-$REPO_ROOT/.local/canton-localnet}"
DOWNLOADS_DIR="$WORK_ROOT/downloads"
RELEASES_DIR="$WORK_ROOT/releases"
LATEST_RELEASE_API="https://api.github.com/repos/digital-asset/decentralized-canton-sync/releases/latest"
ACTION="${1:-doctor}"
TARGET_VERSION="${CANTON_LOCALNET_VERSION:-}"
DRY_RUN="${CANTON_LOCALNET_DRY_RUN:-0}"

RELEASE_VERSION=""
RELEASE_TAG=""
RELEASE_ASSET_URL=""
TARBALL_PATH=""
EXTRACT_DIR=""
LOCALNET_DIR=""
COMPOSE_ENV_FILE=""
COMMON_ENV_FILE=""
COMPOSE_FILE=""
RESOURCE_FILE=""
COMPOSE_BIN=()

podman_ready() {
  command -v podman >/dev/null 2>&1 && podman info >/dev/null 2>&1
}

podman_machine_state() {
  if ! command -v podman >/dev/null 2>&1 || ! command -v jq >/dev/null 2>&1; then
    return 1
  fi

  podman machine inspect podman-machine-default 2>/dev/null | jq -r '.[0].State // empty'
}

run() {
  if [[ "$DRY_RUN" == "1" ]]; then
    printf '+'
    for arg in "$@"; do
      printf ' %q' "$arg"
    done
    printf '\n'
    return 0
  fi

  "$@"
}

require_tool() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf 'Missing required tool: %s\n' "$1" >&2
    exit 1
  fi
}

detect_compose() {
  if command -v podman-compose >/dev/null 2>&1 && podman_ready; then
    COMPOSE_BIN=(podman-compose)
    return
  fi

  if command -v podman >/dev/null 2>&1 && podman_ready && podman compose version >/dev/null 2>&1; then
    COMPOSE_BIN=(podman compose)
    return
  fi

  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    COMPOSE_BIN=(docker compose)
    return
  fi

  if command -v podman-compose >/dev/null 2>&1 || command -v podman >/dev/null 2>&1; then
    local machine_state
    machine_state="$(podman_machine_state || true)"

    if [[ -n "$machine_state" ]]; then
      printf 'Podman is installed but not usable. Machine state: %s.\n' "$machine_state" >&2
    else
      printf 'Podman is installed but not usable.\n' >&2
    fi

    printf 'Fix the Podman connection before starting LocalNet, or install docker compose.\n' >&2
    exit 1
  fi

  printf 'No supported compose engine found. Install podman-compose, podman compose, or docker compose.\n' >&2
  exit 1
}

doctor_compose_engine() {
  if command -v podman-compose >/dev/null 2>&1; then
    printf 'podman-compose\n'
    return
  fi

  if command -v podman >/dev/null 2>&1; then
    printf 'podman compose\n'
    return
  fi

  if command -v docker >/dev/null 2>&1; then
    printf 'docker compose\n'
    return
  fi

  printf 'unavailable\n'
}

release_metadata_json() {
  if [[ -n "$TARGET_VERSION" ]]; then
    curl -fsSL "https://api.github.com/repos/digital-asset/decentralized-canton-sync/releases/tags/v${TARGET_VERSION#v}"
    return
  fi

  curl -fsSL "$LATEST_RELEASE_API"
}

resolve_release() {
  require_tool curl
  require_tool jq

  local release_json asset_name

  release_json="$(release_metadata_json)"
  RELEASE_TAG="$(printf '%s' "$release_json" | jq -r '.tag_name')"
  RELEASE_VERSION="${RELEASE_TAG#v}"
  asset_name="${RELEASE_VERSION}_splice-node.tar.gz"
  RELEASE_ASSET_URL="$(printf '%s' "$release_json" | jq -r --arg asset_name "$asset_name" '.assets[] | select(.name == $asset_name) | .browser_download_url')"

  if [[ -z "$RELEASE_ASSET_URL" || "$RELEASE_ASSET_URL" == "null" ]]; then
    printf 'Could not resolve splice-node asset for release %s.\n' "$RELEASE_TAG" >&2
    exit 1
  fi

  TARBALL_PATH="$DOWNLOADS_DIR/$asset_name"
  EXTRACT_DIR="$RELEASES_DIR/$RELEASE_VERSION"
  LOCALNET_DIR="$EXTRACT_DIR/splice-node/docker-compose/localnet"
  COMPOSE_ENV_FILE="$LOCALNET_DIR/compose.env"
  COMMON_ENV_FILE="$LOCALNET_DIR/env/common.env"
  COMPOSE_FILE="$LOCALNET_DIR/compose.yaml"
  RESOURCE_FILE="$LOCALNET_DIR/resource-constraints.yaml"
}

ensure_bundle() {
  require_tool tar
  mkdir -p "$DOWNLOADS_DIR" "$RELEASES_DIR"

  if [[ -f "$COMPOSE_FILE" ]]; then
    return
  fi

  if [[ ! -f "$TARBALL_PATH" ]]; then
    run curl -fL "$RELEASE_ASSET_URL" -o "$TARBALL_PATH"
  fi

  mkdir -p "$EXTRACT_DIR"
  run tar -xzf "$TARBALL_PATH" -C "$EXTRACT_DIR"
}

compose_base_args() {
  printf '%s\0' \
    --env-file "$COMPOSE_ENV_FILE" \
    --env-file "$COMMON_ENV_FILE" \
    -f "$COMPOSE_FILE" \
    -f "$RESOURCE_FILE" \
    --profile sv \
    --profile app-provider \
    --profile app-user
}

compose_with_base() {
  local args=()

  while IFS= read -r -d '' arg; do
    args+=("$arg")
  done < <(compose_base_args)

  run "${COMPOSE_BIN[@]}" "${args[@]}" "$@"
}

doctor() {
  resolve_release

  printf 'Compose engine: %s\n' "$(doctor_compose_engine)"
  printf 'Release tag: %s\n' "$RELEASE_TAG"
  printf 'Bundle URL: %s\n' "$RELEASE_ASSET_URL"
  printf 'Work root: %s\n' "$WORK_ROOT"
  printf 'Bundle path: %s\n' "$TARBALL_PATH"
  printf 'Extract dir: %s\n' "$EXTRACT_DIR"
  printf 'LocalNet dir: %s\n' "$LOCALNET_DIR"

  if [[ -f "$COMPOSE_FILE" ]]; then
    printf 'Bundle status: extracted\n'
  elif [[ -f "$TARBALL_PATH" ]]; then
    printf 'Bundle status: downloaded\n'
  else
    printf 'Bundle status: missing\n'
  fi

  if command -v podman >/dev/null 2>&1; then
    if podman info >/dev/null 2>&1; then
      printf 'Podman status: ready\n'
    else
      local machine_state
      machine_state="$(podman_machine_state || true)"

      if [[ -n "$machine_state" ]]; then
        printf 'Podman status: %s (connection unhealthy)\n' "$machine_state"
      else
        printf 'Podman status: unavailable\n'
      fi
    fi
  fi
}

up() {
  detect_compose
  resolve_release
  ensure_bundle
  compose_with_base up -d
}

down() {
  detect_compose
  resolve_release

  if [[ ! -f "$COMPOSE_FILE" ]]; then
    printf 'LocalNet bundle is not extracted yet. Nothing to stop.\n'
    return
  fi

  compose_with_base down -v
}

ps_cmd() {
  detect_compose
  resolve_release
  ensure_bundle
  compose_with_base ps
}

logs_cmd() {
  detect_compose
  resolve_release
  ensure_bundle
  shift || true
  compose_with_base logs -f "$@"
}

env_cmd() {
  resolve_release

  cat <<EOF
export LOCALNET_DIR="$LOCALNET_DIR"
export IMAGE_TAG="$RELEASE_VERSION"
EOF
}

download_cmd() {
  resolve_release
  ensure_bundle
  printf 'Bundle ready at %s\n' "$LOCALNET_DIR"
}

case "$ACTION" in
  doctor)
    doctor
    ;;
  download)
    download_cmd
    ;;
  env)
    env_cmd
    ;;
  up)
    up
    ;;
  down)
    down
    ;;
  ps)
    ps_cmd
    ;;
  logs)
    logs_cmd "$@"
    ;;
  *)
    cat <<'EOF' >&2
Usage: scripts/canton-localnet.sh [doctor|download|env|up|down|ps|logs]

Environment:
  CANTON_LOCALNET_VERSION   Override the Splice release version. Example: 0.5.18
  CANTON_LOCALNET_ROOT      Override the local bundle cache directory
  CANTON_LOCALNET_DRY_RUN   Set to 1 to print commands without executing them
EOF
    exit 1
    ;;
esac
