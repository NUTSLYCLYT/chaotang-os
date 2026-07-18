#!/usr/bin/env bash
# 每日朝会自转 wrapper — 蓝图 S2 (docs/plans/chaotang-ext-court-loop-activation-2026-07-19.md)
# crontab 接线属钦天监闸,须用户签字后方可加:
#   30 7 * * * /home/ubuntu/bin/cron-run daily-court 60 -- /home/ubuntu/Projects/chaotang-ext-certification/backend/scripts/run_daily_court.sh
set -euo pipefail

# cron PATH 缺 npm-global/linuxbrew 的老坑,显式补全
export PATH="/home/linuxbrew/.linuxbrew/bin:/home/ubuntu/.npm-global/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

BACKEND=/home/ubuntu/Projects/chaotang-ext-certification/backend
LOG_DIR="$BACKEND/var/logs"
mkdir -p "$LOG_DIR"
cd "$BACKEND"

if ! python3 scripts/daily_court_session.py >> "$LOG_DIR/daily_court.log" 2>&1; then
    /home/ubuntu/.openclaw/script/telegram-notify.sh "⚠️ 每日朝会失败,看 $LOG_DIR/daily_court.log" || true
    exit 1
fi
