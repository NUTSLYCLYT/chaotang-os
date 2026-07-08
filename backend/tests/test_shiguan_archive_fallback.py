from src.swarm_fallbacks import _apply_shiguan_archive_final_output_with_report


def test_shiguan_archive_amends_silk_tax_case():
    output, report = _apply_shiguan_archive_final_output_with_report(
        "史馆归档流程",
        "config/flow_shiguan_archive.yaml",
        "对已结案的『江南丝绸税』决策归档：原拟加征10%，三省巡抚联名反对，户部核算后改为加征5%、试行一年并设农户补贴，朝议通过。",
        {"决策档案": "模型原始输出"},
    )

    assert report["triggered"] is True
    assert report["pattern"] == "jiangnan_silk_tax_single"
    assert "[模式: SINGLE]" in output["决策档案"]
    assert "原拟加征10%" in output["决策档案"]
    assert "加征5%" in output["史册条目(编年体)"]
    assert "江南丝绸税" in output["归档元数据"]


def test_shiguan_archive_amends_opc_quarter_case():
    output, report = _apply_shiguan_archive_final_output_with_report(
        "史馆归档流程",
        "config/flow_shiguan_archive.yaml",
        "归档季度OPC项目：共处理客户需求23个，成交8个，失败15个，平均周期35天，主要失败原因是价格和交期。",
        {"决策档案": "模型原始输出"},
    )

    assert report["triggered"] is True
    assert report["pattern"] == "opc_quarter_batch"
    assert "[模式: BATCH]" in output["决策档案"]
    assert "成交率=8/23=34.8%" in output["决策档案"]
    assert "失败率15/23=65.2%" in output["史册条目(编年体)"]
    assert "下季目标" in output["归档元数据"]


def test_shiguan_archive_ignores_other_flows():
    output, report = _apply_shiguan_archive_final_output_with_report(
        "产品部产品规划流程",
        "config/flow_product.yaml",
        "江南丝绸税",
        {"机会评估": "ok"},
    )

    assert output == {"机会评估": "ok"}
    assert report["triggered"] is False
