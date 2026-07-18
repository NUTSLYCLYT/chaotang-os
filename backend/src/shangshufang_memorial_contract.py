"""ShangshufangReviewMemorial 必填字段契约(镜像 frontend/src/lib/jiqun-api.ts)。

前端 canonical-read-model.ts / canonical-memorial-view.ts 对这些字段做无条件
解引用(.map/.filter/展开),漏填不是"数据不完整"这种软失败,是直接 TypeError
崩溃。Python 端没有编译期类型检查能拦住这类遗漏,这里补一个运行期契约校验,
供 pytest 断言用,也供 backfill 脚本复用同一份判定逻辑,避免两边校验标准走漂。

2026-07-18 实测教训:decision_options / evidence_gaps / next_best_action /
source_label / quality_gate.passed / quality_gate.blocking_issues /
conflict_summary[].departments 六轮里挨个漏过一遍——不是靠人工再挨个记住
"这次是不是又漏了什么",而是这份契约以后每次都完整校验一遍。
"""

from __future__ import annotations

from typing import Any

MEMORIAL_REQUIRED_TOP_LEVEL_FIELDS: tuple[str, ...] = (
    "title",
    "verdict",
    "summary",
    "ministry_outputs",
    "conflict_summary",
    "evidence_gaps",
    "risk_flags",
    "decision_options",
    "next_best_action",
    "source_label",
    "quality_gate",
)

CONFLICT_SUMMARY_ENTRY_REQUIRED_FIELDS: tuple[str, ...] = (
    "type",
    "summary",
    "departments",
    "source_label",
)

QUALITY_GATE_REQUIRED_FIELDS: tuple[str, ...] = (
    "status",
    "reasons",
    "human_signoff_required",
)


def find_memorial_contract_violations(memorial: dict[str, Any]) -> list[str]:
    """返回违反契约的描述列表;空列表代表合法,可以安全喂给前端。"""
    violations: list[str] = []

    for field in MEMORIAL_REQUIRED_TOP_LEVEL_FIELDS:
        if field not in memorial:
            violations.append(f"缺顶层必填字段: {field}")

    conflict_summary = memorial.get("conflict_summary")
    if isinstance(conflict_summary, list):
        for index, entry in enumerate(conflict_summary):
            if not isinstance(entry, dict):
                violations.append(f"conflict_summary[{index}] 不是对象")
                continue
            for field in CONFLICT_SUMMARY_ENTRY_REQUIRED_FIELDS:
                if field not in entry:
                    violations.append(f"conflict_summary[{index}] 缺必填字段: {field}")

    quality_gate = memorial.get("quality_gate")
    if isinstance(quality_gate, dict):
        for field in QUALITY_GATE_REQUIRED_FIELDS:
            if field not in quality_gate:
                violations.append(f"quality_gate 缺必填字段: {field}")
        # passed 不在 TS 必填列表(quality_gate.passed?: boolean),但
        # explicitGate() 只读这个字段判定 overallSignal,不读 status 字符串
        # ——不显式给一个布尔值,前端会判成 'unknown' 而不是真实的通过/阻断。
        if "passed" not in quality_gate:
            violations.append("quality_gate 缺 passed(explicitGate() 只认这个布尔值,不认 status 字符串)")

    return violations
