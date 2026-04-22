#!/usr/bin/env bash
# scripts/setup-nodes.sh — Curb chat app: integration test backend setup
#
# Usage:
#   ./scripts/setup-nodes.sh              # start 2 nodes via merod + meroctl (default)
#   ./scripts/setup-nodes.sh --merobox    # use merobox to manage nodes instead
#   ./scripts/setup-nodes.sh --stop       # kill running nodes, remove env file
#   ./scripts/setup-nodes.sh --clean      # --stop + delete node home directories
#   ./scripts/setup-nodes.sh --help
#
# Credentials (override via env):
#   E2E_ADMIN_USER=admin   E2E_ADMIN_PASS=calimero1234
#
# Auth is bootstrapped automatically against the node HTTP API — no browser needed.

set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

NODE_1_HOME="${CURB_NODE_1_HOME:-$HOME/.calimero/curb-node-1}"
NODE_2_HOME="${CURB_NODE_2_HOME:-$HOME/.calimero/curb-node-2}"
NODE_1_PORT="${NODE_1_PORT:-2428}"
NODE_2_PORT="${NODE_2_PORT:-2429}"
NODE_1_P2P_PORT="${NODE_1_P2P_PORT:-2528}"
NODE_2_P2P_PORT="${NODE_2_P2P_PORT:-2529}"
NODE_1_URL="http://localhost:${NODE_1_PORT}"
NODE_2_URL="http://localhost:${NODE_2_PORT}"

ADMIN_USER="${E2E_ADMIN_USER:-admin}"
ADMIN_PASS="${E2E_ADMIN_PASS:-calimero1234}"

WASM_PATH="$REPO_ROOT/logic/res/curb.wasm"
ENV_OUT="$REPO_ROOT/app/.env.integration"

USE_MEROBOX=false
STOP=false
CLEAN=false

for arg in "$@"; do
  case "$arg" in
    --merobox)  USE_MEROBOX=true ;;
    --stop)     STOP=true ;;
    --clean)    CLEAN=true; STOP=true ;;
    --help|-h)
      sed -n '3,12p' "${BASH_SOURCE[0]}"
      exit 0
      ;;
  esac
done

# ── Helpers ───────────────────────────────────────────────────────────────────

bold()   { printf '\033[1m%s\033[0m\n' "$*"; }
green()  { printf '\033[32m%s\033[0m\n' "$*"; }
yellow() { printf '\033[33m%s\033[0m\n' "$*"; }
red()    { printf '\033[31m%s\033[0m\n' "$*" >&2; }
step()   { printf '\n\033[1;36m▶ %s\033[0m\n' "$*"; }

check_cmd() {
  if ! command -v "$1" &>/dev/null; then
    red "ERROR: '$1' not found in PATH."
    case "$1" in
      merod|meroctl) yellow "Install: ./install-calimero.sh  (then restart terminal)" ;;
      merobox)       yellow "Install merobox: https://calimero-network.github.io/docs/merobox/install" ;;
      jq)            yellow "Install jq: brew install jq  (macOS)  or  apt install jq  (Linux)" ;;
    esac
    exit 1
  fi
}

node_is_running() { curl -sf "http://127.0.0.1:${1}/admin-api/health" &>/dev/null; }

wait_for_node() {
  local port=$1 label=$2
  printf "Waiting for %s (port %s)" "$label" "$port"
  for _ in $(seq 1 60); do
    if node_is_running "$port"; then printf ' ready\n'; return; fi
    printf '.'; sleep 1
  done
  printf '\n'; red "ERROR: $label did not become healthy after 60s"; exit 1
}

pid_file() { echo "/tmp/curb-merod-$1.pid"; }

# ── Auth bootstrap ─────────────────────────────────────────────────────────────
# Sets NODE_ACCESS_TOKEN / NODE_REFRESH_TOKEN globals.

NODE_ACCESS_TOKEN=""
NODE_REFRESH_TOKEN=""

bootstrap_auth() {
  local port=$1 label=$2
  step "Authenticating $label as '${ADMIN_USER}'"

  local res
  res=$(curl -sf -X POST "http://127.0.0.1:${port}/auth/token" \
    -H "Content-Type: application/json" \
    -d "{\"auth_method\":\"user_password\",\"public_key\":\"${ADMIN_USER}\",\"client_name\":\"setup-nodes.sh\",\"timestamp\":0,\"permissions\":[],\"provider_data\":{\"username\":\"${ADMIN_USER}\",\"password\":\"${ADMIN_PASS}\"}}" \
    2>/dev/null) || true

  NODE_ACCESS_TOKEN=$(echo "$res" | jq -r '.data.access_token  // empty' 2>/dev/null)
  NODE_REFRESH_TOKEN=$(echo "$res" | jq -r '.data.refresh_token // empty' 2>/dev/null)

  if [ -z "$NODE_ACCESS_TOKEN" ]; then
    red "ERROR: Auth failed for $label."
    yellow "Response: $res"
    yellow "Credentials: ${ADMIN_USER} / ${ADMIN_PASS}  (override: E2E_ADMIN_USER / E2E_ADMIN_PASS)"
    exit 1
  fi
  green "Authenticated as '${ADMIN_USER}' on $label"
}

register_node() {
  local name=$1 home=$2
  meroctl node remove "$name" 2>/dev/null || true
  meroctl node add "$name" "$home" \
    --access-token  "$NODE_ACCESS_TOKEN" \
    --refresh-token "$NODE_REFRESH_TOKEN" \
    2>/dev/null && green "$name registered with meroctl" \
    || yellow "WARNING: could not register $name with meroctl (non-fatal)"
}

# ── RPC helper ────────────────────────────────────────────────────────────────

rpc_call() {
  local url=$1 token=$2 ctx_id=$3 executor=$4 method=$5 args_json=$6
  curl -sf -X POST "${url}/admin-api/contexts/${ctx_id}/execute" \
    -H "Authorization: Bearer ${token}" \
    -H "Content-Type: application/json" \
    -d "$(jq -n \
          --arg m  "$method" \
          --arg a  "$args_json" \
          --arg e  "$executor" \
          '{method: $m, args_json: $a, executor_public_key: $e}')" \
    >/dev/null
}

# ── merod node management ─────────────────────────────────────────────────────

start_node_merod() {
  local name=$1 home=$2 port=$3 p2p_port=$4

  if node_is_running "$port"; then
    yellow "$name already running on port $port"
    bootstrap_auth "$port" "$name"
    register_node "$name" "$home"
    return
  fi

  if [ ! -d "$home" ]; then
    step "Initialising $name at $home"
    merod --node "$name" --home "$home" init \
      --server-host 127.0.0.1 \
      --server-port "$port" \
      --swarm-port  "$p2p_port" \
      --auth-mode embedded
  fi

  step "Starting $name"
  merod --node "$name" --home "$home" run > "/tmp/curb-merod-${name}.log" 2>&1 &
  echo $! > "$(pid_file "$name")"
  wait_for_node "$port" "$name"
  green "$name running  (pid $!  logs: /tmp/curb-merod-${name}.log)"

  bootstrap_auth "$port" "$name"
  register_node "$name" "$home"
}

stop_node_merod() {
  local name=$1
  local pf; pf=$(pid_file "$name")
  if [ -f "$pf" ]; then
    local pid; pid=$(cat "$pf")
    kill "$pid" 2>/dev/null && yellow "Stopped $name (pid $pid)" || true
    rm -f "$pf"
  fi
  pkill -f "merod --node ${name}" 2>/dev/null || true
}

# ── merobox node management ───────────────────────────────────────────────────

start_nodes_merobox() {
  step "Starting nodes via merobox (--no-docker)"
  cd "$REPO_ROOT/workflows"
  merobox stop --all  2>/dev/null || true
  merobox nuke --force 2>/dev/null || true
  # integration-setup.yml sets stop_all_nodes: false so nodes stay running
  merobox bootstrap run --no-docker integration-setup.yml
  cd "$REPO_ROOT"
}

# ── Stop / Clean ──────────────────────────────────────────────────────────────

if $STOP; then
  step "Stopping nodes"
  stop_node_merod "node-1"
  stop_node_merod "node-2"
  command -v merobox &>/dev/null && { merobox stop --all 2>/dev/null || true; merobox nuke --force 2>/dev/null || true; }
  command -v meroctl &>/dev/null && { meroctl node remove node-1 2>/dev/null || true; meroctl node remove node-2 2>/dev/null || true; }
  if $CLEAN; then
    step "Removing node home directories"
    rm -rf "$NODE_1_HOME" "$NODE_2_HOME"
    yellow "Removed $NODE_1_HOME  $NODE_2_HOME"
  fi
  rm -f "$ENV_OUT" && yellow "Removed $ENV_OUT"
  green "Done."
  exit 0
fi

# ── Prerequisites ─────────────────────────────────────────────────────────────

step "Checking prerequisites"
if $USE_MEROBOX; then
  check_cmd merobox
  check_cmd meroctl
else
  check_cmd merod
  check_cmd meroctl
fi
check_cmd jq
check_cmd curl
green "All tools found"

# ── Build WASM if needed ──────────────────────────────────────────────────────

step "Checking WASM build"
if [ ! -f "$WASM_PATH" ]; then
  yellow "curb.wasm not found — building (first run is slow)…"
  (cd "$REPO_ROOT/logic" && bash build.sh)
  green "curb.wasm built: $WASM_PATH"
else
  green "WASM already exists: $WASM_PATH"
fi

# ── Start nodes ───────────────────────────────────────────────────────────────

if $USE_MEROBOX; then
  start_nodes_merobox
  wait_for_node "$NODE_1_PORT" "node-1"
  wait_for_node "$NODE_2_PORT" "node-2"

  # Get tokens for both nodes (workflow left them running but we still need JWTs)
  bootstrap_auth "$NODE_1_PORT" "node-1"
  ACCESS_TOKEN_1="$NODE_ACCESS_TOKEN"; REFRESH_TOKEN_1="$NODE_REFRESH_TOKEN"
  register_node "node-1" "$HOME/.calimero/calimero-node-1"

  bootstrap_auth "$NODE_2_PORT" "node-2"
  ACCESS_TOKEN_2="$NODE_ACCESS_TOKEN"; REFRESH_TOKEN_2="$NODE_REFRESH_TOKEN"
  register_node "node-2" "$HOME/.calimero/calimero-node-2"

else
  # ── merod path ────────────────────────────────────────────────────────────

  start_node_merod "node-1" "$NODE_1_HOME" "$NODE_1_PORT" "$NODE_1_P2P_PORT"
  ACCESS_TOKEN_1="$NODE_ACCESS_TOKEN"; REFRESH_TOKEN_1="$NODE_REFRESH_TOKEN"

  start_node_merod "node-2" "$NODE_2_HOME" "$NODE_2_PORT" "$NODE_2_P2P_PORT"
  ACCESS_TOKEN_2="$NODE_ACCESS_TOKEN"; REFRESH_TOKEN_2="$NODE_REFRESH_TOKEN"

  # ── Install app on both nodes ──────────────────────────────────────────────

  step "Installing curb app on node-1"
  APP_ID=$(meroctl --node node-1 --output-format json app install --path "$WASM_PATH" 2>/dev/null \
    | jq -r 'if type=="object" then (.applicationId // .data.applicationId // empty) else empty end')
  if [ -z "$APP_ID" ]; then
    yellow "App may already be installed — fetching existing ID"
    APP_ID=$(meroctl --node node-1 --output-format json app ls \
      | jq -r '.apps[0].id // .data.apps[0].id // .data.applications[0].id // empty')
  fi
  [ -n "$APP_ID" ] || { red "ERROR: could not get APP_ID"; exit 1; }
  green "APP_ID: $APP_ID"

  step "Installing curb app on node-2"
  meroctl --node node-2 app install --path "$WASM_PATH" >/dev/null 2>&1 || yellow "App already on node-2"

  # ── Create namespace (group / workspace) on node-1 ────────────────────────

  step "Creating namespace on node-1"
  NS_ID=$(meroctl --node node-1 --output-format json namespace create \
    --application-id "$APP_ID" \
    | jq -r '.namespaceId // .data.namespaceId // empty')
  if [ -z "$NS_ID" ]; then
    yellow "Namespace may already exist — listing"
    NS_ID=$(meroctl --node node-1 --output-format json namespace ls \
      | jq -r '.namespaces[0].id // .data[0].namespace_id // empty')
  fi
  [ -n "$NS_ID" ] || { red "ERROR: could not get NS_ID"; exit 1; }
  green "NS_ID (GROUP_ID): $NS_ID"

  GROUP_ID="$NS_ID"

  # ── Create context (channel) on node-1 ────────────────────────────────────

  step "Creating integration context on node-1"
  INIT_ARGS='{"name":"Integration Test","context_type":"Channel","description":"Playwright e2e context","created_at":1751952997}'

  CTX_RES=$(curl -sf -X POST "${NODE_1_URL}/admin-api/contexts" \
    -H "Authorization: Bearer ${ACCESS_TOKEN_1}" \
    -H "Content-Type: application/json" \
    -d "$(jq -n \
          --arg appId "$APP_ID" \
          --argjson init "$INIT_ARGS" \
          '{applicationId: $appId, initArgs: ($init | tostring)}')" 2>/dev/null) || CTX_RES="{}"

  CONTEXT_ID=$(echo "$CTX_RES" | jq -r '.data.contextId // .data.id // empty' 2>/dev/null)
  MEMBER_KEY_1=$(echo "$CTX_RES" | jq -r '.data.memberPublicKey // .data.member_public_key // empty' 2>/dev/null)

  if [ -z "$CONTEXT_ID" ]; then
    yellow "Context may already exist — listing"
    CONTEXT_ID=$(meroctl --node node-1 --output-format json context ls \
      | jq -r '.contexts[0].id // .data.contexts[0].id // empty')
  fi
  [ -n "$CONTEXT_ID" ] || { red "ERROR: could not get CONTEXT_ID"; exit 1; }
  green "CONTEXT_ID: $CONTEXT_ID"

  if [ -z "$MEMBER_KEY_1" ]; then
    MEMBER_KEY_1=$(curl -sf "${NODE_1_URL}/admin-api/contexts/${CONTEXT_ID}/identities-owned" \
      -H "Authorization: Bearer ${ACCESS_TOKEN_1}" 2>/dev/null \
      | jq -r '(.data // .) | if type=="array" then .[0] else (.identities[0] // .items[0]) end' 2>/dev/null)
  fi
  [ -n "$MEMBER_KEY_1" ] || { red "ERROR: could not get MEMBER_KEY_1"; exit 1; }
  green "MEMBER_KEY_1 (node-1 identity): $MEMBER_KEY_1"

  # ── Create identity for node-2 ────────────────────────────────────────────

  step "Creating identity on node-2"
  IDENT_RES=$(curl -sf -X POST "${NODE_2_URL}/admin-api/identities" \
    -H "Authorization: Bearer ${ACCESS_TOKEN_2}" \
    -H "Content-Type: application/json" -d "{}" 2>/dev/null) || IDENT_RES="{}"

  MEMBER_KEY_2=$(echo "$IDENT_RES" | jq -r '.data.publicKey // .data.public_key // empty' 2>/dev/null)

  if [ -z "$MEMBER_KEY_2" ]; then
    yellow "Fetching existing identity on node-2"
    MEMBER_KEY_2=$(curl -sf "${NODE_2_URL}/admin-api/identities" \
      -H "Authorization: Bearer ${ACCESS_TOKEN_2}" 2>/dev/null \
      | jq -r '(.data // .) | if type=="array" then .[0].publicKey // .[0].public_key else (.identities[0].publicKey // empty) end' 2>/dev/null)
  fi
  [ -n "$MEMBER_KEY_2" ] || { red "ERROR: could not get MEMBER_KEY_2"; exit 1; }
  green "MEMBER_KEY_2 (node-2 identity): $MEMBER_KEY_2"

  # ── Invite node-2 into context ────────────────────────────────────────────

  step "Inviting node-2 into context"
  INVITE_RES=$(curl -sf -X POST "${NODE_1_URL}/admin-api/contexts/${CONTEXT_ID}/invite" \
    -H "Authorization: Bearer ${ACCESS_TOKEN_1}" \
    -H "Content-Type: application/json" \
    -d "$(jq -n \
          --arg granteeId "$MEMBER_KEY_2" \
          --arg granterId "$MEMBER_KEY_1" \
          '{granteeId: $granteeId, granterId: $granterId, capability: "member"}')" 2>/dev/null)

  INVITATION=$(echo "$INVITE_RES" | jq '.data.invitation // .data // empty' 2>/dev/null)
  [ "$INVITATION" != "null" ] && [ -n "$INVITATION" ] || { red "ERROR: invitation is empty"; echo "$INVITE_RES" >&2; exit 1; }
  green "Invitation generated"

  # ── Node-2 joins context ───────────────────────────────────────────────────

  step "Node-2 joining context"
  curl -sf -X POST "${NODE_2_URL}/admin-api/contexts/${CONTEXT_ID}/join" \
    -H "Authorization: Bearer ${ACCESS_TOKEN_2}" \
    -H "Content-Type: application/json" \
    -d "$(jq -n \
          --arg ctxId "$CONTEXT_ID" \
          --arg identId "$MEMBER_KEY_2" \
          --argjson invite "$INVITATION" \
          '{contextId: $ctxId, inviteeId: $identId, invitation: $invite}')" >/dev/null
  green "Node-2 joined context"

  # ── Wait for context to sync to node-2 ────────────────────────────────────

  step "Waiting for context sync to node-2"
  for i in $(seq 1 30); do
    CTXS_2=$(curl -sf "${NODE_2_URL}/admin-api/contexts" \
      -H "Authorization: Bearer ${ACCESS_TOKEN_2}" 2>/dev/null) || CTXS_2="{}"
    if echo "$CTXS_2" | jq -e \
        --arg id "$CONTEXT_ID" \
        '(.data // .) | if type=="array" then .[] | select(.id==$id or .contextId==$id) else empty end' \
        >/dev/null 2>&1; then
      green "Context synced to node-2 (attempt $i)"
      break
    fi
    if [ "$i" -eq 30 ]; then yellow "WARNING: context may not have synced to node-2 within 60s"; fi
    sleep 2
  done

  # ── Set profiles ──────────────────────────────────────────────────────────

  step "Setting profiles (Alice / Bob)"
  rpc_call "$NODE_1_URL" "$ACCESS_TOKEN_1" "$CONTEXT_ID" "$MEMBER_KEY_1" \
    "set_profile" '{"username":"Alice","avatar":null}'
  rpc_call "$NODE_2_URL" "$ACCESS_TOKEN_2" "$CONTEXT_ID" "$MEMBER_KEY_2" \
    "set_profile" '{"username":"Bob","avatar":null}'
  green "Profiles set"

  # ── Seed messages ─────────────────────────────────────────────────────────

  step "Seeding messages"
  rpc_call "$NODE_1_URL" "$ACCESS_TOKEN_1" "$CONTEXT_ID" "$MEMBER_KEY_1" \
    "send_message" \
    '{"message":"Hello from Alice — integration test seed","mentions":[],"mentions_usernames":[],"parent_message":null,"timestamp":1751953010,"sender_username":"Alice","files":null,"images":null}'
  rpc_call "$NODE_2_URL" "$ACCESS_TOKEN_2" "$CONTEXT_ID" "$MEMBER_KEY_2" \
    "send_message" \
    '{"message":"Hello from Bob — integration test seed","mentions":[],"mentions_usernames":[],"parent_message":null,"timestamp":1751953011,"sender_username":"Bob","files":null,"images":null}'
  green "Seed messages sent"

  MEMBER_KEY="$MEMBER_KEY_1"
fi

# ── Discover IDs (merobox path — merod path already has them) ─────────────────

if $USE_MEROBOX; then
  step "Resolving workspace and context IDs"

  GROUPS_RES=$(curl -sf "${NODE_1_URL}/admin-api/groups" \
    -H "Authorization: Bearer ${ACCESS_TOKEN_1}" 2>/dev/null) || GROUPS_RES="{}"
  GROUP_ID=$(echo "$GROUPS_RES" | jq -r '
    (.data // .) |
    if type=="array" then .[0].groupId
    elif type=="object" then (.groups[0].groupId // .items[0].groupId)
    else empty end' 2>/dev/null || echo "")

  if [ -z "$GROUP_ID" ]; then
    NS_RES=$(curl -sf "${NODE_1_URL}/admin-api/namespaces" \
      -H "Authorization: Bearer ${ACCESS_TOKEN_1}" 2>/dev/null) || NS_RES="{}"
    GROUP_ID=$(echo "$NS_RES" | jq -r '
      (.data // .) |
      if type=="array" then .[0].id // .[0].namespaceId // .[0].groupId
      elif type=="object" then (.namespaces[0].id // .items[0].id)
      else empty end' 2>/dev/null || echo "")
  fi
  [ -n "$GROUP_ID" ] && green "GROUP_ID: $GROUP_ID" || yellow "WARNING: could not discover GROUP_ID"

  CTX_RES2=$(curl -sf "${NODE_1_URL}/admin-api/contexts" \
    -H "Authorization: Bearer ${ACCESS_TOKEN_1}" 2>/dev/null) || CTX_RES2="{}"
  CONTEXT_ID=$(echo "$CTX_RES2" | jq -r '
    (.data // .) |
    if type=="array" then .[0].id // .[0].contextId
    elif type=="object" then (.contexts[0].id // .contexts[0].contextId // .items[0].id)
    else empty end' 2>/dev/null || echo "")
  [ -n "$CONTEXT_ID" ] && green "CONTEXT_ID: $CONTEXT_ID" || yellow "WARNING: could not discover CONTEXT_ID"

  IDENT_RES2=$(curl -sf "${NODE_1_URL}/admin-api/contexts/${CONTEXT_ID}/identities-owned" \
    -H "Authorization: Bearer ${ACCESS_TOKEN_1}" 2>/dev/null) || IDENT_RES2="{}"
  MEMBER_KEY=$(echo "$IDENT_RES2" | jq -r '
    (.data // .) |
    if type=="array" then .[0]
    elif type=="object" then (.identities[0] // .items[0])
    else empty end' 2>/dev/null || echo "")
  [ -n "$MEMBER_KEY" ] && green "MEMBER_KEY: $MEMBER_KEY" || yellow "WARNING: could not discover MEMBER_KEY"
fi

# ── Write app/.env.integration ────────────────────────────────────────────────

step "Writing $ENV_OUT"

cat > "$ENV_OUT" <<EOF
# Generated by scripts/setup-nodes.sh — DO NOT COMMIT (contains live tokens)
# Re-run: ./scripts/setup-nodes.sh

E2E_NODE_URL=${NODE_1_URL}
E2E_NODE_URL_2=${NODE_2_URL}

E2E_ACCESS_TOKEN=${ACCESS_TOKEN_1}
E2E_REFRESH_TOKEN=${REFRESH_TOKEN_1}

E2E_ACCESS_TOKEN_2=${ACCESS_TOKEN_2}
E2E_REFRESH_TOKEN_2=${REFRESH_TOKEN_2}

E2E_GROUP_ID=${GROUP_ID:-}
E2E_CONTEXT_ID=${CONTEXT_ID:-}
E2E_MEMBER_KEY=${MEMBER_KEY:-}
EOF

green "Written: $ENV_OUT"

# ── Summary ───────────────────────────────────────────────────────────────────

printf '\n'
bold "══════════════════════════════════════════"
bold " Integration nodes ready"
bold "══════════════════════════════════════════"
printf '\n'
printf "  Node 1:      %s\n" "$NODE_1_URL"
printf "  Node 2:      %s\n" "$NODE_2_URL"
printf "  Group ID:    %s\n" "${GROUP_ID:-<unknown>}"
printf "  Context ID:  %s\n" "${CONTEXT_ID:-<unknown>}"
printf "  Env file:    %s\n" "$ENV_OUT"
printf '\n'
printf "  Run integration tests:\n"
printf "    cd app && pnpm exec playwright test --project=integration\n"
printf '\n'
printf "  Stop nodes when done:\n"
printf "    ./scripts/setup-nodes.sh --stop\n"
printf '\n'
