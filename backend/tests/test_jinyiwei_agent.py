"""锦衣卫情报 agent 测试:检索(注入)→ vet 分级 → court_doc。不打网,search_fn 全 mock。"""
from src import jinyiwei_agent as ja


def _search_ok(_q):
    return [
        {"claim": "竞品A中标某储能电站", "sources": [{"tier": "一手"}]},                       # 入库→绿
        {"claim": "行业传闻B扩产", "sources": [{"name": "财新"}, {"name": "第一财经"}]},         # 二手多源→绿
        {"claim": "某产品通过UL9540认证", "sources": [{"name": "某公众号"}]},                    # 硬声明非一手→待核黄
        {"claim": "未证实小道消息", "sources": []},                                              # 无源→拒红
    ]


def test_gather_intel_grades_and_lights():
    doc = ja.gather_intel("竞品储能动态", search_fn=_search_ok, archive=False)
    lights = [i["level"] for i in doc["items"]]
    assert lights == ["green", "green", "yellow", "red"]
    # 硬声明那条必须"待核",不自动过闸(锦衣卫铁律)
    hard = doc["items"][2]
    assert hard["impact"] == "待核" and hard["level"] == "yellow"
    # 谍报头灯汇总:1 脏 + 1 待核
    assert "挡门外 1" in doc["shielded"] and "1 条待核" in doc["shielded"]


def test_gather_intel_deterministic_grounded():
    doc = ja.gather_intel("x", search_fn=_search_ok, archive=False)
    prov = doc.get("provenance") or {}
    # vet 是确定性门,非 LLM:接地方式必须是确定性,不能靠 rag/llm 自证
    assert prov.get("deterministic_gated") is True


def test_empty_search_is_honest_not_fabricated():
    doc = ja.gather_intel("无结果查询", search_fn=lambda _q: [], archive=False)
    assert doc["items"] == []
    assert "不编造" in doc["shielded"]


def test_search_fn_failure_degrades_to_empty():
    def boom(_q):
        raise RuntimeError("网关挂了")
    doc = ja.gather_intel("x", search_fn=boom, archive=False)
    assert doc["items"] == []  # 检索失败不崩,空态诚实


def test_no_search_fn_is_empty_not_error():
    doc = ja.gather_intel("x", archive=False)  # 未接搜索源
    assert doc["items"] == []
