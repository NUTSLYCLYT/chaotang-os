#!/usr/bin/env bash
# scripts/backend_upgrade_watch.sh — 每日盯本机 brew pin 状态 + 后端健康,有事才推送。
#
# 背景(2026-07-03 事故):linuxbrew 自动把 python@3.14/openssl@3/libffi/sqlite/expat/
# libedit/xz 升到要求 GLIBC 2.38 的新版本,但本机系统 GLIBC 只有 2.35,整个 .venv 起不来。
# 已把这 7 个包 pin 回兼容旧版本止血。这个脚本每天检查:
#   1) pin 住的包,upstream 有没有出现"上次检查以来的新发布"(不是"跟 pin 不一样"就算——
#      那个条件天天成立,会天天想推送,是噪音;只在版本号真的往前挪了才算信号)。
#   2) 本机 8081 后端进程还活不活着。
#   3) 项目全量测试还过不过(轻量健康检查)。
# 只在"有信息量"时才推送,没情况不打扰人(状态记一笔本地日志,不发消息)。
set -uo pipefail

PROJECT_ROOT="/home/ubuntu/fe/fengQun/jiqun_ai_fresh"
BREW="/home/linuxbrew/.linuxbrew/bin/brew"
PUSH="/home/ubuntu/.openclaw/script/push_ops_alert.sh"
STATE_FILE="/home/ubuntu/.openclaw/log/backend-upgrade-watch/last_seen_stable.env"
PINNED_FORMULAS=(python@3.14 openssl@3 libffi sqlite expat libedit xz)

mkdir -p "$(dirname "$STATE_FILE")"
# shellcheck disable=SC1090
[ -f "$STATE_FILE" ] && source "$STATE_FILE"

findings=()
new_state=()

# ---- 1) pinned 包:upstream 版本号比"上次记录到的"更新,才算新信号 ----
for f in "${PINNED_FORMULAS[@]}"; do
    stable=$("$BREW" info "$f" 2>/dev/null | head -1 | grep -oP 'stable \K[0-9][^ ]*')
    [ -z "$stable" ] && continue
    key="LAST_STABLE_$(echo "$f" | tr -c 'a-zA-Z0-9' '_')"
    last="${!key:-}"
    new_state+=("$key=\"$stable\"")
    if [ -n "$last" ] && [ "$last" != "$stable" ]; then
        pinned=$(readlink "/home/linuxbrew/.linuxbrew/opt/$f" 2>/dev/null | grep -oP "$f/\K.*")
        findings+=("📦 $f 有新发布:$last → $stable(当前 pin=$pinned;GLIBC 兼容性需人工核实,别自动解 pin)")
    fi
done

# 首次跑(没有历史状态文件)只建立基线,不因为"跟 pin 不一样"就推送噪音
first_run=0
[ ! -f "$STATE_FILE" ] && first_run=1
printf '%s\n' "${new_state[@]}" > "$STATE_FILE"

# ---- 2) 本机后端进程健康 ----
if ! curl -s -o /dev/null -m 5 "http://127.0.0.1:8081/docs"; then
    findings+=("🔴 本机 8081 后端没响应(可能进程挂了,或本机重启后没自动拉起)")
fi

# ---- 3) 全量测试(用当前 pin 住的解释器;项目没装 pytest-timeout 插件,用 shell timeout 兜底卡死) ----
cd "$PROJECT_ROOT" || exit 0
if ! timeout 300 "$PROJECT_ROOT/.venv/bin/python3" -m pytest tests/ -q \
        > /tmp/backend_upgrade_watch_pytest.log 2>&1; then
    fail_line=$(grep -E "^[0-9]+ (failed|error)" /tmp/backend_upgrade_watch_pytest.log | tail -1)
    findings+=("🔴 全量测试没过:${fail_line:-详见 /tmp/backend_upgrade_watch_pytest.log}")
fi

if [ "$first_run" -eq 1 ] || [ ${#findings[@]} -eq 0 ]; then
    echo "$(date '+%F %T') $([ "$first_run" -eq 1 ] && echo '首次跑,建立基线' || echo '一切正常'),无需推送" >> /tmp/backend_upgrade_watch.log
    exit 0
fi

body=$(printf '%s\n' "${findings[@]}")
"$PUSH" --title "后端升级/健康检查" --body "$body" --tag backend-upgrade-watch --cooldown 82800
