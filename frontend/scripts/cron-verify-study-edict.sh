#!/usr/bin/env bash
# Daily real-backend contract-drift check for the Study Edict true loop.
#
# Adopted 2026-06-08 (大神天才建议, charity-majors/deming): the synchronous release
# gate (final-release-harness.mjs -> verify:study-edict) only exercises the fast
# dry_run path. This daily cron keeps the REAL ~51s LIVE swarm path under a ruler too,
# so a backend contract drift on the live path is caught here — not by the first customer.
#
# Cron: 0 7 * * *  (runs before the 07:18 morning briefing, so drift is known by then)
set -uo pipefail

FE=/home/ubuntu/workspace/frontend/chaotang-web-lyt
BE_HEALTH="http://127.0.0.1:8081/api/health"
LOG=/home/ubuntu/chaotang-logs/study-edict-daily.log
mkdir -p "$(dirname "$LOG")"
TS=$(date '+%Y-%m-%d %H:%M:%S')

# The shell exports HTTP_PROXY=http://127.0.0.1:7880 which 502s loopback — strip it.
unset HTTP_PROXY HTTPS_PROXY http_proxy https_proxy ALL_PROXY all_proxy

code=$(curl -s --noproxy '*' -o /dev/null -w '%{http_code}' --max-time 8 "$BE_HEALTH" 2>/dev/null)
if [ "$code" != "200" ]; then
  echo "$TS  SKIP  backend :8081 health=$code (not up; live check skipped)" >> "$LOG"
  exit 0
fi

cd "$FE" || { echo "$TS  FAIL  cannot cd $FE" >> "$LOG"; exit 1; }
out=$(node scripts/verify-study-edict.mjs --live 2>&1)
ec=$?
last=$(printf '%s\n' "$out" | tail -1)
if [ "$ec" -eq 0 ]; then
  echo "$TS  PASS  live contract aligned | $last" >> "$LOG"
else
  echo "$TS  FAIL(exit=$ec)  live contract DRIFT — investigate | $last" >> "$LOG"
fi
exit "$ec"
