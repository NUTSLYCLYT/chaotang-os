#!/bin/bash
# 朝堂 OS · 可靠 dev 启动（封装本机已知的坑）
# 1) NO_PROXY 显式含 127.0.0.1 —— 否则系统代理(7880)会拦截 localhost,把后端打成 502
# 2) 直起 next 二进制 —— 绕过 pnpm 的 sharp build 预检(pnpm-workspace.yaml 占位符曾导致 pnpm dev 失败)
# 3) 端口 3002（dev），3050 留给 prod。禁用 3001。
set -uo pipefail
cd "$(dirname "$0")/.."

PORT="${1:-3002}"
LOG="/tmp/chaotang-dev.log"

# 停掉占用该端口的旧进程（按 PID，避免 pkill 误伤）
oldpid=$(ss -tlnp 2>/dev/null | grep ":${PORT}" | grep -oP 'pid=\K[0-9]+' | head -1)
if [[ -n "${oldpid:-}" ]]; then
  echo "停止旧 dev (pid ${oldpid})..."; kill "$oldpid" 2>/dev/null; sleep 2
fi

echo "启动 next dev @ ${PORT}（NO_PROXY 已设，加载 .env.local）..."
NO_PROXY="127.0.0.1,localhost,0.0.0.0,::1,jiqun" \
no_proxy="127.0.0.1,localhost,0.0.0.0,::1,jiqun" \
  nohup node node_modules/next/dist/bin/next dev -p "${PORT}" > "$LOG" 2>&1 &
disown

for i in $(seq 1 15); do
  sleep 2
  if ss -tlnp 2>/dev/null | grep -q ":${PORT}"; then
    echo "✓ dev ready @ http://localhost:${PORT}/   (日志: $LOG)"
    exit 0
  fi
done
echo "✗ 启动超时，看日志:"; tail -15 "$LOG"; exit 1
