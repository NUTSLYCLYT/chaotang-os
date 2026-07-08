#!/usr/bin/env bash
# 重启本地 dev 后端并确认加载的是最新代码。
#
# 病根: serve-dev.sh 起服务后如果又有新 commit(尤其是并行会话在同一仓库
# 继续提交),不手动重启就会一直跑旧代码——verify 时表现为"改了却验证不出
# 效果",连续在同一会话里发生过 3 次。本脚本把 kill 旧进程/等端口释放/
# 起新进程/对比"新进程启动时间 vs 最新 commit 时间"这套手动动作固化成一条命令。
#
# 用法: bash scripts/reload-dev.sh
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${FENGQUN_WEB_PORT:-8081}"
OLD_PID=$(ss -ltnp 2>/dev/null | grep "127.0.0.1:${PORT} " | grep -oP 'pid=\K[0-9]+' | head -1 || true)

if [ -n "$OLD_PID" ]; then
  echo "[reload-dev] 停止旧进程 pid=$OLD_PID"
  kill -TERM "$OLD_PID" 2>/dev/null || true
  for _ in $(seq 1 40); do
    ss -ltnp 2>/dev/null | grep -q "127.0.0.1:${PORT} " || break
    sleep 0.25
  done
fi

setsid nohup bash scripts/serve-dev.sh > /tmp/jiqun-dev.log 2>&1 < /dev/null &
disown

for _ in $(seq 1 40); do
  curl -s -m 2 -o /dev/null "http://127.0.0.1:${PORT}/" && break
  sleep 0.5
done

NEW_PID=$(ss -ltnp 2>/dev/null | grep "127.0.0.1:${PORT} " | grep -oP 'pid=\K[0-9]+' | head -1 || true)
if [ -z "$NEW_PID" ]; then
  echo "[reload-dev] 启动失败,查看 /tmp/jiqun-dev.log" >&2
  exit 1
fi

START_TS=$(ps -o lstart= -p "$NEW_PID" | xargs -I{} date -d "{}" +%s)
COMMIT_TS=$(git log -1 --format=%ct)
echo "[reload-dev] 新进程 pid=$NEW_PID"
if [ "$START_TS" -ge "$COMMIT_TS" ]; then
  echo "[reload-dev] ✅ 代码是最新的(进程启动时间 >= 最新 commit 时间)"
else
  echo "[reload-dev] ⚠️ 进程启动早于最新 commit,可能仍是旧代码——检查是否有并行提交" >&2
fi
