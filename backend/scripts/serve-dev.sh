#!/usr/bin/env bash
# Deterministic dev backend launcher for jiqun_ai  (2026-06-08 大神采纳的天才建议)
# ---------------------------------------------------------------------------
# 病根:web/main.py 不 load_dotenv + FENGQUN_AUTH 默认 true（web/deps.py:23）→
# 谁起的后端、带什么 env 全凭手感,同一份代码一会儿 200 一会儿 401。
# 本脚本把"起一个契约门/cron/harness 能打的后端"固化成一条命令、零手感、可复现。
#
# 用法:  bash scripts/serve-dev.sh        # 前台
#        nohup bash scripts/serve-dev.sh > /tmp/jiqun-dev.log 2>&1 & disown   # 后台
set -euo pipefail
cd "$(dirname "$0")/.."   # → jiqun_ai 仓根

# 1) 确定性加载 .env(若存在):provider / db / 配置不再依赖调用方环境。
if [ -f .env ]; then set -a; . ./.env; set +a; fi

# 2) dev 默认:契约门/cron/harness 直击后端不带 token → 关鉴权(可被 .env 覆盖)。
export FENGQUN_WEB_PORT="${FENGQUN_WEB_PORT:-8081}"
export FENGQUN_AUTH="${FENGQUN_AUTH:-false}"
export LITELLM_BASE="${LITELLM_BASE:-http://127.0.0.1:4444}"
export LITELLM_API_KEY="${LITELLM_API_KEY:-${LITELLM_PROXY_KEY:-${LITELLM_MASTER_KEY:-}}}"

# 3) 剥离 loopback 代理:本机 HTTP_PROXY=127.0.0.1:7880 会 502 掉本地回环(curl/playwright 都中过招)。
unset HTTP_PROXY HTTPS_PROXY http_proxy https_proxy ALL_PROXY all_proxy

# 4) 选解释器:优先项目 venv,退化 miniforge / python3。
PY="${PYTHON:-.venv/bin/python}"
[ -x "$PY" ] || PY="/home/ubuntu/miniforge3/bin/python"
[ -x "$PY" ] || PY="python3"

echo "[serve-dev] $PY -m web.main  port=$FENGQUN_WEB_PORT  auth=$FENGQUN_AUTH  cwd=$(pwd)"
exec "$PY" -m web.main
