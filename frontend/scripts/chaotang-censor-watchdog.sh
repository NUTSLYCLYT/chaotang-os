#!/usr/bin/env bash
# 朝堂御史看门狗 · dead-man's switch
#
# 顶尖大神(schneier):"一个连自己死了都不报的御史,比没有御史更危险。"
# 御史台(chaotang-censor.sh)每次巡查写一次心跳;本看门狗独立运行(自己的 cron),
# 只看心跳新不新:御史超时没报到 → 替你喊"御史自己失联了"。
# 故意做成与御史台**互相独立**的最小脚本:御史台整个挂了,看门狗仍能开口。
#
# 用法: bash scripts/chaotang-censor-watchdog.sh
# 退出码: 0=御史在岗, 1=御史失联
# env: CHAOTANG_CENSOR_MAX_AGE_SEC  心跳过期阈值(默认 90000≈25h,容一天一巡 + 缓冲)

set -uo pipefail
HEARTBEAT="${CHAOTANG_CENSOR_HEARTBEAT:-/tmp/chaotang-censor-heartbeat}"
MAX_AGE="${CHAOTANG_CENSOR_MAX_AGE_SEC:-90000}"
NOW=$(date +%s)

if [ ! -f "$HEARTBEAT" ]; then
  echo "🔴 御史看门狗:从无心跳记录 —— 御史台从未巡查过(还没挂上 cron?)"
  exit 1
fi

LAST=$(cat "$HEARTBEAT" 2>/dev/null || echo 0)
case "$LAST" in (*[!0-9]*|'') LAST=0;; esac
AGE=$((NOW - LAST))
AGE_H=$((AGE / 3600))

if [ "$AGE" -gt "$MAX_AGE" ]; then
  echo "🔴 御史看门狗:御史失联 ${AGE_H} 小时未巡查(阈值 $((MAX_AGE/3600))h) —— 御史台自己可能死了,快查!"
  exit 1
fi
echo "🟢 御史看门狗:御史在岗(上次巡查 ${AGE_H} 小时前)"
exit 0
