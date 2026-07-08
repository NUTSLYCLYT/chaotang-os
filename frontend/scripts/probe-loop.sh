#!/usr/bin/env bash
# 朝堂主闭环真实探针(2026-07-06)：真登录 token + 下旨 → 看 swarmDispatched 真假。
# 用法: bash scripts/probe-loop.sh ["下旨命令"]
# 判据: swarmDispatched:true = 飞轮真转; false+degraded = 断链(查 dev 日志 runShangshu warn)。
set -euo pipefail
JIQUN="${JIQUN_API_URL:-http://127.0.0.1:8081}"
WEB="${WEB_BASE:-http://127.0.0.1:3002/chaotang}"
CMD="${1:-评估中美元首会晤与中美关系新定位对我们业务的影响与下一步}"
U="looptest"; P="Loop@12345"
curl -s -m 10 -X POST "$JIQUN/api/auth/register" -H "Content-Type: application/json" -d "{\"username\":\"$U\",\"password\":\"$P\",\"email\":\"loop@test.local\"}" >/dev/null || true
TOKEN=$(curl -s -m 10 -X POST "$JIQUN/api/auth/login" -H "Content-Type: application/json" -d "{\"username\":\"$U\",\"password\":\"$P\"}" | python3 -c "import json,sys;print(json.load(sys.stdin)['token'])")
echo "下旨: $CMD"
curl -N -s -m 320 -X POST "$WEB/api/orchestration/run" -H "Content-Type: application/json" \
  -H "Cookie: courtos.access_token=$TOKEN" -d "{\"command\":\"$CMD\"}" \
| grep -oE 'tavilyCitations":[0-9]+|"finalVerdict":"[^"]*"|swarmDispatched":[a-z]+|swarmDegraded":[a-z]+|"dispatchedTo":\[[^]]*\]' | sort -u
