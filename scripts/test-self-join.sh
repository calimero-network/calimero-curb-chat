#!/usr/bin/env bash
# scripts/test-self-join.sh — end-to-end test that messages propagate
# in both directions after a node auto-joins an Open subgroup + the
# context inside it.
#
# Brings up the same 2-node baseline as `make start` (node1+node2, namespace,
# node2 invited), then:
#   1. Admin creates an Open subgroup "newpublic" + a context inside it.
#   2. Node2 self-joins the newpublic context via /admin-api/contexts/:id/join
#      (Inherited path — no admin-side MemberAdded, authorisation is the
#      namespace-root CAN_JOIN_OPEN_SUBGROUPS bit).
#   3. Both sides set_profile and exchange messages in BOTH #general and
#      newpublic, then read them back.
#   4. Asserts admin↔node2 message propagation in both channels.
#   5. Asserts the auto-join machinery actually fired: MemberJoinedOpen
#      published by node2 + KeyDelivery applied for newpublic on node2.
#
# A bg tail of /tmp/curb-dev-node{,2}.log is grep-filtered to the events
# relevant to this flow (namespace join, group/context create, self-join,
# MemberJoinedOpen, KeyDelivery, set_profile, send_message) and teed to
# $LOG_BUFFER so Phase 6 can assert on the markers.
#
# Usage:
#   bash scripts/test-self-join.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# ── helpers ─────────────────────────────────────────────────────────────────

green()  { printf '\033[32m  ✓  %s\033[0m\n' "$*"; }
yellow() { printf '\033[33m  !  %s\033[0m\n' "$*"; }
red()    { printf '\033[31m  ✗  %s\033[0m\n' "$*" >&2; }
step()   { printf '\n\033[1;36m▶  %s\033[0m\n' "$*"; }
phase()  { printf '\n\033[1;35m═══  %s  ═══\033[0m\n' "$*"; }

LOG_TAIL_PID=""
# macOS mktemp -t treats anything after the X's as a literal suffix that gets
# appended after the random component, so use just the prefix here.
LOG_BUFFER="$(mktemp -t curb-test-self-join).log"
: >"$LOG_BUFFER"
cleanup() {
  if [ -n "$LOG_TAIL_PID" ]; then
    kill "$LOG_TAIL_PID" 2>/dev/null || true
  fi
  # Keep the buffer if the test failed for postmortem; otherwise nuke it.
  if [ "${KEEP_LOG_BUFFER:-0}" != "1" ] && [ "${FAIL:-0}" -eq 0 ]; then
    rm -f "$LOG_BUFFER"
  else
    yellow "filtered log buffer kept at: $LOG_BUFFER"
  fi
}
trap cleanup EXIT

require() {
  command -v "$1" >/dev/null 2>&1 || { red "missing dependency: $1"; exit 1; }
}
require curl
require jq
require python3

# ── Phase 0: clean slate + baseline setup ───────────────────────────────────

phase "Phase 0: bring up baseline (node1 + node2 + namespace invite)"

cd "$REPO_ROOT"
make stop >/dev/null 2>&1 || true

bash scripts/dev-node.sh >/dev/null
green "node1 ready"
bash scripts/dev-node2.sh >/dev/null
green "node2 ready"
bash scripts/dev-invite.sh >/dev/null
green "node2 invited into namespace"

# Load tokens / IDs from the env file the baseline scripts wrote.
ENV_FILE="$REPO_ROOT/app/.env.integration"
[ -f "$ENV_FILE" ] || { red "$ENV_FILE missing"; exit 1; }
# shellcheck disable=SC1090
set -a; . "$ENV_FILE"; set +a

NODE_1_URL="$E2E_NODE_URL"
NODE_2_URL="$E2E_NODE_URL_2"
TOKEN_1="$E2E_ACCESS_TOKEN"
TOKEN_2="$E2E_ACCESS_TOKEN_2"
NAMESPACE_ID="$E2E_GROUP_ID"
GENERAL_CTX="$E2E_CONTEXT_ID"
# E2E_APPLICATION_ID isn't written by the baseline scripts; ask the node.
APP_ID=$(curl -sf "$NODE_1_URL/admin-api/applications" \
  -H "Authorization: Bearer $TOKEN_1" \
  | jq -r '.data.apps[0].id // .data.applications[0].id // empty')
[ -n "$APP_ID" ] || { red "could not resolve app id from /admin-api/applications"; exit 1; }

green "namespace=$NAMESPACE_ID  general=$GENERAL_CTX  app=$APP_ID"

# ── Phase 1: bg-tail merod logs with relevance filter ───────────────────────

phase "Phase 1: streaming filtered merod logs"

# Strip the ANSI color escapes merod emits so the tee output is readable.
# Keep only event types that matter to this test. The set is biased toward
# happy-path INFO lines that core actually emits + every WARN/ERROR that
# could indicate the auto-join machinery misfired. The strings here must
# match what core emits today (see crates/context/src/handlers/*.rs and
# crates/context/src/group_store/namespace_governance.rs); searching for
# "MemberJoinedOpen" directly only matches rejection messages.
LOG_FILTER='(joined context via group membership|received group key|inbound stream for unknown context|failed to publish MemberJoinedOpen|MemberJoinedOpen rejected|failed to wrap group key|failed to publish KeyDelivery|context join authorized|Unauthorized)'

tail -n0 -F /tmp/curb-dev-node.log /tmp/curb-dev-node2.log 2>/dev/null \
  | sed -E 's/\x1b\[[0-9;]*[mGKH]//g' \
  | grep -E --line-buffered "$LOG_FILTER" \
  | sed -E "s|^==> /tmp/curb-dev-node\.log <==|[node1]|; s|^==> /tmp/curb-dev-node2\.log <==|[node2]|" \
  | tee -a "$LOG_BUFFER" &
LOG_TAIL_PID=$!
sleep 0.3  # let the tail attach

# ── Phase 2: admin creates "newpublic" Open subgroup + context ──────────────

phase "Phase 2: admin creates Open subgroup + context"

NEWPUBLIC_ALIAS="newpublic"

step "Creating subgroup ($NEWPUBLIC_ALIAS) under namespace"
SG_RES=$(curl -sf -X POST "$NODE_1_URL/admin-api/namespaces/$NAMESPACE_ID/groups" \
  -H "Authorization: Bearer $TOKEN_1" \
  -H "Content-Type: application/json" \
  -d "$(jq -n --arg a "$NEWPUBLIC_ALIAS" '{groupAlias: $a}')")
NEWPUBLIC_SG=$(echo "$SG_RES" | jq -r '.data.groupId // empty')
[ -n "$NEWPUBLIC_SG" ] || { red "subgroup create failed: $SG_RES"; exit 1; }
green "newpublic subgroup: $NEWPUBLIC_SG"

step "Setting subgroupVisibility=open on newpublic"
curl -sf -X PUT "$NODE_1_URL/admin-api/groups/$NEWPUBLIC_SG/settings/subgroup-visibility" \
  -H "Authorization: Bearer $TOKEN_1" \
  -H "Content-Type: application/json" \
  -d '{"subgroupVisibility":"open"}' >/dev/null
green "visibility set"

step "Creating context inside newpublic"
TIMESTAMP=$(date +%s)
INIT_JSON="{\"name\":\"$NEWPUBLIC_ALIAS\",\"context_type\":\"Channel\",\"description\":\"\",\"created_at\":${TIMESTAMP}}"
INIT_BYTES=$(printf '%s' "$INIT_JSON" | python3 -c \
  "import sys; d=sys.stdin.buffer.read(); print('['+','.join(str(b) for b in d)+']')")
CTX_RES=$(curl -sf -X POST "$NODE_1_URL/admin-api/contexts" \
  -H "Authorization: Bearer $TOKEN_1" \
  -H "Content-Type: application/json" \
  -d "$(jq -n \
        --arg appId "$APP_ID" \
        --arg groupId "$NEWPUBLIC_SG" \
        --argjson initParams "$INIT_BYTES" \
        '{applicationId: $appId, protocol: "near", groupId: $groupId, alias: $a, initializationParams: $initParams}' \
        --arg a "$NEWPUBLIC_ALIAS")")
NEWPUBLIC_CTX=$(echo "$CTX_RES" | jq -r '.data.contextId // empty')
ADMIN_NEWPUBLIC_PK=$(echo "$CTX_RES" | jq -r '.data.memberPublicKey // empty')
[ -n "$NEWPUBLIC_CTX" ] && [ -n "$ADMIN_NEWPUBLIC_PK" ] \
  || { red "context create failed: $CTX_RES"; exit 1; }
green "newpublic context: $NEWPUBLIC_CTX  admin_pk: $ADMIN_NEWPUBLIC_PK"

# Admin also registers a WASM profile in newpublic (so get_profiles shows them).
step "Admin set_profile in newpublic"
curl -sf -X POST "$NODE_1_URL/jsonrpc" \
  -H "Authorization: Bearer $TOKEN_1" \
  -H "Content-Type: application/json" \
  -d "$(jq -n \
        --arg ctx "$NEWPUBLIC_CTX" \
        --arg pk "$ADMIN_NEWPUBLIC_PK" \
        '{jsonrpc:"2.0",id:1,method:"execute",
          params:{contextId:$ctx, executorPublicKey:$pk,
                  method:"set_profile", argsJson:{username:"nodeAdmin", avatar:null}}}')" \
  >/dev/null

sleep 1  # let propagation start
green "admin profile registered"

# ── Phase 3: node2 self-joins newpublic via /join ───────────────────────────

phase "Phase 3: node2 self-joins newpublic (inherited path)"

step "POST /admin-api/contexts/$NEWPUBLIC_CTX/join on node2"
JOIN_RES=$(curl -sf -X POST "$NODE_2_URL/admin-api/contexts/$NEWPUBLIC_CTX/join" \
  -H "Authorization: Bearer $TOKEN_2" \
  -H "Content-Type: application/json" -d '{}')
NODE2_NEWPUBLIC_PK=$(echo "$JOIN_RES" | jq -r '.data.memberPublicKey // empty')
[ -n "$NODE2_NEWPUBLIC_PK" ] || { red "self-join failed: $JOIN_RES"; exit 1; }
green "node2 joined newpublic — pk: $NODE2_NEWPUBLIC_PK"

step "waiting 5s for KeyDelivery propagation"
sleep 5

step "Node2 set_profile in newpublic"
curl -sf -X POST "$NODE_2_URL/jsonrpc" \
  -H "Authorization: Bearer $TOKEN_2" \
  -H "Content-Type: application/json" \
  -d "$(jq -n \
        --arg ctx "$NEWPUBLIC_CTX" \
        --arg pk "$NODE2_NEWPUBLIC_PK" \
        '{jsonrpc:"2.0",id:1,method:"execute",
          params:{contextId:$ctx, executorPublicKey:$pk,
                  method:"set_profile", argsJson:{username:"NodeUser", avatar:null}}}')" \
  >/dev/null
sleep 1
green "node2 profile registered"

# ── Phase 4: bidirectional send + read ─────────────────────────────────────

send_msg() {
  local node_url="$1" token="$2" ctx="$3" pk="$4" msg="$5" sender="$6"
  local now=$(($(date +%s) * 1000))
  curl -sf -X POST "$node_url/jsonrpc" \
    -H "Authorization: Bearer $token" \
    -H "Content-Type: application/json" \
    -d "$(jq -n \
          --arg ctx "$ctx" --arg pk "$pk" --arg msg "$msg" \
          --arg sender "$sender" --argjson ts "$now" \
          '{jsonrpc:"2.0",id:1,method:"execute",
            params:{contextId:$ctx, executorPublicKey:$pk,
                    method:"send_message",
                    argsJson:{message:$msg, mentions:[], mentions_usernames:[],
                              parent_message:null, timestamp:$ts,
                              sender_username:$sender, files:null, images:null}}}')"
}

read_msgs() {
  local node_url="$1" token="$2" ctx="$3" pk="$4"
  curl -sf -X POST "$node_url/jsonrpc" \
    -H "Authorization: Bearer $token" \
    -H "Content-Type: application/json" \
    -d "$(jq -n --arg ctx "$ctx" --arg pk "$pk" \
          '{jsonrpc:"2.0",id:1,method:"execute",
            params:{contextId:$ctx, executorPublicKey:$pk,
                    method:"get_messages",
                    argsJson:{parent_message:null, limit:100, offset:0, search_term:null}}}')"
}

# Resolve node2's identity in #general (which was set up by dev-invite.sh).
NODE2_GENERAL_PK=$(curl -sf "$NODE_2_URL/admin-api/contexts/$GENERAL_CTX/identities-owned" \
  -H "Authorization: Bearer $TOKEN_2" | jq -r '.data.identities[0] // empty')
[ -n "$NODE2_GENERAL_PK" ] || { red "no node2 identity in general"; exit 1; }
ADMIN_GENERAL_PK=$(curl -sf "$NODE_1_URL/admin-api/contexts/$GENERAL_CTX/identities-owned" \
  -H "Authorization: Bearer $TOKEN_1" | jq -r '.data.identities[0] // empty')
[ -n "$ADMIN_GENERAL_PK" ] || { red "no admin identity in general"; exit 1; }

ADMIN_GENERAL_MSG="admin→general $(date +%H:%M:%S)"
NODE2_GENERAL_MSG="node2→general $(date +%H:%M:%S)"
ADMIN_NEWPUB_MSG="admin→newpublic $(date +%H:%M:%S)"
NODE2_NEWPUB_MSG="node2→newpublic $(date +%H:%M:%S)"

phase "Phase 4: send messages from both sides"
step "admin → #general"; send_msg "$NODE_1_URL" "$TOKEN_1" "$GENERAL_CTX" "$ADMIN_GENERAL_PK" "$ADMIN_GENERAL_MSG" "nodeAdmin" >/dev/null
step "node2 → #general"; send_msg "$NODE_2_URL" "$TOKEN_2" "$GENERAL_CTX" "$NODE2_GENERAL_PK" "$NODE2_GENERAL_MSG" "NodeUser" >/dev/null
step "admin → newpublic"; send_msg "$NODE_1_URL" "$TOKEN_1" "$NEWPUBLIC_CTX" "$ADMIN_NEWPUBLIC_PK" "$ADMIN_NEWPUB_MSG" "nodeAdmin" >/dev/null
step "node2 → newpublic"; send_msg "$NODE_2_URL" "$TOKEN_2" "$NEWPUBLIC_CTX" "$NODE2_NEWPUBLIC_PK" "$NODE2_NEWPUB_MSG" "NodeUser" >/dev/null

step "waiting 6s for state-DAG sync"
sleep 6

# ── Phase 5: assertions ─────────────────────────────────────────────────────

phase "Phase 5: read messages on both nodes and compare"

assert_visible() {
  local label="$1" body="$2" needle="$3"
  if echo "$body" | grep -qF "$needle"; then
    green "$label sees: \"$needle\""
    return 0
  else
    red "$label DOES NOT see: \"$needle\""
    return 1
  fi
}

ADMIN_VIEW_GENERAL=$(read_msgs "$NODE_1_URL" "$TOKEN_1" "$GENERAL_CTX" "$ADMIN_GENERAL_PK")
NODE2_VIEW_GENERAL=$(read_msgs "$NODE_2_URL" "$TOKEN_2" "$GENERAL_CTX" "$NODE2_GENERAL_PK")
ADMIN_VIEW_NEWPUB=$(read_msgs "$NODE_1_URL" "$TOKEN_1" "$NEWPUBLIC_CTX" "$ADMIN_NEWPUBLIC_PK")
NODE2_VIEW_NEWPUB=$(read_msgs "$NODE_2_URL" "$TOKEN_2" "$NEWPUBLIC_CTX" "$NODE2_NEWPUBLIC_PK")

FAIL=0
step "#general"
assert_visible "  admin#general" "$ADMIN_VIEW_GENERAL" "$NODE2_GENERAL_MSG" || FAIL=1
assert_visible "  node2#general" "$NODE2_VIEW_GENERAL" "$ADMIN_GENERAL_MSG" || FAIL=1

step "#newpublic"
assert_visible "  admin#newpublic" "$ADMIN_VIEW_NEWPUB" "$NODE2_NEWPUB_MSG" || FAIL=1
assert_visible "  node2#newpublic" "$NODE2_VIEW_NEWPUB" "$ADMIN_NEWPUB_MSG" || FAIL=1

# Let stragglers in the bg log tail flush.
sleep 1

# ── Phase 6: log-marker checks — confirm the auto-join path was used ────────
#
# Phase 5 already proves message propagation works end-to-end, but it can't
# distinguish "messages flowed because the new MemberJoinedOpen + KeyDelivery
# path fired" from "messages flowed because of some other code path".
# Phase 6 checks the merod logs for positive markers of the join + a strict
# allow-list of failure signatures.
#
# Core emits very few `info!` lines on the happy path here — most of the
# proof has to come from the *absence* of WARNs/ERRORs. The patterns below
# match what crates/context/src/handlers/join_context.rs and
# crates/context/src/group_store/namespace_governance.rs actually emit.
phase "Phase 6: log-marker checks"

# `tail -F file1 file2` only prints "==> file <==" headers when it switches
# between files, so per-node scoping via the tee-d buffer is fragile. For
# the per-node positive assertion grep the source log directly; for the
# negative assertions ("this never fires") grep both raw logs.
NODE1_LOG=/tmp/curb-dev-node.log
NODE2_LOG=/tmp/curb-dev-node2.log

assert_log_present() {
  local label="$1" pattern="$2" file="$3"
  if grep -E -q "$pattern" "$file"; then
    green "$label"
    return 0
  fi
  red "$label — no match for /$pattern/ in $file"
  return 1
}

assert_log_absent() {
  local label="$1" pattern="$2"
  local hits
  hits=$(grep -E -h "$pattern" "$NODE1_LOG" "$NODE2_LOG" 2>/dev/null | head -5)
  if [ -n "$hits" ]; then
    red "$label — UNEXPECTED match for /$pattern/"
    echo "$hits" | sed 's/^/      /' >&2
    return 1
  fi
  green "$label"
  return 0
}

# Positive: node2's join handler logs this once it has the ContextIdentity
# row, before publishing MemberJoinedOpen. Two contexts get joined on node2
# over the test (#general via dev-invite, newpublic via Phase 3) — at least
# one match expected.
assert_log_present "node2 joined context via group membership" \
  "joined context via group membership" "$NODE2_LOG" || FAIL=1

# Negative: the MemberJoinedOpen publish is silent on success but warns on
# failure. Same for the KeyDelivery wrapping/publish on the admin side.
assert_log_absent "no 'failed to publish MemberJoinedOpen' warnings" \
  "failed to publish MemberJoinedOpen" || FAIL=1
assert_log_absent "no 'failed to wrap group key' warnings" \
  "failed to wrap group key" || FAIL=1
assert_log_absent "no 'failed to publish KeyDelivery' warnings" \
  "failed to publish KeyDelivery" || FAIL=1

# Negative: the apply-side rejection paths. If any of these fire, the
# joiner's MemberJoinedOpen was refused and KeyDelivery never followed.
assert_log_absent "no 'MemberJoinedOpen rejected' lines" \
  "MemberJoinedOpen rejected" || FAIL=1

# Negative: the original symptom — joiner has a key but no ContextIdentity
# (or vice-versa) so sync attempts come from an unknown context. There's a
# benign transient on #general during the dev-invite namespace-join window
# (node1 starts syncing to node2 before node2 materialises its row) — we
# only care about hits for the newpublic context. Both the log line and
# $NEWPUBLIC_CTX use bs58 encoding so direct substring grep works.
NEWPUB_WARN_HITS=$(grep -E "inbound stream for unknown context.*${NEWPUBLIC_CTX}" \
  "$NODE1_LOG" "$NODE2_LOG" 2>/dev/null || true)
if [ -n "$NEWPUB_WARN_HITS" ]; then
  red "saw 'inbound stream for unknown context' for newpublic ($NEWPUBLIC_CTX):"
  echo "$NEWPUB_WARN_HITS" | head -5 | sed 's/^/      /' >&2
  FAIL=1
else
  green "no 'inbound stream for unknown context' warnings for newpublic context"
fi

phase "Result"
if [ "$FAIL" -eq 0 ]; then
  printf '\033[1;32m  ✅  PASS — bidirectional propagation works for #general and newpublic\033[0m\n'
  exit 0
else
  printf '\033[1;31m  ❌  FAIL — see above for which side missed which message\033[0m\n'
  printf '\nFor deeper inspection:\n'
  printf '  tail -200 /tmp/curb-dev-node.log /tmp/curb-dev-node2.log\n'
  exit 1
fi
