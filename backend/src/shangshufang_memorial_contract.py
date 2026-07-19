"""ShangshufangReviewMemorial 必填字段契约(镜像 frontend/src/lib/jiqun-api.ts)。

前端 canonical-read-model.ts / canonical-memorial-view.ts 对这些字段做无条件
解引用(.map/.filter/展开),漏填不是"数据不完整"这种软失败,是直接 TypeError
崩溃。Python 端没有编译期类型检查能拦住这类遗漏,这里补一个运行期契约校验,
供 pytest 断言用,也供 backfill 脚本复用同一份判定逻辑,避免两边校验标准走漂。

2026-07-18 实测教训(九轮里挨个撞出来的,不是设计时就想全的——每次以为查完了,
下一层就被指出来):
- decision_options / evidence_gaps / next_best_action / source_label /
  quality_gate.passed / conflict_summary[].departments 先后漏填(字段层)。
- 字段在、类型不对一样会崩或悄悄误判(容器类型层):conflict_summary 给个
  字符串,`.flatMap()` 照样崩;quality_gate.passed 给个 "false" 字符串,
  `typeof passed === 'boolean'` 判定失败会静默退化成"未知"。
- 容器是 list 不代表元素类型也对(元素类型层):evidence_gaps 是 list 但
  装了个数字,`unique()` 对每个元素调 `.trim()`,数字没有这个方法照样崩。
- 对象数组元素只查"是不是 dict"不够(嵌套字段层):ministry_outputs 元素是
  dict,但内部 department/opinion 这些字段本身也可能缺失或类型错，一样会
  影响渲染。

这一版改成递归 schema 校验,不再对每一层新维度单独写一段特判代码——嵌套多
深都用同一套 _check_value/_check_schema 递归下去,不用再指望"这次真的想全
了",下次真出现新的嵌套结构也是同一套代码覆盖,不用再加一层特判。
"""

from __future__ import annotations

from typing import Any, Union

# Schema:字段名 → (期望类型, nested)。
# nested 的含义随 expected_type 变化:
#   expected_type 是 dict 时,nested 是子 Schema(校验这个对象内部字段)或 None(不深查)。
#   expected_type 是 list 时,nested 是元素期望类型(str/bool 等原始类型)，
#     或子 Schema(元素本身是对象,递归校验),或 None(不查元素)。
#   expected_type 是 str/bool 等标量时,nested 恒为 None。
FieldSpec = tuple[str, type, Union["Schema", type, None]]
Schema = tuple[FieldSpec, ...]

MINISTRY_OUTPUT_ITEM_FIELDS: Schema = (
    ("department", str, None),
    ("focus", str, None),
    ("opinion", str, None),
    ("status", str, None),
    ("source_label", str, None),
)

DECISION_OPTION_ITEM_FIELDS: Schema = (
    ("action", str, None),
    ("label", str, None),
    ("reason", str, None),
    ("enabled", bool, None),
)

CONFLICT_SUMMARY_ENTRY_FIELDS: Schema = (
    ("type", str, None),
    ("summary", str, None),
    ("departments", list, str),
    ("source_label", str, None),
)

QUALITY_GATE_FIELDS: Schema = (
    ("status", str, None),
    ("reasons", list, str),
    ("human_signoff_required", bool, None),
    # passed 在 TS 里是 quality_gate.passed?: boolean(非必填),但
    # explicitGate() 只读这个字段判定 overallSignal,不读 status 字符串——
    # 缺了它前端会判成"未知"而不是真实的通过/阻断,功能上等同必填,这里按
    # 必填处理。
    ("passed", bool, None),
)

MEMORIAL_SCHEMA: Schema = (
    ("title", str, None),
    ("verdict", str, None),
    ("summary", str, None),
    ("ministry_outputs", list, MINISTRY_OUTPUT_ITEM_FIELDS),
    ("conflict_summary", list, CONFLICT_SUMMARY_ENTRY_FIELDS),
    ("evidence_gaps", list, str),
    ("risk_flags", list, str),
    ("decision_options", list, DECISION_OPTION_ITEM_FIELDS),
    ("next_best_action", str, None),
    ("source_label", str, None),
    ("quality_gate", dict, QUALITY_GATE_FIELDS),
)


def _matches_type(value: Any, expected_type: type) -> bool:
    # bool 是 int 的子类,isinstance(True, int) 也是 True——bool 必须单独
    # 判定,否则 0/1 会被误判成合法的 bool,真布尔值也可能混进别的类型检查。
    if expected_type is bool:
        return isinstance(value, bool)
    return isinstance(value, expected_type)


def _check_value(
    value: Any,
    expected_type: type,
    nested: "Schema | type | None",
    *,
    where: str,
    violations: list[str],
) -> None:
    if not _matches_type(value, expected_type):
        note = (
            "(前端用 typeof x === 'boolean' 严格判定,类型不对会被当成缺失,静默误判)"
            if expected_type is bool
            else ""
        )
        violations.append(
            f"{where} 类型错误: 期望 {expected_type.__name__},实际 {type(value).__name__}{note}"
        )
        return

    if expected_type is list and nested is not None:
        for index, item in enumerate(value):
            item_where = f"{where}[{index}]"
            if isinstance(nested, type):
                if not _matches_type(item, nested):
                    violations.append(
                        f"{item_where} 元素类型错误: 期望 {nested.__name__},实际 {type(item).__name__}"
                    )
            else:  # nested 是子 Schema,元素本身应该是对象
                if not isinstance(item, dict):
                    violations.append(f"{item_where} 不是对象: {type(item).__name__}")
                else:
                    _check_schema(item, nested, where=item_where, violations=violations)
    elif expected_type is dict and nested is not None:
        _check_schema(value, nested, where=where, violations=violations)  # type: ignore[arg-type]


def _check_schema(
    obj: dict[str, Any], schema: Schema, *, where: str, violations: list[str]
) -> None:
    for field, expected_type, nested in schema:
        field_where = f"{where}.{field}"
        if field not in obj:
            # field_where(点号连接)而不是 where——跟下面类型错误分支的措辞
            # 保持一致,方便按 "路径.字段名" 整串检索,不用记两种不同格式。
            violations.append(f"{field_where} 缺必填字段")
            continue
        _check_value(obj[field], expected_type, nested, where=field_where, violations=violations)


def find_memorial_contract_violations(memorial: Any) -> list[str]:
    """返回违反契约的描述列表;空列表代表合法,可以安全喂给前端。"""
    if not isinstance(memorial, dict):
        return [f"memorial 本身不是对象: {type(memorial).__name__}"]
    violations: list[str] = []
    _check_schema(memorial, MEMORIAL_SCHEMA, where="memorial", violations=violations)
    return violations
