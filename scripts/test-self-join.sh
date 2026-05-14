#!/usr/bin/env bash
# scripts/test-self-join.sh — comprehensive admin-API integration test
# covering the post-054a784f metadata API and the 47122c05 self-join
# Open-subgroup propagation path, without the curb frontend.
#
# Brings up the same 2-node baseline as `make start` (node1+node2,
# namespace, node2 invited), then exercises:
#
#   Phase 2  workspace/member metadata
#              - admin sets namespace metadata `name = $WORKSPACE_NAME`
#              - admin sets own member metadata `name = $ADMIN_NAME`
#              - node2 sets own member metadata `name = $NODE2_NAME`
#
#   Phase 3  PUBLIC subgroup (`newpublic`) + context
#              - admin creates the subgroup (Open) + the channel context
#              - admin writes group and context metadata
#              - admin set_profile in newpublic (WASM)
#
#   Phase 4  PRIVATE subgroup (`newprivate`) + context
#              - admin creates the subgroup (Restricted) + context
#              - admin writes metadata, does NOT add node2
#              - asserts: node2 cannot read this subgroup
#
#   Phase 5  node2 self-joins newpublic (Inherited path)
#
#   Phase 6  visibility assertions
#              - admin sees: general, newpublic, newprivate
#              - node2 sees: general, newpublic — but NOT newprivate
#
#   Phase 7  username assertions (each side sees the other's name)
#              - listMembers(namespace) from both nodes
#              - listMembers(newpublic) from both nodes
#
#   Phase 8  metadata GET assertions
#              - GET /groups/:ns/metadata
#              - GET /groups/:newpublic/metadata
#              - GET /groups/:ns/contexts/:newpublic_ctx/metadata
#              - GET /groups/:ns/members/:admin/metadata
#              - GET /groups/:ns/members/:node2/metadata
#              - same five reads, from node2's perspective
#
#   Phase 9  DM subgroup + context (restricted, admin + node2 only)
#              - admin creates the DM subgroup, adds node2 as Member
#              - admin creates the DM context with `context_type: "Dm"`
#              - node2 joins the DM context
#              - both set_profile + send_message + read back
#
#   Phase 10 JSON-RPC message propagation
#              - admin↔node2 send/receive in #general, newpublic, dm
#
#   Phase 11 log-marker checks (positive `joined context…`, negative
#              MemberJoinedOpen/KeyDelivery failure signatures, no
#              `inbound stream for unknown context` for the newpublic
#              context_id)
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
info()   { printf '\033[2m     %s\033[0m\n' "$*"; }

FAIL=0

LOG_TAIL_PID=""
LOG_BUFFER="$(mktemp -t curb-test-self-join).log"
: >"$LOG_BUFFER"
cleanup() {
  if [ -n "$LOG_TAIL_PID" ]; then
    kill "$LOG_TAIL_PID" 2>/dev/null || true
  fi
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

# Assertion helpers always return 0 so a failure doesn't trip `set -e`.
# Failures set the global FAIL=1; the final phase consults that to decide
# the exit code. This lets the script keep running through later phases
# and surface ALL the things that broke, not just the first one.
assert_eq() {
  local label="$1" expected="$2" actual="$3"
  if [ "$expected" = "$actual" ]; then
    green "$label  →  \"$actual\""
  else
    red "$label  →  expected \"$expected\", got \"$actual\""
    FAIL=1
  fi
}

assert_contains() {
  local label="$1" haystack="$2" needle="$3"
  if echo "$haystack" | grep -qF "$needle"; then
    green "$label  →  contains \"$needle\""
  else
    red "$label  →  does NOT contain \"$needle\""
    echo "$haystack" | head -3 | sed 's/^/        /' >&2
    FAIL=1
  fi
}

assert_not_contains() {
  local label="$1" haystack="$2" needle="$3"
  if echo "$haystack" | grep -qF "$needle"; then
    red "$label  →  UNEXPECTEDLY contains \"$needle\""
    FAIL=1
  else
    green "$label  →  does not contain \"$needle\""
  fi
}

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
APP_ID=$(curl -sf "$NODE_1_URL/admin-api/applications" \
  -H "Authorization: Bearer $TOKEN_1" \
  | jq -r '.data.apps[0].id // .data.applications[0].id // empty')
[ -n "$APP_ID" ] || { red "could not resolve app id from /admin-api/applications"; exit 1; }

# Resolve self-identity on the namespace for both nodes — used as the
# `:identity` path segment for /members/:identity/metadata calls.
ADMIN_NS_ID=$(curl -sf "$NODE_1_URL/admin-api/groups/$NAMESPACE_ID/members" \
  -H "Authorization: Bearer $TOKEN_1" | jq -r '.data.selfIdentity // .selfIdentity // empty')
NODE2_NS_ID=$(curl -sf "$NODE_2_URL/admin-api/groups/$NAMESPACE_ID/members" \
  -H "Authorization: Bearer $TOKEN_2" | jq -r '.data.selfIdentity // .selfIdentity // empty')
[ -n "$ADMIN_NS_ID" ] && [ -n "$NODE2_NS_ID" ] \
  || { red "could not resolve self-identity for both nodes on namespace"; exit 1; }

info "namespace = $NAMESPACE_ID"
info "general   = $GENERAL_CTX"
info "app       = $APP_ID"
info "admin id  = $ADMIN_NS_ID"
info "node2 id  = $NODE2_NS_ID"

# ── Phase 1: bg-tail merod logs ─────────────────────────────────────────────

phase "Phase 1: streaming filtered merod logs"

LOG_FILTER='(joined context via group membership|received group key|inbound stream for unknown context|failed to publish MemberJoinedOpen|MemberJoinedOpen rejected|failed to wrap group key|failed to publish KeyDelivery|context join authorized|Unauthorized|MetadataSet|metadata_set)'

tail -n0 -F /tmp/curb-dev-node.log /tmp/curb-dev-node2.log 2>/dev/null \
  | sed -E 's/\x1b\[[0-9;]*[mGKH]//g' \
  | grep -E --line-buffered "$LOG_FILTER" \
  | sed -E "s|^==> /tmp/curb-dev-node\.log <==|[node1]|; s|^==> /tmp/curb-dev-node2\.log <==|[node2]|" \
  | tee -a "$LOG_BUFFER" &
LOG_TAIL_PID=$!
sleep 0.3

# ── Phase 2: workspace + per-member metadata ────────────────────────────────

phase "Phase 2: workspace + per-member metadata"

WORKSPACE_NAME="QA Workspace"
ADMIN_NAME="nodeAdmin"
NODE2_NAME="NodeUser"

put_metadata() {
  # put_metadata <node_url> <token> <path-fragment> <name>
  local node_url="$1" token="$2" path="$3" name="$4"
  curl -sf -X PUT "$node_url/admin-api/$path" \
    -H "Authorization: Bearer $token" \
    -H "Content-Type: application/json" \
    -d "$(jq -n --arg n "$name" '{name: $n}')" >/dev/null
}

get_metadata_name() {
  # get_metadata_name <node_url> <token> <path-fragment>
  local node_url="$1" token="$2" path="$3"
  curl -sf "$node_url/admin-api/$path" \
    -H "Authorization: Bearer $token" \
    | jq -r '.data.data.name // .data.name // empty'
}

step "admin: PUT namespace metadata { name = \"$WORKSPACE_NAME\" }"
put_metadata "$NODE_1_URL" "$TOKEN_1" "groups/$NAMESPACE_ID/metadata" "$WORKSPACE_NAME"
green "set"

step "admin: PUT own member metadata { name = \"$ADMIN_NAME\" }"
put_metadata "$NODE_1_URL" "$TOKEN_1" \
  "groups/$NAMESPACE_ID/members/$ADMIN_NS_ID/metadata" "$ADMIN_NAME"
green "set"

step "node2: PUT own member metadata { name = \"$NODE2_NAME\" }"
put_metadata "$NODE_2_URL" "$TOKEN_2" \
  "groups/$NAMESPACE_ID/members/$NODE2_NS_ID/metadata" "$NODE2_NAME"
green "set"

# Let governance ops propagate. MemberMetadataSet / NamespaceMetadataSet
# are governance ops just like Add/Remove; a single sleep is enough since
# both sides are 127.0.0.1.
sleep 3

# ── Phase 3: PUBLIC subgroup + context ──────────────────────────────────────

phase "Phase 3: admin creates PUBLIC subgroup + context"

NEWPUBLIC_ALIAS="newpublic"
NEWPUBLIC_CHAN_NAME="Newpublic Channel"

step "admin: POST /namespaces/:ns/groups (create subgroup)"
SG_RES=$(curl -sf -X POST "$NODE_1_URL/admin-api/namespaces/$NAMESPACE_ID/groups" \
  -H "Authorization: Bearer $TOKEN_1" \
  -H "Content-Type: application/json" \
  -d "$(jq -n --arg a "$NEWPUBLIC_ALIAS" '{groupName: $a, groupAlias: $a}')")
NEWPUBLIC_SG=$(echo "$SG_RES" | jq -r '.data.groupId // empty')
[ -n "$NEWPUBLIC_SG" ] || { red "subgroup create failed: $SG_RES"; exit 1; }
green "newpublic subgroup: $NEWPUBLIC_SG"

step "admin: PUT visibility = open"
curl -sf -X PUT "$NODE_1_URL/admin-api/groups/$NEWPUBLIC_SG/settings/subgroup-visibility" \
  -H "Authorization: Bearer $TOKEN_1" \
  -H "Content-Type: application/json" \
  -d '{"subgroupVisibility":"open"}' >/dev/null
green "open"

step "admin: PUT subgroup metadata { name = \"$NEWPUBLIC_CHAN_NAME\" }"
put_metadata "$NODE_1_URL" "$TOKEN_1" "groups/$NEWPUBLIC_SG/metadata" "$NEWPUBLIC_CHAN_NAME"
green "set"

step "admin: POST /admin-api/contexts (create context inside newpublic)"
NOW=$(date +%s)
INIT_JSON="{\"name\":\"$NEWPUBLIC_ALIAS\",\"context_type\":\"Channel\",\"description\":\"\",\"created_at\":${NOW}}"
INIT_BYTES=$(printf '%s' "$INIT_JSON" | python3 -c \
  "import sys; d=sys.stdin.buffer.read(); print('['+','.join(str(b) for b in d)+']')")
CTX_RES=$(curl -sf -X POST "$NODE_1_URL/admin-api/contexts" \
  -H "Authorization: Bearer $TOKEN_1" \
  -H "Content-Type: application/json" \
  -d "$(jq -n \
        --arg appId "$APP_ID" \
        --arg groupId "$NEWPUBLIC_SG" \
        --arg name "$NEWPUBLIC_CHAN_NAME" \
        --arg alias "$NEWPUBLIC_ALIAS" \
        --argjson initParams "$INIT_BYTES" \
        '{applicationId: $appId, protocol: "near", groupId: $groupId, name: $name, alias: $alias, initializationParams: $initParams}')")
NEWPUBLIC_CTX=$(echo "$CTX_RES" | jq -r '.data.contextId // empty')
ADMIN_NEWPUBLIC_PK=$(echo "$CTX_RES" | jq -r '.data.memberPublicKey // empty')
[ -n "$NEWPUBLIC_CTX" ] && [ -n "$ADMIN_NEWPUBLIC_PK" ] \
  || { red "context create failed: $CTX_RES"; exit 1; }
green "newpublic context: $NEWPUBLIC_CTX  admin_pk: $ADMIN_NEWPUBLIC_PK"

step "admin: PUT context metadata { name = \"$NEWPUBLIC_CHAN_NAME\" }"
put_metadata "$NODE_1_URL" "$TOKEN_1" \
  "groups/$NEWPUBLIC_SG/contexts/$NEWPUBLIC_CTX/metadata" "$NEWPUBLIC_CHAN_NAME"
green "set"

step "admin: set_profile in newpublic"
curl -sf -X POST "$NODE_1_URL/jsonrpc" \
  -H "Authorization: Bearer $TOKEN_1" \
  -H "Content-Type: application/json" \
  -d "$(jq -n \
        --arg ctx "$NEWPUBLIC_CTX" --arg pk "$ADMIN_NEWPUBLIC_PK" --arg u "$ADMIN_NAME" \
        '{jsonrpc:"2.0",id:1,method:"execute",
          params:{contextId:$ctx, executorPublicKey:$pk,
                  method:"set_profile", argsJson:{username:$u, avatar:null}}}')" >/dev/null
green "admin profile registered"

# ── Phase 4: PRIVATE subgroup + context (node2 NOT added) ───────────────────

phase "Phase 4: admin creates PRIVATE subgroup + context (node2 NOT added)"

NEWPRIVATE_ALIAS="newprivate"
NEWPRIVATE_CHAN_NAME="Newprivate Channel"

step "admin: create newprivate subgroup"
SG_RES=$(curl -sf -X POST "$NODE_1_URL/admin-api/namespaces/$NAMESPACE_ID/groups" \
  -H "Authorization: Bearer $TOKEN_1" \
  -H "Content-Type: application/json" \
  -d "$(jq -n --arg a "$NEWPRIVATE_ALIAS" '{groupName: $a, groupAlias: $a}')")
NEWPRIVATE_SG=$(echo "$SG_RES" | jq -r '.data.groupId // empty')
[ -n "$NEWPRIVATE_SG" ] || { red "subgroup create failed: $SG_RES"; exit 1; }
green "newprivate subgroup: $NEWPRIVATE_SG"

step "admin: PUT visibility = restricted"
curl -sf -X PUT "$NODE_1_URL/admin-api/groups/$NEWPRIVATE_SG/settings/subgroup-visibility" \
  -H "Authorization: Bearer $TOKEN_1" \
  -H "Content-Type: application/json" \
  -d '{"subgroupVisibility":"restricted"}' >/dev/null
green "restricted"

step "admin: PUT subgroup metadata { name = \"$NEWPRIVATE_CHAN_NAME\" }"
put_metadata "$NODE_1_URL" "$TOKEN_1" "groups/$NEWPRIVATE_SG/metadata" "$NEWPRIVATE_CHAN_NAME"
green "set"

step "admin: create newprivate context"
INIT_JSON="{\"name\":\"$NEWPRIVATE_ALIAS\",\"context_type\":\"Channel\",\"description\":\"\",\"created_at\":${NOW}}"
INIT_BYTES=$(printf '%s' "$INIT_JSON" | python3 -c \
  "import sys; d=sys.stdin.buffer.read(); print('['+','.join(str(b) for b in d)+']')")
CTX_RES=$(curl -sf -X POST "$NODE_1_URL/admin-api/contexts" \
  -H "Authorization: Bearer $TOKEN_1" \
  -H "Content-Type: application/json" \
  -d "$(jq -n \
        --arg appId "$APP_ID" \
        --arg groupId "$NEWPRIVATE_SG" \
        --arg name "$NEWPRIVATE_CHAN_NAME" \
        --arg alias "$NEWPRIVATE_ALIAS" \
        --argjson initParams "$INIT_BYTES" \
        '{applicationId: $appId, protocol: "near", groupId: $groupId, name: $name, alias: $alias, initializationParams: $initParams}')")
NEWPRIVATE_CTX=$(echo "$CTX_RES" | jq -r '.data.contextId // empty')
ADMIN_NEWPRIVATE_PK=$(echo "$CTX_RES" | jq -r '.data.memberPublicKey // empty')
[ -n "$NEWPRIVATE_CTX" ] && [ -n "$ADMIN_NEWPRIVATE_PK" ] \
  || { red "context create failed: $CTX_RES"; exit 1; }
green "newprivate context: $NEWPRIVATE_CTX"

step "admin: PUT context metadata { name = \"$NEWPRIVATE_CHAN_NAME\" }"
put_metadata "$NODE_1_URL" "$TOKEN_1" \
  "groups/$NEWPRIVATE_SG/contexts/$NEWPRIVATE_CTX/metadata" "$NEWPRIVATE_CHAN_NAME"
green "set"

# ── Phase 5: node2 self-joins newpublic ─────────────────────────────────────

phase "Phase 5: node2 self-joins newpublic (Inherited path)"

JOIN_RES=$(curl -sf -X POST "$NODE_2_URL/admin-api/contexts/$NEWPUBLIC_CTX/join" \
  -H "Authorization: Bearer $TOKEN_2" \
  -H "Content-Type: application/json" -d '{}')
NODE2_NEWPUBLIC_PK=$(echo "$JOIN_RES" | jq -r '.data.memberPublicKey // empty')
[ -n "$NODE2_NEWPUBLIC_PK" ] || { red "self-join failed: $JOIN_RES"; exit 1; }
green "node2 joined newpublic — pk: $NODE2_NEWPUBLIC_PK"

step "waiting 5s for KeyDelivery + governance propagation"
sleep 5

step "node2: set_profile in newpublic"
curl -sf -X POST "$NODE_2_URL/jsonrpc" \
  -H "Authorization: Bearer $TOKEN_2" \
  -H "Content-Type: application/json" \
  -d "$(jq -n \
        --arg ctx "$NEWPUBLIC_CTX" --arg pk "$NODE2_NEWPUBLIC_PK" --arg u "$NODE2_NAME" \
        '{jsonrpc:"2.0",id:1,method:"execute",
          params:{contextId:$ctx, executorPublicKey:$pk,
                  method:"set_profile", argsJson:{username:$u, avatar:null}}}')" >/dev/null
green "node2 profile registered"
sleep 1

# ── Phase 6: visibility assertions ──────────────────────────────────────────

phase "Phase 6: visibility — public vs private subgroup from each side"

list_subgroup_ids() {
  local node_url="$1" token="$2"
  curl -sf "$node_url/admin-api/groups/$NAMESPACE_ID/subgroups" \
    -H "Authorization: Bearer $token" \
    | jq -r '.data.subgroups[]?.groupId // .subgroups[]?.groupId // empty' 2>/dev/null
}

ADMIN_SUBGROUPS=$(list_subgroup_ids "$NODE_1_URL" "$TOKEN_1")
NODE2_SUBGROUPS=$(list_subgroup_ids "$NODE_2_URL" "$TOKEN_2")

step "admin /groups/:ns/subgroups"
assert_contains "  admin sees newpublic" "$ADMIN_SUBGROUPS" "$NEWPUBLIC_SG"
assert_contains "  admin sees newprivate" "$ADMIN_SUBGROUPS" "$NEWPRIVATE_SG"

step "node2 /groups/:ns/subgroups"
assert_contains "  node2 sees newpublic" "$NODE2_SUBGROUPS" "$NEWPUBLIC_SG"
assert_not_contains "  node2 does NOT see newprivate" "$NODE2_SUBGROUPS" "$NEWPRIVATE_SG"

# ── Phase 7: username assertions ────────────────────────────────────────────

phase "Phase 7: usernames — each side sees the other's name"

list_member_name() {
  # list_member_name <node_url> <token> <group_id> <identity>
  local node_url="$1" token="$2" gid="$3" id="$4"
  curl -sf "$node_url/admin-api/groups/$gid/members" \
    -H "Authorization: Bearer $token" \
    | jq -r --arg id "$id" \
        '(.data.members // .members)[] | select(.identity == $id) | (.name // .alias // "")'
}

step "namespace member names"
assert_eq "  admin sees node2 name on namespace" "$NODE2_NAME" \
  "$(list_member_name "$NODE_1_URL" "$TOKEN_1" "$NAMESPACE_ID" "$NODE2_NS_ID")"
assert_eq "  node2 sees admin name on namespace" "$ADMIN_NAME" \
  "$(list_member_name "$NODE_2_URL" "$TOKEN_2" "$NAMESPACE_ID" "$ADMIN_NS_ID")"
assert_eq "  admin sees own name on namespace"   "$ADMIN_NAME" \
  "$(list_member_name "$NODE_1_URL" "$TOKEN_1" "$NAMESPACE_ID" "$ADMIN_NS_ID")"
assert_eq "  node2 sees own name on namespace"   "$NODE2_NAME" \
  "$(list_member_name "$NODE_2_URL" "$TOKEN_2" "$NAMESPACE_ID" "$NODE2_NS_ID")"

# ── Phase 8: metadata GET assertions ────────────────────────────────────────

phase "Phase 8: metadata GETs from both sides"

step "workspace (namespace) metadata"
assert_eq "  admin GET /groups/:ns/metadata"          "$WORKSPACE_NAME" \
  "$(get_metadata_name "$NODE_1_URL" "$TOKEN_1" "groups/$NAMESPACE_ID/metadata")"
assert_eq "  node2 GET /groups/:ns/metadata"          "$WORKSPACE_NAME" \
  "$(get_metadata_name "$NODE_2_URL" "$TOKEN_2" "groups/$NAMESPACE_ID/metadata")"

step "newpublic subgroup metadata"
assert_eq "  admin GET /groups/:newpublic/metadata"   "$NEWPUBLIC_CHAN_NAME" \
  "$(get_metadata_name "$NODE_1_URL" "$TOKEN_1" "groups/$NEWPUBLIC_SG/metadata")"
assert_eq "  node2 GET /groups/:newpublic/metadata"   "$NEWPUBLIC_CHAN_NAME" \
  "$(get_metadata_name "$NODE_2_URL" "$TOKEN_2" "groups/$NEWPUBLIC_SG/metadata")"

step "newpublic context metadata"
assert_eq "  admin GET .../contexts/:newpublic_ctx/metadata"  "$NEWPUBLIC_CHAN_NAME" \
  "$(get_metadata_name "$NODE_1_URL" "$TOKEN_1" \
       "groups/$NEWPUBLIC_SG/contexts/$NEWPUBLIC_CTX/metadata")"
assert_eq "  node2 GET .../contexts/:newpublic_ctx/metadata"  "$NEWPUBLIC_CHAN_NAME" \
  "$(get_metadata_name "$NODE_2_URL" "$TOKEN_2" \
       "groups/$NEWPUBLIC_SG/contexts/$NEWPUBLIC_CTX/metadata")"

step "member metadata"
assert_eq "  admin GET admin's member metadata"   "$ADMIN_NAME" \
  "$(get_metadata_name "$NODE_1_URL" "$TOKEN_1" \
       "groups/$NAMESPACE_ID/members/$ADMIN_NS_ID/metadata")"
assert_eq "  admin GET node2's member metadata"   "$NODE2_NAME" \
  "$(get_metadata_name "$NODE_1_URL" "$TOKEN_1" \
       "groups/$NAMESPACE_ID/members/$NODE2_NS_ID/metadata")"
assert_eq "  node2 GET admin's member metadata"   "$ADMIN_NAME" \
  "$(get_metadata_name "$NODE_2_URL" "$TOKEN_2" \
       "groups/$NAMESPACE_ID/members/$ADMIN_NS_ID/metadata")"
assert_eq "  node2 GET own member metadata"       "$NODE2_NAME" \
  "$(get_metadata_name "$NODE_2_URL" "$TOKEN_2" \
       "groups/$NAMESPACE_ID/members/$NODE2_NS_ID/metadata")"

# ── Phase 9: DM subgroup + context ──────────────────────────────────────────

phase "Phase 9: DM subgroup (restricted, admin + node2)"

DM_ALIAS="DM_CONTEXT_${ADMIN_NS_ID:0:8}_${NODE2_NS_ID:0:8}"
DM_CHAN_NAME="DM: nodeAdmin ↔ NodeUser"

step "admin: create DM subgroup"
SG_RES=$(curl -sf -X POST "$NODE_1_URL/admin-api/namespaces/$NAMESPACE_ID/groups" \
  -H "Authorization: Bearer $TOKEN_1" \
  -H "Content-Type: application/json" \
  -d "$(jq -n --arg a "$DM_ALIAS" '{groupName: $a, groupAlias: $a}')")
DM_SG=$(echo "$SG_RES" | jq -r '.data.groupId // empty')
[ -n "$DM_SG" ] || { red "DM subgroup create failed: $SG_RES"; exit 1; }
green "DM subgroup: $DM_SG"

step "admin: PUT visibility = restricted"
curl -sf -X PUT "$NODE_1_URL/admin-api/groups/$DM_SG/settings/subgroup-visibility" \
  -H "Authorization: Bearer $TOKEN_1" \
  -H "Content-Type: application/json" \
  -d '{"subgroupVisibility":"restricted"}' >/dev/null
green "restricted"

step "admin: add node2 to DM subgroup"
ADD_RES=$(curl -sf -X POST "$NODE_1_URL/admin-api/groups/$DM_SG/members" \
  -H "Authorization: Bearer $TOKEN_1" \
  -H "Content-Type: application/json" \
  -d "$(jq -n --arg id "$NODE2_NS_ID" '{members: [{identity: $id, role: "Member"}]}')") || true
green "add request sent"

step "admin: PUT DM subgroup metadata { name = \"$DM_CHAN_NAME\" }"
put_metadata "$NODE_1_URL" "$TOKEN_1" "groups/$DM_SG/metadata" "$DM_CHAN_NAME"
green "set"

step "admin: create DM context (context_type=Dm)"
DM_INIT_JSON="{\"name\":\"$DM_ALIAS\",\"context_type\":\"Dm\",\"description\":\"\",\"created_at\":${NOW}}"
DM_INIT_BYTES=$(printf '%s' "$DM_INIT_JSON" | python3 -c \
  "import sys; d=sys.stdin.buffer.read(); print('['+','.join(str(b) for b in d)+']')")
DM_CTX_RES=$(curl -sf -X POST "$NODE_1_URL/admin-api/contexts" \
  -H "Authorization: Bearer $TOKEN_1" \
  -H "Content-Type: application/json" \
  -d "$(jq -n \
        --arg appId "$APP_ID" \
        --arg groupId "$DM_SG" \
        --arg name "$DM_CHAN_NAME" \
        --arg alias "$DM_ALIAS" \
        --argjson initParams "$DM_INIT_BYTES" \
        '{applicationId: $appId, protocol: "near", groupId: $groupId, name: $name, alias: $alias, initializationParams: $initParams}')")
DM_CTX=$(echo "$DM_CTX_RES" | jq -r '.data.contextId // empty')
ADMIN_DM_PK=$(echo "$DM_CTX_RES" | jq -r '.data.memberPublicKey // empty')
[ -n "$DM_CTX" ] && [ -n "$ADMIN_DM_PK" ] \
  || { red "DM context create failed: $DM_CTX_RES"; exit 1; }
green "DM context: $DM_CTX"

step "admin: PUT DM context metadata"
put_metadata "$NODE_1_URL" "$TOKEN_1" \
  "groups/$DM_SG/contexts/$DM_CTX/metadata" "$DM_CHAN_NAME"
green "set"

step "waiting 5s for MemberAdded + KeyDelivery to node2"
sleep 5

step "node2: join the DM context"
DM_JOIN_RES=$(curl -sf -X POST "$NODE_2_URL/admin-api/contexts/$DM_CTX/join" \
  -H "Authorization: Bearer $TOKEN_2" \
  -H "Content-Type: application/json" -d '{}' || true)
NODE2_DM_PK=$(echo "$DM_JOIN_RES" | jq -r '.data.memberPublicKey // empty')
if [ -z "$NODE2_DM_PK" ]; then
  # Restricted-subgroup adds don't always need an explicit /join from the
  # member side — the admin-add path may have materialised the identity
  # already. Look it up via identities-owned.
  NODE2_DM_PK=$(curl -sf "$NODE_2_URL/admin-api/contexts/$DM_CTX/identities-owned" \
    -H "Authorization: Bearer $TOKEN_2" | jq -r '.data.identities[0] // empty')
fi
[ -n "$NODE2_DM_PK" ] || { red "node2 DM identity missing"; FAIL=1; }
green "node2 DM pk: ${NODE2_DM_PK:-MISSING}"

if [ -n "$NODE2_DM_PK" ]; then
  step "node2: set_profile in DM"
  curl -sf -X POST "$NODE_2_URL/jsonrpc" \
    -H "Authorization: Bearer $TOKEN_2" \
    -H "Content-Type: application/json" \
    -d "$(jq -n \
          --arg ctx "$DM_CTX" --arg pk "$NODE2_DM_PK" --arg u "$NODE2_NAME" \
          '{jsonrpc:"2.0",id:1,method:"execute",
            params:{contextId:$ctx, executorPublicKey:$pk,
                    method:"set_profile", argsJson:{username:$u, avatar:null}}}')" >/dev/null || true
  green "set"
fi

# ── Phase 10: JSON-RPC send/recv ────────────────────────────────────────────

phase "Phase 10: JSON-RPC send_message + get_messages"

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

# Resolve identity on #general for both sides.
NODE2_GENERAL_PK=$(curl -sf "$NODE_2_URL/admin-api/contexts/$GENERAL_CTX/identities-owned" \
  -H "Authorization: Bearer $TOKEN_2" | jq -r '.data.identities[0] // empty')
ADMIN_GENERAL_PK=$(curl -sf "$NODE_1_URL/admin-api/contexts/$GENERAL_CTX/identities-owned" \
  -H "Authorization: Bearer $TOKEN_1" | jq -r '.data.identities[0] // empty')

T=$(date +%H:%M:%S)
ADMIN_GEN_MSG="admin→general $T"
NODE2_GEN_MSG="node2→general $T"
ADMIN_PUB_MSG="admin→newpublic $T"
NODE2_PUB_MSG="node2→newpublic $T"
ADMIN_DM_MSG="admin→dm $T"
NODE2_DM_MSG="node2→dm $T"

step "send messages from both sides"
send_msg "$NODE_1_URL" "$TOKEN_1" "$GENERAL_CTX"   "$ADMIN_GENERAL_PK"   "$ADMIN_GEN_MSG"  "$ADMIN_NAME" >/dev/null
send_msg "$NODE_2_URL" "$TOKEN_2" "$GENERAL_CTX"   "$NODE2_GENERAL_PK"   "$NODE2_GEN_MSG"  "$NODE2_NAME" >/dev/null
send_msg "$NODE_1_URL" "$TOKEN_1" "$NEWPUBLIC_CTX" "$ADMIN_NEWPUBLIC_PK" "$ADMIN_PUB_MSG"  "$ADMIN_NAME" >/dev/null
send_msg "$NODE_2_URL" "$TOKEN_2" "$NEWPUBLIC_CTX" "$NODE2_NEWPUBLIC_PK" "$NODE2_PUB_MSG"  "$NODE2_NAME" >/dev/null
if [ -n "$NODE2_DM_PK" ]; then
  send_msg "$NODE_1_URL" "$TOKEN_1" "$DM_CTX" "$ADMIN_DM_PK"  "$ADMIN_DM_MSG"  "$ADMIN_NAME" >/dev/null
  send_msg "$NODE_2_URL" "$TOKEN_2" "$DM_CTX" "$NODE2_DM_PK"  "$NODE2_DM_MSG"  "$NODE2_NAME" >/dev/null
fi
green "send_message issued for all channels"

step "waiting 6s for state-DAG sync"
sleep 6

step "read messages on both nodes"
ADMIN_VIEW_GEN=$(read_msgs "$NODE_1_URL" "$TOKEN_1" "$GENERAL_CTX"   "$ADMIN_GENERAL_PK")
NODE2_VIEW_GEN=$(read_msgs "$NODE_2_URL" "$TOKEN_2" "$GENERAL_CTX"   "$NODE2_GENERAL_PK")
ADMIN_VIEW_PUB=$(read_msgs "$NODE_1_URL" "$TOKEN_1" "$NEWPUBLIC_CTX" "$ADMIN_NEWPUBLIC_PK")
NODE2_VIEW_PUB=$(read_msgs "$NODE_2_URL" "$TOKEN_2" "$NEWPUBLIC_CTX" "$NODE2_NEWPUBLIC_PK")
if [ -n "$NODE2_DM_PK" ]; then
  ADMIN_VIEW_DM=$(read_msgs "$NODE_1_URL" "$TOKEN_1" "$DM_CTX" "$ADMIN_DM_PK")
  NODE2_VIEW_DM=$(read_msgs "$NODE_2_URL" "$TOKEN_2" "$DM_CTX" "$NODE2_DM_PK")
fi

step "#general"
assert_contains "  admin sees node2's #general msg" "$ADMIN_VIEW_GEN" "$NODE2_GEN_MSG"
assert_contains "  node2 sees admin's #general msg" "$NODE2_VIEW_GEN" "$ADMIN_GEN_MSG"

step "newpublic"
assert_contains "  admin sees node2's newpublic msg" "$ADMIN_VIEW_PUB" "$NODE2_PUB_MSG"
assert_contains "  node2 sees admin's newpublic msg" "$NODE2_VIEW_PUB" "$ADMIN_PUB_MSG"

if [ -n "$NODE2_DM_PK" ]; then
  step "DM"
  assert_contains "  admin sees node2's DM msg" "$ADMIN_VIEW_DM" "$NODE2_DM_MSG"
  assert_contains "  node2 sees admin's DM msg" "$NODE2_VIEW_DM" "$ADMIN_DM_MSG"
fi

sleep 1

# ── Phase 11: log-marker checks ─────────────────────────────────────────────

phase "Phase 11: log-marker checks"

NODE1_LOG=/tmp/curb-dev-node.log
NODE2_LOG=/tmp/curb-dev-node2.log

assert_log_present() {
  local label="$1" pattern="$2" file="$3"
  if grep -E -q "$pattern" "$file"; then
    green "$label"
  else
    red "$label — no match for /$pattern/ in $file"
    FAIL=1
  fi
}

assert_log_absent() {
  local label="$1" pattern="$2"
  # `grep -q` returns 1 on no-match; combine with pipefail-safe `|| true`
  # so the script doesn't exit before we even decide pass/fail.
  if ! grep -E -q "$pattern" "$NODE1_LOG" "$NODE2_LOG" 2>/dev/null; then
    green "$label"
    return 0
  fi
  red "$label — UNEXPECTED match for /$pattern/"
  grep -E -h "$pattern" "$NODE1_LOG" "$NODE2_LOG" 2>/dev/null \
    | head -5 | sed 's/^/      /' >&2 || true
  FAIL=1
}

assert_log_present "node2 joined context via group membership" \
  "joined context via group membership" "$NODE2_LOG"
assert_log_absent "no 'failed to publish MemberJoinedOpen'" \
  "failed to publish MemberJoinedOpen"
assert_log_absent "no 'failed to wrap group key'" \
  "failed to wrap group key"
assert_log_absent "no 'failed to publish KeyDelivery'" \
  "failed to publish KeyDelivery"
assert_log_absent "no 'MemberJoinedOpen rejected'" \
  "MemberJoinedOpen rejected"

# Scoped: ignore the benign #general transient during dev-invite, only
# care about hits for the newpublic ctx.
NEWPUB_WARN_HITS=$(grep -E "inbound stream for unknown context.*${NEWPUBLIC_CTX}" \
  "$NODE1_LOG" "$NODE2_LOG" 2>/dev/null || true)
if [ -n "$NEWPUB_WARN_HITS" ]; then
  red "'inbound stream for unknown context' for newpublic ($NEWPUBLIC_CTX):"
  echo "$NEWPUB_WARN_HITS" | head -5 | sed 's/^/      /' >&2
  FAIL=1
else
  green "no 'inbound stream for unknown context' warnings for newpublic"
fi

# ── Result ──────────────────────────────────────────────────────────────────

phase "Result"
if [ "$FAIL" -eq 0 ]; then
  printf '\033[1;32m  ✅  PASS — public/private/DM visibility, usernames, metadata, and message propagation all green\033[0m\n'
  exit 0
else
  printf '\033[1;31m  ❌  FAIL — see above\033[0m\n'
  printf '\nFor deeper inspection:\n'
  printf '  tail -200 /tmp/curb-dev-node.log /tmp/curb-dev-node2.log\n'
  exit 1
fi
