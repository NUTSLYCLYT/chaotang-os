"""同意天才建议后落地的两条(张小龙:等多久要诚实 / charity-majors:修完要能被看见)。

- pending_action 的 waiting_hint:只做"已等待多久"(数据真实存在),不编"预计还要多久"
  (没有历史处置时长分布,编一个数字就是 F 项批过的"未接地冒充权威"同款毛病)。
- court_action 的幂等结果(claimed/replay/in_flight)落 production_events,
  这样几周真实流量后能看数据判断 idempotent_in_flight 是否值得继续投入,而不是靠猜。
"""
from __future__ import annotations

import importlib
from pathlib import Path

from fastapi.testclient import TestClient

from src import court_state_store as css
from src import production_events as pe

app = importlib.import_module("web.main").app
client = TestClient(app)


# ---- waiting_hint:纯函数,可复现,不碰真实时钟 ----
def test_waiting_hint_absent_without_now(tmp_path: Path):
    p = tmp_path / "s.json"
    css.set_state("d", "待审", dept="hubu", si="accounting", title="X", severity=1,
                  updated_at="2026-07-01T00:00:00+08:00", path=p)
    pa = css.pending_action("hubu", "accounting", path=p)   # 不传 now → 保持旧行为可复现
    assert pa["top"]["waiting_hint"] is None
    assert pa["top"]["waiting_since"] == "2026-07-01T00:00:00+08:00"


def test_waiting_hint_minutes_hours_days(tmp_path: Path):
    p = tmp_path / "s.json"
    css.set_state("d", "待审", dept="hubu", si="accounting", title="X", severity=1,
                  updated_at="2026-07-01T00:00:00+08:00", path=p)
    assert css.pending_action("hubu", "accounting", now="2026-07-01T00:20:00+08:00", path=p
                               )["top"]["waiting_hint"] == "已等待 20 分钟"
    assert css.pending_action("hubu", "accounting", now="2026-07-01T05:00:00+08:00", path=p
                               )["top"]["waiting_hint"] == "已等待 5 小时"
    assert css.pending_action("hubu", "accounting", now="2026-07-04T00:00:00+08:00", path=p
                               )["top"]["waiting_hint"] == "已等待 3 天"


def test_waiting_hint_honest_on_bad_input(tmp_path: Path):
    """时间戳缺失/格式错 → 诚实返回 None,不硬凑文案(不編不存在的等待时长)。"""
    p = tmp_path / "s.json"
    css.set_state("d", "待审", dept="hubu", si="accounting", title="X", severity=1,
                  updated_at="不是时间戳", path=p)
    assert css.pending_action("hubu", "accounting", now="2026-07-01T00:00:00+08:00", path=p
                               )["top"]["waiting_hint"] is None


def test_pending_endpoint_returns_waiting_hint(tmp_path: Path, monkeypatch):
    """走真实端点:/api/court/pending 在 web 层取真实时钟,应该带 waiting_hint。"""
    monkeypatch.setattr(css, "_DEFAULT_PATH", tmp_path / "s.json")
    css.set_state("d1", "待审", dept="hubu", si="accounting", title="垫资合同", severity=2,
                  updated_at="2026-01-01T00:00:00+08:00", path=tmp_path / "s.json")
    r = client.get("/api/court/pending", params={"dept": "hubu", "si": "accounting"})
    assert r.status_code == 200
    top = r.json()["data"]["top"]
    assert top["waiting_since"] == "2026-01-01T00:00:00+08:00"
    assert top["waiting_hint"] is not None and "已等待" in top["waiting_hint"]  # 早年份→真实端点必有值


# ---- 幂等结果可观测:claimed / replay / in_flight 都落 production_events ----
def test_idempotency_outcomes_recorded_as_events(tmp_path: Path, monkeypatch):
    monkeypatch.setattr(css, "_IDEM_PATH", tmp_path / "idem.json")
    monkeypatch.setenv("FENGQUN_PRODUCTION_EVENTS", str(tmp_path / "events.jsonl"))

    doc = {"doc_id": "obs-1", "actions": ["apply_fixes"], "workflow": {"state": "待审"}}
    key = "obs-key-1"

    r1 = client.post("/api/court/action", json={"doc": doc, "action": "apply_fixes",
                                                  "idempotency_key": key})
    assert r1.json()["data"]["status"] == "ok"
    r2 = client.post("/api/court/action", json={"doc": doc, "action": "apply_fixes",
                                                  "idempotency_key": key})
    assert r2.json()["data"]["idempotent_replay"] is True

    events = pe.recent_events(path=tmp_path / "events.jsonl")
    statuses = [e["status"] for e in events if e["event_type"] == "court_idempotency"]
    assert statuses == ["claimed", "replay"]


def test_idempotency_in_flight_recorded_as_event(tmp_path: Path, monkeypatch):
    monkeypatch.setattr(css, "_IDEM_PATH", tmp_path / "idem.json")
    monkeypatch.setenv("FENGQUN_PRODUCTION_EVENTS", str(tmp_path / "events.jsonl"))

    key = "obs-key-2"
    css.claim_idempotent(key, path=tmp_path / "idem.json")   # 模拟并发请求正卡在执行中

    doc = {"doc_id": "obs-2", "actions": ["apply_fixes"], "workflow": {"state": "待审"}}
    r = client.post("/api/court/action", json={"doc": doc, "action": "apply_fixes",
                                                 "idempotency_key": key})
    assert r.json()["data"]["code"] == "idempotent_in_flight"

    events = pe.recent_events(path=tmp_path / "events.jsonl")
    statuses = [e["status"] for e in events if e["event_type"] == "court_idempotency"]
    assert statuses == ["in_flight"]
