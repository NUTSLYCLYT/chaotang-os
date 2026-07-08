#!/usr/bin/env bash
# scripts/flywheel/run-hubu-flywheel.sh — 工作日定时调户部飞轮
#
# 必须设置环境变量 FLYWHEEL_KEY，否则接口 fail-closed 返回 401，飞轮不执行。
# 示例：export FLYWHEEL_KEY=<your-secret>（写入 ~/.bashrc 或 systemd EnvironmentFile）
export PATH="$HOME/.npm-global/bin:$HOME/.local/bin:/usr/bin:/bin"
KEY="${FLYWHEEL_KEY:-}"
mkdir -p "$HOME/.gstack"
curl -s --noproxy 127.0.0.1,localhost --max-time 60 \
  -X POST http://127.0.0.1:3050/chaotang/api/court/hubu/auto-raise \
  -H "Content-Type: application/json" \
  ${KEY:+-H "x-flywheel-key: $KEY"} \
  | tee -a "$HOME/.gstack/flywheel-hubu.log"
