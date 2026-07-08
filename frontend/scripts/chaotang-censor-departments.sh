#!/usr/bin/env bash
# 朝堂御史 · 部门诚实矩阵(按需跑,比日报深) — 逐部门扫"还碰不碰 mock 假数据"
#
# 顶尖大神拓扑(不犯多 agent 噪声错):不给每个部门配一个御史,而是一份矩阵里逐部门一行 🟢/🟡。
# 诚实纪律:碰 mock ≠ 一定造假 —— 可能是诚实 fallback(标 FALLBACK)。故御史只标 🟡"人工核",不硬判 🔴。
#   要 🔴 的是"假 LIVE"(verified=false 却标 LIVE/真实),那要人看 source-label，脚本只负责把"该看的地方"点出来。
# 这是只读 grep(确定性,无 LLM)。
#
# 用法: pnpm censor:depts
# 退出码: 恒 0(这是审计地图,不是红线门;不让它 fail CI)

set -uo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO"

# 部门 → 名:扫描范围(feature 目录 + 对应 API 路由)。新部门按此格式加。
DEPTS=(
  "户部|src/features/hubu src/app/api/court/hubu"
  "礼部|src/features/libu src/app/api/court/dept/market"
  "工部|src/features/gongbu src/app/api/court/dept/works"
  "兵部|src/features/bingbu"
  "刑部/法务|src/features/legal src/app/api/court/xingbu src/app/api/consult"
  "人事/吏部|src/features/personnel"
  "钦天监|src/features/qintian src/features/forecast src/app/api/qintian src/app/api/court/forecast"
  "太医院|src/features/taiyi src/features/health src/app/api/court/taiyi"
  "军机处|src/features/command-center src/features/imperial"
  "上书房|src/features/shangshufang"
  "史馆|src/features/shiguan src/features/shiguan-ui"
  "锦衣卫/情报|src/features/intel src/app/api/court/intel"
  "庄园|src/features/zhuangyuan src/features/manors"
)

# mock 信号:import mock fixtures / mock.ts / mock-archive / RADAR_NODES / MOCK_ 常量
MOCK_PAT="lib/mock/fixtures|/mock'|/mock\"|mock-archive|RADAR_NODES|MOCK_[A-Z]"

echo "════════════════════════════════════════════"
echo "  朝堂御史 · 部门诚实矩阵 · $(date '+%Y-%m-%d %H:%M')"
echo "════════════════════════════════════════════"
echo "(🟡=该部门有文件碰 mock,人工核是诚实 fallback 还是假 LIVE;🟢=未见 mock 信号)"
echo ""

TOUCHED=0; TOTAL=0; declare -a YELLOW_DEPTS=()
for entry in "${DEPTS[@]}"; do
  name="${entry%%|}"; name="${entry%%|*}"
  paths="${entry#*|}"
  TOTAL=$((TOTAL+1))
  # 只扫存在的路径
  existing=""
  for p in $paths; do [ -e "$p" ] && existing="$existing $p"; done
  if [ -z "$existing" ]; then
    printf "  ⚪ %-12s (无对应目录,跳过)\n" "$name"
    continue
  fi
  hits=$(grep -rlnE "$MOCK_PAT" $existing --include=*.ts --include=*.tsx 2>/dev/null | grep -vE "\.nodetest\.|\.test\.|\.spec\." || true)
  if [ -n "$hits" ]; then
    TOUCHED=$((TOUCHED+1))
    YELLOW_DEPTS+=("$name")
    cnt=$(printf '%s\n' "$hits" | grep -c . )
    printf "  🟡 %-12s 碰 mock 的文件 %s 个,人工核:\n" "$name" "$cnt"
    printf '%s\n' "$hits" | sed 's|^|       |' | head -4
  else
    printf "  🟢 %-12s 未见 mock 信号\n" "$name"
  fi
done

echo ""
echo "── 异动雷达(vs baseline·deming 记分板) ──"
BASELINE="$REPO/scripts/censor-depts-baseline.txt"
REGRESSED=0
if [ -f "$BASELINE" ]; then
  for d in ${YELLOW_DEPTS[@]+"${YELLOW_DEPTS[@]}"}; do
    grep -qxF "$d" "$BASELINE" 2>/dev/null || { echo "  🔴 假数据回潮异动:【$d】新碰 mock(不在 baseline,必查!)"; REGRESSED=$((REGRESSED+1)); }
  done
  while IFS= read -r b; do
    [ -z "$b" ] && continue
    printf '%s\n' ${YELLOW_DEPTS[@]+"${YELLOW_DEPTS[@]}"} | grep -qxF "$b" || echo "  🟢 进展:【$b】已转真,可从 baseline 移除(记分板向零)"
  done < "$BASELINE"
  [ "$REGRESSED" = 0 ] && echo "  ✅ 无回潮:碰 mock 部门未超出 baseline 已知 backlog"
else
  printf '%s\n' ${YELLOW_DEPTS[@]+"${YELLOW_DEPTS[@]}"} > "$BASELINE"
  echo "  (首次:已把本次 🟡 集写入 baseline → $BASELINE,下次起做回潮检测)"
fi
echo ""
echo "── 裁断 ──"
if [ "$REGRESSED" -gt 0 ]; then
  echo "🔴 $TOUCHED/$TOTAL 碰 mock,其中 $REGRESSED 处【回潮异动】超出 baseline — 必查(有人新加了假数据)。"
else
  echo "🟡 $TOUCHED/$TOTAL 碰 mock(均在 baseline 已知 backlog,无新回潮)。逐一人工核:诚实 fallback 还是假 LIVE。"
fi
echo "（御史只点位置不替你判真伪;baseline=已批准/待办的 backlog,新碰 mock=回潮。记分板目标:baseline 向零。）"
exit $([ "$REGRESSED" -gt 0 ] && echo 1 || echo 0)
