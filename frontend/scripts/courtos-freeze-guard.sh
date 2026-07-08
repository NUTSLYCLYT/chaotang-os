#!/bin/bash
# CourtOS 部门学习·安全守护(2026-06-22 · 解冻做安全)
# 演进史:此锁原为"冻结守护"(铁律5 冻部门学习,grep 任何越界)。2026-06-22 蜂群产出修真后,
#   部门学习有了真燃料 → 经陛下治理决定「解冻 + 做安全」(Musk ②→③)。本锁随之从
#   "禁止存在"改为"查安全条件":学习可以活、可以从签核学,但两条红线不可破:
#     ① 不得有伪造证据的提权后门;② 让学习"喂决策"(重排部门)必须经 env 闸、默认关、可审计。
# 口头纪律必腐烂,机器纪律才长存。命中即 exit 1。
# 用法:bash scripts/courtos-freeze-guard.sh   (CI/pre-merge 可挂;退出码非0=有违规)
set -uo pipefail
cd "$(dirname "$0")/.." || exit 2

VIOL=0
red() { echo "  🔴 $1"; VIOL=$((VIOL + 1)); }

echo "═══ CourtOS 部门学习·安全守护 ═══"

# ── 锁1:CRITICAL 伪造后门不得复现 —— e2e-* evidenceId 凭空伪造双证据提权 ──
# 解冻 ≠ 开后门。学习只能认真实 boss_decision 签核链,不得有 NODE_ENV 旁路。
# 排除 *.nodetest.ts:回归断言里会写 isE2eEvidenceId(断言它不存在),不是后门本身。
if grep -rqs --include='*.ts' --exclude='*.nodetest.ts' "isE2eEvidenceId" src/lib/department-learning/ 2>/dev/null; then
  red "伪造后门复现:isE2eEvidenceId(real-source.ts)—— 非prod 用 e2e-* 可伪造'老板签核+史馆归档'双证据提权。解冻≠开后门,必须移除。"
fi

# ── 锁2:CRITICAL 决策影响必须有闸 —— 学习喂决策(重排部门)须经 env 闸、默认关 ──
# 学习"观测/记录"已解冻放行;但让 verdict 重排部门/喂军机处=给裁决加权重(铁律4 高危),
# 必须经 DEPARTMENT_LEARNING_FEED_DECISIONS 开关(默认关、可审计、可回滚),不得无闸直喂。
# grep 锁在「数据加载根」loadAdvisorSignals(而非排序函数名)——会审 HIGH:
# 锁排序函数名可被"换个 wrapper 名喂决策"绕过;锁加载根则只要 orchestrate 碰学习信号就必须有闸。
if grep -rqsE "loadAdvisorSignals" src/app/api/court/orchestrate/ 2>/dev/null; then
  if ! grep -rqs "DEPARTMENT_LEARNING_FEED_DECISIONS" src/app/api/court/orchestrate/ 2>/dev/null; then
    red "决策影响未加闸:orchestrate 加载部门学习信号(loadAdvisorSignals)重排部门,却无 DEPARTMENT_LEARNING_FEED_DECISIONS 环境闸。学习喂决策必须可开关、默认关、可审计(铁律4)。"
  fi
fi

echo ""
if [ "$VIOL" -gt 0 ]; then
  echo "❌ 学习安全守护:$VIOL 条红线越界。"
  echo "   解冻后两条不可破:① 无伪造后门;② 喂决策必须经 env 闸默认关。修复后本锁转绿。"
  exit 1
fi
echo "✅ 学习安全守护:无后门、决策影响有闸(或未喂决策)。"
exit 0
