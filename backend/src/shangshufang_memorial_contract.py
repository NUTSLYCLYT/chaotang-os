"""ShangshufangReviewMemorial 必填字段契约(镜像 frontend/src/lib/jiqun-api.ts)。

前端 canonical-read-model.ts / canonical-memorial-view.ts 对这些字段做无条件
解引用(.map/.filter/展开),漏填不是"数据不完整"这种软失败,是直接 TypeError
崩溃。Python 端没有编译期类型检查能拦住这类遗漏,这里补一个运行期契约校验,
供 pytest 断言用,也供 backfill 脚本复用同一份判定逻辑,避免两边校验标准走漂。

2026-07-18 实测教训(八轮里挨个撞出来的,不是设计时就想全的):
- decision_options / evidence_gaps / next_best_action / source_label /
  quality_gate.passed / conflict_summary[].departments 先后漏填。
- 只查"字段在不在"不够:字段在、类型不对一样会崩或悄悄误判——
  conflict_summary 给个字符串而不是数组,`item.departments.map()` 照样崩;
  quality_gate.passed 给个 "false" 字符串而不是布尔值,前端
  `typeof passed === 'boolean'` 判定失败会静默退化成"未知"而不是报错。
- 只查"数组本身是数组"不够,数组元素类型不对一样会崩:evidence_gaps 是
  list 但装了个数字,`unique()` 对每个元素调 `.trim()`,数字没有这个方法,
  照样崩——这一版补上数组元素级别的类型检查。
"""

from __future__ import annotations

from typing import Any

# 字段名 → (期望容器类型, 期望元素类型或 None)。
# 元素类型只在容器类型是 list 时有意义;dict/str/bool 字段留 None。
MEMORIAL_REQUIRED_TOP_LEVEL_FIELDS: tuple[tuple[str, type, type | None], ...] = (
    ("title", str, None),
    ("verdict", str, None),
    ("summary", str, None),
    ("ministry_outputs", list, dict),
    ("conflict_summary", list, dict),
    ("evidence_gaps", list, str),
    ("risk_flags", list, str),
    ("decision_options", list, dict),
    ("next_best_action", str, None),
    ("source_label", str, None),
    ("quality_gate", dict, None),
)

CONFLICT_SUMMARY_ENTRY_REQUIRED_FIELDS: tuple[tuple[str, type, type | None], ...] = (
    ("type", str, None),
    ("summary", str, None),
    ("departments", list, str),
    ("source_label", str, None),
)

QUALITY_GATE_REQUIRED_FIELDS: tuple[tuple[str, type, type | None], ...] = (
    ("status", str, None),
    ("reasons", list, str),
    ("human_signoff_required", bool, None),
)


def _matches_type(value: Any, expected_type: type) -> bool:
    # bool 是 int 的子类,isinstance(True, int) 也是 True——bool 必须单独
    # 判定,否则 0/1 会被误判成合法的 bool,真布尔值也可能混进别的类型检查。
    if expected_type is bool:
        return isinstance(value, bool)
    return isinstance(value, expected_type)


def _check_field(
    container: dict[str, Any],
    field: str,
    expected_type: type,
    item_type: type | None,
    *,
    where: str,
    violations: list[str],
) -> None:
    if field not in container:
        violations.append(f"{where} 缺必填字段: {field}")
        return
    value = container[field]
    if not _matches_type(value, expected_type):
        note = (
            "(前端用 typeof x === 'boolean' 严格判定,类型不对会被当成缺失,静默误判)"
            if expected_type is bool
            else ""
        )
        violations.append(
            f"{where}.{field} 类型错误: 期望 {expected_type.__name__},实际 {type(value).__name__}{note}"
        )
        return
    if item_type is not None and expected_type is list:
        for index, item in enumerate(value):
            if not _matches_type(item, item_type):
                violations.append(
                    f"{where}.{field}[{index}] 元素类型错误: 期望 {item_type.__name__},"
                    f"实际 {type(item).__name__}"
                )


def find_memorial_contract_violations(memorial: Any) -> list[str]:
    """返回违反契约的描述列表;空列表代表合法,可以安全喂给前端。"""
    violations: list[str] = []

    if not isinstance(memorial, dict):
        return [f"memorial 本身不是对象: {type(memorial).__name__}"]

    for field, expected_type, item_type in MEMORIAL_REQUIRED_TOP_LEVEL_FIELDS:
        _check_field(memorial, field, expected_type, item_type, where="memorial", violations=violations)

    conflict_summary = memorial.get("conflict_summary")
    if isinstance(conflict_summary, list):
        for index, entry in enumerate(conflict_summary):
            where = f"conflict_summary[{index}]"
            if not isinstance(entry, dict):
                violations.append(f"{where} 不是对象: {type(entry).__name__}")
                continue
            for field, expected_type, item_type in CONFLICT_SUMMARY_ENTRY_REQUIRED_FIELDS:
                _check_field(entry, field, expected_type, item_type, where=where, violations=violations)

    quality_gate = memorial.get("quality_gate")
    if isinstance(quality_gate, dict):
        for field, expected_type, item_type in QUALITY_GATE_REQUIRED_FIELDS:
            _check_field(quality_gate, field, expected_type, item_type, where="quality_gate", violations=violations)
        # passed 不在 TS 必填列表(quality_gate.passed?: boolean),但
        # explicitGate() 只读这个字段判定 overallSignal,不读 status 字符串
        # ——不显式给一个布尔值,前端会判成 'unknown' 而不是真实的通过/阻断。
        _check_field(quality_gate, "passed", bool, None, where="quality_gate", violations=violations)

    return violations
