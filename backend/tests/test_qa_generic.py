"""通用 QA prompt 生成器 + 动态字段校验 测试。"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.prompts_qa_v2 import build_qa_prompt, QA_TECH_SUPPORT_V3, QA_TECH_SUPPORT_V2
from src.schema import OUTPUT_FIELDS, validate_output, calculate_total_score
from src.flow_engine import _parse_qa_output

# ── build_qa_prompt 测试 ─────────────────────────────────────────────


def test_opc_fields_return_original_v3():
    """OPC 标准 7 字段应返回原始 v3 prompt，保持兼容。"""
    result = build_qa_prompt(
        output_fields=OUTPUT_FIELDS,
        step_ids=[
            "opc_leader",
            "market_intel",
            "solution_architect",
            "customer_success",
            "qa_tech_support",
        ],
        step_names=[
            "OPC负责人",
            "市场情报专家",
            "解决方案架构师",
            "客户成功经理",
            "技术支持专家",
        ],
        qa_version="v3",
    )
    assert result == QA_TECH_SUPPORT_V3


def test_opc_fields_return_original_v2():
    """OPC 标准 7 字段 + v2 版本应返回原始 v2 prompt。"""
    result = build_qa_prompt(
        output_fields=OUTPUT_FIELDS,
        step_ids=[
            "opc_leader",
            "market_intel",
            "solution_architect",
            "customer_success",
            "qa_tech_support",
        ],
        step_names=[
            "OPC负责人",
            "市场情报专家",
            "解决方案架构师",
            "客户成功经理",
            "技术支持专家",
        ],
        qa_version="v2",
    )
    assert result == QA_TECH_SUPPORT_V2


def test_haolong_fields_generate_dynamic():
    """获客 Pipeline 字段应生成动态 prompt。"""
    haolong_fields = [
        "线索评分",
        "客户档案",
        "触达策略",
        "沟通话术",
        "营销内容",
        "分发计划",
    ]
    result = build_qa_prompt(
        output_fields=haolong_fields,
        step_ids=[
            "lead_acquisition",
            "lead_archive",
            "lead_outreach",
            "content_publish",
            "qa_tech_support",
        ],
        step_names=["获客AI", "归档AI", "触达AI", "发布AI", "质量检查专家"],
        qa_version="v3",
    )

    # 不是原始 v3 prompt
    assert result != QA_TECH_SUPPORT_V3

    # 包含获客的字段名
    assert "线索评分" in result
    assert "客户档案" in result
    assert "分发计划" in result

    # 包含上游 Agent 的 step_id（不含 qa_tech_support 自身）
    assert "lead_acquisition" in result
    assert "content_publish" in result
    assert (
        "qa_tech_support" not in result.split("source_agent")[0]
    )  # qa 不在 agent 列表中

    # 包含上游 Agent 名称
    assert "获客AI" in result
    assert "发布AI" in result

    # 包含评分维度
    assert "完整性" in result
    assert "需求匹配度" in result


def test_product_fields_generate_dynamic():
    """产品部字段应生成动态 prompt。"""
    product_fields = [
        "机会评估",
        "竞品分析",
        "产品定义",
        "技术规格",
        "成本定价",
        "开发计划",
        "合规路径",
    ]
    result = build_qa_prompt(
        output_fields=product_fields,
        step_ids=[
            "product_manager",
            "competitive_research",
            "product_planning",
            "compliance_check",
            "qa_tech_support",
        ],
        step_names=[
            "产品部门经理",
            "竞品研究专员",
            "产品规划专员",
            "合规评估专员",
            "质量检查专家",
        ],
    )

    assert "机会评估" in result
    assert "合规路径" in result
    assert "product_manager" in result
    assert "7个字段" in result or "7字段" in result


# ── validate_output 自定义字段测试 ────────────────────────────────────


def test_validate_output_custom_fields_pass():
    """自定义字段校验通过。"""
    fields = ["线索评分", "客户档案", "触达策略"]
    data = {f: f"内容_{f}" for f in fields}
    is_valid, issues = validate_output(data, fields=fields)
    assert is_valid is True
    assert issues == []


def test_validate_output_custom_fields_missing():
    """自定义字段缺失检测。"""
    fields = ["线索评分", "客户档案", "触达策略"]
    data = {"线索评分": "有"}
    is_valid, issues = validate_output(data, fields=fields)
    assert is_valid is False
    assert any("客户档案" in i for i in issues)
    assert any("触达策略" in i for i in issues)


def test_validate_output_default_fields():
    """不传 fields 参数时使用默认 OUTPUT_FIELDS。"""
    data = {f: f"内容" for f in OUTPUT_FIELDS}
    is_valid, issues = validate_output(data)
    assert is_valid is True


# ── _parse_qa_output 自定义字段测试 ──────────────────────────────────


def test_parse_qa_output_custom_fields():
    """_parse_qa_output 用自定义字段校验。"""
    import json

    custom_fields = ["线索评分", "客户档案"]
    qa_json = json.dumps(
        {
            "qa_result": "pass",
            "quality_score": {
                "scores": {
                    "完整性": 4.0,
                    "逻辑一致性": 4.0,
                    "需求匹配度": 4.0,
                    "信息密度": 4.0,
                    "行业专业性": 4.0,
                    "可执行性": 4.0,
                },
                "issues": [],
            },
            "final_output": {
                "线索评分": "高质量线索",
                "客户档案": "客户A档案",
            },
        },
        ensure_ascii=False,
    )

    final_output, qa_result = _parse_qa_output(qa_json, custom_fields)
    assert final_output is not None
    assert qa_result["qa_result"] == "pass"


def test_parse_qa_output_custom_fields_fail():
    """缺少自定义字段时应标记为 fail。"""
    import json

    custom_fields = ["线索评分", "客户档案", "触达策略"]
    qa_json = json.dumps(
        {
            "qa_result": "pass",
            "quality_score": {
                "scores": {
                    "完整性": 4.0,
                    "逻辑一致性": 4.0,
                    "需求匹配度": 4.0,
                    "信息密度": 4.0,
                    "行业专业性": 4.0,
                    "可执行性": 4.0,
                },
            },
            "final_output": {
                "线索评分": "有",
                # 缺少 客户档案 和 触达策略
            },
        },
        ensure_ascii=False,
    )

    final_output, qa_result = _parse_qa_output(qa_json, custom_fields)
    assert qa_result["qa_result"] == "fail"
    assert any("客户档案" in i for i in qa_result["issues"])


# ── Flow 配置加载测试 ────────────────────────────────────────────────


def test_haolong_config_has_qa_step():
    """获客 Flow 配置应包含 QA 尾步。"""
    import yaml

    with open("config/flow_haolong.yaml", encoding="utf-8") as f:
        config = yaml.safe_load(f)

    step_ids = [s["id"] for s in config["steps"]]
    assert "qa_tech_support" in step_ids
    assert step_ids[-1] == "qa_tech_support"  # 必须是最后一步


def test_product_config_has_qa_step():
    """产品部 Flow 配置应包含 QA 尾步。"""
    import yaml

    with open("config/flow_product.yaml", encoding="utf-8") as f:
        config = yaml.safe_load(f)

    step_ids = [s["id"] for s in config["steps"]]
    assert "qa_tech_support" in step_ids
    assert step_ids[-1] == "qa_tech_support"


# ── 回归断言:钉死"四层烟雾链"(2026-06-22 朝堂前端真链反查出)──────────────
# 背景:final_output 漏字段 + C2/C3 产品偏置 + 软分偏置 + 总分维度名漂移,四个 bug
# 互相掩盖,让"非产品蜂群质量差"这个错误结论存活很久。下列断言把"对的分项→对的总分"
# 和"非产品蜂群不被产品硬核查误杀"绑死,让 CI 每次替人复核。


def test_non_product_scores_not_halved_by_name_drift():
    """铁律2 SSOT:动态 QA prompt 的维度名(结构完整性/数据一致性/风险识别质量)必须被
    calculate_total_score 认得——好分项不能因名字对不上权重表而被腰斩。
    历史 bug:libu 分项 5/4/5/4/4 被算成 1.64(应 ~4.47)。"""
    libu_like = {
        "结构完整性": 5,
        "数据一致性": 4,
        "需求匹配度": 5,
        "可执行性": 4,
        "风险识别质量": 4,
    }
    total = calculate_total_score(libu_like)
    assert total >= 4.0, f"好分项被腰斩:total={total}(名字漂移回归)"


def test_opc_dimension_names_no_regression():
    """OPC 旧命名仍正确加权,修复不得回归产品蜂群。"""
    opc_like = {
        "完整性": 5,
        "逻辑一致性": 4,
        "需求匹配度": 5,
        "信息密度": 4,
        "行业专业性": 4,
        "可执行性": 5,
    }
    assert calculate_total_score(opc_like) >= 4.0


def _qa_raw(hard_checks: dict) -> str:
    import json

    return json.dumps(
        {
            "final_output": {"a": "x"},
            "qa_result": "pass",
            "quality_score": {"scores": {"需求匹配度": 5, "可执行性": 4}},
            "hard_checks": hard_checks,
        },
        ensure_ascii=False,
    )


def test_general_domain_exempts_product_hard_checks():
    """非产品蜂群(qa_domain=general):C2需求约束/C3事实 FAIL 不得代码强制判 fail
    (产品语义对招聘/法律不适用),只 C1 数字勾稽封顶。"""
    raw = _qa_raw(
        {"C1数字勾稽": "NA", "C2需求硬约束命中": "FAIL", "C3事实有据": "FAIL"}
    )
    _fo, qa = _parse_qa_output(raw, output_fields=["a"], qa_domain="general")
    assert qa.get("qa_result") != "fail", "非产品蜂群被产品硬核查误杀(域豁免回归)"


def test_product_domain_still_enforces_hard_checks():
    """产品蜂群(qa_domain=product,默认):C2 FAIL 仍代码强制判 fail,不得放水。"""
    raw = _qa_raw(
        {"C1数字勾稽": "PASS", "C2需求硬约束命中": "FAIL", "C3事实有据": "PASS"}
    )
    _fo, qa = _parse_qa_output(raw, output_fields=["a"], qa_domain="product")
    assert qa.get("qa_result") == "fail", "产品蜂群硬核查被放水(强制回归)"
