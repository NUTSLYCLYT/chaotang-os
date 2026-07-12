"""tests/test_real_department_engines.py — 真实部门引擎共享注册表:契约映射 + 失败兜底。"""

from __future__ import annotations

import json

from src import real_department_engines as rde


def _court_doc(
    light="yellow", items=None, headline="判定文本", shielded="为你挡了什么"
):
    return {
        "doc_type": "brief",
        "dept": "bingbu",
        "case_id": "BB-20260703-000",
        "light": light,
        "headline": headline,
        "shielded": shielded,
        "items": (
            items
            if items is not None
            else [
                {
                    "level": "yellow",
                    "title": "线索评分:xxx",
                    "fix": "未经战情团复核",
                    "evidence_ref": "truth://x",
                },
            ]
        ),
        "adversarial": None,
        "actions": ["take_next_action"],
        "provenance": {
            "advisors": [],
            "archive_id": "BB-20260703-000",
            "gate": "pending",
            "rag_grounded": False,
            "deterministic_gated": False,
            "grounding": "none",
        },
        "source_label": "LIVE_SWARM",
        "signed": False,
        "seal": {
            "stamp": "令旗印",
            "color": "赤橙",
            "sealed_archive": "BB-20260703-000",
        },
    }


def _jinyiwei_doc(items=None):
    return {
        "doc_type": "brief",
        "dept": "jinyiwei",
        "case_id": "JYW-x",
        "light": "yellow",
        "headline": "需人工复核 —— 未接地",
        "shielded": "未获取到可核情报(不编造)",
        "items": items if items is not None else [],
        "adversarial": None,
        "actions": ["verify_source"],
        "provenance": {
            "advisors": [],
            "archive_id": None,
            "gate": "pending",
            "rag_grounded": False,
            "deterministic_gated": True,
            "grounding": "deterministic",
        },
        "source_label": "MIXED",
        "signed": False,
        "seal": {"stamp": "绣春刀印", "color": "玄黑暗红", "sealed_archive": None},
    }


def test_adapt_bingbu_success(monkeypatch):
    import src.bingbu_battlecard as bb

    monkeypatch.setattr(
        bb, "run_bingbu_battlecard", lambda task_input, **kw: _court_doc()
    )
    doc = rde.adapt_bingbu("要不要给这个客户报价")
    assert doc is not None
    assert doc["dept"] == "bingbu"


def test_adapt_bingbu_failure_returns_none(monkeypatch):
    import src.bingbu_battlecard as bb

    def _boom(task_input, **kw):
        raise RuntimeError("flow engine down")

    monkeypatch.setattr(bb, "run_bingbu_battlecard", _boom)
    assert rde.adapt_bingbu("任何任务") is None


def test_adapt_bingbu_empty_items_returns_none(monkeypatch):
    import src.bingbu_battlecard as bb

    monkeypatch.setattr(
        bb, "run_bingbu_battlecard", lambda task_input, **kw: _court_doc(items=[])
    )
    assert rde.adapt_bingbu("任何任务") is None


def test_adapt_jinyiwei_no_findings_is_honest_not_none(monkeypatch):
    import src.jinyiwei_agent as ja

    monkeypatch.setattr(
        ja,
        "gather_intel",
        lambda query, *, search_fn=None, archive=True: _jinyiwei_doc(),
    )
    doc = rde.adapt_jinyiwei("这个客户是不是真的破产了")
    assert doc is not None
    assert doc["items"] == []


def test_adapt_jinyiwei_failure_returns_none(monkeypatch):
    import src.jinyiwei_agent as ja

    def _boom(query, *, search_fn=None, archive=True):
        raise RuntimeError("vet门挂了")

    monkeypatch.setattr(ja, "gather_intel", _boom)
    assert rde.adapt_jinyiwei("任何任务") is None


def test_merge_known_evidence_extracts_multiple_short_candidates():
    """2026-07-12 Codex 停止前审查发现:把一整段任务描述当成一个整体子串去
    LIKE 匹配，要求历史 claim/query 逐字包含这一大段文本才算命中——两次
    任务描述只要措辞稍有不同就永远不会命中，等同于让"读历史复用"这个
    功能形同虚设。这里直接测 `_candidate_keywords` 按标点切出的候选短语，
    不是整段原文一个字不差地当子串。"""
    keywords = rde._candidate_keywords("某供应商资质尽调，追加核实新情况")
    assert "某供应商资质尽调" in keywords
    assert "追加核实新情况" in keywords
    assert "某供应商资质尽调，追加核实新情况" not in keywords  # 不是整段当一个候选


def test_adapt_jinyiwei_reuses_persisted_evidence_without_duplicate_claims(
    isolated_session_local, monkeypatch
):
    """锦衣卫共享证据服务阶段2验收:两次主题重叠但措辞不同的 adapt_jinyiwei
    调用，第二次应该能读到第一次写回共享池的"入库"级历史情报并合并进检索
    结果，且不会在池子里插入重复的 claim_key 行。两次调用的模拟检索结果
    刻意设成互不相同的 claim 文本——如果只断言"资质核验"这个词出现在第二
    次结果里，即使历史合并完全失效，也会因为第二次自己的新检索结果恰好
    包含这个词而误判通过(这正是 Codex 停止前审查抓到的第一版测试假阳性)。
    这里同时断言第二次结果里出现"资质核验"(来自历史合并)和"合同条款"
    (来自本次新检索)两条互不相同的内容，才能证明合并是真的生效。"""
    import src.jinyiwei_search as js
    from src.db.models import JinyiweiEvidence

    responses = [
        [
            {
                "claim": "该供应商已通过一手资质核验",
                "sources": [{"name": "https://a.com", "tier": "一手"}],
            }
        ],
        [
            {
                "claim": "该供应商合同条款审查无异常",
                "sources": [{"name": "https://b.com", "tier": "一手"}],
            }
        ],
    ]
    call_count = {"n": 0}

    def _fake_tavily(query, **kw):
        idx = call_count["n"]
        call_count["n"] += 1
        return responses[idx] if idx < len(responses) else []

    monkeypatch.setattr(js, "tavily_search", _fake_tavily)

    doc1 = rde.adapt_jinyiwei("某供应商资质尽调")
    assert doc1 is not None
    assert call_count["n"] == 1

    # 第二次任务描述在第一次的基础上加了一句，措辞不同但共享
    # "某供应商资质尽调" 这个短语——_candidate_keywords 会把它切成候选词，
    # 而不是要求整段文本逐字匹配历史记录。
    doc2 = rde.adapt_jinyiwei("某供应商资质尽调，追加核实合同风险")
    assert doc2 is not None
    assert call_count["n"] == 2  # 第二次仍会真实检索，但检索结果会跟历史合并
    claims_seen = {item.get("title") for item in doc2["items"]}
    assert any("资质核验" in (c or "") for c in claims_seen)  # 来自历史合并
    assert any("合同条款" in (c or "") for c in claims_seen)  # 来自本次新检索

    db = isolated_session_local()
    try:
        rows = (
            db.query(JinyiweiEvidence)
            .filter_by(claim="该供应商已通过一手资质核验")
            .all()
        )
        assert len(rows) == 1  # 没有插入重复行，是原地更新
    finally:
        db.close()


def test_adapt_jinyiwei_reuses_evidence_for_unpunctuated_follow_up(
    isolated_session_local, monkeypatch
):
    """2026-07-12 Codex 停止前二次审查纠正:"keyword split still misses
    common unpunctuated follow-ups"——第一版修复只按标点切候选词，遇到
    "某供应商资质尽调追加核实"这种中间没有逗号/句号的追加式后续问法，
    `_candidate_keywords` 切不出比整句更短的候选，退化回"整段当一个候选"
    的老问题。这里专门测这种没有标点分隔的后续问法，验证反向包含检查
    (历史 query 整个作为子串出现在新任务描述里)能补上这个场景。"""
    import src.jinyiwei_search as js
    from src.db.models import JinyiweiEvidence

    responses = [
        [
            {
                "claim": "该供应商已通过一手资质核验",
                "sources": [{"name": "https://a.com", "tier": "一手"}],
            }
        ],
        [
            {
                "claim": "该供应商合同条款审查无异常",
                "sources": [{"name": "https://b.com", "tier": "一手"}],
            }
        ],
    ]
    call_count = {"n": 0}

    def _fake_tavily(query, **kw):
        idx = call_count["n"]
        call_count["n"] += 1
        return responses[idx] if idx < len(responses) else []

    monkeypatch.setattr(js, "tavily_search", _fake_tavily)

    doc1 = rde.adapt_jinyiwei("某供应商资质尽调")
    assert doc1 is not None
    assert call_count["n"] == 1

    # 关键:第二次任务描述在第一次的基础上直接追加文字，中间没有任何
    # 标点分隔——_candidate_keywords 单独切不出"某供应商资质尽调"这个候选，
    # 必须靠 _merge_known_evidence 的反向包含检查(历史 query 整段是新任务
    # 描述的子串)才能命中。
    doc2 = rde.adapt_jinyiwei("某供应商资质尽调追加核实合同风险")
    assert doc2 is not None
    assert call_count["n"] == 2
    claims_seen = {item.get("title") for item in doc2["items"]}
    assert any("资质核验" in (c or "") for c in claims_seen)  # 来自历史合并
    assert any("合同条款" in (c or "") for c in claims_seen)  # 来自本次新检索

    db = isolated_session_local()
    try:
        rows = (
            db.query(JinyiweiEvidence)
            .filter_by(claim="该供应商已通过一手资质核验")
            .all()
        )
        assert len(rows) == 1
    finally:
        db.close()


def test_merge_known_evidence_ignores_generic_short_historical_query(
    isolated_session_local, monkeypatch
):
    """2026-07-12 Codex 停止前三次审查纠正:"reverse substring match can
    merge unrelated historical evidence"——反向包含检查如果不设最短长度
    门槛，一条很短、很通用的历史 query(比如"核实"这两个字)几乎必然是
    任何任务描述的子串，会把完全不相关主题的历史情报错误合并进来。这里
    验证:历史 query 只有 2 个字时，即使这 2 个字确实是新任务描述的子串，
    也不应该触发合并——`_MIN_MATCH_LEN` 挡住了这种通用词误命中。"""
    import src.jinyiwei_search as js

    responses = [
        [
            {
                "claim": "某个完全无关主题的旧结论",
                "sources": [{"name": "https://a.com", "tier": "一手"}],
            }
        ],
        [
            {
                "claim": "本次真实检索到的新结论",
                "sources": [{"name": "https://b.com", "tier": "一手"}],
            }
        ],
    ]
    call_count = {"n": 0}

    def _fake_tavily(query, **kw):
        idx = call_count["n"]
        call_count["n"] += 1
        return responses[idx] if idx < len(responses) else []

    monkeypatch.setattr(js, "tavily_search", _fake_tavily)

    # 第一次任务描述本身就很短、很通用("核实"两个字)——这类查询词
    # 几乎必然是后面任何任务描述的子串。
    doc1 = rde.adapt_jinyiwei("核实")
    assert doc1 is not None

    # 第二次是完全不相关的主题，只是措辞上恰好包含"核实"这两个字。
    doc2 = rde.adapt_jinyiwei("请核实这份完全无关的采购合同细节")
    assert doc2 is not None
    claims_seen = {item.get("title") for item in doc2["items"]}
    assert not any("完全无关主题的旧结论" in (c or "") for c in claims_seen)
    assert any("本次真实检索到的新结论" in (c or "") for c in claims_seen)


def test_merge_known_evidence_still_matches_short_specific_entity(
    isolated_session_local, monkeypatch
):
    """2026-07-12 Codex 停止前四次审查纠正:"min-length fix overcorrects and
    drops valid short entities"——三次审查后把最短长度提到4个字符，确实
    挡住了"核实"这类通用词，但中文很多真实、具体的实体名(公司/城市/产品)
    本来就只有2-3个字，比如"厦门"——一刀切的长度门槛会把这类短但语义具体
    的实体名也一起挡掉，反而让"读历史复用"在这些常见场景里失效。这里验证
    历史 query 是"厦门"这个2字真实地名时，后续追加式问法仍然能正确合并
    历史情报——停用词表挡的是通用连接词/套话，不是所有短字符串。"""
    import src.jinyiwei_search as js

    responses = [
        [
            {
                "claim": "厦门分公司合规资质完备",
                "sources": [{"name": "https://a.com", "tier": "一手"}],
            }
        ],
        [
            {
                "claim": "合作方近期新增股权变更",
                "sources": [{"name": "https://b.com", "tier": "一手"}],
            }
        ],
    ]
    call_count = {"n": 0}

    def _fake_tavily(query, **kw):
        idx = call_count["n"]
        call_count["n"] += 1
        return responses[idx] if idx < len(responses) else []

    monkeypatch.setattr(js, "tavily_search", _fake_tavily)

    doc1 = rde.adapt_jinyiwei("厦门")
    assert doc1 is not None

    # 追加式问法，无标点，且共享的"厦门"只有2个字——如果又退化回长度
    # 一刀切，这条历史情报会被错误挡在外面。
    doc2 = rde.adapt_jinyiwei("厦门合作方尽调追加材料")
    assert doc2 is not None
    claims_seen = {item.get("title") for item in doc2["items"]}
    assert any("厦门分公司合规资质完备" in (c or "") for c in claims_seen)  # 历史合并
    assert any("合作方近期新增股权变更" in (c or "") for c in claims_seen)  # 本次新检索


def test_merge_known_evidence_ignores_generic_short_historical_noun(
    isolated_session_local, monkeypatch
):
    """2026-07-12 Codex 停止前五次审查纠正:"short stopword gate reopens
    unrelated evidence merges"——第一版停用词表只收了"核实"这类通用连接词/
    套话/动词，把最短长度门槛降回2之后，"合同"这类同样通用、但词性是名词
    的高频业务词完全没被挡住——这类通用名词在供应商/合同/投资/尽调类任务
    描述里几乎无处不在，跟"核实"是同一类误合并风险，只是换了词性。这里
    验证历史 query 是通用名词"合同"两个字时，同样不应该触发合并。"""
    import src.jinyiwei_search as js

    responses = [
        [
            {
                "claim": "某个完全无关主题的旧结论",
                "sources": [{"name": "https://a.com", "tier": "一手"}],
            }
        ],
        [
            {
                "claim": "本次真实检索到的新结论",
                "sources": [{"name": "https://b.com", "tier": "一手"}],
            }
        ],
    ]
    call_count = {"n": 0}

    def _fake_tavily(query, **kw):
        idx = call_count["n"]
        call_count["n"] += 1
        return responses[idx] if idx < len(responses) else []

    monkeypatch.setattr(js, "tavily_search", _fake_tavily)

    doc1 = rde.adapt_jinyiwei("合同")
    assert doc1 is not None

    # 第二次是完全不相关的主题，只是措辞上恰好包含"合同"这两个字——
    # 几乎任何供应商/尽调类任务描述都可能提到"合同"这个通用名词。
    doc2 = rde.adapt_jinyiwei("请审阅这份新采购合同的付款条款是否合理")
    assert doc2 is not None
    claims_seen = {item.get("title") for item in doc2["items"]}
    assert not any("完全无关主题的旧结论" in (c or "") for c in claims_seen)
    assert any("本次真实检索到的新结论" in (c or "") for c in claims_seen)


def test_contract_mapping_fields(monkeypatch):
    import src.bingbu_battlecard as bb

    monkeypatch.setattr(
        bb, "run_bingbu_battlecard", lambda task_input, **kw: _court_doc()
    )
    fn = rde.get_real_engine_fn_for_swarm(
        "bingbu_strategy_swarm", swarm_role="兵部竞争战略蜂群"
    )
    assert fn is not None
    out = fn("要不要给这个客户报价")
    assert out is not None
    assert out["swarm_id"] == "bingbu_strategy_swarm"
    assert out["swarm_role"] == "兵部竞争战略蜂群"
    assert out["source_label"] == "LIVE_ENGINE"
    assert out["position"] == "补证"  # yellow → 补证
    assert out["missing_evidence"] == ["未经战情团复核"]
    assert out["key_findings"]
    assert out["evidence_used"]


def test_contract_mapping_empty_items_fills_missing_evidence(monkeypatch):
    import src.jinyiwei_agent as ja

    monkeypatch.setattr(
        ja,
        "gather_intel",
        lambda query, *, search_fn=None, archive=True: _jinyiwei_doc(),
    )
    fn = rde.get_real_engine_fn_for_swarm(
        "jinyiwei_intel_swarm", swarm_role="锦衣卫情报蜂群"
    )
    out = fn("这个客户是不是真的破产了")
    assert out is not None
    assert out["missing_evidence"] == ["未获取到可核情报(不编造)"]
    assert out["evidence_used"] == []


def test_engine_exception_inside_fn_returns_none(monkeypatch):
    import src.bingbu_battlecard as bb

    def _boom(task_input, **kw):
        raise RuntimeError("boom")

    monkeypatch.setattr(bb, "run_bingbu_battlecard", _boom)
    fn = rde.get_real_engine_fn_for_swarm(
        "bingbu_strategy_swarm", swarm_role="兵部竞争战略蜂群"
    )
    assert fn("要不要给这个客户报价") is None


def test_unregistered_swarm_returns_none():
    assert (
        rde.get_real_engine_fn_for_swarm("libu_screen_swarm", swarm_role="吏部筛选蜂群")
        is None
    )


def test_unregistered_minister_code_returns_none():
    # gong_bu(工部)有人设但无真实引擎(需presale+task双输入,未接),应返回 None
    assert rde.get_raw_engine_fn_for_minister("gong_bu") is None


def test_registered_minister_code_returns_adapter(monkeypatch, tmp_path):
    # get_raw_engine_fn_for_minister 现在返回一个包了可见度记录的闭包,不再是原始
    # adapter 本身(2026-07-04 加观测后行为变了)——验证行为一致(调用能穿透到注册表
    # 里的 adapter 并拿到它的返回值),不比对象身份;用假 adapter 避免打真网络。
    monkeypatch.setattr(rde, "_ENGINE_CALL_LOG", tmp_path / "calls.jsonl")
    fake_doc = {"items": [{"level": "green"}]}
    for code, dept in (
        ("bing_bu", "兵部"),
        ("jin_yi_wei", "锦衣卫"),
        ("xing_bu", "刑部"),
        ("hu_bu", "户部"),
    ):
        monkeypatch.setitem(rde.REAL_ENGINE_ADAPTERS, dept, lambda t: fake_doc)
        fn = rde.get_raw_engine_fn_for_minister(code)
        assert fn is not None
        assert fn("任意任务") == fake_doc


def test_adapt_xingbu_success(monkeypatch):
    import src.xingbu_verdict as xv

    doc = _court_doc(
        items=[
            {
                "level": "red",
                "title": "违约金比例过高",
                "fix": None,
                "evidence_ref": "truth://x",
            }
        ]
    )
    monkeypatch.setattr(xv, "run_verdict_from_text", lambda raw_text, **kw: doc)
    out = rde.adapt_xingbu("这份采购合同有没有坑")
    assert out is not None
    assert out["items"]


def test_adapt_xingbu_empty_findings_returns_none(monkeypatch):
    import src.xingbu_verdict as xv

    monkeypatch.setattr(
        xv, "run_verdict_from_text", lambda raw_text, **kw: _court_doc(items=[])
    )
    assert rde.adapt_xingbu("今天天气不错") is None


def test_adapt_xingbu_failure_returns_none(monkeypatch):
    import src.xingbu_verdict as xv

    def _boom(raw_text, **kw):
        raise RuntimeError("抽取模型挂了")

    monkeypatch.setattr(xv, "run_verdict_from_text", _boom)
    assert rde.adapt_xingbu("任何任务") is None


def test_adapt_hubu_quotation_skips_unrelated_task():
    # 不含报价关键词 → 不调用真实flow,直接None(防止误判FAIL的假红灯)
    assert rde.adapt_hubu_quotation("要不要招一个新工程师") is None


def test_adapt_hubu_quotation_success_on_quotation_task(monkeypatch):
    import src.quotation_verdict as qv

    doc = _court_doc(
        items=[
            {"level": "green", "title": "毛利率达标", "fix": None, "evidence_ref": "x"}
        ],
    )
    monkeypatch.setattr(qv, "run_quotation_verdict", lambda task_input, **kw: doc)
    out = rde.adapt_hubu_quotation("这个报价大概多少钱")
    assert out is not None
    assert out["items"]


def test_adapt_hubu_quotation_failure_returns_none(monkeypatch):
    import src.quotation_verdict as qv

    def _boom(task_input, **kw):
        raise RuntimeError("flow_quotation 挂了")

    monkeypatch.setattr(qv, "run_quotation_verdict", _boom)
    assert rde.adapt_hubu_quotation("这个报价大概多少钱") is None


def test_call_adapter_observed_logs_hit(monkeypatch, tmp_path):
    log_path = tmp_path / "real_engine_calls.jsonl"
    monkeypatch.setattr(rde, "_ENGINE_CALL_LOG", log_path)
    out = rde._call_adapter_observed(
        "兵部", lambda t: {"items": [{"level": "green"}]}, "x"
    )
    assert out == {"items": [{"level": "green"}]}
    lines = log_path.read_text(encoding="utf-8").strip().splitlines()
    assert len(lines) == 1
    entry = json.loads(lines[0])
    assert entry["dept"] == "兵部"
    assert entry["outcome"] == "hit"
    assert entry["elapsed_ms"] >= 0


def test_call_adapter_observed_logs_empty_on_none(monkeypatch, tmp_path):
    log_path = tmp_path / "real_engine_calls.jsonl"
    monkeypatch.setattr(rde, "_ENGINE_CALL_LOG", log_path)
    out = rde._call_adapter_observed("户部", lambda t: None, "x")
    assert out is None
    entry = json.loads(log_path.read_text(encoding="utf-8").strip())
    assert entry["outcome"] == "empty"


def test_call_adapter_observed_logs_error_on_exception(monkeypatch, tmp_path):
    log_path = tmp_path / "real_engine_calls.jsonl"
    monkeypatch.setattr(rde, "_ENGINE_CALL_LOG", log_path)

    def _boom(t):
        raise RuntimeError("boom")

    out = rde._call_adapter_observed("刑部", _boom, "x")
    assert out is None
    entry = json.loads(log_path.read_text(encoding="utf-8").strip())
    assert entry["outcome"] == "error"


def test_call_adapter_observed_write_failure_is_silent(monkeypatch):
    # 日志目录写不进去(路径非法)也不能让真实判定流程崩掉
    monkeypatch.setattr(rde, "_ENGINE_CALL_LOG", "/nonexistent-root/x/y.jsonl")
    out = rde._call_adapter_observed("兵部", lambda t: {"items": [1]}, "x")
    assert out == {"items": [1]}


def test_adapt_lipu_skips_unrelated_task():
    # 不含对外出稿关键词 → 不调用真实flow,直接None(防止把无关会审喂进flow_lipu空转)
    assert rde.adapt_lipu("要不要招一个PACK工艺工程师") is None


def test_adapt_lipu_success_on_content_task(monkeypatch):
    import src.lipu_vet as lv

    doc = _court_doc(
        items=[
            {
                "level": "green",
                "title": "硬声明有据(素材回链):≥90%",
                "fix": None,
                "evidence_ref": "x",
            }
        ],
    )
    monkeypatch.setattr(lv, "run_lipu_vet", lambda task_input, **kw: doc)
    out = rde.adapt_lipu("用给定素材写一篇公众号推文,素材:容量保持率≥90%")
    assert out is not None
    assert out["items"]


def test_adapt_lipu_failure_returns_none(monkeypatch):
    import src.lipu_vet as lv

    def _boom(task_input, **kw):
        raise RuntimeError("flow_lipu 挂了")

    monkeypatch.setattr(lv, "run_lipu_vet", _boom)
    assert rde.adapt_lipu("写一篇对外新闻稿") is None


def test_adapt_lipu_routes_brand_strategy_through_same_gate(monkeypatch):
    # 品牌战略任务 → 走 run_brand_strategy_vet(跑flow_brand_strategy),但复用同一 lipu_vet 门
    import src.lipu_vet as lv

    called = {}
    brand_doc = _court_doc(
        items=[
            {
                "level": "green",
                "title": "品牌叙事有据",
                "fix": None,
                "evidence_ref": "x",
            }
        ]
    )

    def _brand(task_input, **kw):
        called["brand"] = True
        return brand_doc

    def _content(task_input, **kw):
        called["content"] = True
        return _court_doc()

    monkeypatch.setattr(lv, "run_brand_strategy_vet", _brand)
    monkeypatch.setattr(lv, "run_lipu_vet", _content)
    out = rde.adapt_lipu("给本司做一份品牌战略与品牌定位")
    assert out is not None and called.get("brand") and "content" not in called, called


def test_lipu_registered_on_real_l4_sid():
    # 礼部 L4 真实 sid 是 libu_communication_swarm(SWARM_DEFS 键),不是注册表 flow id "lipu"
    fn = rde.get_real_engine_fn_for_swarm(
        "libu_communication_swarm", swarm_role="礼部对外表达蜂群"
    )
    assert fn is not None
    # 死键回归守卫:上轮误登记的 "lipu" 不该触发
    assert rde.get_real_engine_fn_for_swarm("lipu", swarm_role="x") is None


def test_lipu_registered_on_l3_minister():
    # 礼部 L3 丞相会审 code = li_bu_rites(li_bu 是吏部)
    assert rde.get_raw_engine_fn_for_minister("li_bu_rites") is not None
    assert rde._MINISTER_CODE_DEPT.get("li_bu_rites") == "礼部"


def test_swarm_id_dept_keys_are_real_sids():
    # 结构守卫:_SWARM_ID_DEPT 每个键必须是 SWARM_DEFS 真实 sid,否则是永不触发的死键
    from src.swarm_execution_loop import SWARM_DEFS

    for sid in rde._SWARM_ID_DEPT:
        assert sid in SWARM_DEFS, f"死键:{sid} 不在 SWARM_DEFS,L4 永不触发"


def test_adapt_tianjian_success(monkeypatch):
    import src.tianjian_verdict as tv

    doc = _court_doc(
        items=[
            {
                "level": "yellow",
                "title": "态势:xxx",
                "fix": "来源待核",
                "evidence_ref": "x",
            }
        ],
    )
    monkeypatch.setattr(tv, "run_tianjian_forecast", lambda task_input, **kw: doc)
    out = rde.adapt_tianjian("预判一下明年储能电芯价格走势")
    assert out is not None
    assert out["items"]


def test_adapt_tianjian_empty_items_returns_none(monkeypatch):
    import src.tianjian_verdict as tv

    monkeypatch.setattr(
        tv, "run_tianjian_forecast", lambda task_input, **kw: _court_doc(items=[])
    )
    assert rde.adapt_tianjian("随便一个任务") is None


def test_adapt_tianjian_failure_returns_none(monkeypatch):
    import src.tianjian_verdict as tv

    def _boom(task_input, **kw):
        raise RuntimeError("flow_tianjian 挂了")

    monkeypatch.setattr(tv, "run_tianjian_forecast", _boom)
    assert rde.adapt_tianjian("任何任务") is None


def test_tianjian_registered_on_l3_minister_only():
    # 钦天监只走 L3(qin_tian_jian);不在 SWARM_DEFS 故无 L4 sid
    assert rde.get_raw_engine_fn_for_minister("qin_tian_jian") is not None
    assert "钦天监" not in rde._SWARM_ID_DEPT.values()


def test_adapt_libu_personnel_skips_unrelated_task():
    assert rde.adapt_libu_personnel("这个报价大概多少钱") is None


def test_adapt_libu_personnel_success(monkeypatch):
    import src.libu_vet as lbv

    doc = _court_doc(
        items=[
            {
                "level": "green",
                "title": "安全资质红线已覆盖",
                "fix": None,
                "evidence_ref": "x",
            }
        ],
    )
    monkeypatch.setattr(lbv, "run_libu_verdict", lambda task_input, **kw: doc)
    out = rde.adapt_libu_personnel("招聘锂电PACK工艺工程师,筛选简历并设计面试题")
    assert out is not None
    assert out["items"]


def test_adapt_libu_personnel_failure_returns_none(monkeypatch):
    import src.libu_vet as lbv

    def _boom(task_input, **kw):
        raise RuntimeError("flow_libu 挂了")

    monkeypatch.setattr(lbv, "run_libu_verdict", _boom)
    assert rde.adapt_libu_personnel("设计一套面试方案") is None


def test_adapt_libu_dispatcher_routes_appointment(monkeypatch):
    # 任免/权限任务 → 走责任图分席(确定性),不碰招聘 flow
    import src.libu_appointment_vet as av

    doc = _court_doc(
        items=[{"level": "red", "title": "缺 owner", "fix": None, "evidence_ref": "x"}]
    )
    monkeypatch.setattr(av, "run_libu_appointment", lambda t, **kw: doc)
    out = rde.adapt_libu_personnel("这个权限该授权给谁,谁负责")
    assert out is not None and out["items"]


def test_adapt_libu_dispatcher_routes_recruit(monkeypatch):
    import src.libu_vet as lbv

    doc = _court_doc(
        items=[{"level": "green", "title": "锚定", "fix": None, "evidence_ref": "x"}]
    )
    monkeypatch.setattr(lbv, "run_libu_verdict", lambda t, **kw: doc)
    out = rde.adapt_libu_personnel("招聘锂电PACK工程师,筛选简历")
    assert out is not None and out["items"]


def test_adapt_libu_dispatcher_unrelated_returns_none():
    assert rde.adapt_libu_personnel("今天天气不错") is None


def test_libu_personnel_registered_on_both_paths():
    # 吏部 L3=li_bu(li_bu_rites 才是礼部),L4=libu_org_execution_swarm
    assert rde.get_raw_engine_fn_for_minister("li_bu") is not None
    assert rde._MINISTER_CODE_DEPT.get("li_bu") == "吏部"
    fn = rde.get_real_engine_fn_for_swarm(
        "libu_org_execution_swarm", swarm_role="吏部组织执行蜂群"
    )
    assert fn is not None
