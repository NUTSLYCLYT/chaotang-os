#!/usr/bin/env bash
# self-healing-monitor.sh — 自愈 cron
#
# 工作方式：
#   1. 运行 health-monitor.mjs
#   2. 有服务 DOWN → 尝试 system-restore.sh
#   3. 等 20s 后再探一次
#   4. 仍然 DOWN → 发告警（通过 health-monitor 的 CHAOTANG_ALERT_URL 推送）
#   5. 全绿 → 静默退出
#
# cron 接入（每 5 分钟）：
#   */5 * * * * cd /home/ubuntu/workspace/frontend/chaotang-web-lyt && bash scripts/self-healing-monitor.sh >> ~/.openclaw/log/chaotang-self-healing.log 2>&1
#
# 与直接跑 health-monitor.mjs 的区别：
#   health-monitor: 探测 → 告警 → 等人工处理（MTTR ≈ 5-30 分钟）
#   self-healing:   探测 → 告警前先自愈 → 30s 后再探 → 仍挂才告警（MTTR ≈ 30s）

set -uo pipefail
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TS() { date '+%H:%M:%S'; }

log() { echo "[$(TS)] $*"; }

# 1. 初次健康探测（先捕获退出码，再判断）
log "── 自愈巡检开始 ──"
node "$REPO_DIR/scripts/health-monitor.mjs" > /dev/null 2>&1
HEALTH_EXIT=$?
if [ "$HEALTH_EXIT" -eq 0 ]; then
  log "✓ 全服务健康，退出"
  exit 0
fi

log "⚠ $HEALTH_EXIT 个服务 DOWN，尝试自动恢复..."

# 2. 尝试恢复（不发告警，直接 restart）
bash "$REPO_DIR/scripts/system-restore.sh" 2>&1 | grep -E "✓|✗|⚠|restart|DOWN" || true

# 3. 等服务初始化
log "等待 25s 让服务初始化..."
sleep 25

# 4. 二次探测
log "── 二次健康探测 ──"
if node "$REPO_DIR/scripts/health-monitor.mjs" 2>&1; then
  log "✓ 自愈成功！服务已恢复"
  exit 0
fi

# 5. 仍然 DOWN → health-monitor 已写 alert log + 发 Telegram（若配置）
log "🔴 自愈失败，人工介入：bash scripts/system-restore.sh"
exit 1
