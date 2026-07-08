"""Unit tests for RunState (Harness L4)."""
import pytest
from src.run_state import RunState, StepOutput


@pytest.fixture
def rs():
    return RunState(task_input="测试客户需求：需要500kWh储能系统")


# ── add_step / step tracking ──────────────────────────────

class TestAddStep:
    def test_add_single(self, rs):
        rs.add_step("opc_leader", "OPC负责人", "客户画像分析完成")
        assert "opc_leader" in rs.step_outputs
        assert rs._step_order == ["opc_leader"]

    def test_add_multiple_preserves_order(self, rs):
        rs.add_step("opc_leader", "OPC负责人", "输出1")
        rs.add_step("market_intel", "市场情报专家", "输出2")
        rs.add_step("solution_architect", "架构师", "输出3")
        assert rs._step_order == ["opc_leader", "market_intel", "solution_architect"]

    def test_overwrite_same_step_no_duplicate_order(self, rs):
        rs.add_step("opc_leader", "OPC负责人", "第一次输出")
        rs.add_step("opc_leader", "OPC负责人", "第二次输出（重试）")
        assert rs._step_order.count("opc_leader") == 1
        assert rs.step_outputs["opc_leader"].output == "第二次输出（重试）"

    def test_status_recorded(self, rs):
        rs.add_step("opc_leader", "OPC负责人", "输出", status="warning")
        assert rs.step_outputs["opc_leader"].status == "warning"


# ── extract_artifacts ─────────────────────────────────────

class TestExtractArtifacts:
    def test_extract_level(self, rs):
        output = "客户等级：A，建议优先跟进"
        rs.extract_artifacts("opc_leader", output, [
            {"field": "客户等级", "pattern": r"客户等级[：:]\s*(S|A|B|C)"}
        ])
        assert rs.artifacts.get("客户等级") == "A"

    def test_extract_budget_number(self, rs):
        output = "预算金额约为500万元，建议方案在此范围内"
        rs.extract_artifacts("opc_leader", output, [
            {"field": "预算金额", "pattern": r"(\d+[\.\d]*)\s*(万元|亿元|元)"}
        ])
        assert rs.artifacts.get("预算金额") == "500"

    def test_no_match_not_stored(self, rs):
        rs.extract_artifacts("s1", "没有等级信息", [
            {"field": "客户等级", "pattern": r"等级[：:]\s*(S|A|B|C)"}
        ])
        assert "客户等级" not in rs.artifacts

    def test_empty_rules(self, rs):
        rs.extract_artifacts("s1", "任意输出", [])
        assert rs.artifacts == {}

    def test_empty_field_skipped(self, rs):
        rs.extract_artifacts("s1", "输出", [{"field": "", "pattern": r"\d+"}])
        assert rs.artifacts == {}

    def test_multiple_rules(self, rs):
        output = "客户等级：B，预算：200万元，联系人：张总"
        rules = [
            {"field": "客户等级", "pattern": r"客户等级[：:]\s*(S|A|B|C)"},
            {"field": "预算", "pattern": r"预算[：:]\s*(\d+万元)"},
        ]
        rs.extract_artifacts("s1", output, rules)
        assert rs.artifacts["客户等级"] == "B"
        assert rs.artifacts["预算"] == "200万元"


# ── to_context ────────────────────────────────────────────

class TestToContext:
    def test_basic_structure(self, rs):
        ctx = rs.to_context()
        assert ctx["task_input"] == "测试客户需求：需要500kWh储能系统"
        assert ctx["steps"] == []

    def test_steps_exported(self, rs):
        rs.add_step("opc_leader", "OPC负责人", "分析输出")
        ctx = rs.to_context()
        assert len(ctx["steps"]) == 1
        assert ctx["steps"][0]["step"] == "opc_leader"
        assert ctx["steps"][0]["output"] == "分析输出"

    def test_order_preserved_in_export(self, rs):
        rs.add_step("step_a", "Agent A", "输出A")
        rs.add_step("step_b", "Agent B", "输出B")
        ctx = rs.to_context()
        assert [s["step"] for s in ctx["steps"]] == ["step_a", "step_b"]

    def test_optional_fields_absent_when_none(self, rs):
        ctx = rs.to_context()
        assert "knowledge" not in ctx
        assert "rag_docs" not in ctx

    def test_knowledge_included(self, rs):
        rs.knowledge = "产品参数：电压 48V"
        ctx = rs.to_context()
        assert ctx["knowledge"] == "产品参数：电压 48V"


# ── render_for_step ───────────────────────────────────────

class TestRenderForStep:
    def test_includes_task_input(self, rs):
        rendered = rs.render_for_step("opc_leader")
        assert "测试客户需求" in rendered

    def test_includes_all_steps_in_full_mode(self, rs):
        rs.add_step("step_a", "Agent A", "输出A内容")
        rs.add_step("step_b", "Agent B", "输出B内容")
        rendered = rs.render_for_step("step_c", context_mode="full")
        assert "输出A内容" in rendered
        assert "输出B内容" in rendered

    def test_deps_none_includes_all(self, rs):
        rs.add_step("step_a", "Agent A", "输出A")
        rs.add_step("step_b", "Agent B", "输出B")
        rendered = rs.render_for_step("step_c", deps=None)
        assert "输出A" in rendered
        assert "输出B" in rendered

    def test_summary_mode_skips_non_dep_without_summary(self, rs):
        rs.add_step("step_a", "Agent A", "输出A很长的内容内容内容")
        rs.add_step("step_b", "Agent B", "输出B内容")
        # step_b 无摘要，summary模式下只保留 deps 里的
        rendered = rs.render_for_step("step_c", deps=["step_a"], context_mode="summary")
        assert "输出A很长的内容内容内容" in rendered
        # step_b 不是 dep 且无摘要 → 不出现
        assert "输出B内容" not in rendered

    def test_artifacts_only_mode(self, rs):
        rs.add_step("step_a", "Agent A", "输出A")
        rs.artifacts["客户等级"] = "A"
        rendered = rs.render_for_step("step_b", context_mode="artifacts_only")
        assert "客户等级" in rendered
        # 步骤输出不包含
        assert "输出A" not in rendered

    def test_artifacts_always_included_in_full(self, rs):
        rs.artifacts["预算金额"] = "500万元"
        rendered = rs.render_for_step("step_b", context_mode="full")
        assert "预算金额" in rendered
        assert "500万元" in rendered

    def test_max_chars_truncation(self, rs):
        rs.add_step("step_a", "Agent A", "X" * 10000)
        rendered = rs.render_for_step("step_b", max_chars=500)
        assert len(rendered) <= 520  # 略有余量
        assert "已截断" in rendered

    def test_knowledge_section_label(self, rs):
        rs.knowledge = "电压参数：48V"
        rendered = rs.render_for_step("s1")
        assert "产品知识库" in rendered
        assert "电压参数：48V" in rendered

    def test_rag_docs_included(self, rs):
        rs.rag_docs = "文档片段：储能系统规范"
        rendered = rs.render_for_step("s1")
        assert "储能系统规范" in rendered


# ── get_artifact ──────────────────────────────────────────

class TestGetArtifact:
    def test_existing_key(self, rs):
        rs.artifacts["等级"] = "A"
        assert rs.get_artifact("等级") == "A"

    def test_missing_key_default(self, rs):
        assert rs.get_artifact("不存在", default="N/A") == "N/A"

    def test_missing_key_none(self, rs):
        assert rs.get_artifact("不存在") is None
