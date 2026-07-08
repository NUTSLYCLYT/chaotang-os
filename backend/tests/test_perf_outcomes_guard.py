"""Performance-Outcomes 评分-返工环安全护栏的回归断言。

钉死 5 技巧 + 3 坑的不变量,纯函数离线可跑(无 LLM、无 DB)。
对应 src/perf_outcomes_guard.py。
"""

from __future__ import annotations

from src.perf_outcomes_guard import (
    accept_revision,
    bias_risk,
    clamp_revisions,
    enrich_quality_result,
    family_of,
    is_grader_stable,
    needs_human,
    parse_judge_verdict,
    pick_heterogeneous_grader,
    run_llm_judge,
    should_run_llm_judge,
)


# ---- 技巧2: 模型家族识别 + 异构裁判 ----
def test_family_of_known_models():
    assert family_of("claude-haiku-4-5") == "claude"
    assert family_of("opus") == "claude"
    assert family_of("swarm-deepseek-pro") == "deepseek"
    assert family_of("gpt-5.5") == "openai"
    assert family_of("codex-gpt-5.5") == "openai"
    assert (
        family_of("o1-mini") == "openai"
    )  # o1/o3 系列归 openai(词边界已防 proto1 误命中)
    assert family_of("o3-pro") == "openai"
    assert family_of("ollama-coder") == "local"
    assert family_of("qwen2.5") == "local"
    assert family_of(None) == "inherit"


# ---- 坑1: 自评偏袒 ----
def test_bias_risk_same_family_is_true():
    assert (
        bias_risk("swarm-deepseek-pro", "deepseek-chat") is True
    )  # 同 deepseek 家族 = 自评


def test_bias_risk_missing_grader_is_true():
    assert bias_risk("swarm-deepseek-pro", None) is True  # grader 未设 = 同 doer = 自评


def test_bias_risk_different_family_is_false():
    assert bias_risk("swarm-deepseek-pro", "claude-haiku-4-5") is False


def test_bias_risk_o1_series_same_openai_family():
    # 第二轮会审: o1 doer + o1 grader 同属 openai,不可互评
    assert bias_risk("o1-mini", "o1-pro") is True
    assert bias_risk("gpt-4o", "o1-mini") is True


def test_pick_heterogeneous_grader_returns_different_family():
    got = pick_heterogeneous_grader(
        "swarm-deepseek-pro", ["deepseek-chat", "claude-haiku-4-5"]
    )
    assert got == "claude-haiku-4-5"


def test_pick_heterogeneous_grader_none_when_all_same_family():
    assert (
        pick_heterogeneous_grader(
            "swarm-deepseek-pro", ["deepseek-chat", "deepseek-v3"]
        )
        is None
    )


# ---- 技巧1: 确定性闸前置短路(省 token) ----
def test_should_run_llm_judge_skips_when_deterministic_failed():
    assert should_run_llm_judge(deterministic_passed=False) is False  # 没过就别烧 LLM


def test_should_run_llm_judge_runs_when_deterministic_passed():
    assert should_run_llm_judge(deterministic_passed=True) is True


# ---- 坑3: maxRevisions 硬钳 ----
def test_clamp_revisions_bounds():
    assert clamp_revisions(5) == 3
    assert clamp_revisions(-1) == 0
    assert clamp_revisions(2) == 2


# ---- 坑3: champion 冠军机制(防越改越差 / token 黑洞) ----
def test_accept_revision_only_when_strictly_better_by_min_improvement():
    assert (
        accept_revision(champion_score=7.0, candidate_score=8.0, min_improvement=1.0)
        is True
    )


def test_accept_revision_rejects_regression():
    assert (
        accept_revision(champion_score=7.0, candidate_score=6.0, min_improvement=1.0)
        is False
    )


def test_accept_revision_rejects_tiny_improvement():
    assert (
        accept_revision(champion_score=7.0, candidate_score=7.5, min_improvement=1.0)
        is False
    )


def test_accept_revision_rejects_equal():
    assert (
        accept_revision(champion_score=7.0, candidate_score=7.0, min_improvement=1.0)
        is False
    )


# ---- 技巧5: 评分自一致性(防飘) ----
def test_is_grader_stable_within_tolerance():
    assert is_grader_stable([8.0, 8.0, 9.0], tolerance=2.0) is True  # spread 1 <= 2


def test_is_grader_unstable_when_spread_exceeds_tolerance():
    assert is_grader_stable([6.0, 9.0], tolerance=2.0) is False  # spread 3 > 2


def test_is_grader_stable_single_sample():
    assert is_grader_stable([8.0], tolerance=2.0) is True


# ---- 技巧5: 人在环兜底 ----
def test_needs_human_clean_pass_no_human():
    assert needs_human(passed=True, bias=False, grader_stable=True) is False


def test_needs_human_when_biased_even_if_passed():
    assert (
        needs_human(passed=True, bias=True, grader_stable=True) is True
    )  # 自评通过不可信


def test_needs_human_when_unstable():
    assert needs_human(passed=True, bias=False, grader_stable=False) is True


def test_needs_human_when_failed():
    assert needs_human(passed=False, bias=False, grader_stable=True) is True


# ---- 会审补缺(2026-06-25 独立 review 发现的盲点) ----
def test_bias_risk_unknown_doer_is_conservative():
    # 坑1 HIGH: doer 未指定时无法排除同家族 → 必须保守判有偏袒,否则护栏静默开闸
    assert bias_risk(None, "claude-haiku-4-5") is True
    assert bias_risk(None, "gpt-5") is True


def test_pick_heterogeneous_grader_none_when_doer_unknown():
    # doer 未知无法保证异构 → 返 None 让上层告警,不可乱选
    assert pick_heterogeneous_grader(None, ["claude-haiku-4-5", "gpt-5"]) is None


def test_family_of_no_false_positive():
    # 防误归类: algemmation 靠词边界正则不命中 gemma;local-bank 靠移除过宽的 'local' needle
    assert family_of("algemmation-x") == "algemmation-x"
    assert family_of("local-bank-api") == "local-bank-api"


def test_is_grader_stable_empty_is_false():
    # MEDIUM: 零采样无数据 ≠ 稳定
    assert is_grader_stable([]) is False


def test_clamp_revisions_inverted_bounds_raises():
    # MEDIUM: lo>hi 契约违反,直接报错不静默
    import pytest

    with pytest.raises(ValueError):
        clamp_revisions(2, lo=5, hi=3)


def test_needs_human_full_truth_table():
    # 钉死全 8 组合: 只有 (pass, 无偏, 稳) 才放行,其余一律转人工
    for passed in (True, False):
        for bias in (True, False):
            for stable in (True, False):
                expected = not (passed and not bias and stable)
                assert (
                    needs_human(passed=passed, bias=bias, grader_stable=stable)
                    is expected
                )


# ---- P2a: enrich_quality_result 把护栏元数据附加进确定性 gate(不调 LLM) ----
def test_enrich_preserves_original_gate_fields():
    gate = {
        "passed": True,
        "blocking_reasons": [],
        "warnings": [],
        "revised_output": {"x": 1},
    }
    out = enrich_quality_result(gate)
    # 向后兼容: 原字段一个不少
    assert out["passed"] is True
    assert out["blocking_reasons"] == []
    assert out["revised_output"] == {"x": 1}


def test_enrich_adds_perf_outcomes_fields():
    out = enrich_quality_result({"passed": True, "warnings": []})
    assert out["should_run_llm_judge"] is True
    assert out["judge_pending"] is True
    assert out["grader_model_planned"] == "openai/claude-haiku-4-5"
    assert out["needs_human"] is False


def test_family_of_strips_litellm_route_prefix():
    # P2b TDD: openai/ 路由前缀不能污染家族判定
    assert family_of("openai/claude-haiku-4-5") == "claude"
    assert family_of("openai/swarm-deepseek-pro") == "deepseek"
    assert family_of("openai/gpt-5.5") == "openai"


def test_enrich_failed_gate_skips_judge_and_needs_human():
    out = enrich_quality_result(
        {"passed": False, "warnings": ["evidence_or_gap_required"]}
    )
    assert out["should_run_llm_judge"] is False  # 确定性没过,下游别烧 LLM
    assert out["needs_human"] is True  # 没过必转人工


def test_enrich_high_risk_warning_forces_human_even_if_passed():
    out = enrich_quality_result(
        {"passed": True, "warnings": ["high_risk_requires_human_confirmation"]}
    )
    assert out["needs_human"] is True  # 高风险待确认,即便确定性过也转人工


def test_enrich_grader_is_heterogeneous_to_swarm_doer():
    out = enrich_quality_result({"passed": True, "warnings": []})
    # 预设裁判必须与蜂群 doer(deepseek 系)不同家族
    assert bias_risk("swarm-deepseek-pro", out["grader_model_planned"]) is False


# ---- P2b: parse_judge_verdict 鲁棒解析 ----
def test_parse_judge_verdict_plain_json():
    v = parse_judge_verdict('{"score": 8, "passed": true, "feedback": ""}')
    assert v["score"] == 8.0 and v["passed"] is True and v["parse_ok"] is True


def test_parse_judge_verdict_fenced_with_prose():
    v = parse_judge_verdict(
        '```json\n{"score": 6, "passed": false, "feedback": "缺证据"}\n```\n说明:...'
    )
    assert v["score"] == 6.0 and v["passed"] is False and v["feedback"] == "缺证据"


def test_parse_judge_verdict_unparseable_is_conservative():
    v = parse_judge_verdict("我觉得还行吧")
    assert v["parse_ok"] is False and v["passed"] is False and v["score"] == 0.0


def test_parse_judge_verdict_infers_passed_from_score_when_absent():
    assert parse_judge_verdict('{"score": 9}', threshold=8)["passed"] is True
    assert parse_judge_verdict('{"score": 5}', threshold=8)["passed"] is False


# ---- P2b: run_llm_judge(注入 fake call,离线) ----
def _fake_call(output, status="success"):
    def _c(*, system_prompt, user_prompt, model):
        return {"status": status, "output": output, "model": model}

    return _c


def test_run_llm_judge_success():
    v = run_llm_judge(
        "brief", call=_fake_call('{"score": 9, "passed": true}'), threshold=8
    )
    assert v is not None and v["score"] == 9.0 and v["passed"] is True


def test_run_llm_judge_call_error_returns_none():
    def boom(**kw):
        raise RuntimeError("api down")

    assert run_llm_judge("brief", call=boom) is None  # 异常 → 降级


def test_run_llm_judge_all_unparseable_returns_none():
    assert run_llm_judge("brief", call=_fake_call("瞎说没JSON")) is None


def test_run_llm_judge_multisample_unstable_fails_pass():
    # 三采样极差>2 → 不稳定 → passed=False(技巧5)
    outs = iter(['{"score": 9}', '{"score": 6}', '{"score": 9}'])

    def vary(**kw):
        return {"status": "success", "output": next(outs), "model": kw["model"]}

    v = run_llm_judge("brief", call=vary, threshold=7, samples=3)
    assert v is not None and v["stable"] is False and v["passed"] is False


# ---- P2b: enrich_quality_result 接真裁判 ----
def test_enrich_with_judge_fills_real_fields_and_clears_pending():
    out = enrich_quality_result(
        {"passed": True, "warnings": [], "revised_output": "x"},
        judge_call=_fake_call('{"score": 9, "passed": true}'),
        doer_model="swarm-deepseek-pro",  # 异构于 claude 裁判
    )
    assert out["judge_pending"] is False
    assert out["judge_score"] == 9.0
    assert out["bias_risk"] is False
    assert out["judge_passed"] is True
    assert out["needs_human"] is False


def test_enrich_with_judge_same_family_flags_bias_and_human():
    out = enrich_quality_result(
        {"passed": True, "warnings": [], "revised_output": "x"},
        judge_call=_fake_call('{"score": 9, "passed": true}'),
        grader_model_planned="openai/swarm-deepseek-pro",  # 与 doer 同 deepseek 家族
        doer_model="swarm-deepseek-pro",
    )
    assert out["bias_risk"] is True
    assert out["judge_passed"] is False  # 自评不算真过
    assert out["needs_human"] is True


def test_enrich_judge_skipped_when_deterministic_failed():
    # 确定性没过 → 短路,不调裁判(judge_pending 留 True)
    called = {"n": 0}

    def counting(**kw):
        called["n"] += 1
        return {"status": "success", "output": '{"score": 9}', "model": kw["model"]}

    out = enrich_quality_result(
        {"passed": False, "warnings": []},
        judge_call=counting,
        doer_model="swarm-deepseek-pro",
    )
    assert out["judge_pending"] is True
    assert called["n"] == 0  # 没烧 LLM


def test_enrich_judge_unreachable_degrades_gracefully():
    def boom(**kw):
        raise RuntimeError("down")

    out = enrich_quality_result(
        {"passed": True, "warnings": [], "revised_output": "x"},
        judge_call=boom,
        doer_model="swarm-deepseek-pro",
    )
    assert out["judge_pending"] is True  # 调不通 → 退回 P2a 形态,不伪造分数
    assert "judge_score" not in out


def test_parse_judge_verdict_handles_nested_and_trailing_prose():
    # LOW1 修复: raw_decode 容忍嵌套对象 + 尾部说明文字
    v = parse_judge_verdict('{"score": 7, "passed": false, "extra": {"k": 1}}\n说明: 仅供参考')
    assert v["parse_ok"] is True and v["score"] == 7.0 and v["passed"] is False
