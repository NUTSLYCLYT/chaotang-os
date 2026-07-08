"""钦天监真实信号 + 敞口探测 + 触发器核销 + routing_truth · 回归门(2026-07-08 完善油箱)。

钉死:三路真信号从真账本采(连胜/缺证/引用塌缩)、无源维度诚实 None+自招供、
敞口只探文本能探的两条(blast_radius 恒招供)、触发器发了能核销(留名纪律)、
路由决定落账供阈值校准。
"""

from datetime import datetime, timedelta, timezone

import pytest

import src.tenant as T
from src import qintianjian_signals as qs
from src.orchestration_plan import record_routing_decision
from src.qintianjian_lens import lens_envelope, qintianjian_lens


@pytest.fixture()
def tenant_tmp(tmp_path, monkeypatch):
    monkeypatch.setattr(T, "DATA_ROOT", tmp_path)
    with T.tenant_context("t_q"):
        yield tmp_path


def _seed_truth(verdicts: list[str]):
    from src.truth_ledger import record

    base = datetime.now(timezone.utc) - timedelta(hours=len(verdicts))
    for i, v in enumerate(verdicts):
        record(
            swarm="quotation",
            checker="quotation_real_score",
            verdict=v,
            case_id=f"c{i}",
            evidence=f"e{i}",
            ts=(base + timedelta(hours=i)).isoformat(),
        )


# ── 信号采集 ─────────────────────────────────────────────────────────


def test_win_streak_and_deficit_from_truth_ledger(tenant_tmp):
    _seed_truth(["PASS", "FAIL", "PASS", "UNKNOWN", "PASS", "PASS"])
    out = qs.collect_cycle_signals()
    sig, prov = out["signals"], out["provenance"]
    # 连胜:尾部 PASS,PASS,(UNKNOWN 不计不断),PASS → streak=3
    assert prov["win_streak_danger"]["source"] == "truth_ledger"
    assert "连胜 3 条" in prov["win_streak_danger"]["note"]
    assert 0 < sig["win_streak_danger"] < 1
    # 缺证率:6 判定里 1 条 UNKNOWN
    assert abs(sig["evidence_deficit"] - 1 / 6) < 1e-4


def test_court_doc_light_vocabulary(tenant_tmp):
    """真账本第二词表(court_doc 灯):green=胜/red=败断链/yellow=缺证有保留。"""
    _seed_truth(["green", "red", "green", "yellow", "green", "green"])
    out = qs.collect_cycle_signals()
    assert "连胜 3 条" in out["provenance"]["win_streak_danger"]["note"]
    # yellow 计入缺证率:6 条里 1 条
    assert abs(out["signals"]["evidence_deficit"] - 1 / 6) < 1e-4


def test_citation_collapse_signal(tenant_tmp):
    from src.shiguan_outcome import log_citation

    for _ in range(4):
        log_citation(["同一个旧案"])
    log_citation(["别的案"])
    out = qs.collect_cycle_signals()
    # n<10 小语料塌缩是构造性必然,按未知剔分母(会审Taleb)
    assert out["signals"]["correlation_to_one"] is None
    assert "不足以判塌缩" in out["provenance"]["correlation_to_one"]["note"]

    for i in range(5):
        log_citation([f"其他案{i}"])
    out2 = qs.collect_cycle_signals()  # 10条:4同源+6各异
    assert out2["signals"]["correlation_to_one"] == 0.4
    assert out2["provenance"]["correlation_to_one"]["samples"] == 10


def test_empty_ledgers_are_honest_unknown(tenant_tmp):
    out = qs.collect_cycle_signals()
    sig = out["signals"]
    assert all(sig[k] is None for k in sig), "空账本全维 None,不造假数"
    virgin = qs.virgin_dimensions(out["provenance"])
    assert set(virgin) == set(sig), "全维自招供 0 次真实输入"


def test_no_proxy_for_unsourced_dimensions(tenant_tmp):
    """replication_accel/valuation_heat 无真实源:永远 None+招供,禁 proxy 冒充。"""
    _seed_truth(["PASS"] * 5)
    out = qs.collect_cycle_signals()
    for k in ("replication_accel", "valuation_heat"):
        assert out["signals"][k] is None
        assert out["provenance"][k]["note"] == "0 次真实输入"


# ── 敞口探测 ─────────────────────────────────────────────────────────


def test_exposure_detects_payment_and_commitment(tenant_tmp):
    out = qs.detect_exposure("给供应商预付 30% 定金,并对外报价承诺交期")
    exp = out["exposure"]
    assert exp["irreversible_payment"] is True
    assert exp["external_commitment"] is True
    # 不能响的警报已拆除,不再假装存在(会审Taleb)
    assert "blast_radius_over_threshold" not in exp


def test_exposure_clean_text(tenant_tmp):
    out = qs.detect_exposure("帮我复盘一下上周的试制瓶颈")
    assert not any(v for k, v in out["exposure"].items()), "干净文本不触任何敞口"


def test_exposure_feeds_lens_veto(tenant_tmp):
    """真实链路:密旨文本含预付款 → 敞口 → 镜片 ruin 否决(签字轴强制)。"""
    exp = qs.detect_exposure("向新供应商预付 50 万定金锁产能")
    lens = qintianjian_lens({"entry_swarms": ["opc"]}, exposure=exp["exposure"])
    assert lens["verdict"] == "veto"


# ── 自招供进信封 ─────────────────────────────────────────────────────


def test_virgin_dimensions_confess_in_envelope(tenant_tmp):
    sig = qs.collect_cycle_signals()  # 空账本:全未知
    lens = qintianjian_lens({"entry_swarms": ["opc"]}, signals=sig["signals"])
    lens["data_provenance"] = sig["provenance"]
    env = lens_envelope(lens)
    assert "0 次真实输入" in env["uncertainty"]
    assert "replication_accel" in env["uncertainty"]


# ── 触发器核销账本 ────────────────────────────────────────────────────


def test_trigger_lifecycle(tenant_tmp):
    recs = qs.log_triggers("task-1", ["若单一客户占比>80%,重开镜片"])
    assert len(recs) == 1 and recs[0]["status"] == "open"
    pend = qs.pending_triggers()
    assert [p["id"] for p in pend] == [recs[0]["id"]]

    with pytest.raises(ValueError, match="留名"):
        qs.resolve_trigger(recs[0]["id"], fired=False, resolved_by="")

    done = qs.resolve_trigger(
        recs[0]["id"], fired=True, resolved_by="老板", note="真发生了"
    )
    assert done["status"] == "fired"
    assert qs.pending_triggers() == [], "核销后不再催问"

    with pytest.raises(ValueError, match="已核销"):
        qs.resolve_trigger(recs[0]["id"], fired=False, resolved_by="老板")


def test_triggers_tenant_isolated(tenant_tmp):
    qs.log_triggers("task-1", ["触发器A"])
    with T.tenant_context("t_other"):
        assert qs.pending_triggers() == []


# ── routing_truth 账本 ───────────────────────────────────────────────


def test_routing_decision_recorded(tenant_tmp):
    plan = {
        "mode": "junjichu",
        "entry_swarms": ["quotation", "legal"],
        "abstained": [{"ministry": "gong_bu", "reason": "无自信命中"}],
        "ministries": [{"code": "hubu", "score": 3}, {"code": "xingbu", "score": 2}],
    }
    record_routing_decision(plan, "算报价并核对合同违约风险", chosen_by="chancellor")
    record_routing_decision(
        {"mode": "explicit", "entry_swarms": ["opc"]}, "随便", chosen_by="user"
    )
    import json

    path = T.get_tenant_data_dir("routing") / "decisions.jsonl"
    rows = [json.loads(x) for x in path.read_text(encoding="utf-8").splitlines()]
    assert len(rows) == 2
    assert (
        rows[0]["mode"] == "junjichu"
        and rows[0]["ministry_scores"][0]["code"] == "hubu"
    )
    assert rows[1]["chosen_by"] == "user", "人推翻路由的对照组也要攒"


def test_trigger_endpoints(tenant_tmp):
    """API 面:GET 催问清单 / POST 核销(留名取登录身份,匿名 400)。"""
    import importlib

    from fastapi.testclient import TestClient

    from web.deps import get_current_user
    from web.schemas.auth import CurrentUser

    app = importlib.import_module("web.main").app

    def _boss():
        T.set_current_tenant("t_q")
        return CurrentUser(username="老板", tenant_slug="t_q")

    app.dependency_overrides[get_current_user] = _boss
    try:
        client = TestClient(app)
        rec = qs.log_triggers("task-9", ["若供应商涨价>10%,重开镜片"])[0]
        pend = client.get("/api/qintianjian/triggers/pending").json()
        assert [p["id"] for p in pend] == [rec["id"]]
        r = client.post(
            f"/api/qintianjian/triggers/{rec['id']}/resolve",
            json={"fired": False, "note": "核实未涨"},
        )
        assert r.status_code == 200 and r.json()["resolved_by"] == "老板"
        assert client.get("/api/qintianjian/triggers/pending").json() == []
    finally:
        app.dependency_overrides.pop(get_current_user, None)
