"""蜂群系统基础测试。"""

import json
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.schema import OUTPUT_FIELDS, validate_output
from src.flow_engine import (
    _eval_run_if,
    _render_context,
    _parse_qa_output,
    _apply_opc_safety_floor,
    _apply_opc_safety_floor_with_report,
    _is_opc_safety_floor_triggered,
    FlowEngine,
)
from src.step_log import RunLog, get_run_dir, load_run, save_run_meta

# --- schema 测试 ---


def test_validate_output_pass():
    data = {field: f"{field}的内容" for field in OUTPUT_FIELDS}
    is_valid, issues = validate_output(data)
    assert is_valid is True
    assert issues == []


def test_validate_output_missing_fields():
    data = {"客户背景": "有内容"}
    is_valid, issues = validate_output(data)
    assert is_valid is False
    assert len(issues) == 6  # 缺少6个字段
    assert any("核心需求" in i for i in issues)


def test_validate_output_empty_field():
    data = {field: f"{field}的内容" for field in OUTPUT_FIELDS}
    data["市场分析"] = ""
    is_valid, issues = validate_output(data)
    assert is_valid is False
    assert any("市场分析" in i for i in issues)


def test_validate_output_not_dict():
    is_valid, issues = validate_output("not a dict")
    assert is_valid is False
    assert "不是字典类型" in issues[0]


def test_apply_opc_safety_floor_builds_non_empty_final_output():
    task = "某储能集成商需要 -40℃ 工况 100MWh 集装箱储能方案，预算800万，6个月交付，倾向磷酸铁锂"
    out = _apply_opc_safety_floor("OPC市场方案流程", "config/flow_opc.yaml", task, {})

    assert out is not None
    assert set(OUTPUT_FIELDS).issubset(out)
    assert "0.08元/Wh" in out["解决方案"]
    assert "5,000-9,000万元" in out["解决方案"]
    assert "8-16MWh" in out["解决方案"]
    assert "锂析出" in out["解决方案"]
    assert "人类确认/签字" in out["风险与建议"]


def test_apply_opc_safety_floor_appends_offgrid_constraints():
    task = "北方某工厂区独立储能需求：离网运行，冬季-25℃，容量10MWh，要求循环2000次，无并网条件，12个月交付"
    out = _apply_opc_safety_floor(
        "OPC市场方案流程",
        "config/flow_opc.yaml",
        task,
        {"解决方案": "原方案", "风险与建议": "原风险"},
    )

    assert out is not None
    assert out["解决方案"].startswith("原方案")
    assert "孤岛运行" in out["解决方案"]
    assert "2-3%容量/天" in out["解决方案"]
    assert "600-900万元" in out["解决方案"]


def test_apply_opc_safety_floor_reports_triggers():
    task = "某储能集成商需要 -40℃ 工况 100MWh 集装箱储能方案，预算800万，6个月交付，倾向磷酸铁锂"
    out, report = _apply_opc_safety_floor_with_report("OPC市场方案流程", "config/flow_opc.yaml", task, {})

    assert out is not None
    assert report["applicable"] is True
    assert report["triggered"] is True
    assert report["empty_output_rebuilt"] is True
    assert report["trigger_count"] == 3
    assert report["triggers"] == [
        "budget_capacity_mismatch",
        "extreme_cold_lfp_charging",
        "large_scale_delivery_pressure",
    ]
    assert report["injected_chars"] > 0


def test_run_meta_persists_metadata(tmp_path, monkeypatch):
    monkeypatch.setattr("src.step_log._LEGACY_RUNS_DIR", tmp_path)
    monkeypatch.setattr("src.step_log.RUNS_DIR", tmp_path)

    run = RunLog(run_id="meta_test", task_input="任务", flow_name="OPC市场方案流程")
    run.metadata = {"opc_safety_floor": {"triggered": True, "triggers": ["budget_capacity_mismatch"]}}

    save_run_meta(run, config_path="config/flow_opc.yaml")
    loaded = load_run("meta_test")

    assert loaded is not None
    assert loaded.metadata["opc_safety_floor"]["triggered"] is True
    assert loaded.metadata["opc_safety_floor"]["triggers"] == ["budget_capacity_mismatch"]


def test_load_run_resolves_unique_timestamp_prefix(tmp_path, monkeypatch):
    monkeypatch.setattr("src.tenant.DATA_ROOT", tmp_path / "data")
    monkeypatch.setattr("src.step_log._LEGACY_RUNS_DIR", tmp_path / "legacy_runs")
    monkeypatch.setattr("src.step_log.RUNS_DIR", tmp_path / "legacy_runs")

    run = RunLog(
        run_id="20260609_003027_499455",
        task_input="任务",
        flow_name="AI Ops",
    )
    save_run_meta(run, config_path="config/flow_ai_ops.yaml")

    resolved = get_run_dir("20260609_003027")
    loaded = load_run("20260609_003027")

    assert resolved is not None
    assert resolved.name == "20260609_003027_499455"
    assert loaded is not None
    assert loaded.run_id == "20260609_003027_499455"
    assert loaded.config_path == "config/flow_ai_ops.yaml"


def test_load_run_rejects_ambiguous_timestamp_prefix(tmp_path, monkeypatch):
    monkeypatch.setattr("src.tenant.DATA_ROOT", tmp_path / "data")
    monkeypatch.setattr("src.step_log._LEGACY_RUNS_DIR", tmp_path / "legacy_runs")
    monkeypatch.setattr("src.step_log.RUNS_DIR", tmp_path / "legacy_runs")

    save_run_meta(RunLog("20260609_003027_111111", "任务1", "Flow A"))
    save_run_meta(RunLog("20260609_003027_222222", "任务2", "Flow B"))

    assert get_run_dir("20260609_003027") is None
    assert load_run("20260609_003027") is None


def test_is_opc_safety_floor_triggered():
    run = RunLog(run_id="r", task_input="任务", flow_name="OPC市场方案流程")
    assert _is_opc_safety_floor_triggered(run) is False

    run.metadata = {"opc_safety_floor": {"triggered": False}}
    assert _is_opc_safety_floor_triggered(run) is False

    run.metadata = {"opc_safety_floor": {"triggered": True}}
    assert _is_opc_safety_floor_triggered(run) is True


# --- context 渲染测试 ---


def test_render_context_initial():
    context = {"task_input": "测试需求", "steps": []}
    rendered = _render_context(context)
    assert "## 原始客户需求" in rendered
    assert "测试需求" in rendered


def test_render_context_with_steps():
    context = {
        "task_input": "测试需求",
        "steps": [
            {"step": "opc_leader", "agent_name": "OPC负责人", "output": "第一步输出"},
            {
                "step": "market_intel",
                "agent_name": "市场情报专家",
                "output": "第二步输出",
            },
        ],
    }
    rendered = _render_context(context)
    assert "## 原始客户需求" in rendered
    assert "## OPC负责人 的分析结果" in rendered
    assert "第一步输出" in rendered
    assert "## 市场情报专家 的分析结果" in rendered
    assert "第二步输出" in rendered
    # 确认分隔符
    assert "---" in rendered


# --- QA 输出解析测试 ---


def test_parse_qa_output_valid():
    qa_json = json.dumps(
        {
            "qa_result": "pass",
            "issues": [],
            "final_output": {field: f"{field}内容" for field in OUTPUT_FIELDS},
        },
        ensure_ascii=False,
    )

    final_output, qa_result = _parse_qa_output(qa_json)
    assert final_output is not None
    assert qa_result["qa_result"] == "pass"
    assert len(qa_result["issues"]) == 0


def test_parse_qa_output_with_markdown_wrapper():
    inner = json.dumps(
        {
            "qa_result": "pass",
            "issues": [],
            "final_output": {field: f"{field}内容" for field in OUTPUT_FIELDS},
        },
        ensure_ascii=False,
    )
    wrapped = f"```json\n{inner}\n```"

    final_output, qa_result = _parse_qa_output(wrapped)
    assert final_output is not None
    assert qa_result["qa_result"] == "pass"


def test_parse_qa_output_invalid_json():
    final_output, qa_result = _parse_qa_output("这不是JSON")
    assert final_output is None
    assert qa_result["qa_result"] == "error"
    assert any("JSON解析失败" in i for i in qa_result["issues"])


def test_parse_qa_output_missing_fields():
    qa_json = json.dumps(
        {
            "qa_result": "pass",
            "issues": [],
            "final_output": {"客户背景": "有内容"},  # 缺6个字段
        },
        ensure_ascii=False,
    )

    final_output, qa_result = _parse_qa_output(qa_json)
    assert final_output is not None
    # 二次校验会把 qa_result 改为 fail
    assert qa_result["qa_result"] == "fail"
    assert len(qa_result["issues"]) >= 6


def test_eval_run_if_allows_safe_comparisons():
    prev_step_log = MagicMock(
        status="success", quality_score={"total_score": 4.2}, output="VERDICT: 准奏"
    )
    context = {"steps": [{"step": "a"}]}
    assert (
        _eval_run_if(
            "prev_status == 'success' and prev_score >= 4.0", context, prev_step_log
        )
        is True
    )
    assert (
        _eval_run_if(
            "'准奏' in prev_output and step_count == 1", context, prev_step_log
        )
        is True
    )


def test_eval_run_if_invalid_expression_defaults_to_false():
    prev_step_log = MagicMock(
        status="success", quality_score={"total_score": 4.2}, output="ok"
    )
    context = {"steps": []}
    assert (
        _eval_run_if("__import__('os').system('echo x')", context, prev_step_log)
        is False
    )
    assert _eval_run_if("unknown_name == 1", context, prev_step_log) is False


# --- Flow 配置加载测试 ---


def test_flow_config_loads():
    import yaml

    config_path = Path(__file__).resolve().parent.parent / "config" / "flow_opc.yaml"
    with open(config_path, encoding="utf-8") as f:
        config = yaml.safe_load(f)

    assert config["flow_name"] == "OPC市场方案流程"
    assert config["default_model"] == "openai/swarm-quick"
    assert len(config["steps"]) == 6
    assert config["steps"][0]["id"] == "opc_leader"
    assert any(step["id"] == "conflict_resolver" for step in config["steps"])
    assert config["steps"][-1]["id"] == "qa_tech_support"
    assert len(config["output_fields"]) == 7


# --- prompt_inline 测试 ---


def _write_tmp_flow(tmp_path: Path, steps: list) -> Path:
    """将 flow config 写成临时 YAML 文件，供 FlowEngine 加载。"""
    import yaml as _yaml

    config = {
        "flow_name": "测试Flow",
        "default_model": "openai/test-model",
        "steps": steps,
        "output_fields": ["客户背景"],
    }
    p = tmp_path / "flow_test.yaml"
    p.write_text(_yaml.dump(config, allow_unicode=True), encoding="utf-8")
    return p


def test_flow_engine_uses_prompt_inline(tmp_path):
    """FlowEngine 应将 prompt_inline 字段直接作为 system_prompt，而不尝试加载文件。"""
    cfg_path = _write_tmp_flow(
        tmp_path,
        [
            {
                "id": "test_step",
                "name": "测试步骤",
                "prompt_inline": "你是测试Agent，请输出JSON。",
            }
        ],
    )

    captured_system_prompts: list[str] = []

    class _FakeResponse:
        class _Choice:
            class _Message:
                content = "测试输出"

            message = _Message()

        choices = [_Choice()]
        usage = MagicMock(prompt_tokens=10, completion_tokens=5, total_tokens=15)
        model = "openai/test-model"

    def _fake_completion(**kwargs):
        msgs = kwargs.get("messages", [])
        for m in msgs:
            if m.get("role") == "system":
                captured_system_prompts.append(m["content"])
        return _FakeResponse()

    with patch("litellm.completion", side_effect=_fake_completion):
        engine = FlowEngine(str(cfg_path))
        engine.run("测试任务")

    assert any("你是测试Agent，请输出JSON。" in sp for sp in captured_system_prompts)


def test_flow_engine_prompt_inline_empty_falls_through(tmp_path):
    """prompt_inline 为空字符串时，引擎无 prompt_key 则在构建阶段抛出 ValueError。"""
    cfg_path = _write_tmp_flow(
        tmp_path,
        [{"id": "no_prompt_step", "name": "无Prompt步骤", "prompt_inline": ""}],
    )
    with pytest.raises(ValueError, match="no prompt source"):
        FlowEngine(str(cfg_path))
