#!/usr/bin/env bash
# 缺证率北极星 · 每日一行(2026-07-08 用户拍板盯两周,复盘日 2026-07-22)。
# 落日快照进 eval/evidence_deficit_history.jsonl 并推 Telegram 一行:
# 率 + 最大贡献司(=下一个该补凭据链路的司) + 较昨日 Δ。
# crontab: 5 8 * * 1-5 /home/ubuntu/Projects/chaotang-os/backend/scripts/cron-evidence-deficit-daily.sh
set -uo pipefail
cd /home/ubuntu/Projects/chaotang-os/backend
unset HTTP_PROXY HTTPS_PROXY http_proxy https_proxy ALL_PROXY all_proxy

line=$(.venv/bin/python -m src.evidence_deficit 2>&1 | tail -1)
LOG=/home/ubuntu/chaotang-logs/evidence-deficit-daily.log
mkdir -p "$(dirname "$LOG")"
echo "$(date '+%Y-%m-%d %H:%M:%S')  $line" >> "$LOG"
/home/ubuntu/.openclaw/script/telegram-notify.sh "📏 北极星·$line" >/dev/null 2>&1 || true
