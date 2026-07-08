from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

from src.production_events import recent_events


class FakeRunner:
    DEFAULT_BUSINESS_LEDGER = Path("/tmp/business.jsonl")
    DEFAULT_GOLDEN_CANDIDATES = Path("/tmp/candidates.jsonl")
    DEFAULT_EVENTS = Path("/tmp/events.jsonl")
    DEFAULT_FAILURES = Path("/tmp/failures.jsonl")
    CASES_PATH = Path("/tmp/golden_cases.json")
    HARNESS_ROOT = Path("/tmp/harness")
    review_calls = []
    dashboard_calls = []

    @classmethod
    def load_business_cases(cls, path):
        cls.dashboard_calls.append(("business", path))
        return {
            "case_a": {
                "task": "低温储能商机",
                "source": "客户询盘",
                "owner": "销售A",
                "light": "yellow",
                "status": "awaiting_human_signoff",
                "headline": "可继续澄清，报价/交期/安全需签字",
                "why": "报价需要人工确认",
                "next_action": "人工确认后再沟通",
                "forbidden_actions": ["禁止报价", "禁止承诺交期"],
            }
        }

    @classmethod
    def load_golden_candidate_states(cls, path):
        cls.dashboard_calls.append(("candidates", path))
        return {
            "cand_a": {
                "candidate_id": "cand_a",
                "case_id": "case_a",
                "promotion_status": "needs_human_review",
                "observed_output": "客户说预算可调整",
            },
            "cand_b": {
                "candidate_id": "cand_b",
                "case_id": "case_b",
                "promotion_status": "promoted",
            },
        }

    @classmethod
    def build_board_review(cls, **kwargs):
        cls.dashboard_calls.append(("review", kwargs))
        return {
            "board": "chaotang-commercial-loop",
            "maturity_level": "L4 Closed-loop",
            "counts": {"business_cases": 1, "pending_golden_candidates": 1},
            "missing": ["缺少真实首屏仪表盘"],
            "build": ["把 business cards 接到朝堂 UI 首屏"],
            "advisor_notes": {"zhang_xiaolong": "减少解释，把下一步变成默认动作。"},
        }

    @classmethod
    def review_golden_candidate(cls, **kwargs):
        cls.review_calls.append(kwargs)
        if kwargs["candidate_id"] == "missing":
            raise SystemExit("unknown golden candidate: missing")
        return {
            "event_type": "golden_candidate_review",
            "candidate_id": kwargs["candidate_id"],
            "review_status": kwargs["status"],
            "reviewer": kwargs["reviewer"],
            "review_note": kwargs["note"],
        }


def test_commercial_loop_dashboard_endpoint(monkeypatch):
    from web.main import app
    from web.routers import commercial_loop

    FakeRunner.dashboard_calls = []
    monkeypatch.setattr(commercial_loop, "_load_runner", lambda: FakeRunner)
    client = TestClient(app)

    response = client.get("/api/commercial-loop/dashboard")

    assert response.status_code == 200
    data = response.json()
    assert data["maturity_level"] == "L4 Closed-loop"
    assert data["business_cards"][0]["case_id"] == "case_a"
    assert data["business_cards"][0]["light"] == "yellow"
    assert data["business_cards"][0]["forbidden_actions"] == ["禁止报价", "禁止承诺交期"]
    assert data["golden_candidates"]["pending"][0]["candidate_id"] == "cand_a"
    assert data["golden_candidates"]["promoted"][0]["candidate_id"] == "cand_b"
    assert "zhang_xiaolong" in data["advisor_notes"]


def test_commercial_loop_dashboard_uses_configured_artifact_paths(monkeypatch, tmp_path):
    from web.main import app
    from web.routers import commercial_loop

    paths = {
        "FENGQUN_COMMERCIAL_BUSINESS_LEDGER": tmp_path / "business.jsonl",
        "FENGQUN_COMMERCIAL_GOLDEN_CANDIDATES": tmp_path / "candidates.jsonl",
        "FENGQUN_COMMERCIAL_EVENTS": tmp_path / "events.jsonl",
        "FENGQUN_COMMERCIAL_FAILURES": tmp_path / "failures.jsonl",
    }
    for key, value in paths.items():
        monkeypatch.setenv(key, str(value))
    FakeRunner.dashboard_calls = []
    monkeypatch.setattr(commercial_loop, "_load_runner", lambda: FakeRunner)
    client = TestClient(app)

    response = client.get("/api/commercial-loop/dashboard")

    assert response.status_code == 200
    assert ("business", paths["FENGQUN_COMMERCIAL_BUSINESS_LEDGER"]) in FakeRunner.dashboard_calls
    assert ("candidates", paths["FENGQUN_COMMERCIAL_GOLDEN_CANDIDATES"]) in FakeRunner.dashboard_calls
    review_call = [call for call in FakeRunner.dashboard_calls if call[0] == "review"][-1][1]
    assert review_call["event_path"] == paths["FENGQUN_COMMERCIAL_EVENTS"]
    assert review_call["failure_path"] == paths["FENGQUN_COMMERCIAL_FAILURES"]
    assert review_call["golden_candidate_path"] == paths["FENGQUN_COMMERCIAL_GOLDEN_CANDIDATES"]


def test_commercial_loop_can_promote_candidate(monkeypatch, tmp_path):
    from web.main import app
    from web.routers import commercial_loop

    FakeRunner.review_calls = []
    event_path = tmp_path / "commercial-promote-events.jsonl"
    monkeypatch.setenv("FENGQUN_PRODUCTION_EVENTS", str(event_path))
    monkeypatch.setattr(commercial_loop, "_load_runner", lambda: FakeRunner)
    client = TestClient(app)

    response = client.post(
        "/api/commercial-loop/golden-candidates/cand_a/promote",
        json={"reviewer": "史馆", "note": "人工确认", "reference": "预算澄清优先"},
    )

    assert response.status_code == 200
    assert response.json()["status"] == "promoted"
    assert FakeRunner.review_calls[-1]["status"] == "promoted"
    assert FakeRunner.review_calls[-1]["reference"] == "预算澄清优先"
    assert FakeRunner.review_calls[-1]["golden_cases_path"] == (
        FakeRunner.HARNESS_ROOT / "artifacts" / "commercial_loop_promoted_cases.json"
    )
    event = recent_events(path=event_path)[-1]
    assert event["event_type"] == "commercial_golden_candidate_review"
    assert event["task_id"] == "cand_a"
    assert event["swarm"] == "bingbu"
    assert event["status"] == "promoted"
    assert event["prime_minister_next_step"]["owner"] == "bingbu"
    assert event["qintianjian_trigger"]["signal"] == "customer_outcome_or_aftercare_feedback"


def test_commercial_loop_promote_can_use_configured_golden_cases_path(monkeypatch, tmp_path):
    from web.main import app
    from web.routers import commercial_loop

    configured = tmp_path / "reviewed_cases.json"
    FakeRunner.review_calls = []
    monkeypatch.setenv("FENGQUN_COMMERCIAL_GOLDEN_CASES", str(configured))
    monkeypatch.setattr(commercial_loop, "_load_runner", lambda: FakeRunner)
    client = TestClient(app)

    response = client.post(
        "/api/commercial-loop/golden-candidates/cand_a/promote",
        json={"reviewer": "史馆", "note": "人工确认", "reference": "预算澄清优先"},
    )

    assert response.status_code == 200
    assert FakeRunner.review_calls[-1]["golden_cases_path"] == configured


def test_commercial_loop_can_reject_candidate(monkeypatch, tmp_path):
    from web.main import app
    from web.routers import commercial_loop

    FakeRunner.review_calls = []
    event_path = tmp_path / "commercial-reject-events.jsonl"
    monkeypatch.setenv("FENGQUN_PRODUCTION_EVENTS", str(event_path))
    monkeypatch.setattr(commercial_loop, "_load_runner", lambda: FakeRunner)
    client = TestClient(app)

    response = client.post(
        "/api/commercial-loop/golden-candidates/cand_a/reject",
        json={"reviewer": "史馆", "note": "重复样本"},
    )

    assert response.status_code == 200
    assert response.json()["status"] == "rejected"
    assert FakeRunner.review_calls[-1]["status"] == "rejected"
    assert FakeRunner.review_calls[-1]["note"] == "重复样本"
    event = recent_events(path=event_path)[-1]
    assert event["status"] == "rejected"
    assert event["gate_status"] == "clear"
    assert "不得复用" in event["prime_minister_next_step"]["blocker"]


def test_commercial_loop_review_unknown_candidate_returns_400(monkeypatch, tmp_path):
    from web.main import app
    from web.routers import commercial_loop

    event_path = tmp_path / "commercial-missing-events.jsonl"
    monkeypatch.setenv("FENGQUN_PRODUCTION_EVENTS", str(event_path))
    monkeypatch.setattr(commercial_loop, "_load_runner", lambda: FakeRunner)
    client = TestClient(app)

    response = client.post(
        "/api/commercial-loop/golden-candidates/missing/promote",
        json={"reviewer": "史馆", "reference": "预算澄清优先"},
    )

    assert response.status_code == 400
    assert "unknown golden candidate" in response.json()["detail"]
    assert recent_events(path=event_path) == []
