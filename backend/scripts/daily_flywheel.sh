#!/usr/bin/env bash
# 每日自我进化飞轮(十件事#7)。挂 cron 每晚跑,产出进化日报到 reports/flywheel/。
# 用法: crontab -e 加一行 →  0 2 * * *  cd /path/to/jiqun_ai && bash scripts/daily_flywheel.sh
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p reports/flywheel
STAMP=$(date +%Y%m%d)
echo "[flywheel] $(date) 开始每日进化" 
python3 scripts/nightly_flywheel.py --write >> "reports/flywheel/run_${STAMP}.log" 2>&1 || {
  echo "[flywheel] 运行失败,见 reports/flywheel/run_${STAMP}.log"; exit 1; }
echo "[flywheel] 完成,日报见 reports/flywheel/"
