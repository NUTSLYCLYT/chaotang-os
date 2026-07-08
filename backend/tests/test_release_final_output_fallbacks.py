from src.flow_engine import (
    _build_pack_rd_final_output,
    _build_quotation_final_output,
    _build_sdlc_final_output,
    _build_sourcing_final_output,
    _build_xiaohongshu_final_output,
)


def test_quotation_fallback_contains_cost_anchor_and_terms():
    output = _build_quotation_final_output("客户要-30℃户外电源,1.5kWh,要求循环1500次,催着今天出个报价")

    assert "14000-21000" in output["报价明细"]
    assert "正式报价需BOM审批" in output["合同条款"]
    assert "禁止未核库存" in output["风险与建议"]


def test_sourcing_fallback_rejects_normal_21700_for_minus_30c():
    output = _build_sourcing_final_output("为户外电源项目找-30℃可用21700电芯，3.5Ah以上，循环1500次，目标单价≤8元/支")

    assert "标准21700" in output["电芯参数对比表"]
    assert "不满足" in output["电芯参数对比表"]
    assert "EVE" in output["推荐供应商池"]


def test_sdlc_fallback_returns_runnable_weather_cli():
    output = _build_sdlc_final_output("开发一个天气查询CLI工具，输入城市名输出当前温度湿度，Python 3.10+实现")

    assert "argparse" in output["代码实现"]
    assert "Open-Meteo" in output["需求规格说明"]
    assert "python weather.py --city Beijing" in output["测试报告"]


def test_xiaohongshu_fallback_refuses_fake_test_data():
    output = _build_xiaohongshu_final_output("帮我策划一篇小红书笔记：主题是『-40℃极限测评，我把电池放在内蒙古零下40度户外测了3天』")

    assert "标题选项" in output["内容选题矩阵"]
    assert "严禁捏造测评数据" in output["舆情与合规风险"]


def test_pack_rd_fallback_uses_library_cell_and_checks_energy_range():
    output = _build_pack_rd_final_output("基于给定电芯列表做PACK评估。需求：12V电压平台，电量1100Wh，可上浮15%")

    assert "18650-3500mAh 4S24P" in output["售前成本核算"]
    assert "1209.6Wh" in output["系统BOM汇总"]
    assert "不加PTC/加热膜" in output["结构热设计方案"]
