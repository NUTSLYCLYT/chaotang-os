"""ShangshufangReviewMemorial 必填字段契约(镜像 frontend/src/lib/jiqun-api.ts)。

前端 canonical-read-model.ts / canonical-memorial-view.ts 对这些字段做无条件
解引用(.map/.filter/展开),漏填不是"数据不完整"这种软失败,是直接 TypeError
崩溃。Python 端没有编译期类型检查能拦住这类遗漏,这里补一个运行期契约校验,
供 pytest 断言用,也供 backfill 脚本复用同一份判定逻辑,避免两边校验标准走漂。

2026-07-18 实测教训(七轮里挨个撞出来的,不是设计时就想全的):
- decision_options / evidence_gaps / next_best_action / source_label /
  quality_gate.passed / conflict_summary[].departments 先后漏填。
- 只查"字段在不在"不够:字段在、类型不对一样会崩或悄悄误判——
  conflict_summary 给个字符串而不是数组,`item.departments.map()` 照样崩;
  quality_gate.passed 给个 "false" 字符串而不是布尔值,前端
  `typeof passed === 'boolean'` 判定失败会静默退化成"未知"而不是报错,
  这是误判,比崩溃更难发现。这份契约同时查"在不在"和"类型对不对"。
"""

from __future__ import annotations

from typing import Any

# 字段名 → 期望的 Python 类型(dict/list 装 JSON 反序列化后的原生类型;
# TS string 对应 Python str)。
MEMORIAL_REQUIRED_TOP_LEVEL_FIELDS: tuple[tuple[str, type], ...] = (
    ("title", str),
    ("verdict", str),
    ("summary", str),
    ("ministry_outputs", list),
    ("conflict_summary", list),
    ("evidence_gaps", list),
    ("risk_flags", list),
    ("decision_options", list),
    ("next_best_action", str),
    ("source_label", str),
    ("quality_gate", dict),
)

CONFLICT_SUMMARY_ENTRY_REQUIRED_FIELDS: tuple[tuple[str, type], ...] = (
    ("type", str),
    ("summary", str),
    ("departments", list),
    ("source_label", str),
)

QUALITY_GATE_REQUIRED_FIELDS: tuple[tuple[str, type], ...] = (
    ("status", str),
    ("reasons", list),
    ("human_signoff_required", bool),
)


def _check_field(
    container: dict[str, Any],
    field: str,
    expected_type: type,
    *,
    where: str,
    violations: list[str],
) -> None:
    if field not in container:
        violations.append(f"{where} 缺必填字段: {field}")
        return
    value = container[field]
    # bool 是 int 的子类,isinstance(True, int) 也是 True——顺序检查 bool
    # 优先,避免把 0/1 误判成合法的 bool,也避免把真布尔值误判成别的类型。
    if expected_type is bool:
        if not isinstance(value, bool):
            violations.append(
                f"{where}.{field} 类型错误: 期望 bool,实际 {type(value).__name__}"
                f"(前端用 typeof x === 'boolean' 严格判定,类型不对会被当成缺失,静默误判)"
            )
        return
    if not isinstance(value, expected_type):
        violations.append(
            f"{where}.{field} 类型错误: 期望 {expected_type.__name__},实际 {type(value).__name__}"
        )


def find_memorial_contract_violations(memorial: Any) -> list[str]:
    """返回违反契约的描述列表;空列表代表合法,可以安全喂给前端。"""
    violations: list[str] = []

    if not isinstance(memorial, dict):
        return [f"memorial 本身不是对象: {type(memorial).__name__}"]

    for field, expected_type in MEMORIAL_REQUIRED_TOP_LEVEL_FIELDS:
        _check_field(memorial, field, expected_type, where="memorial", violations=violations)

    conflict_summary = memorial.get("conflict_summary")
    if isinstance(conflict_summary, list):
        for index, entry in enumerate(conflict_summary):
            where = f"conflict_summary[{index}]"
            if not isinstance(entry, dict):
                violations.append(f"{where} 不是对象: {type(entry).__name__}")
                continue
            for field, expected_type in CONFLICT_SUMMARY_ENTRY_REQUIRED_FIELDS:
                _check_field(entry, field, expected_type, where=where, violations=violations)

    quality_gate = memorial.get("quality_gate")
    if isinstance(quality_gate, dict):
        for field, expected_type in QUALITY_GATE_REQUIRED_FIELDS:
            _check_field(quality_gate, field, expected_type, where="quality_gate", violations=violations)
        # passed 不在 TS 必填列表(quality_gate.passed?: boolean),但
        # explicitGate() 只读这个字段判定 overallSignal,不读 status 字符串
        # ——不显式给一个布尔值,前端会判成 'unknown' 而不是真实的通过/阻断。
        _check_field(quality_gate, "passed", bool, where="quality_gate", violations=violations)

    return violations
