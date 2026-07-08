"""工部审查检查器验收（Deming）：抓到植入缺陷=PASS，漏掉 critical=FAIL，确定性。

证明工部审查"能抓真 bug"靠的是确定性 catch-rate 判定,不是 LLM 自评。
"""

from __future__ import annotations

from scripts.gongbu_review_check import check_review, load_cases
from src.truth_ledger import _DETERMINISTIC


def test_checker_registered_in_ledger():
    assert "gongbu_review_check" in _DETERMINISTIC  # 否则不计入 flywheel health


def test_golden_cases_load_and_well_formed():
    cases = load_cases()
    assert len(cases) >= 4
    for c in cases:
        assert c.get("id") and c.get("snippet") and c.get("planted_defects")
        for d in c["planted_defects"]:
            assert d.get("must_catch_keywords") and d.get("severity")


def test_review_that_catches_defect_passes():
    case = {
        "id": "t1",
        "planted_defects": [
            {
                "id": "eval_injection",
                "severity": "critical",
                "must_catch_keywords": ["eval", "注入", "输入"],
                "min_hits": 2,
            }
        ],
    }
    review = "严重问题：直接 eval 用户输入存在代码注入风险，必须改用 ast.literal_eval。"
    r = check_review(review, case)
    assert r["verdict"] == "PASS"
    assert r["catch_rate"] == 1.0
    assert r["caught"][0]["id"] == "eval_injection"


def test_review_that_misses_critical_fails():
    case = {
        "id": "t2",
        "planted_defects": [
            {
                "id": "sql_injection",
                "severity": "critical",
                "must_catch_keywords": ["SQL", "注入", "参数化"],
                "min_hits": 2,
            }
        ],
    }
    review = "代码风格不错，命名清晰，建议加点注释。"  # 泛泛夸,没抓到 SQL 注入
    r = check_review(review, case)
    assert r["verdict"] == "FAIL"  # 漏掉 critical → FAIL,拆穿"泛泛夸"theater
    assert r["missed"][0]["id"] == "sql_injection"


def test_real_golden_snippet_with_good_review_passes():
    """用真实 golden case + 一个抓到缺陷的审查,端到端验证。"""
    cases = load_cases()
    eval_case = next(c for c in cases if c["id"] == "gbr_eval_injection")
    good = "发现 critical 安全缺陷：eval 直接执行用户输入，构成代码注入，必须移除 eval。"
    r = check_review(good, eval_case)
    assert r["verdict"] == "PASS"
