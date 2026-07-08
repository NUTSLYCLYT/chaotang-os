#!/usr/bin/env bash
# Daily Chaotang real-swarm release-gate smoke.
#
# Cron example:
#   10 7 * * * /home/ubuntu/workspace/frontend/chaotang-web-lyt/scripts/cron-chaotang-real-swarm-gate.sh
#
# This intentionally reuses scripts/chaotang-release-gates.mjs so daily checks and
# release checks write the same report/audit schema under dev/artifacts/chaotang-release-gates.
set -uo pipefail

FE=/home/ubuntu/workspace/frontend/chaotang-web-lyt
BE_HEALTH="http://127.0.0.1:8081/api/health"
LOG=/home/ubuntu/chaotang-logs/real-swarm-gate-daily.log
mkdir -p "$(dirname "$LOG")"
TS=$(date '+%Y-%m-%d %H:%M:%S')

# Some shells export proxy variables that break loopback requests.
unset HTTP_PROXY HTTPS_PROXY http_proxy https_proxy ALL_PROXY all_proxy

code=$(curl -s --noproxy '*' -o /dev/null -w '%{http_code}' --max-time 8 "$BE_HEALTH" 2>/dev/null)
if [ "$code" != "200" ]; then
  report="$FE/dev/artifacts/chaotang-release-gates/latest.json"
  mkdir -p "$(dirname "$report")"
  cat > "$report" <<JSON
{
  "schema": "chaotang.release-gates.v1",
  "runId": "daily-real-swarm-degraded-$(date '+%Y%m%d-%H%M%S')",
  "startedAt": "$(date -Iseconds)",
  "finishedAt": "$(date -Iseconds)",
  "decision": "DEGRADED",
  "mode": "real-swarm-smoke",
  "baseUrl": "http://127.0.0.1:3002",
  "artifactDir": "dev/artifacts/chaotang-release-gates",
  "evidence": {
    "realSwarmSmoke": {
      "required": true,
      "status": "$code",
      "ok": false,
      "reason": "backend :8081 health is unavailable; smoke was not run"
    }
  },
  "stages": [
    {
      "id": "backend-health",
      "status": "degraded",
      "startedAt": "$(date -Iseconds)",
      "finishedAt": "$(date -Iseconds)",
      "error": "backend :8081 health=$code"
    }
  ],
  "summary": { "total": 1, "passed": 0, "failed": 1, "durationMs": 0 }
}
JSON
  echo "$TS  DEGRADED  backend :8081 health=$code (real swarm gate not run) | report=$report" >> "$LOG"
  /home/ubuntu/.openclaw/script/telegram-notify.sh "🔴 朝堂金丝雀 DEGRADED: 后端:8081 health=$code,真蜂群门没跑" >/dev/null 2>&1 || true
  exit 1
fi

cd "$FE" || { echo "$TS  FAIL  cannot cd $FE" >> "$LOG"; exit 1; }

# basePath 自适应(2026-07-08 修连红):dev :3002 可能带 /chaotang basePath 起,
# 金丝雀打裸路径会 404 误报"drift"。探 true-chain-health,非404 即认带前缀的 devUrl。
if [ -z "${CHAOTANG_GATES_DEV_URL:-}" ]; then
  bp_code=$(curl -s --noproxy 127.0.0.1,localhost -o /dev/null -w '%{http_code}' --max-time 8 "http://127.0.0.1:3002/chaotang/api/court/true-chain-health" 2>/dev/null)
  if [ "$bp_code" != "404" ] && [ "$bp_code" != "000" ]; then
    export CHAOTANG_GATES_DEV_URL="http://127.0.0.1:3002/chaotang"
  fi
fi

export CHAOTANG_GATES_ONLY_REAL_SWARM=1
export CHAOTANG_GATES_REAL_SWARM=1
export CHAOTANG_GATES_REUSE_DEV="${CHAOTANG_GATES_REUSE_DEV:-1}"
export CHAOTANG_GATES_RUN_ID="${CHAOTANG_GATES_RUN_ID:-daily-real-swarm-$(date '+%Y%m%d-%H%M%S')}"

out=$(npm run harness:chaotang:daily-real-swarm 2>&1)
ec=$?
last=$(printf '%s\n' "$out" | tail -1)
report="$FE/dev/artifacts/chaotang-release-gates/latest.json"

if [ "$ec" -eq 0 ]; then
  echo "$TS  PASS  real swarm gate aligned | $last | report=$report" >> "$LOG"
else
  echo "$TS  FAIL(exit=$ec)  real swarm gate drift | $last | report=$report" >> "$LOG"
  # 核心闭环断了必须主动找人,不许只写日志(2026-07-08:连红两天无人知)
  reason=$(python3 -c "
import json
try:
    r=json.load(open('$report'))
    bad=[s for s in r.get('stages',[]) if s.get('status')!='passed']
    print((bad[0].get('error') or bad[0].get('id')) if bad else r.get('decision',''))
except Exception as e: print('report unreadable')" 2>/dev/null | head -c 300)
  /home/ubuntu/.openclaw/script/telegram-notify.sh "🔴 朝堂金丝雀 FAIL: 下旨→会审真链路冒烟未过 — ${reason} | log: chaotang-logs/real-swarm-gate-daily.log" >/dev/null 2>&1 || true
fi
exit "$ec"
