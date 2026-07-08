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
