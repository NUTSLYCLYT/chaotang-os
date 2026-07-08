# tests/test_chaotang_draft.py
from src import chaotang_orchestrator as orch


def test_draft_returns_categories(monkeypatch):
    def fake_llm(prompt: str, **_):
        return ('{"draft":"拟旨:评估该项目","intent":"评估项目可行性",'
                '"categories":[{"label":"商业可行性研判","description":"算账+风险",'
                '"taskType":"analysis","ministers":["hu_bu","xing_bu"],"confidence":0.8},'
                '{"label":"市场招商方案","description":"话术+客户","taskType":"creative",'
                '"ministers":["li_bu_rites"],"confidence":0.6}]}')
    monkeypatch.setattr(orch, "_llm_json", fake_llm)
    monkeypatch.setattr(orch, "_kb_search",
                        lambda q: [{"source": "chroma", "snippet": "历史报价 120 万", "score": 0.9}])

    draft = orch.draft_decree("帮我评估这个项目值不值得投")
    assert draft["intent"]
    cats = draft["recommendedCategories"]
    assert len(cats) == 2
    c0 = cats[0]
    assert c0["id"]
    assert c0["ministers"] == ["hu_bu", "xing_bu"]
    assert set(c0["groups"]) == {"finlaw"}
    assert c0["citations"]
    assert draft["source"] == "llm"


def test_draft_rule_fallback_on_llm_error(monkeypatch):
    def boom(*_, **__):
        raise RuntimeError("llm down")
    monkeypatch.setattr(orch, "_llm_json", boom)
    monkeypatch.setattr(orch, "_kb_search", lambda q: [])
    draft = orch.draft_decree("随便问问")
    assert draft["source"] == "rule"
    assert len(draft["recommendedCategories"]) >= 1
