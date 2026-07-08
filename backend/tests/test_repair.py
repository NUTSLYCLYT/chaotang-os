"""自动修复循环单元测试。"""

import json
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.repair import (
    DIMENSION_STEP_MAP,
    STEP_INDEX_MAP,
    RepairConfig,
    RepairHistory,
    RepairInstruction,
    RepairRound,
    build_context_overlay,
    build_step_index_map,
    build_dimension_step_map,
    evaluate_round,
    needs_repair,
    resolve_repair_targets,
    save_repair_history,
    load_repair_history,
    _get_maps_for_run,
)
from src.schema import QUALITY_DIMENSIONS, calculate_total_score
from src.step_log import RunLog


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


def _make_run_log(
    run_id: str = "test_run",
    scores: dict | None = None,
    issues: list | None = None,
    improvement_targets: list | None = None,
    weakest_fields: list | None = None,
) -> RunLog:
    """构造带 QA 结果的 RunLog。"""
    if scores is None:
        scores = {d: 4 for d in QUALITY_DIMENSIONS}
    total = calculate_total_score(scores)
    qa_result = {
        "qa_result": "pass" if total >= 3.5 else "fail",
        "issues": issues or [],
        "quality_score": {
            "scores": scores,
            "total_score": total,
            "grade": "B+",
            "issues": issues or [],
            "weakest_fields": weakest_fields or [],
            "improvement_targets": improvement_targets or [],
            "overall_comment": "测试评价",
        },
    }
    run = RunLog(run_id=run_id, task_input="测试任务", flow_name="test")
    run.qa_result = qa_result
    run.quality_score = qa_result["quality_score"]
    return run


DEFAULT_CONFIG = RepairConfig(enabled=True, max_retries=3, min_score=3.5, min_delta=0.2, min_dimension_score=3.0)


# ---------------------------------------------------------------------------
# 映射表测试
# ---------------------------------------------------------------------------


class TestDimensionStepMap:
    def test_all_dimensions_covered(self):
        """所有 6 个评分维度都有映射。"""
        for dim in QUALITY_DIMENSIONS:
            assert dim in DIMENSION_STEP_MAP, f"维度 '{dim}' 缺少映射"

    def test_all_mapped_steps_have_index(self):
        """映射表中的所有 step_id 都有 STEP_INDEX_MAP 条目。"""
        for dim, steps in DIMENSION_STEP_MAP.items():
            for step in steps:
                assert step in STEP_INDEX_MAP, f"维度 '{dim}' 映射的 step '{step}' 不在 STEP_INDEX_MAP 中"

    def test_step_index_order(self):
        """STEP_INDEX_MAP 的顺序与 OPC Flow 步骤一致。"""
        expected_order = [
            "opc_leader",
            "market_intel",
            "solution_architect",
            "customer_success",
            "qa_tech_support",
        ]
        for i, step in enumerate(expected_order):
            assert STEP_INDEX_MAP[step] == i


# ---------------------------------------------------------------------------
# needs_repair 测试
# ---------------------------------------------------------------------------


class TestNeedsRepair:
    def test_no_repair_when_all_good(self):
        """全部高分，不需要修复。"""
        run = _make_run_log(scores={d: 4 for d in QUALITY_DIMENSIONS})
        assert needs_repair(run, DEFAULT_CONFIG) is False

    def test_needs_repair_total_low(self):
        """总分低于阈值触发修复。"""
        run = _make_run_log(scores={d: 2.5 for d in QUALITY_DIMENSIONS})
        assert needs_repair(run, DEFAULT_CONFIG) is True

    def test_needs_repair_single_dim_low(self):
        """单维度低于 min_dimension_score 触发修复。"""
        scores = {d: 4 for d in QUALITY_DIMENSIONS}
        scores["信息密度"] = 2  # 低于 3.0
        run = _make_run_log(scores=scores)
        assert needs_repair(run, DEFAULT_CONFIG) is True

    def test_no_qa_result_no_repair(self):
        """没有 QA 结果，不触发修复。"""
        run = RunLog(run_id="x", task_input="t", flow_name="f")
        assert needs_repair(run, DEFAULT_CONFIG) is False


# ---------------------------------------------------------------------------
# resolve_repair_targets 测试
# ---------------------------------------------------------------------------


class TestResolveRepairTargets:
    def test_deterministic_mapping(self):
        """纯启发式映射：信息密度低 → market_intel。"""
        scores = {d: 4 for d in QUALITY_DIMENSIONS}
        scores["信息密度"] = 2
        run = _make_run_log(scores=scores)
        instructions = resolve_repair_targets(run.qa_result, DEFAULT_CONFIG)

        assert len(instructions) >= 1
        target_steps = {i.target_step for i in instructions}
        assert "market_intel" in target_steps

    def test_qa_cross_reference(self):
        """QA source_agent 归因交叉验证。"""
        scores = {d: 4 for d in QUALITY_DIMENSIONS}
        scores["行业专业性"] = 2
        issues = [
            {
                "dimension": "行业专业性",
                "severity": "high",
                "field": "竞品情况",
                "source_agent": "solution_architect",
                "problem": "技术参数不准确",
                "suggestion": "校正参数",
            }
        ]
        run = _make_run_log(scores=scores, issues=issues)
        instructions = resolve_repair_targets(run.qa_result, DEFAULT_CONFIG)

        # solution_architect 应该出现在目标中（来自 QA 归因）
        target_steps = {i.target_step for i in instructions}
        assert "solution_architect" in target_steps

        # 检查 symptoms 包含 QA 的问题描述
        sa_inst = [i for i in instructions if i.target_step == "solution_architect"][0]
        assert "技术参数不准确" in sa_inst.symptoms

    def test_no_targets_when_all_good(self):
        """全部高分，返回空列表。"""
        run = _make_run_log(scores={d: 4 for d in QUALITY_DIMENSIONS})
        instructions = resolve_repair_targets(run.qa_result, DEFAULT_CONFIG)
        assert instructions == []

    def test_qa_tech_support_excluded(self):
        """qa_tech_support 不应作为 rerun 目标。"""
        scores = {d: 2 for d in QUALITY_DIMENSIONS}
        run = _make_run_log(scores=scores)
        instructions = resolve_repair_targets(run.qa_result, DEFAULT_CONFIG)
        target_steps = {i.target_step for i in instructions}
        assert "qa_tech_support" not in target_steps

    def test_instructions_sorted_by_step_order(self):
        """指令按步骤执行顺序排列。"""
        scores = {d: 2 for d in QUALITY_DIMENSIONS}
        run = _make_run_log(scores=scores)
        instructions = resolve_repair_targets(run.qa_result, DEFAULT_CONFIG)
        indices = [STEP_INDEX_MAP[i.target_step] for i in instructions]
        assert indices == sorted(indices)

    def test_fallback_weakest_two_when_total_low(self):
        """总分低但无单维度低于阈值时，选最弱的 2 个维度。"""
        # 所有维度都是 3.0（刚好不低于 min_dimension_score）
        # 但总分 3.0 < min_score 3.5
        scores = {d: 3 for d in QUALITY_DIMENSIONS}
        scores["信息密度"] = 3  # 所有都是 3，但总分 = 3.0 < 3.5
        run = _make_run_log(scores=scores)
        instructions = resolve_repair_targets(run.qa_result, DEFAULT_CONFIG)
        assert len(instructions) >= 1  # 应该有目标

    def test_legal_flow_uses_domain_steps_from_run_config(self):
        """租户 runs 目录下的 repair 也必须使用当前 flow 的步骤映射。"""
        scores = {d: 4 for d in QUALITY_DIMENSIONS}
        scores["可执行性"] = 2
        run = _make_run_log(run_id="legal_test", scores=scores)
        run.config_path = "config/flow_legal.yaml"

        step_index_map, dimension_step_map = _get_maps_for_run(run)
        instructions = resolve_repair_targets(
            run.qa_result,
            DEFAULT_CONFIG,
            step_index_map=step_index_map,
            dimension_step_map=dimension_step_map,
        )

        target_steps = {i.target_step for i in instructions}
        assert "legal_compliance" in target_steps
        assert "customer_success" not in target_steps
        assert "solution_architect" not in target_steps


# ---------------------------------------------------------------------------
# build_context_overlay 测试
# ---------------------------------------------------------------------------


class TestBuildContextOverlay:
    def test_overlay_format(self):
        """生成的 overlay 包含正确的标题和 JSON 结构。"""
        inst = RepairInstruction(
            target_step="market_intel",
            failure_dimensions=("信息密度",),
            symptoms=("市场分析缺乏数据",),
            repair_goals=("包含至少3个数据点",),
            constraints=("保持现有内容",),
        )
        overlay = build_context_overlay([inst], round_num=1)
        assert "[AUTO-REPAIR]" in overlay
        assert "Round 1" in overlay
        assert "market_intel" in overlay
        assert "信息密度" in overlay
        assert "市场分析缺乏数据" in overlay

    def test_overlay_includes_previous_scores(self):
        """overlay 包含上轮分数。"""
        inst = RepairInstruction(
            target_step="market_intel",
            failure_dimensions=("信息密度",),
            symptoms=(),
            repair_goals=(),
            constraints=(),
        )
        overlay = build_context_overlay([inst], round_num=2, scores_before={"信息密度": 2})
        assert "previous_scores" in overlay
        assert '"信息密度": 2' in overlay

    def test_overlay_is_valid_structure(self):
        """overlay 中的 JSON 部分可以被解析。"""
        inst = RepairInstruction(
            target_step="opc_leader",
            failure_dimensions=("需求匹配度",),
            symptoms=("需求覆盖不全",),
            repair_goals=("逐条对照需求",),
            constraints=("不要删除有效内容",),
        )
        overlay = build_context_overlay([inst], round_num=1)
        # 提取 JSON 部分（在标题和说明之后）
        lines = overlay.split("\n")
        json_start = None
        for i, line in enumerate(lines):
            if line.strip().startswith("{"):
                json_start = i
                break
        assert json_start is not None
        json_text = "\n".join(lines[json_start:])
        parsed = json.loads(json_text)
        assert parsed["repair_round"] == 1
        assert len(parsed["instructions"]) == 1


# ---------------------------------------------------------------------------
# evaluate_round 测试
# ---------------------------------------------------------------------------


class TestEvaluateRound:
    def _make_instruction(self):
        return RepairInstruction(
            target_step="market_intel",
            failure_dimensions=("信息密度",),
            symptoms=(),
            repair_goals=(),
            constraints=(),
        )

    def test_threshold_met(self):
        """达标停止。"""
        before = _make_run_log("r1", scores={d: 3 for d in QUALITY_DIMENSIONS})
        after = _make_run_log("r2", scores={d: 4 for d in QUALITY_DIMENSIONS})
        stop, rr = evaluate_round(before, after, DEFAULT_CONFIG, 1, [self._make_instruction()])
        assert stop == "threshold_met"
        assert rr.outcome == "improved"

    def test_regression(self):
        """退化停止。"""
        before = _make_run_log("r1", scores={d: 3 for d in QUALITY_DIMENSIONS})
        after = _make_run_log("r2", scores={d: 2 for d in QUALITY_DIMENSIONS})
        stop, rr = evaluate_round(before, after, DEFAULT_CONFIG, 1, [self._make_instruction()])
        assert stop == "regression"
        assert rr.outcome == "regressed"

    def test_no_improvement(self):
        """无改善停止。"""
        before = _make_run_log("r1", scores={d: 3 for d in QUALITY_DIMENSIONS})
        after = _make_run_log("r2", scores={d: 3.1 for d in QUALITY_DIMENSIONS})
        stop, rr = evaluate_round(before, after, DEFAULT_CONFIG, 1, [self._make_instruction()])
        assert stop == "no_improvement"
        assert rr.outcome == "no_change"

    def test_continue_on_improvement(self):
        """改善但未达标，继续。"""
        before = _make_run_log("r1", scores={d: 2 for d in QUALITY_DIMENSIONS})
        # 提升到 2.8（仍未达标但有明显改善）
        after = _make_run_log("r2", scores={d: 2.8 for d in QUALITY_DIMENSIONS})
        stop, rr = evaluate_round(before, after, DEFAULT_CONFIG, 1, [self._make_instruction()])
        assert stop is None
        assert rr.outcome == "improved"


# ---------------------------------------------------------------------------
# RepairHistory 序列化测试
# ---------------------------------------------------------------------------


class TestRepairHistory:
    def test_roundtrip_serialization(self):
        """to_dict / from_dict 往返一致。"""
        history = RepairHistory(
            session_id="20260403_repair",
            original_run_id="run_001",
            task_input="测试任务",
            rounds=[
                RepairRound(
                    round_number=1,
                    source_run_id="run_001",
                    new_run_id="run_002",
                    from_step=1,
                    instructions=[{"target_step": "market_intel"}],
                    scores_before={"信息密度": 2},
                    scores_after={"信息密度": 3},
                    total_before=2.5,
                    total_after=3.2,
                    delta=0.7,
                    outcome="improved",
                )
            ],
            final_run_id="run_002",
            stop_reason="threshold_met",
        )
        data = history.to_dict()
        restored = RepairHistory.from_dict(data)
        assert restored.session_id == history.session_id
        assert restored.original_run_id == history.original_run_id
        assert len(restored.rounds) == 1
        assert restored.rounds[0].delta == 0.7
        assert restored.stop_reason == "threshold_met"

    def test_persistence(self, tmp_path, monkeypatch):
        """save / load 文件往返。"""
        monkeypatch.setattr("src.repair.REPAIRS_DIR", tmp_path)
        history = RepairHistory(
            session_id="test_persist",
            original_run_id="r1",
            task_input="t",
            stop_reason="max_retries",
        )
        save_repair_history(history)
        loaded = load_repair_history("test_persist")
        assert loaded is not None
        assert loaded.session_id == "test_persist"
        assert loaded.stop_reason == "max_retries"


# ---------------------------------------------------------------------------
# RepairConfig 测试
# ---------------------------------------------------------------------------


class TestRepairConfig:
    def test_defaults(self):
        config = RepairConfig()
        assert config.enabled is False
        assert config.max_retries == 3
        assert config.min_score == 3.5
        assert config.min_delta == 0.2
        assert config.min_dimension_score == 3.0

    def test_custom_values(self):
        config = RepairConfig(enabled=True, max_retries=5, min_score=4.0)
        assert config.enabled is True
        assert config.max_retries == 5
        assert config.min_score == 4.0


# ---------------------------------------------------------------------------
# Flow 配置中 repair 段加载测试
# ---------------------------------------------------------------------------


class TestFlowConfigRepair:
    def test_flow_config_has_repair_section(self):
        """flow_opc.yaml 包含 repair 配置段。"""
        import yaml

        config_path = Path(__file__).resolve().parent.parent / "config" / "flow_opc.yaml"
        with open(config_path, encoding="utf-8") as f:
            config = yaml.safe_load(f)

        assert "repair" in config
        repair = config["repair"]
        assert "enabled" in repair
        assert "max_retries" in repair
        assert "min_score" in repair
        assert "min_delta" in repair
        assert "min_dimension_score" in repair


class TestDynamicMaps:
    def test_build_step_index_map_opc(self):
        steps = [
            {"id": "opc_leader", "name": "OPC负责人"},
            {"id": "market_intel", "name": "市场情报专家"},
            {"id": "qa_tech_support", "name": "QA"},
        ]
        m = build_step_index_map(steps)
        assert m == {"opc_leader": 0, "market_intel": 1, "qa_tech_support": 2}

    def test_build_step_index_map_haolong(self):
        steps = [
            {"id": "lead_acquisition", "name": "获客AI"},
            {"id": "lead_archive", "name": "归档AI"},
            {"id": "lead_outreach", "name": "触达AI"},
            {"id": "content_publish", "name": "发布AI"},
            {"id": "qa_tech_support", "name": "QA"},
        ]
        m = build_step_index_map(steps)
        assert m == {
            "lead_acquisition": 0,
            "lead_archive": 1,
            "lead_outreach": 2,
            "content_publish": 3,
            "qa_tech_support": 4,
        }

    def test_build_dimension_step_map_returns_all_dims(self):
        steps = [
            {"id": "product_manager", "name": "产品部门经理"},
            {"id": "competitive_research", "name": "竞品研究专员"},
            {"id": "qa_tech_support", "name": "QA"},
        ]
        m = build_dimension_step_map(steps)
        for dim in QUALITY_DIMENSIONS:
            assert dim in m, f"维度 '{dim}' 缺少映射"
            assert len(m[dim]) >= 1

    def test_resolve_repair_targets_with_custom_maps(self):
        step_configs = [
            {"id": "lead_acquisition", "name": "获客AI"},
            {"id": "lead_archive", "name": "归档AI"},
            {"id": "qa_tech_support", "name": "QA"},
        ]
        sim = build_step_index_map(step_configs)
        dsm = build_dimension_step_map(step_configs)

        scores = {d: 4 for d in QUALITY_DIMENSIONS}
        scores["信息密度"] = 2
        run = _make_run_log(scores=scores)
        instructions = resolve_repair_targets(
            run.qa_result,
            DEFAULT_CONFIG,
            step_index_map=sim,
            dimension_step_map=dsm,
        )
        assert len(instructions) >= 1
        for inst in instructions:
            assert inst.target_step in sim
            assert inst.target_step != "qa_tech_support"

    def test_dimension_map_no_step0_collapse_domain_swarms(self):
        """回归：领域蜂群（中文 agent 名）的维度映射不得全部塌缩到第一步。

        历史 bug：旧关键词表只认通用词（经理/架构/竞品/客户），财务/法务/朝堂等
        领域名全部落空 → fallback 命中 non_qa_steps[0]，repair 永远重跑错误的第一步
        （finance/court 实测 6/6 维度塌缩）。修复后位置兜底必须保证多目标分布。
        """
        domain_swarms = {
            "finance": [
                {"id": "finance_analyst", "name": "财务分析师"},
                {"id": "finance_cashflow", "name": "现金流预测专员"},
                {"id": "finance_risk", "name": "财务风控专员"},
                {"id": "qa_tech_support", "name": "QA"},
            ],
            "legal": [
                {"id": "legal_review", "name": "法务初审专员"},
                {"id": "contract_counsel", "name": "合同法务专员"},
                {"id": "legal_compliance", "name": "合规与落地专员"},
                {"id": "qa_tech_support", "name": "QA"},
            ],
            "sourcing": [
                {"id": "supplier_intel", "name": "供应商情报员"},
                {"id": "cell_spec_collector", "name": "电芯参数采集员"},
                {"id": "spec_normalizer", "name": "数据清洗师"},
                {"id": "sourcing_synthesizer", "name": "整合分析师"},
                {"id": "qa_tech_support", "name": "QA"},
            ],
        }
        for swarm_id, steps in domain_swarms.items():
            non_qa = [s["id"] for s in steps if s["id"] != "qa_tech_support"]
            step0 = non_qa[0]
            dim_map = build_dimension_step_map(steps)
            collapsed = [d for d in QUALITY_DIMENSIONS if dim_map[d] == [step0]]
            distinct = {t for v in dim_map.values() for t in v}
            assert len(collapsed) < len(QUALITY_DIMENSIONS), (
                f"{swarm_id}: {len(collapsed)}/6 维度塌缩到 {step0}（step0 bug 复发）"
            )
            assert len(distinct) >= 2, f"{swarm_id}: 仅命中 {distinct}，repair 无法区分责任步骤"
