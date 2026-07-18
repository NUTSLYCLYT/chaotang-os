"""find_memorial_contract_violations 自身要能真的抓到缺字段,不只是在合法
数据上不报错——2026-07-18 的教训是"回归测试用手写 fixture 巧合掩盖了真实
缺陷",这里反过来验证校验器本身对已知会让前端崩的缺陷保持敏感。"""

from __future__ import annotations

from src.shangshufang_memorial_contract import find_memorial_contract_violations

_VALID_MEMORIAL = {
    "title": "门下省封驳纪要",
    "verdict": "已封驳",
    "summary": "summary",
    "ministry_outputs": [],
    "conflict_summary": [
        {"type": "human_signoff", "summary": "s", "departments": [], "source_label": "FALLBACK"}
    ],
    "evidence_gaps": [],
    "risk_flags": ["门下省封驳"],
    "decision_options": [],
    "next_best_action": "await_human_signoff",
    "source_label": "FALLBACK",
    "quality_gate": {
        "passed": False,
        "status": "blocked",
        "reasons": ["门下省封驳"],
        "human_signoff_required": True,
    },
}


def test_valid_memorial_has_no_violations():
    assert find_memorial_contract_violations(_VALID_MEMORIAL) == []


def test_missing_top_level_field_is_caught():
    memorial = {k: v for k, v in _VALID_MEMORIAL.items() if k != "decision_options"}
    violations = find_memorial_contract_violations(memorial)
    assert any("decision_options" in v for v in violations)


def test_missing_conflict_summary_departments_is_caught():
    # 2026-07-18 真实复现过的崩溃:unique(item.departments).map(...) on undefined
    memorial = {
        **_VALID_MEMORIAL,
        "conflict_summary": [{"type": "human_signoff", "summary": "s", "source_label": "FALLBACK"}],
    }
    violations = find_memorial_contract_violations(memorial)
    assert any("conflict_summary[0]" in v and "departments" in v for v in violations)


def test_missing_quality_gate_passed_is_caught():
    # 2026-07-18 真实复现过的问题:explicitGate() 只认 passed,不认 status，
    # 漏填 passed 会让 overallSignal 判成 'unknown' 而不是真实的阻断/通过。
    memorial = {
        **_VALID_MEMORIAL,
        "quality_gate": {
            "status": "blocked",
            "reasons": ["x"],
            "human_signoff_required": True,
        },
    }
    violations = find_memorial_contract_violations(memorial)
    assert any("passed" in v for v in violations)


def test_missing_quality_gate_required_string_field_is_caught():
    memorial = {
        **_VALID_MEMORIAL,
        "quality_gate": {"passed": False, "human_signoff_required": True},
    }
    violations = find_memorial_contract_violations(memorial)
    assert any("quality_gate" in v and "status" in v for v in violations)
    assert any("quality_gate" in v and "reasons" in v for v in violations)


# ── 2026-07-18 第七轮:光查"字段在不在"不够,字段在、类型不对一样会崩或
# 静默误判。以下几条是上一版校验器会漏放行的假阴性,现在补上类型检查。


def test_conflict_summary_wrong_type_is_caught_not_silently_passed():
    # 上一版:isinstance(conflict_summary, list) 为 False 时直接跳过检查，
    # 字符串会被判成"合法"。真实前端 memorial.conflict_summary.flatMap(...)
    # 对字符串直接崩(没有 .flatMap 方法)。
    memorial = {**_VALID_MEMORIAL, "conflict_summary": "not a list"}
    violations = find_memorial_contract_violations(memorial)
    assert any("conflict_summary" in v and "类型错误" in v for v in violations)


def test_conflict_summary_entry_departments_wrong_type_is_caught():
    # departments 给字符串而不是数组——上一版只查 "departments" in entry，
    # 键在就算过，字符串照样让 unique(item.departments).map(...) 崩
    # (字符串没有 .map 方法)。
    memorial = {
        **_VALID_MEMORIAL,
        "conflict_summary": [
            {"type": "human_signoff", "summary": "s", "departments": "not a list", "source_label": "FALLBACK"}
        ],
    }
    violations = find_memorial_contract_violations(memorial)
    assert any("conflict_summary[0]" in v and "departments" in v and "类型错误" in v for v in violations)


def test_quality_gate_passed_wrong_type_is_caught_not_silently_passed():
    # passed 给字符串 "false"(真值)而不是布尔值 False——上一版只查
    # "passed" in quality_gate，键在就算过。前端 explicitGate() 用
    # typeof passed === 'boolean' 严格判定，字符串会被当成"没给"，静默退化
    # 成 overallSignal='unknown'，不报错但结果是错的——这正是"误判"而不是
    # "崩溃"，比崩溃更难在测试里发现。
    memorial = {
        **_VALID_MEMORIAL,
        "quality_gate": {**_VALID_MEMORIAL["quality_gate"], "passed": "false"},
    }
    violations = find_memorial_contract_violations(memorial)
    assert any("passed" in v and "类型错误" in v for v in violations)


def test_quality_gate_wrong_type_at_top_level_is_caught():
    # quality_gate 本身不是对象——上一版顶层检查只查"键在不在"，不查类型，
    # quality_gate: null 会被判成"字段存在"，然后 isinstance(quality_gate,
    # dict) 为 False 时子字段检查全被跳过，整体判成合法。
    memorial = {**_VALID_MEMORIAL, "quality_gate": None}
    violations = find_memorial_contract_violations(memorial)
    assert any("quality_gate" in v and "类型错误" in v for v in violations)


def test_ministry_outputs_wrong_type_is_caught():
    memorial = {**_VALID_MEMORIAL, "ministry_outputs": {}}
    violations = find_memorial_contract_violations(memorial)
    assert any("ministry_outputs" in v and "类型错误" in v for v in violations)


def test_title_wrong_type_is_caught():
    memorial = {**_VALID_MEMORIAL, "title": None}
    violations = find_memorial_contract_violations(memorial)
    assert any("title" in v and "类型错误" in v for v in violations)


def test_memorial_itself_not_a_dict_is_caught():
    assert find_memorial_contract_violations("not a dict") != []
    assert find_memorial_contract_violations([]) != []
    assert find_memorial_contract_violations(None) != []
