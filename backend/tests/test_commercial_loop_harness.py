from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[1]
HARNESS = ROOT / "harness" / "chaotang-commercial-loop"
RUNNER_PATH = HARNESS / "scripts" / "run_harness.py"


def load_runner():
    spec = importlib.util.spec_from_file_location("commercial_loop_runner", RUNNER_PATH)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def test_golden_cases_have_required_fields():
    cases = json.loads((HARNESS / "golden_cases" / "commercial_loop_cases.json").read_text(encoding="utf-8"))
    assert len(cases) >= 3
    for case in cases:
        assert case["case_id"]
        assert case["task"]
        assert case["source"]
        assert case["owner"]
        assert case["success_metric"]
        assert case["reference"]
        assert case["must_not"]


def test_dry_run_case_passes_contract_without_ledger(tmp_path):
    runner = load_runner()
    case = runner.load_cases()[0]
    result = runner.run_case(case, mode="dry-run", write_ledger=False, ledger=tmp_path / "ledger.jsonl")

    assert result["mode"] == "dry-run"
    assert result["status"] == "passed"
    assert result["quality_gate"]["status"] == "passed"
    assert result["quality_gate"]["score"] >= 3.5
    assert result["quality_gate"]["traceability"] >= 0.8
    assert result["quality_gate"]["number_grounding"] == 1.0
    assert {r["block_id"] for r in result["records"]} == {
        "lead",
        "opc",
        "product",
        "quotation",
        "archive",
        "report",
    }
    assert not (tmp_path / "ledger.jsonl").exists()


def test_dry_run_writes_replayable_ledger(tmp_path):
    runner = load_runner()
    case = runner.load_cases()[1]
    ledger = tmp_path / "ledger.jsonl"
    result = runner.run_case(case, mode="dry-run", write_ledger=True, ledger=ledger)

    assert ledger.exists()
    lines = ledger.read_text(encoding="utf-8").splitlines()
    assert len(lines) == 1
    replay = json.loads(lines[0])
    assert replay["case_id"] == result["case_id"]
    assert replay["quality_gate"]["human_signoff_required"] is True


def test_gate_blocks_ungrounded_numbers():
    runner = load_runner()
    case = runner.load_cases()[0]
    record = runner.BlockRecord(
        block_id="lead",
        status="passed",
        owner="test",
        input=case["task"],
        output="无依据承诺 9999MWh 和 1元 报价",
        evidence=[runner.Evidence(source="test", claim=case["task"])],
        assumptions=[],
        confidence=0.9,
        next_action="block",
    )
    gate = runner.evaluate_gate([record], case)

    assert gate.status == "blocked"
    assert gate.number_grounding < 1.0


def test_blocked_report_does_not_generate_customer_talk_track():
    runner = load_runner()
    case = runner.load_cases()[0]
    gate = runner.QualityGate(
        status="blocked",
        score=1.0,
        traceability=0.0,
        number_grounding=0.0,
        human_signoff_required=True,
        reasons=["blocked"],
    )
    record = runner.BlockRecord(
        block_id="lead",
        status="failed",
        owner="test",
        input=case["task"],
        output="timeout",
        evidence=[runner.Evidence(source="test", claim="timeout")],
        assumptions=[],
        confidence=0,
        next_action="fix timeout",
    )
    report = runner.build_report(case, [record], gate)

    assert "暂不生成客户话术" in report["customer_summary"]
    assert "暂停承诺" in report["sales_followup"]


def test_passed_report_does_not_promise_quotation_or_delivery():
    runner = load_runner()
    case = runner.load_cases()[0]
    gate = runner.QualityGate(
        status="passed",
        score=5.0,
        traceability=1.0,
        number_grounding=1.0,
        human_signoff_required=True,
        reasons=[],
    )
    record = runner.BlockRecord(
        block_id="opc",
        status="passed",
        owner="test",
        input=case["task"],
        output="ok",
        evidence=[runner.Evidence(source="test", claim="ok")],
        assumptions=[],
        confidence=1,
        next_action="confirm constraints",
    )
    report = runner.build_report(case, [record], gate)

    assert "报价和交期需人工签字" in report["customer_summary"]


def test_can_run_subset_of_blocks_in_dry_run(tmp_path):
    runner = load_runner()
    case = runner.load_cases()[0]
    result = runner.run_case(
        case,
        mode="dry-run",
        write_ledger=False,
        ledger=tmp_path / "ledger.jsonl",
        blocks=("opc",),
    )

    assert result["status"] == "passed"
    assert [r["block_id"] for r in result["records"]] == ["opc", "archive", "report"]


def test_fast_flow_config_keeps_one_lightweight_step():
    runner = load_runner()
    fast = runner.make_fast_flow_config("opc")

    assert len(fast["steps"]) == 1
    step = fast["steps"][0]
    assert step["id"].endswith("_fast_judgment")
    assert step["no_tools"] is True
    assert "prompt_inline" in step
    assert "只允许输出三类数字" in step["prompt_inline"]
    assert "prompt_key" not in step
    assert "tools" not in step
    assert "depends_on" not in step
    assert fast["knowledge_pre_retrieval"]["enabled"] is False
    assert fast["repair"]["enabled"] is False
    assert fast["max_llm_calls"] <= 4
    assert fast["steps"][0]["max_tokens"] <= 1400
    assert fast["steps"][0]["temperature"] == 0
    assert fast["default_temperature"] == 0
    assert fast["default_api_key_env"]


def test_gate_blocks_model_error_output():
    runner = load_runner()
    case = runner.load_cases()[0]
    record = runner.BlockRecord(
        block_id="opc",
        status="passed",
        owner="test",
        input=case["task"],
        output="[ERROR] model=openai/swarm-quick, error=Missing credentials",
        evidence=[runner.Evidence(source="test", claim="run_id=x")],
        assumptions=[],
        confidence=0.9,
        next_action="should block",
    )
    gate = runner.evaluate_gate([record], case)

    assert gate.status == "blocked"
    assert any("model/runtime error" in reason for reason in gate.reasons)


def test_budget_per_wh_is_allowed_as_deterministic_derived_number():
    runner = load_runner()
    case = runner.load_cases()[0]
    record = runner.BlockRecord(
        block_id="opc",
        status="passed",
        owner="test",
        input=case["task"],
        output="预算800万，容量100MWh，确定性计算得到0.08元/Wh。",
        evidence=[runner.Evidence(source="test", claim=case["task"])],
        assumptions=[],
        confidence=0.9,
        next_action="continue",
    )
    gate = runner.evaluate_gate([record], case)

    assert gate.number_grounding == 1.0


def test_deterministic_context_injects_correct_budget_per_wh():
    runner = load_runner()
    case = runner.load_cases()[0]
    ctx = runner.build_deterministic_context(case)

    assert "slot_instruction" in ctx
    assert "0.08元/Wh" in ctx["slot_instruction"]
    assert "禁止输出: 8元/Wh" in ctx["slot_instruction"]
    assert "市场价格区间" in ctx["slot_instruction"]


def test_number_extractor_ignores_bare_standard_ids():
    runner = load_runner()

    assert "36276" not in runner._numbers("需要满足 GB/T 36276 标准")


def test_wide_event_is_written_for_passed_run(tmp_path):
    runner = load_runner()
    case = runner.load_cases()[0]
    result = runner.run_case(
        case,
        mode="dry-run",
        write_ledger=False,
        ledger=tmp_path / "ledger.jsonl",
        blocks=("opc",),
        fast=True,
    )
    event_path = tmp_path / "events.jsonl"
    failure_path = tmp_path / "failures.jsonl"

    runner.write_observability_events(
        result,
        event_path=event_path,
        failure_path=failure_path,
        blocks=("opc",),
        fast=True,
    )

    event = json.loads(event_path.read_text(encoding="utf-8").splitlines()[0])
    assert event["event_type"] == "commercial_loop_run"
    assert event["case_id"] == result["case_id"]
    assert event["blocks_requested"] == ["opc"]
    assert event["gate_status"] == "passed"
    assert event["ungrounded_numbers"] == []
    assert not failure_path.exists()


def test_failure_sample_is_written_for_ungrounded_numbers(tmp_path):
    runner = load_runner()
    case = runner.load_cases()[0]
    record = runner.BlockRecord(
        block_id="opc",
        status="passed",
        owner="test",
        input=case["task"],
        output="无来源市场价 9999元/Wh",
        evidence=[runner.Evidence(source="test", claim="run_id=x")],
        assumptions=[],
        confidence=0.9,
        next_action="should block",
    )
    gate = runner.evaluate_gate([record], case)
    result = {
        "case_id": case["case_id"],
        "mode": "real",
        "status": "blocked",
        "created_at": runner._now(),
        "input": {
            "task": case["task"],
            "source": case["source"],
            "owner": case["owner"],
            "success_metric": case["success_metric"],
        },
        "records": [runner.asdict(record)],
        "quality_gate": runner.asdict(gate),
        "report": {},
    }
    event_path = tmp_path / "events.jsonl"
    failure_path = tmp_path / "failures.jsonl"
    candidate_path = tmp_path / "candidates.jsonl"

    runner.write_observability_events(
        result,
        event_path=event_path,
        failure_path=failure_path,
        golden_candidate_path=candidate_path,
        blocks=("opc",),
        fast=True,
    )

    event = json.loads(event_path.read_text(encoding="utf-8").splitlines()[0])
    failure = json.loads(failure_path.read_text(encoding="utf-8").splitlines()[0])
    assert "9999元/Wh" in event["ungrounded_numbers"]
    assert failure["event_type"] == "commercial_loop_failure_sample"
    assert failure["latest_business_output"] == "无来源市场价 9999元/Wh"
    candidate = json.loads(candidate_path.read_text(encoding="utf-8").splitlines()[0])
    assert candidate["event_type"] == "golden_candidate"
    assert candidate["candidate_type"] == "failure"
    assert "9999元/Wh" in candidate["must_not"]


def test_business_case_event_requires_signoff_for_passed_gate():
    runner = load_runner()
    case = runner.load_cases()[0]
    result = runner.run_case(
        case,
        mode="dry-run",
        write_ledger=False,
        ledger=Path("/tmp/unused.jsonl"),
        blocks=("opc",),
        fast=True,
    )

    event = runner.build_business_case_event(result, owner="sales")

    assert event["event_type"] == "business_case_state"
    assert event["status"] == "awaiting_human_signoff"
    assert event["light"] == "yellow"
    assert event["owner"] == "sales"
    assert "禁止报价" in event["forbidden_actions"]


def test_business_transition_records_customer_feedback(tmp_path):
    runner = load_runner()
    ledger = tmp_path / "business.jsonl"
    runner.append_business_event(
        ledger,
        {
            "event_type": "business_case_state",
            "timestamp": runner._now(),
            "case_id": "case_a",
            "status": "awaiting_human_signoff",
            "light": "yellow",
            "owner": "sales",
            "next_action": "人工确认",
        },
    )

    event = runner.build_business_transition(
        ledger,
        case_id="case_a",
        action="record_feedback",
        outcome="needs_full_proposal",
        customer_response="客户要求完整方案",
    )

    assert event["status"] == "customer_feedback"
    assert event["outcome"] == "needs_full_proposal"
    assert event["customer_response"] == "客户要求完整方案"


def test_business_transition_rejects_invalid_outcome(tmp_path):
    runner = load_runner()
    ledger = tmp_path / "business.jsonl"
    runner.append_business_event(
        ledger,
        {
            "event_type": "business_case_state",
            "timestamp": runner._now(),
            "case_id": "case_a",
            "status": "awaiting_human_signoff",
            "light": "yellow",
            "owner": "sales",
            "next_action": "人工确认",
        },
    )

    with pytest.raises(SystemExit):
        runner.build_business_transition(
            ledger,
            case_id="case_a",
            action="record_feedback",
            outcome="invented",
        )


def test_business_case_event_and_transitions(tmp_path):
    runner = load_runner()
    case = runner.load_cases()[0]
    result = runner.run_case(
        case,
        mode="dry-run",
        write_ledger=False,
        ledger=tmp_path / "ledger.jsonl",
        blocks=("opc",),
    )
    business_path = tmp_path / "business.jsonl"
    initial = runner.build_business_case_event(result, owner="销售A")
    runner.append_business_event(business_path, initial)

    current = runner.load_business_cases(business_path)[case["case_id"]]
    assert current["status"] == "awaiting_human_signoff"
    assert current["light"] == "yellow"
    assert current["owner"] == "销售A"
    assert current["task"] == case["task"]
    assert current["source"] == case["source"]
    assert "禁止报价" in current["forbidden_actions"]

    actioned = runner.build_business_transition(
        business_path,
        case_id=case["case_id"],
        action="mark_actioned",
        owner="销售A",
        note="已发澄清问题",
    )
    runner.append_business_event(business_path, actioned)
    feedback = runner.build_business_transition(
        business_path,
        case_id=case["case_id"],
        action="record_feedback",
        outcome="budget_changed",
        customer_response="客户说预算可调整",
    )
    runner.append_business_event(business_path, feedback)
    archived = runner.build_business_transition(
        business_path,
        case_id=case["case_id"],
        action="archive",
        lesson="预算澄清是第一步",
    )
    runner.append_business_event(business_path, archived)

    final = runner.load_business_cases(business_path)[case["case_id"]]
    assert final["status"] == "archived"
    assert final["headline"] == "已入史馆归档"
    assert final["outcome"] == "budget_changed"
    assert final["lesson"] == "预算澄清是第一步"
    candidate = runner.build_golden_candidate_from_business(final)
    assert candidate is not None
    assert candidate["task"] == case["task"]
    cards = runner.format_business_cards({case["case_id"]: final})
    assert case["case_id"] in cards
    assert "负责人" in cards


def test_business_outcome_can_generate_golden_candidate(tmp_path):
    runner = load_runner()
    case = runner.load_cases()[0]
    business_case = {
        "case_id": case["case_id"],
        "owner": "销售A",
        "outcome": "budget_changed",
        "customer_response": "客户说预算可调整",
        "lesson": "预算澄清是第一步",
    }
    candidate = runner.build_golden_candidate_from_business(business_case)

    assert candidate is not None
    assert candidate["candidate_type"] == "business_outcome"
    assert candidate["outcome"] == "budget_changed"
    assert candidate["promotion_status"] == "needs_human_review"
    assert candidate["candidate_id"]


def test_golden_candidate_can_be_promoted_with_audit_event(tmp_path):
    runner = load_runner()
    case = runner.load_cases()[0]
    candidate_path = tmp_path / "candidates.jsonl"
    golden_cases_path = tmp_path / "golden_cases.json"
    golden_cases_path.write_text(json.dumps([case], ensure_ascii=False), encoding="utf-8")
    candidate = runner.build_golden_candidate_from_business(
        {
            "case_id": case["case_id"],
            "task": case["task"],
            "source": case["source"],
            "owner": "销售A",
            "outcome": "budget_changed",
            "customer_response": "客户说预算可调整",
            "lesson": "预算澄清是第一步",
        }
    )
    runner.append_golden_candidate(candidate_path, candidate)

    event = runner.review_golden_candidate(
        candidate_path=candidate_path,
        golden_cases_path=golden_cases_path,
        candidate_id=candidate["candidate_id"],
        status="promoted",
        reviewer="史馆",
        note="人工确认可复盘",
        reference="预算澄清优先|不得直接报价",
    )
    states = runner.load_golden_candidate_states(candidate_path)
    promoted_cases = json.loads(golden_cases_path.read_text(encoding="utf-8"))

    assert event["review_status"] == "promoted"
    assert states[candidate["candidate_id"]]["promotion_status"] == "promoted"
    assert len(promoted_cases) == 2
    assert promoted_cases[-1]["case_id"].startswith(f"{case['case_id']}_promoted_")
    assert promoted_cases[-1]["reference"] == ["预算澄清优先", "不得直接报价"]
    assert promoted_cases[-1]["promoted_from_candidate_id"] == candidate["candidate_id"]


def test_golden_candidate_can_be_rejected_without_formal_case(tmp_path):
    runner = load_runner()
    candidate_path = tmp_path / "candidates.jsonl"
    golden_cases_path = tmp_path / "golden_cases.json"
    golden_cases_path.write_text("[]", encoding="utf-8")
    candidate = runner.build_golden_candidate_from_business(
        {
            "case_id": "case_to_reject",
            "task": "重复样本",
            "outcome": "no_response",
            "customer_response": "无回复",
        }
    )
    runner.append_golden_candidate(candidate_path, candidate)

    event = runner.review_golden_candidate(
        candidate_path=candidate_path,
        golden_cases_path=golden_cases_path,
        candidate_id=candidate["candidate_id"],
        status="rejected",
        reviewer="史馆",
        note="重复",
        reference="",
    )

    assert event["review_status"] == "rejected"
    assert runner.load_golden_candidate_states(candidate_path)[candidate["candidate_id"]]["promotion_status"] == "rejected"
    assert json.loads(golden_cases_path.read_text(encoding="utf-8")) == []


def test_promoted_golden_case_creates_parent_directory(tmp_path):
    runner = load_runner()
    target = tmp_path / "nested" / "reviewed" / "cases.json"
    runner.append_promoted_golden_case(
        target,
        {
            "case_id": "promoted_case",
            "task": "低温储能商机",
            "source": "客户询盘",
            "owner": "史馆",
            "success_metric": "人工审核后的生产反馈样本可回归验证",
            "reference": ["预算澄清优先"],
            "must_not": [],
            "human_signoff_triggers": ["报价"],
            "promoted_from_candidate_id": "candidate_a",
            "promotion_status": "promoted",
        },
    )

    assert target.exists()
    assert json.loads(target.read_text(encoding="utf-8"))[0]["case_id"] == "promoted_case"


def test_board_review_summarizes_loop_artifacts(tmp_path):
    runner = load_runner()
    case = runner.load_cases()[0]
    result = runner.run_case(
        case,
        mode="dry-run",
        write_ledger=False,
        ledger=tmp_path / "ledger.jsonl",
        blocks=("opc",),
        fast=True,
    )
    business_path = tmp_path / "business.jsonl"
    event_path = tmp_path / "events.jsonl"
    failure_path = tmp_path / "failures.jsonl"
    candidate_path = tmp_path / "candidates.jsonl"

    runner.append_business_event(business_path, runner.build_business_case_event(result, owner="销售A"))
    runner.write_observability_events(
        result,
        event_path=event_path,
        failure_path=failure_path,
        golden_candidate_path=candidate_path,
        blocks=("opc",),
        fast=True,
    )
    feedback = runner.build_business_transition(
        business_path,
        case_id=case["case_id"],
        action="record_feedback",
        outcome="budget_changed",
        customer_response="客户说预算可调整",
    )
    runner.append_business_event(business_path, feedback)
    archived = runner.build_business_transition(
        business_path,
        case_id=case["case_id"],
        action="archive",
        lesson="预算澄清是第一步",
    )
    runner.append_business_event(business_path, archived)
    final = runner.load_business_cases(business_path)[case["case_id"]]
    runner.append_golden_candidate(candidate_path, runner.build_golden_candidate_from_business(final))

    review = runner.build_board_review(
        business_path=business_path,
        event_path=event_path,
        failure_path=failure_path,
        golden_candidate_path=candidate_path,
    )
    formatted = runner.format_board_review(review)

    assert review["maturity_level"] == "L4 Closed-loop"
    assert review["counts"]["business_cases"] == 1
    assert review["counts"]["archived_cases"] == 1
    assert review["counts"]["events"] == 1
    assert review["counts"]["golden_candidates"] == 1
    assert "zhang_xiaolong" in review["advisor_notes"]
    assert "下一步构建" in formatted
