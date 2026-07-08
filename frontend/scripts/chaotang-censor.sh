#!/usr/bin/env bash
# 朝堂御史台 · 只读巡查(确定性,无 LLM) → 一份合成朝报 + 弹劾 + 心跳
#
# 铁律(顶尖大神定):
#   1. 御史只观察 + 报告 + 弹劾,绝不下场执行/改码/kill 进程。本脚本纯 read-only。
#   2. 确定性优先(Karpathy):端口/build/git/红线回潮是 grep/curl/ss 的活,不是 LLM 的活。
#      LLM 的判断力只该用在"这堆信号里哪条值得吵醒老板"——那一层交给 Hermes 转发时再判。
#   3. 默认怀疑、缺席即告警(schneier):该活没活 = 红/黄,绝不沉默;无恙也要明说"今日无恙"。
#   4. 一份合成朝报:单一窗口,信号不稀释。
#
# 用法: bash scripts/chaotang-censor.sh   (或 pnpm censor)
# 退出码: 0=无恙/小恙(黄), 1=有恙(红)。Hermes/cron 可据此决定是否吵醒你。
# env 开关:
#   CENSOR_PROD_EXPECTED=1  上线后置 1:prod(:3050)未起从🟡升🔴
#   CENSOR_RUN_GATES=1      额外跑 tsc+test:node(慢,默认跳)

set -uo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO"
HEARTBEAT="${CHAOTANG_CENSOR_HEARTBEAT:-/tmp/chaotang-censor-heartbeat}"
RED=0; YELLOW=0; declare -a IMPEACH=()

red()    { RED=$((RED+1));    IMPEACH+=("$1"); printf '🔴 %s\n' "$1"; }
yellow() { YELLOW=$((YELLOW+1));               printf '🟡 %s\n' "$1"; }
green()  {                                     printf '🟢 %s\n' "$1"; }
sect()   { printf '\n── %s ──\n' "$1"; }

port_up() { ss -tlnp 2>/dev/null | grep -q ":$1[[:space:]]"; }
http_code() { curl -s -o /dev/null -w '%{http_code}' --max-time 4 --noproxy 127.0.0.1,localhost "$1" 2>/dev/null || echo 000; }

echo "════════════════════════════════════════════"
echo "  朝堂御史朝报 · $(date '+%Y-%m-%d %H:%M:%S')"
echo "════════════════════════════════════════════"

# ── 1. 端口/服务健康(默认怀疑) ──
sect "健康巡查"
if port_up 8081; then
  green "jiqun :8081 在岗"
  # 验签姿态:无 token 打受保护端点,200=验签关(裸奔,伪造 token 能穿墙)
  jcode=$(http_code "http://127.0.0.1:8081/api/chaotang/study/briefing")
  if [ "$jcode" = "200" ]; then
    if [ "${CENSOR_PROD_EXPECTED:-0}" = "1" ]; then red "jiqun 验签关闭(无token→200,FENGQUN_AUTH=false):公网裸奔!伪造 token 能穿墙,上线前必开"; else yellow "jiqun 验签关闭(dev 态 FENGQUN_AUTH=false);上公网前必须 FENGQUN_AUTH=true(否则验签门形同虚设)"; fi
  elif [ "$jcode" = "401" ] || [ "$jcode" = "403" ]; then green "jiqun 验签开启(无token→$jcode,伪造 token 被挡)"; fi
else red "jiqun :8081 未监听(后端核心 down)"; fi
if port_up 4444; then green "LiteLLM :4444 在岗"; else red "LiteLLM :4444 未监听(模型网关 down)"; fi
if port_up 3002; then green "Next dev :3002 在岗"; else yellow "Next dev :3002 未起(本地开发态,可忽略)"; fi
if port_up 3050; then green "Next prod :3050 在岗"; else
  if [ "${CENSOR_PROD_EXPECTED:-0}" = "1" ]; then red "Next prod :3050 未监听(已上线却 down!)"; else yellow "Next prod :3050 未起(未上线;上线后置 CENSOR_PROD_EXPECTED=1 升红)"; fi
fi
if port_up 3050; then
  code=$(http_code "http://127.0.0.1:3050/chaotang/court-briefing")
  [[ "$code" =~ ^(200|401|308)$ ]] && green "prod HTTP 响应 $code" || red "prod 端口活但 HTTP 异常($code)"
fi

# ── 2. git / 发布态 ──
sect "发布态"
BR=$(git branch --show-current 2>/dev/null || echo '?')
DIRTY=$(git status --porcelain 2>/dev/null | grep -vcE 'dock-snapshot|\.playwright-mcp|\.next-buildcheck|settings\.local' || true)
green "分支 $BR"
git fetch origin master --quiet 2>/dev/null || yellow "git fetch origin master 失败(网络?)"
AHEAD=$(git rev-list --count origin/master..HEAD 2>/dev/null || echo '?')
[ "$AHEAD" != "0" ] && [ "$AHEAD" != "?" ] && yellow "领先 origin/master $AHEAD 个提交(未合 master = 未上线)" || green "与 origin/master 同步"
[ "${DIRTY:-0}" != "0" ] && yellow "工作树有 $DIRTY 处未提交改动" || green "工作树净"

# ── 3. 诚实纠察(异动雷达·弹劾) ──
sect "诚实纠察"
# 3a 假数据 mock 路由回潮(精确信号:8ad3c13 删的那个文件是否复活;不用宽 grep 免误报合法 planning 态)
if [ -f "src/app/api/tasks/[taskId]/route.ts" ]; then
  red "假数据 mock 路由回潮:/api/tasks/[id] 复活(8ad3c13 删的那个永返 status:'planning' 假路由)— 人工核是否又是假数据"
else green "假数据 mock 路由(/api/tasks/[id])仍不在"; fi
# 3b API_MODE 诚实总开关
if grep -q "?? 'real'" src/lib/api/client.ts 2>/dev/null; then green "API_MODE 默认仍 'real'"; else red "API_MODE 默认被改离 'real'(#2 诚实开关被动)"; fi
# 3c 前端直连重型上游(引擎边界红线;要求端口在引号串里=真 URL,排除注释/工厂注释,免误报)
HITS=$(grep -rnE "['\"\`][^'\"\`]*(:18789|:8644)" src/ --include=*.ts --include=*.tsx 2>/dev/null | grep -vE "live-swarm-adapter-factory" || true)
if [ -n "$HITS" ]; then red "疑似前端直连重型网关(:18789/:8644),违引擎边界13.2-9 — 人工核:"; printf '     %s\n' "$HITS" | head -3; else green "无前端直连 :18789/:8644"; fi
# 3d 验签门 fail-closed 仍在
if grep -q "fail-closed" src/lib/auth/backend-verify.ts 2>/dev/null; then green "验签门 fail-closed 仍在"; else red "验签门 fail-closed 被移除(裸奔风险)"; fi
# 3e 治理原语红线哨兵(2026-06-25 大神设计落地的核心原语,红线回潮即弹劾——御史本体形态)
GOV_OK=1
gov_chk() { if [ -f "$1" ] && grep -q "$2" "$1" 2>/dev/null; then :; else red "治理红线回潮:$3"; GOV_OK=0; fi; }
gov_chk "src/core/courtos/chancellor/mandate.ts" "validateMandate" "丞相拟旨三必填校验(validateMandate)缺失"
gov_chk "src/core/courtos/chancellor/mandate.ts" "steelmanAgainst" "丞相拟旨自我反驳位(steelman)缺失"
# 门下语义 2026-06-28 后住 court-pipeline(LLM驳议·fail-closed);旧确定性闸 menxia-gate.ts 已退役入 dev/_attic
gov_chk "src/lib/orchestration/court-pipeline.ts" "保守判再议" "门下封驳fail-closed(失败绝不放行)缺失"
gov_chk "src/lib/orchestration/court-pipeline.nodetest.ts" "禁带 score" "门下闸禁score/draft回归断言缺失"
# 部门蜂群派发守门(2026-07-06 会审 CRITICAL 修复):任何调 dispatchDeptToSwarm 的 route 必过守门,否则匿名烧钱+admin提权
NAKED=$(grep -rl dispatchDeptToSwarm src/app --include=route.ts 2>/dev/null | while read -r f; do grep -q requireCourtSwarmAuth "$f" || echo "$f"; done)
[ -n "$NAKED" ] && { red "蜂群派发 route 缺守门(匿名烧钱+admin提权):$NAKED"; GOV_OK=0; }
gov_chk "src/core/courtos/qintian/tail-audit.ts" "assessRuin" "钦天监死法地图(assessRuin)缺失"
gov_chk "src/core/courtos/qintian/tail-audit.ts" "亏不起" "钦天监ruin红线缺失"
[ "$GOV_OK" = "1" ] && green "治理原语红线齐(丞相三必填/门下禁score-draft/钦天监ruin红线)"

# ── 4. 门禁哨兵(慢,默认跳) ──
if [ "${CENSOR_RUN_GATES:-0}" = "1" ]; then
  sect "门禁哨兵"
  # 注:grep -c 数到 0 时退出码为 1,不能接 || echo '?'(会把全绿报成红);空值才是真异常(timeout 等)
  TSC_ERR=$(timeout 320 pnpm exec tsc --noEmit 2>&1 | grep -c 'error TS'); [ -z "$TSC_ERR" ] && TSC_ERR='?'
  [ "$TSC_ERR" = "0" ] && green "tsc 0 错" || red "tsc $TSC_ERR 错"
  NODE_FAIL=$(timeout 200 pnpm test:node 2>&1 | grep -oE '# fail [0-9]+' | grep -oE '[0-9]+' | head -1); [ -z "$NODE_FAIL" ] && NODE_FAIL='?'
  [ "$NODE_FAIL" = "0" ] && green "test:node 全绿" || red "test:node 失败 $NODE_FAIL"
else
  printf '\n(门禁哨兵跳过;CENSOR_RUN_GATES=1 开启 tsc+test:node)\n'
fi

# ── 心跳(给看门狗) ──
date +%s > "$HEARTBEAT" 2>/dev/null || true

# ── 合成裁断 ──
sect "御史裁断"
if [ "$RED" -gt 0 ]; then
  echo "🔴 今日有恙:$RED 红 / $YELLOW 黄"
  echo "弹劾:"; printf '  • %s\n' "${IMPEACH[@]}"
  exit 1
elif [ "$YELLOW" -gt 0 ]; then
  echo "🟡 今日小恙:$YELLOW 黄(无红,可缓)"
  exit 0
else
  echo "🟢 今日无恙 —— 御史已巡毕,一切如常"
  exit 0
fi
