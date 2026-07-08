#!/bin/bash
# 锦衣卫心跳推送(2026-06-21)
# 读漏斗 json → 一行健康日报 → 推用户已有的 telegram 通道。
# 解决"cron 悄悄死没人知道":健康主动找你;空转时升级红色告警,而非等你去 /intel 看。
# 由 cron 在每日采集后调用(见 crontab jinyiwei 行)。
set -uo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
FUNNEL="$REPO/public/intel-funnel.json"
NOTIFY="/home/ubuntu/.openclaw/script/telegram-notify.sh"

MSG=$(FUNNEL="$FUNNEL" python3 - <<'PY'
import json, os

try:
    d = json.load(open(os.environ["FUNNEL"], encoding="utf-8"))
except Exception:
    print("🔴 锦衣卫:漏斗文件缺失,采集可能从未成功 —— 查 cron / 管线日志")
    raise SystemExit

streak = int(d.get("empty_streak", 0) or 0)
if streak > 0:
    print(
        f"🔴 锦衣卫空转告警 · 连续 {streak} 次未采到情报(代理挂 / 被限频?)\n"
        f"数据停在 last_success={d.get('last_success_at', '未知')}\n"
        f"速查 /tmp/jinyiwei-cron.log"
    )
else:
    print(
        f"🗡️ 锦衣卫日报 · 采{d.get('fetched', 0)} · 入库{d.get('admitted', 0)} · "
        f"待核{d.get('pending', 0)} · 拦{d.get('rejected', 0)} · 🆕异动{d.get('new', 0)} · 把关在岗"
    )
PY
)

if [ -x "$NOTIFY" ]; then
    "$NOTIFY" --markdown "$MSG"
else
    echo "[jinyiwei-heartbeat] telegram-notify 不可用,仅本地输出:"
    echo "$MSG"
fi
