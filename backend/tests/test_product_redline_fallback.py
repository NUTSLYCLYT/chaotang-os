from src.swarm_fallbacks import _apply_product_redline_final_output_with_report


def test_product_redline_amends_low_temp_1p5kwh_constraints():
    output, report = _apply_product_redline_final_output_with_report(
        "产品部产品规划流程",
        "config/flow_product.yaml",
        "针对北方寒冷地区户外电源市场（-30℃），1.5kWh容量，目标价3000元以内，10月发布",
        {"机会评估": "模型原始输出"},
    )

    assert report["triggered"] is True
    assert report["pattern"] == "low_temp_1p5kwh_3000_october"
    assert "三约束不可同时满足" in output["机会评估"]
    assert "BOM空间约1000-1500元" in output["成本定价"]
    assert "原10月窗口高风险或不可行" in output["开发计划"]
    assert "提价至3500-4000元" in output["成本定价"]
    assert "不等于满足原需求" in output["成本定价"]


def test_product_redline_amends_vehicle_600wh_constraints():
    output, report = _apply_product_redline_final_output_with_report(
        "产品部产品规划流程",
        "config/flow_product.yaml",
        "公司要做车载便携储能，12V/24V兼容，600Wh，支持-20℃启动，目标终端价1500元，Q2上市",
        {"机会评估": "模型原始输出"},
    )

    assert report["triggered"] is True
    assert report["pattern"] == "vehicle_600wh_1500_q2"
    assert "四约束高度冲突" in output["机会评估"]
    assert "必须保持600Wh" in output["产品定义"]
    assert "BOM空间约500-750元" in output["成本定价"]
    assert "不能改成2027年" in output["开发计划"]
    assert "振动、EMC、UN38.3" in output["合规路径"]


def test_product_redline_ignores_other_flows():
    output, report = _apply_product_redline_final_output_with_report(
        "财务分析与财务风险评估流程",
        "config/flow_finance.yaml",
        "600Wh 1500 Q2",
        {"财务画像": "ok"},
    )

    assert output == {"财务画像": "ok"}
    assert report["triggered"] is False
