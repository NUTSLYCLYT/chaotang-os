"""冲突仲裁引擎测试。"""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.conflict_resolver import (
    ConflictResolver,
    ConfigIssue,
    detect_cycle,
    safe_payload,
    validate_orchestrator_config,
)


# ── 循环依赖检测 ──────────────────────────────────────────────────────

class TestCycleDetection:
    """循环依赖检测测试。"""

    def test_no_cycle_linear(self):
        """线性链路无环。"""
        swarms = ["haolong", "opc", "product", "quotation"]
        bindings = [
            {"topic": "haolong_completed", "target_swarm": "opc", "enabled": True},
            {"topic": "opc_completed", "target_swarm": "product", "enabled": True},
            {"topic": "product_completed", "target_swarm": "quotation", "enabled": True},
        ]
        assert detect_cycle(swarms, bindings) is None

    def test_simple_cycle(self):
        """简单双节点环。"""
        swarms = ["a", "b"]
        bindings = [
            {"topic": "a_completed", "target_swarm": "b", "enabled": True},
            {"topic": "b_completed", "target_swarm": "a", "enabled": True},
        ]
        cycle = detect_cycle(swarms, bindings)
        assert cycle is not None
        assert "a" in cycle and "b" in cycle

    def test_three_node_cycle(self):
        """三节点环。"""
        swarms = ["a", "b", "c"]
        bindings = [
            {"topic": "a_completed", "target_swarm": "b", "enabled": True},
            {"topic": "b_completed", "target_swarm": "c", "enabled": True},
            {"topic": "c_completed", "target_swarm": "a", "enabled": True},
        ]
        cycle = detect_cycle(swarms, bindings)
        assert cycle is not None

    def test_disabled_binding_no_cycle(self):
        """禁用的绑定不参与环检测。"""
        swarms = ["a", "b"]
        bindings = [
            {"topic": "a_completed", "target_swarm": "b", "enabled": True},
            {"topic": "b_completed", "target_swarm": "a", "enabled": False},
        ]
        assert detect_cycle(swarms, bindings) is None

    def test_self_loop(self):
        """自环。"""
        swarms = ["a"]
        bindings = [
            {"topic": "a_completed", "target_swarm": "a", "enabled": True},
        ]
        cycle = detect_cycle(swarms, bindings)
        assert cycle is not None


# ── 配置校验 ──────────────────────────────────────────────────────────

class TestConfigValidation:
    """配置校验测试。"""

    def test_valid_config(self):
        """正常配置无问题。"""
        issues = validate_orchestrator_config(
            swarm_ids=["haolong", "opc", "product"],
            bindings=[
                {"topic": "haolong_completed", "target_swarm": "opc", "enabled": True},
                {"topic": "opc_completed", "target_swarm": "product", "enabled": True},
            ],
        )
        errors = [i for i in issues if i.level == "error"]
        assert len(errors) == 0

    def test_invalid_target_swarm(self):
        """引用不存在的 target_swarm。"""
        issues = validate_orchestrator_config(
            swarm_ids=["haolong", "opc"],
            bindings=[
                {"topic": "haolong_completed", "target_swarm": "nonexistent", "enabled": True},
            ],
        )
        errors = [i for i in issues if i.level == "error"]
        assert len(errors) == 1
        assert "nonexistent" in errors[0].message

    def test_duplicate_binding_warning(self):
        """重复绑定产生警告。"""
        issues = validate_orchestrator_config(
            swarm_ids=["a", "b"],
            bindings=[
                {"topic": "a_completed", "target_swarm": "b", "enabled": True},
                {"topic": "a_completed", "target_swarm": "b", "enabled": True},
            ],
        )
        warnings = [i for i in issues if i.level == "warning"]
        assert any("重复绑定" in w.message for w in warnings)

    def test_cycle_detection_in_validation(self):
        """校验中包含循环依赖检测。"""
        issues = validate_orchestrator_config(
            swarm_ids=["a", "b"],
            bindings=[
                {"topic": "a_completed", "target_swarm": "b", "enabled": True},
                {"topic": "b_completed", "target_swarm": "a", "enabled": True},
            ],
        )
        errors = [i for i in issues if i.level == "error"]
        assert any("循环依赖" in e.message for e in errors)

    def test_invalid_transform_field(self):
        """transform 引用不存在的字段。"""
        issues = validate_orchestrator_config(
            swarm_ids=["a", "b"],
            bindings=[
                {"topic": "a_completed", "target_swarm": "b", "transform": "不存在的字段", "enabled": True},
            ],
            output_fields_map={"a": ["客户背景", "解决方案"]},
        )
        warnings = [i for i in issues if i.level == "warning"]
        assert any("不存在的字段" in w.message for w in warnings)


# ── 冲突仲裁策略 ──────────────────────────────────────────────────────

class TestArbitrationStrategies:
    """仲裁策略测试。"""

    def test_all_strategy(self):
        """all 策略：全部执行。"""
        resolver = ConflictResolver(strategy="all")
        r1 = resolver.arbitrate("product", "opc", 4.0, "输入1", "opc_completed")
        r2 = resolver.arbitrate("product", "haolong", 3.5, "输入2", "haolong_completed")
        assert r1.action == "execute"
        assert r2.action == "execute"

    def test_first_win_strategy(self):
        """first_win 策略：第一个触发的执行，后续跳过。"""
        resolver = ConflictResolver(strategy="first_win")
        r1 = resolver.arbitrate("product", "opc", 4.0, "输入1", "opc_completed")
        r2 = resolver.arbitrate("product", "haolong", 4.5, "输入2", "haolong_completed")
        assert r1.action == "execute"
        assert r2.action == "skip"
        assert "first_win" in r2.reason

    def test_best_score_strategy(self):
        """best_score 策略：低分被跳过。"""
        resolver = ConflictResolver(strategy="best_score")
        r1 = resolver.arbitrate("product", "opc", 4.0, "输入1", "opc_completed")
        assert r1.action == "execute"
        r2 = resolver.arbitrate("product", "haolong", 3.5, "输入2", "haolong_completed")
        assert r2.action == "skip"
        assert "best_score" in r2.reason

    def test_reset(self):
        """reset 清除状态后可重新触发。"""
        resolver = ConflictResolver(strategy="first_win")
        resolver.arbitrate("product", "opc", 4.0, "输入1", "opc_completed")
        resolver.reset()
        r = resolver.arbitrate("product", "haolong", 3.5, "输入2", "haolong_completed")
        assert r.action == "execute"

    def test_trigger_history(self):
        """触发历史记录。"""
        resolver = ConflictResolver(strategy="all")
        resolver.arbitrate("product", "opc", 4.0, "输入1", "opc_completed")
        resolver.arbitrate("quotation", "product", 3.8, "输入2", "product_completed")
        history = resolver.get_trigger_history()
        assert "product" in history
        assert "quotation" in history
        assert len(history["product"]) == 1


# ── Payload 保护 ──────────────────────────────────────────────────────

class TestSafePayload:
    """Payload 深拷贝测试。"""

    def test_deep_copy(self):
        """修改拷贝不影响原始数据。"""
        original = {
            "quality_score": {"total_score": 4.0, "scores": {"完整性": 4}},
            "final_output": {"解决方案": "LFP方案"},
        }
        copied = safe_payload(original)
        copied["quality_score"]["total_score"] = 999
        copied["final_output"]["解决方案"] = "被篡改"

        assert original["quality_score"]["total_score"] == 4.0
        assert original["final_output"]["解决方案"] == "LFP方案"


# ── 集成到 SwarmOrchestrator ──────────────────────────────────────────

class TestOrchestratorIntegration:
    """编排器集成冲突仲裁测试。"""

    def test_load_config_with_cycle_raises(self, tmp_path):
        """加载含循环依赖的配置时抛异常。"""
        import yaml
        from src.swarm_orchestrator import SwarmOrchestrator

        config = {
            "swarms": [
                {"id": "a", "name": "A", "config": "config/flow_opc.yaml"},
                {"id": "b", "name": "B", "config": "config/flow_opc.yaml"},
            ],
            "bindings": [
                {"topic": "a_completed", "target_swarm": "b", "enabled": True},
                {"topic": "b_completed", "target_swarm": "a", "enabled": True},
            ],
        }
        config_path = tmp_path / "cycle.yaml"
        config_path.write_text(yaml.dump(config, allow_unicode=True))

        with pytest.raises(ValueError, match="循环依赖"):
            SwarmOrchestrator(str(config_path))

    def test_load_config_with_invalid_target_raises(self, tmp_path):
        """加载引用不存在蜂群的配置时抛异常。"""
        import yaml
        from src.swarm_orchestrator import SwarmOrchestrator

        config = {
            "swarms": [
                {"id": "a", "name": "A", "config": "config/flow_opc.yaml"},
            ],
            "bindings": [
                {"topic": "a_completed", "target_swarm": "ghost", "enabled": True},
            ],
        }
        config_path = tmp_path / "invalid.yaml"
        config_path.write_text(yaml.dump(config, allow_unicode=True))

        with pytest.raises(ValueError, match="致命错误"):
            SwarmOrchestrator(str(config_path))

    def test_valid_production_config(self):
        """生产配置能正常加载（无致命错误）。"""
        from src.swarm_orchestrator import SwarmOrchestrator

        orch = SwarmOrchestrator("config/swarm_orchestrator.yaml")
        errors = [i for i in orch.config_issues if i.level == "error"]
        assert len(errors) == 0
        assert len(orch.swarms) >= 5
        assert len(orch.bindings) >= 3

    def test_arbitration_strategy_from_config(self, tmp_path):
        """从配置文件读取仲裁策略。"""
        import yaml
        from src.swarm_orchestrator import SwarmOrchestrator

        config = {
            "swarms": [
                {"id": "a", "name": "A", "config": "config/flow_opc.yaml"},
                {"id": "b", "name": "B", "config": "config/flow_opc.yaml"},
            ],
            "bindings": [
                {"topic": "a_completed", "target_swarm": "b", "enabled": True},
            ],
            "arbitration": {"strategy": "first_win"},
        }
        config_path = tmp_path / "strategy.yaml"
        config_path.write_text(yaml.dump(config, allow_unicode=True))

        orch = SwarmOrchestrator(str(config_path))
        assert orch._resolver.strategy == "first_win"
