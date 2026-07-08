#!/usr/bin/env bash
# 部门学习 · 假数据监控（2026-06-20 立）
#
# 随时回答两问:
#   1. 影子导师 advisor 喂进 orchestrate 的数据,是真学习还是种子/残留?(RULE_SEED/unknown = 假)
#   2. C1 污染清干净没?(tasks 里不该再有 department_learning_% 残留)
#
# 只读查询,不写库、不碰任何会话的在途工作。dev 默认库,可 DB=路径 覆盖。
set -euo pipefail
DB="${DB:-$(dirname "$0")/../.chaotang-main-dev.db}"
[ -f "$DB" ] || { echo "DB 不存在: $DB"; exit 1; }
q() { sqlite3 -readonly "$DB" "$1" 2>/dev/null; }

echo "=== 部门学习假数据监控 · $(date '+%Y-%m-%d %H:%M:%S') · $DB ==="

POLLUTE=$(q "SELECT COUNT(*) FROM tasks WHERE id LIKE 'department_learning_%';")
TOP20=$(q "SELECT COUNT(*) FROM (SELECT id FROM tasks ORDER BY created_at DESC LIMIT 20) WHERE id LIKE 'department_learning_%';")
TODAY=$(q "SELECT COUNT(*) FROM tasks WHERE id LIKE 'department_learning_%' AND status IN('completed','reviewed','archived') AND date(updated_at)=date('now');")
DLT=$(q "SELECT COUNT(*) FROM department_learning;" || echo 0)
# confirmed/refuted = 已下定论的学习。GROUNDED = 有 real_source 证据 + PRIMARY(真) ; 否则伪造。
CONFIRMED=$(q "SELECT COUNT(*) FROM department_learning WHERE json_extract(record_json,'\$.verdict') IN ('confirmed','refuted');" || echo 0)
GROUNDED=$(q "SELECT COUNT(*) FROM department_learning WHERE json_extract(record_json,'\$.verdict') IN ('confirmed','refuted') AND json_extract(record_json,'\$.sourceLabel')='PRIMARY' AND record_json LIKE '%real_source%';" || echo 0)
FAKE=$((CONFIRMED - GROUNDED))

echo "C1 残留(tasks 里 department_learning_%):      $POLLUTE   ← 应为 0(迁移会在下次启动自动清)"
echo "  其中污染「最新20奏折」:                     $TOP20"
echo "  其中污染「今日已办」completed_today:        $TODAY"
echo "独立表 department_learning 记录数:            $DLT"
echo "已下定论(confirmed/refuted):                 $CONFIRMED"
echo "  其中有真实结果源证据(grounded·PRIMARY):    $GROUNDED"
echo "  伪造(下了定论却无 real_source 证据):        $FAKE   ← >0 才是真该报警的假数据"
echo ""
VERDICT="OK"
[ "$POLLUTE" -gt 0 ] && { echo "🔴 C1 污染未清:$POLLUTE 条残留正在污染朝报(待 server 重启跑迁移自动清)。"; VERDICT="DIRTY"; }
if [ "$FAKE" -gt 0 ]; then
  echo "🔴 伪造学习:$FAKE 条 confirmed/refuted 没有 real_source 双证据 —— 真该报警,有人在没证据时下定论。"
  VERDICT="FAKE"
elif [ "$CONFIRMED" -eq 0 ]; then
  echo "🟢 诚实待命:暂无真实学习(全种子/观察),但 real-source 拒绝无证据写 confirmed —— 这是诚实的空,不是造假。待第一条真决策签核+归档。"
  [ "$VERDICT" = "OK" ] && VERDICT="HONEST-WAITING"
else
  echo "🟢 真实学习:$GROUNDED 条 confirmed/refuted 均有 real_source 双证据支撑。"
fi
echo "判定: $VERDICT"
