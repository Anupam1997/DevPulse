#!/usr/bin/env bash
set -euo pipefail

API="${API_URL:-http://localhost:4000}"
PASS=0
FAIL=0

check() {
  local name="$1"
  local cond="$2"
  if eval "$cond"; then
    echo "  ✓ $name"
    PASS=$((PASS + 1))
  else
    echo "  ✗ $name"
    FAIL=$((FAIL + 1))
  fi
}

sign_payload() {
  node -e "
    const crypto = require('crypto');
    const payload = process.argv[1];
    const secret = process.argv[2];
    console.log('sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex'));
  " "$1" "$2"
}

echo "=== DevPulse E2E Test ==="
echo "API: $API"
echo ""

echo "[1] Health check"
HEALTH=$(curl -sf "$API/health")
check "health status ok" "echo '$HEALTH' | grep -q '\"status\":\"ok\"'"
READY=$(curl -sf "$API/health/ready")
check "database connected" "echo '$READY' | grep -q '\"db\":true'"
check "redis connected" "echo '$READY' | grep -q '\"redis\":true'"
echo ""

echo "[2] Auth — login + create org"
LOGIN=$(curl -sf -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"githubId":"e2e-test-user","username":"e2e-tester","avatarUrl":"https://github.com/github.png","email":"e2e@test.dev"}')
TOKEN=$(echo "$LOGIN" | node -e "process.stdout.write(JSON.parse(require('fs').readFileSync(0)).token||'')")
check "login returns token" "[[ -n '$TOKEN' ]]"

ORG=$(curl -sf -X POST "$API/auth/orgs" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"name\":\"E2E Org $(date +%s)\"}")
ORG_ID=$(echo "$ORG" | node -e "process.stdout.write(JSON.parse(require('fs').readFileSync(0)).org.id)")
TOKEN=$(echo "$ORG" | node -e "process.stdout.write(JSON.parse(require('fs').readFileSync(0)).token)")
SECRET=$(echo "$ORG" | node -e "process.stdout.write(JSON.parse(require('fs').readFileSync(0)).webhookSecret)")
check "org created" "[[ -n '$ORG_ID' ]]"
check "webhook secret generated" "[[ -n '$SECRET' ]]"
echo "  orgId: $ORG_ID"
echo ""

echo "[3] Auth — /auth/me"
ME=$(curl -sf -H "Authorization: Bearer $TOKEN" "$API/auth/me")
check "me returns current org" "echo '$ME' | grep -q '$ORG_ID'"
echo ""

echo "[4] Webhook — simulate GitHub push"
RUN_ID=$(date +%s)
PUSH_DELIVERY="e2e-push-${RUN_ID}"
PR_DELIVERY="e2e-pr-${RUN_ID}"
PAYLOAD='{"repository":{"id":888001,"name":"e2e-repo","full_name":"e2e-org/e2e-repo"},"sender":{"id":99001,"login":"e2e-tester","avatar_url":"https://github.com/github.png"},"commits":[{"id":"deadbeef","message":"feat: e2e test commit","author":{"username":"e2e-tester"}}],"ref":"refs/heads/main"}'
SIG=$(sign_payload "$PAYLOAD" "$SECRET")
WH=$(curl -sf -X POST "$API/webhooks/github?orgId=$ORG_ID" \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: push" \
  -H "X-GitHub-Delivery: $PUSH_DELIVERY" \
  -H "X-Hub-Signature-256: $SIG" \
  -d "$PAYLOAD")
check "webhook accepted" "echo '$WH' | grep -q '\"received\":true'"
sleep 2
echo ""

echo "[5] Webhook — simulate PR merged"
PR_PAYLOAD='{"action":"closed","pull_request":{"id":888002,"number":1,"title":"E2E test PR","merged":true,"user":{"id":99001,"login":"e2e-tester"}},"repository":{"id":888001,"name":"e2e-repo","full_name":"e2e-org/e2e-repo"},"sender":{"id":99001,"login":"e2e-tester","avatar_url":"https://github.com/github.png"}}'
PR_SIG=$(sign_payload "$PR_PAYLOAD" "$SECRET")
curl -sf -X POST "$API/webhooks/github?orgId=$ORG_ID" \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: pull_request" \
  -H "X-GitHub-Delivery: $PR_DELIVERY" \
  -H "X-Hub-Signature-256: $PR_SIG" \
  -d "$PR_PAYLOAD" > /dev/null
sleep 2
echo ""

echo "[6] REST API — verify data"
EVENTS=$(curl -sf -H "Authorization: Bearer $TOKEN" "$API/orgs/$ORG_ID/events?limit=10")
EVENT_COUNT=$(echo "$EVENTS" | node -e "process.stdout.write(String(JSON.parse(require('fs').readFileSync(0)).total))")
check "events recorded (>=2)" "[[ ${EVENT_COUNT:-0} -ge 2 ]]"
echo "  events total: $EVENT_COUNT"

METRICS=$(curl -sf -H "Authorization: Bearer $TOKEN" "$API/orgs/$ORG_ID/metrics")
COMMITS=$(echo "$METRICS" | node -e "process.stdout.write(String(JSON.parse(require('fs').readFileSync(0)).summary.totalCommits))")
MERGED=$(echo "$METRICS" | node -e "process.stdout.write(String(JSON.parse(require('fs').readFileSync(0)).summary.totalMergedPRs))")
check "metrics show commits" "[[ ${COMMITS:-0} -ge 1 ]]"
check "metrics show merged PRs" "[[ ${MERGED:-0} -ge 1 ]]"
echo "  commits: $COMMITS, merged PRs: $MERGED"

REPOS=$(curl -sf -H "Authorization: Bearer $TOKEN" "$API/orgs/$ORG_ID/repos")
REPO_COUNT=$(echo "$REPOS" | node -e "process.stdout.write(String(JSON.parse(require('fs').readFileSync(0)).length))")
check "repo registered" "[[ ${REPO_COUNT:-0} -ge 1 ]]"

LEADERBOARD=$(curl -sf -H "Authorization: Bearer $TOKEN" "$API/orgs/$ORG_ID/leaderboard")
LB_ENTRIES=$(echo "$LEADERBOARD" | node -e "process.stdout.write(String(JSON.parse(require('fs').readFileSync(0)).entries.length))")
check "leaderboard has entries" "[[ ${LB_ENTRIES:-0} -ge 1 ]]"

SPRINT=$(curl -sf -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"E2E Sprint","startDate":"2026-06-01T00:00:00.000Z","endDate":"2026-06-30T00:00:00.000Z","goalPoints":50}' \
  "$API/orgs/$ORG_ID/sprints")
SPRINT_ID=$(echo "$SPRINT" | node -e "process.stdout.write(JSON.parse(require('fs').readFileSync(0)).id||'')")
check "sprint created" "[[ -n '$SPRINT_ID' ]]"

SPRINTS=$(curl -sf -H "Authorization: Bearer $TOKEN" "$API/orgs/$ORG_ID/sprints")
SPRINT_LIST=$(echo "$SPRINTS" | node -e "process.stdout.write(String(JSON.parse(require('fs').readFileSync(0)).length))")
check "sprints list returns data" "[[ ${SPRINT_LIST:-0} -ge 1 ]]"

SPRINT_DETAIL=$(curl -sf -H "Authorization: Bearer $TOKEN" "$API/orgs/$ORG_ID/sprints/$SPRINT_ID")
check "sprint detail has burndown" "echo '$SPRINT_DETAIL' | grep -q '\"burndown\"'"

echo "[7] Webhook idempotency — duplicate delivery"
curl -sf -X POST "$API/webhooks/github?orgId=$ORG_ID" \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: push" \
  -H "X-GitHub-Delivery: $PUSH_DELIVERY" \
  -H "X-Hub-Signature-256: $SIG" \
  -d "$PAYLOAD" > /dev/null
sleep 2
EVENTS_AFTER=$(curl -sf -H "Authorization: Bearer $TOKEN" "$API/orgs/$ORG_ID/events?limit=10")
EVENT_COUNT_AFTER=$(echo "$EVENTS_AFTER" | node -e "process.stdout.write(String(JSON.parse(require('fs').readFileSync(0)).total))")
check "duplicate delivery ignored" "[[ ${EVENT_COUNT_AFTER:-0} -eq ${EVENT_COUNT:-0} ]]"

WH_STATUS=$(curl -sf -H "Authorization: Bearer $TOKEN" "$API/orgs/$ORG_ID/webhook-status")
check "webhook status listening" "echo '$WH_STATUS' | grep -q '\"listening\":true'"
echo ""

echo "[8] Validation — malformed request body"
MALFORMED=$(curl -s -o /tmp/e2e-malformed.json -w "%{http_code}" -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"githubId":123}')
check "malformed login returns 400" "[[ '$MALFORMED' == '400' ]]"
echo ""

echo "=== Results: $PASS passed, $FAIL failed ==="
[[ $FAIL -eq 0 ]]
