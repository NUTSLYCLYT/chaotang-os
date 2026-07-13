#!/usr/bin/env bash
# system-restore.sh — 一命令恢复朝堂全服务栈
# 用法：bash scripts/system-restore.sh [--dry-run]
#   --dry-run: 只检查状态，不实际重启
#
# 顺序：LiteLLM → legal-agent → jiqun → nginx → courtos-web

set -euo pipefail
DRY_RUN="${1:-}"

C_GREEN='\033[0;32m'; C_RED='\033[0;31m'; C_YELLOW='\033[1;33m'; C_RESET='\033[0m'; C_BOLD='\033[1m'
ok()   { printf "${C_GREEN}  ✓ %s${C_RESET}\n" "$*"; }
fail() { printf "${C_RED}  ✗ %s${C_RESET}\n" "$*"; FAIL=$((FAIL+1)); }
warn() { printf "${C_YELLOW}  ⚠ %s${C_RESET}\n" "$*"; }
info() { printf "  → %s\n" "$*"; }

FAIL=0

maybe_restart() {
  local svc="$1" label="$2"
  if [ "$DRY_RUN" = "--dry-run" ]; then
    if systemctl --user is-active --quiet "$svc" 2>/dev/null; then
      ok "$label ($svc) 运行中"
    else
      warn "$label ($svc) 已停止 [dry-run 跳过重启]"
    fi
    return 0
  fi
  info "重启 $label..."
  if systemctl --user restart "$svc" 2>/dev/null; then
    ok "$label restart 已发出"
  else
    fail "$label restart 失败（unit 未注册？）"
    warn "  手动启动：systemctl --user start $svc 或直接运行进程"
  fi
}

wait_healthy() {
  local name="$1" url="$2" max_secs="${3:-10}"
  if [ "$DRY_RUN" = "--dry-run" ]; then
    if curl -sf --max-time 2 "$url" -o /dev/null 2>/dev/null; then
      ok "$name 健康 [dry-run]"
    else
      fail "$name 健康检查失败 [dry-run] — $url"
    fi
    # fail() records the error; keep checking the remaining services so the
    # final dry-run summary reports the whole stack instead of stopping early.
    return 0
  fi
  for i in $(seq 1 "$max_secs"); do
    if curl -sf --max-time 2 "$url" -o /dev/null 2>/dev/null; then
      ok "$name 健康 (${i}s)"
      return 0
    fi
    sleep 1
  done
  fail "$name 健康检查超时 (${max_secs}s) — $url"
  return 1
}

printf "\n${C_BOLD}════════════════════════════════════════════${C_RESET}\n"
printf "${C_BOLD}  朝堂服务恢复  %s${C_RESET}\n" "$(date '+%Y-%m-%d %H:%M:%S')"
[ "$DRY_RUN" = "--dry-run" ] && printf "  模式: ${C_YELLOW}dry-run（只检查，不重启）${C_RESET}\n"
printf "${C_BOLD}════════════════════════════════════════════${C_RESET}\n\n"

# [1/5] LiteLLM — AI 网关
printf "[1/5] LiteLLM (:4444)\n"
maybe_restart "litellm.service" "LiteLLM"
wait_healthy "LiteLLM" "http://127.0.0.1:4444/health/readiness" 12

# [2/5] legal-agent — 法务 agent
printf "\n[2/5] legal-agent (:18003)\n"
maybe_restart "legal-agent-manor.service" "legal-agent"
wait_healthy "legal-agent" "http://127.0.0.1:18003/health" 8

# [3/5] jiqun — 产线执行引擎
printf "\n[3/5] jiqun (:8081)\n"
if systemctl --user list-units --no-legend 2>/dev/null | grep -q "jiqun"; then
  maybe_restart "jiqun.service" "jiqun"
  wait_healthy "jiqun" "http://127.0.0.1:8081/api/health" 12
else
  warn "jiqun 未注册 systemd unit"
  warn "  手动启动: cd /home/ubuntu/Projects/chaotang-os/backend"
  warn "  .venv/bin/python -m gunicorn -c gunicorn.conf.py web.main:app"
  # 检查是否已经在跑
  if curl -sf --max-time 2 "http://127.0.0.1:8081/api/health" -o /dev/null 2>/dev/null; then
    ok "jiqun 已在运行（手动启动）"
  else
    fail "jiqun 未运行"
  fi
fi

# [4/5] nginx — 反向代理
printf "\n[4/5] nginx\n"
if systemctl --user list-units --no-legend 2>/dev/null | grep -q "nginx-app"; then
  maybe_restart "nginx-app.service" "nginx"
  [ "$DRY_RUN" = "--dry-run" ] || sleep 1
  if curl -sf --max-time 3 "http://127.0.0.1:3050/chaotang/admin" -o /dev/null 2>/dev/null; then
    ok "nginx → courtos-web 通路正常"
  elif [ "$DRY_RUN" = "--dry-run" ]; then
    fail "nginx → courtos-web 通路不可用 [dry-run]"
  else
    warn "nginx 已重启但 :3050 未响应（courtos-web 可能还在初始化）"
  fi
else
  warn "nginx-app.service 未注册，跳过"
fi

# [5/5] courtos-web — Next.js 前端
printf "\n[5/5] courtos-web (:3050)\n"
if systemctl --user is-active --quiet "courtos-web.service" 2>/dev/null; then
  if [ "$DRY_RUN" = "--dry-run" ]; then
    ok "courtos-web 运行中"
    wait_healthy "courtos-web" "http://127.0.0.1:3050/chaotang/admin" 20
  else
    info "courtos-web 已在运行，跳过重启"
    ok "courtos-web (:3050) 正常"
  fi
else
  maybe_restart "courtos-web.service" "courtos-web"
  wait_healthy "courtos-web" "http://127.0.0.1:3050/chaotang/admin" 20
fi

# 汇总
printf "\n${C_BOLD}════════════════════════════════════════════${C_RESET}\n"
if [ "$FAIL" -eq 0 ]; then
  printf "${C_GREEN}${C_BOLD}🟢 全部服务恢复正常${C_RESET}\n\n"
  # 最终健康快报
  printf "  端口速查:\n"
  for port_svc in "4444:LiteLLM" "18003:legal-agent" "8081:jiqun" "3050:courtos-web"; do
    port="${port_svc%%:*}"; svc="${port_svc##*:}"
    if ss -tlnp 2>/dev/null | grep -Eq "LISTEN[[:space:]].*:${port}([[:space:]]|$)"; then
      printf "  ${C_GREEN}✓${C_RESET} :%-6s %s\n" "$port" "$svc"
    else
      printf "  ${C_YELLOW}⚠${C_RESET} :%-6s %s (未监听)\n" "$port" "$svc"
    fi
  done
  printf "\n"
  exit 0
else
  printf "${C_RED}${C_BOLD}🔴 %d 个服务异常，需人工介入${C_RESET}\n" "$FAIL"
  printf "  参考 docs/DEPLOY-RUNBOOK.md 排查\n\n"
  exit 1
fi
