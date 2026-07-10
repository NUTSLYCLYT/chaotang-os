# tests/test_chaotang_closed_loop.py
"""T-be1: 大殿大臣状态真实联动 + 闭环端点加固测试。

覆盖:
  1. throne/overview 大臣状态非全 idle(注入有 running run 后应推断出 processing)
  2. memorial review 边界:action 校验、空奏折 fail、reviewer fallback
  3. study/briefing 待裁决区包含 pending 状态(非仅 running)
  4. archive 返回结构完整(memorials + decisions)
  5. archive retrospective 可 GET(synthetic) + POST 保存 + 不存在自动合成
  6. POST retrospective 持久化后 GET 返回真实版本
"""

from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient

# ──────────────── fixtures ────────────────


@pytest.fixture()
def client(monkeypatch):
    monkeypatch.setenv("FENGQUN_AUTH", "false")
    from web.main import app

    return TestClient(app)


def _make_memorial(
    run_id: str,
    dept: str = "finance",
    status: str = "running",
    risk: str = "low",
    priority: str = "normal",
) -> dict:
    """返回一个最小 memorial dict(enrich_memorial 格式)。"""
    return {
        "id": run_id,
        "title": f"test-{run_id}",
        "sourceDepartment": dept,
        "agentCode": "hu_bu",
        "priority": priority,
        "riskLevel": risk,
        "status": status,
        "summary": "test",
        "createdAt": "2026-05-28T00:00:00",
        "suggestedAction": None,
        "deadline": None,
        "qualityScore": None,
        "grade": None,
    }


# ──────────────── 1. throne/overview 大臣状态真实联动 ────────────────


class TestThroneOverviewMinisterStatus:
    def test_ministers_present(self, client):
        r = client.get("/api/chaotang/throne/overview")
        assert r.status_code == 200
        ministers = r.json()["data"]["ministers"]
        assert len(ministers) == 11

    def test_ministers_have_status_field(self, client):
        ministers = client.get("/api/chaotang/throne/overview").json()["data"][
            "ministers"
        ]
        valid = {"idle", "processing", "risk", "pending_review", "done"}
        for m in ministers:
            assert "status" in m, f"minister {m.get('id')} 缺 status 字段"
            assert m["status"] in valid, f"minister status={m['status']!r} 非法"

    def test_minister_status_reflects_running_memorial(self, client, monkeypatch):
        """注入 finance 部门有 running 奏折后,hu_bu 大臣应为 processing。"""
        import web.routers.throne as throne_mod

        running_mem = _make_memorial("run_test_run", dept="finance", status="running")
        monkeypatch.setattr(throne_mod, "_build_memorial_list", lambda: [running_mem])
        # 重置缓存
        throne_mod._CT_MEMORIAL_CACHE["expires_at"] = 0.0

        r = client.get("/api/chaotang/throne/overview")
        ministers = r.json()["data"]["ministers"]
        finance = next(m for m in ministers if m.get("department") == "finance")
        assert (
            finance["status"] == "processing"
        ), f"finance 有 running 奏折应为 processing,得 {finance['status']!r}"

    def test_minister_status_reflects_high_risk_memorial(self, client, monkeypatch):
        """注入 legal 部门 high risk 奏折后,xing_bu 应为 risk。"""
        import web.routers.throne as throne_mod

        risk_mem = _make_memorial(
            "run_risk", dept="legal", status="pending", risk="high"
        )
        monkeypatch.setattr(throne_mod, "_build_memorial_list", lambda: [risk_mem])
        throne_mod._CT_MEMORIAL_CACHE["expires_at"] = 0.0

        ministers = client.get("/api/chaotang/throne/overview").json()["data"][
            "ministers"
        ]
        legal = next(m for m in ministers if m.get("department") == "legal")
        assert (
            legal["status"] == "risk"
        ), f"legal 有 high risk 奏折应为 risk,得 {legal['status']!r}"

    def test_minister_status_reflects_pending_memorial(self, client, monkeypatch):
        """注入 market 部门 pending 奏折后,li_bu_rites 应为 pending_review。"""
        import web.routers.throne as throne_mod
        import web.task_registry as tr

        pending_mem = _make_memorial(
            "run_pend", dept="market", status="pending", risk="low"
        )
        monkeypatch.setattr(throne_mod, "_build_memorial_list", lambda: [pending_mem])
        throne_mod._CT_MEMORIAL_CACHE["expires_at"] = 0.0
        # 隔离 task_snapshot,确保无在跑任务干扰大臣状态推断
        monkeypatch.setattr(tr, "_task_registry", {})

        ministers = client.get("/api/chaotang/throne/overview").json()["data"][
            "ministers"
        ]
        market = next(m for m in ministers if m.get("department") == "market")
        assert (
            market["status"] == "pending_review"
        ), f"market 有 pending 奏折应为 pending_review,得 {market['status']!r}"

    def test_no_hardcoded_idle(self, client, monkeypatch):
        """注入有 running/risk/pending 奏折时,不应有任意大臣仍是 idle(仅看有数据的部门)。"""
        import web.routers.throne as throne_mod

        mems = [
            _make_memorial("r1", dept="finance", status="running"),
            _make_memorial("r2", dept="legal", status="pending", risk="high"),
        ]
        monkeypatch.setattr(throne_mod, "_build_memorial_list", lambda: mems)
        throne_mod._CT_MEMORIAL_CACHE["expires_at"] = 0.0

        ministers = client.get("/api/chaotang/throne/overview").json()["data"][
            "ministers"
        ]
        dept_status = {m["department"]: m["status"] for m in ministers}
        assert dept_status["finance"] != "idle"
        assert dept_status["legal"] != "idle"

    def test_empty_memorials_all_idle(self, client, monkeypatch):
        """无任何奏折且无在跑任务时,全部大臣应为 idle。"""
        import web.routers.throne as throne_mod
        import web.task_registry as tr

        monkeypatch.setattr(throne_mod, "_build_memorial_list", lambda: [])
        throne_mod._CT_MEMORIAL_CACHE["expires_at"] = 0.0
        # 隔离 task_snapshot,确保无在跑任务
        monkeypatch.setattr(tr, "_task_registry", {})

        ministers = client.get("/api/chaotang/throne/overview").json()["data"][
            "ministers"
        ]
        assert all(m["status"] == "idle" for m in ministers)

    def test_archived_memorial_yields_done_not_idle(self, client, monkeypatch):
        """approve 后奏折 status 变为 archived,大臣状态应为 done,不应回退 idle。
        回归测试:T-16 sidecar 改 approve→archived 之前只认 approved,archived 落 else→idle。
        """
        import web.routers.throne as throne_mod
        import web.task_registry as tr

        archived_mem = _make_memorial(
            "run_arch", dept="finance", status="archived", risk="low"
        )
        monkeypatch.setattr(throne_mod, "_build_memorial_list", lambda: [archived_mem])
        throne_mod._CT_MEMORIAL_CACHE["expires_at"] = 0.0
        # 隔离 task_snapshot,确保无在跑任务干扰推断
        monkeypatch.setattr(tr, "_task_registry", {})

        ministers = client.get("/api/chaotang/throne/overview").json()["data"][
            "ministers"
        ]
        finance = next(m for m in ministers if m.get("department") == "finance")
        assert (
            finance["status"] == "done"
        ), f"archived 奏折对应大臣应为 done,得 {finance['status']!r}"


# ──────────────── 2. memorial review 边界加固 ────────────────


class TestMemorialReviewEdges:
    def _inject_run(self, monkeypatch, run_id: str, has_output: bool = True):
        import web.routers.chaotang as ct

        class _FakeRun:
            task_input = "测试任务"
            final_output = {"recommendation": "建议"} if has_output else {}

        monkeypatch.setattr(
            ct, "load_run", lambda rid: _FakeRun() if rid == run_id else None
        )

    def test_approve_returns_ok(self, client, monkeypatch, tmp_path):
        import src.chaotang_store as cs

        monkeypatch.setattr(cs, "_DATA_ROOT", tmp_path)
        self._inject_run(monkeypatch, "run_ok")
        r = client.post(
            "/api/chaotang/memorials/run_ok/review",
            json={"action": "approve", "comment": "准"},
        )
        assert r.status_code == 200
        body = r.json()
        assert body["success"] is True
        assert body["data"]["action"] == "approve"
        assert body["data"]["taskStatus"] == "archived"

    def test_reject_returns_reviewed_status(self, client, monkeypatch, tmp_path):
        import src.chaotang_store as cs

        monkeypatch.setattr(cs, "_DATA_ROOT", tmp_path)
        self._inject_run(monkeypatch, "run_rej")
        r = client.post(
            "/api/chaotang/memorials/run_rej/review",
            json={"action": "reject", "comment": "驳回"},
        )
        assert r.status_code == 200
        assert r.json()["data"]["taskStatus"] == "reviewed"

    def test_inquire_action_valid(self, client, monkeypatch, tmp_path):
        import src.chaotang_store as cs

        monkeypatch.setattr(cs, "_DATA_ROOT", tmp_path)
        self._inject_run(monkeypatch, "run_inq")
        r = client.post(
            "/api/chaotang/memorials/run_inq/review",
            json={"action": "inquire", "comment": "需追问"},
        )
        assert r.status_code == 200
        assert r.json()["success"] is True

    def test_invalid_action_rejected(self, client, monkeypatch, tmp_path):
        """无效 action 应被拒绝:Pydantic 422 或 200 success=False 均可。"""
        import src.chaotang_store as cs

        monkeypatch.setattr(cs, "_DATA_ROOT", tmp_path)
        self._inject_run(monkeypatch, "run_bad")
        r = client.post(
            "/api/chaotang/memorials/run_bad/review",
            json={"action": "explode", "comment": ""},
        )
        # 接受 422(Pydantic 校验) 或 200 success=False(业务层校验)
        assert r.status_code in (200, 422), f"期望拒绝,得 {r.status_code}"
        if r.status_code == 200:
            assert r.json()["success"] is False

    def test_nonexistent_run_returns_fail(self, client, monkeypatch, tmp_path):
        import src.chaotang_store as cs
        import web.routers.chaotang as ct

        monkeypatch.setattr(cs, "_DATA_ROOT", tmp_path)
        monkeypatch.setattr(ct, "load_run", lambda rid: None)
        r = client.post(
            "/api/chaotang/memorials/no_such_run/review",
            json={"action": "approve", "comment": ""},
        )
        assert r.status_code == 200
        assert r.json()["success"] is False

    def test_approve_no_final_output_does_not_crash(
        self, client, monkeypatch, tmp_path
    ):
        """final_output 为空时 approve 不应 500。"""
        import src.chaotang_store as cs

        monkeypatch.setattr(cs, "_DATA_ROOT", tmp_path)
        self._inject_run(monkeypatch, "run_empty", has_output=False)
        r = client.post(
            "/api/chaotang/memorials/run_empty/review",
            json={"action": "approve", "comment": ""},
        )
        assert r.status_code == 200
        assert r.json()["success"] is True


# ──────────────── 3. study/briefing 待裁决区含 pending ────────────────


class TestStudyBriefingPendingDecisions:
    def test_pending_decisions_includes_pending_status(self, client, monkeypatch):
        """study/briefing pendingDecisions 应包含 pending 状态奏折,不只 running。"""
        import web.routers.throne as throne_mod

        mems = [
            _make_memorial("r_pend", dept="finance", status="pending", priority="high"),
            _make_memorial("r_run", dept="legal", status="running", priority="normal"),
        ]
        monkeypatch.setattr(throne_mod, "_build_memorial_list", lambda: mems)
        throne_mod._CT_MEMORIAL_CACHE["expires_at"] = 0.0

        r = client.get("/api/chaotang/study/briefing")
        assert r.status_code == 200
        data = r.json()["data"]
        pending_ids = {d["memorialId"] for d in data["pendingDecisions"]}
        assert "r_pend" in pending_ids, "pending 状态奏折应出现在 pendingDecisions 中"

    def test_briefing_shape_complete(self, client):
        r = client.get("/api/chaotang/study/briefing")
        assert r.status_code == 200
        data = r.json()["data"]
        for key in (
            "dailyReport",
            "importantEvents",
            "pendingDecisions",
            "recommendations",
            "recentMemorials",
            "recentTasks",
        ):
            assert key in data, f"briefing 缺字段 {key}"

    def test_daily_report_counts(self, client, monkeypatch):
        """dailyReport.pendingDecisions 应同时计 pending + running。"""
        import web.routers.throne as throne_mod

        mems = [
            _make_memorial("r1", status="pending"),
            _make_memorial("r2", status="running"),
            _make_memorial("r3", status="approved"),
        ]
        monkeypatch.setattr(throne_mod, "_build_memorial_list", lambda: mems)
        throne_mod._CT_MEMORIAL_CACHE["expires_at"] = 0.0

        data = client.get("/api/chaotang/study/briefing").json()["data"]
        assert (
            data["dailyReport"]["pendingDecisions"] >= 2
        ), "pending+running 合计应至少 2"


# ──────────────── 4. archive 结构完整 ────────────────


class TestArchiveStructure:
    def test_archive_returns_memorials_and_decisions(
        self, client, monkeypatch, tmp_path
    ):
        import src.chaotang_store as cs

        monkeypatch.setattr(cs, "_DATA_ROOT", tmp_path)
        r = client.get("/api/chaotang/archive")
        assert r.status_code == 200
        data = r.json()["data"]
        assert "memorials" in data
        assert "decisions" in data
        assert isinstance(data["memorials"], list)
        assert isinstance(data["decisions"], list)

    def test_approved_memorial_appears_in_archive(self, client, monkeypatch, tmp_path):
        """approve 后奏折应出现在 archive 列表里。"""
        import src.chaotang_store as cs
        import web.routers.throne as throne_mod

        monkeypatch.setattr(cs, "_DATA_ROOT", tmp_path)

        # 保存一条 approve review
        cs.save_review("run_arch", action="approve", comment="归档", reviewer="皇上")

        # 注入含 run_arch 的奏折列表
        mem = _make_memorial("run_arch", status="approved")
        monkeypatch.setattr(throne_mod, "_build_memorial_list", lambda: [mem])
        throne_mod._CT_MEMORIAL_CACHE["expires_at"] = 0.0

        data = client.get("/api/chaotang/archive").json()["data"]
        ids = {m["id"] for m in data["memorials"]}
        assert "run_arch" in ids


# ──────────────── 5 & 6. archive retrospective ────────────────


class TestArchiveRetrospective:
    def test_get_nonexistent_returns_synthetic(self, client, monkeypatch, tmp_path):
        import src.chaotang_store as cs

        monkeypatch.setattr(cs, "_DATA_ROOT", tmp_path)
        r = client.get("/api/chaotang/archive/no_task/retrospective")
        assert r.status_code == 200
        data = r.json()["data"]
        assert data["synthetic"] is True
        assert "score" in data

    def test_get_existing_returns_saved(self, client, monkeypatch, tmp_path):
        import src.chaotang_store as cs

        monkeypatch.setattr(cs, "_DATA_ROOT", tmp_path)
        cs.save_retrospective(
            "task_real",
            {
                "score": 5,
                "successes": ["全程闭环"],
                "failures": [],
                "lessons": ["单 worker"],
                "authoredBy": "史官",
            },
        )
        r = client.get("/api/chaotang/archive/task_real/retrospective")
        assert r.status_code == 200
        data = r.json()["data"]
        assert data["score"] == 5
        assert data["synthetic"] is False

    def test_post_retrospective_persists(self, client, monkeypatch, tmp_path):
        """POST /archive/{task_id}/retrospective 保存后 GET 应返回真实版本(非 synthetic)。"""
        import src.chaotang_store as cs

        monkeypatch.setattr(cs, "_DATA_ROOT", tmp_path)
        payload = {
            "score": 4,
            "successes": ["dispatch 跑通"],
            "failures": ["stream 超时"],
            "lessons": ["心跳延长到 15s"],
            "playbook": "下次先测 SSE",
            "authoredBy": "史官",
            "outcome": "success",
        }
        r = client.post("/api/chaotang/archive/task_post/retrospective", json=payload)
        assert r.status_code == 200
        assert r.json()["success"] is True
        saved = r.json()["data"]
        assert saved["score"] == 4
        assert saved["lessons"] == ["心跳延长到 15s"]
        assert saved["outcome"] == "success"

        # GET 应返回刚保存的版本
        r2 = client.get("/api/chaotang/archive/task_post/retrospective")
        assert r2.json()["data"]["synthetic"] is False
        assert r2.json()["data"]["score"] == 4
        assert r2.json()["data"]["outcome"] == "success"

    def test_post_retrospective_rejects_invalid_outcome(
        self, client, monkeypatch, tmp_path
    ):
        """outcome 只接受三态之一;非法值落到 pending,不静默存假状态。"""
        import src.chaotang_store as cs

        monkeypatch.setattr(cs, "_DATA_ROOT", tmp_path)
        r = client.post(
            "/api/chaotang/archive/task_bad_outcome/retrospective",
            json={"score": 3, "outcome": "not_a_real_state"},
        )
        assert r.status_code == 422  # pydantic Literal 校验直接拒绝

    def test_post_invalid_score_still_saves(self, client, monkeypatch, tmp_path):
        """score 缺失时默认 3,不崩。"""
        import src.chaotang_store as cs

        monkeypatch.setattr(cs, "_DATA_ROOT", tmp_path)
        r = client.post(
            "/api/chaotang/archive/task_noscore/retrospective",
            json={"successes": [], "failures": [], "lessons": []},
        )
        assert r.status_code == 200
        assert r.json()["success"] is True
        assert r.json()["data"]["score"] == 3


# ──────────────── 6. 路径穿越校验 ────────────────


class TestPathTraversalGuard:
    """恶意 task_id / run_id 应被拒绝(success=False),不得触及文件系统。"""

    # null 字节(\x00)由 HTTP 客户端层面拒绝,无需到路由层校验
    _MALICIOUS = [
        "../../etc/passwd",
        "../secrets",
        "foo/bar",
    ]

    def test_post_retrospective_rejects_malicious_task_id(
        self, client, monkeypatch, tmp_path
    ):
        import src.chaotang_store as cs

        monkeypatch.setattr(cs, "_DATA_ROOT", tmp_path)
        for bad_id in self._MALICIOUS:
            r = client.post(
                f"/api/chaotang/archive/{bad_id}/retrospective",
                json={"score": 3, "successes": [], "failures": [], "lessons": []},
            )
            # FastAPI 会把 path segment 匹配截断,导致部分 id 路由失败(404/422);
            # 若路由命中则业务层必须拒绝(success=False)
            if r.status_code == 200:
                assert (
                    r.json()["success"] is False
                ), f"期望拒绝恶意 task_id={bad_id!r},但返回 success=True"

    def test_get_retrospective_rejects_malicious_task_id(
        self, client, monkeypatch, tmp_path
    ):
        import src.chaotang_store as cs

        monkeypatch.setattr(cs, "_DATA_ROOT", tmp_path)
        for bad_id in self._MALICIOUS:
            r = client.get(f"/api/chaotang/archive/{bad_id}/retrospective")
            if r.status_code == 200:
                assert (
                    r.json()["success"] is False
                ), f"期望拒绝恶意 task_id={bad_id!r},但返回 success=True"

    def test_safe_id_still_works(self, client, monkeypatch, tmp_path):
        """合法 id 校验通过后端正常处理,不误拦。"""
        import src.chaotang_store as cs

        monkeypatch.setattr(cs, "_DATA_ROOT", tmp_path)
        r = client.post(
            "/api/chaotang/archive/safe-task_01/retrospective",
            json={"score": 4, "successes": ["ok"], "failures": [], "lessons": []},
        )
        assert r.status_code == 200
        assert r.json()["success"] is True


# ──────────────── 7. 批阅后 memorial.status 同步 ────────────────


class TestMemorialStatusSync:
    """approve/reject 后,列表/详情端点返回的 memorial.status 应反映批阅态,不再 pending。"""

    def _inject_run(self, monkeypatch, run_id: str):
        import web.routers.chaotang as ct

        class _FakeRun:
            task_input = "状态同步测试任务"
            final_output = {"recommendation": "测试建议"}
            qa_result = None
            steps = []
            flow_name = "chaotang"

        # run_id 是实例属性,需动态赋值
        fake = _FakeRun()
        fake.run_id = run_id
        monkeypatch.setattr(ct, "load_run", lambda rid: fake if rid == run_id else None)

    def test_approve_persists_archived_status(self, client, monkeypatch, tmp_path):
        """approve 后 get_memorial_status 应返回 'archived'。"""
        import src.chaotang_store as cs

        monkeypatch.setattr(cs, "_DATA_ROOT", tmp_path)
        self._inject_run(monkeypatch, "run_sync1")

        r = client.post(
            "/api/chaotang/memorials/run_sync1/review",
            json={"action": "approve", "comment": "准"},
        )
        assert r.json()["success"] is True

        assert (
            cs.get_memorial_status("run_sync1") == "archived"
        ), "approve 后持久状态应为 archived"

    def test_reject_persists_rejected_status(self, client, monkeypatch, tmp_path):
        """reject 后 get_memorial_status 应返回 'rejected'。"""
        import src.chaotang_store as cs

        monkeypatch.setattr(cs, "_DATA_ROOT", tmp_path)
        self._inject_run(monkeypatch, "run_sync2")

        r = client.post(
            "/api/chaotang/memorials/run_sync2/review",
            json={"action": "reject", "comment": "驳回"},
        )
        assert r.json()["success"] is True

        assert (
            cs.get_memorial_status("run_sync2") == "rejected"
        ), "reject 后持久状态应为 rejected"

    def test_memorial_detail_shows_archived_after_approve(
        self, client, monkeypatch, tmp_path
    ):
        """approve 后 GET /memorials/{id} 返回的 status 应为 archived,不再 pending。"""
        import src.chaotang_store as cs

        monkeypatch.setattr(cs, "_DATA_ROOT", tmp_path)
        self._inject_run(monkeypatch, "run_sync3")

        client.post(
            "/api/chaotang/memorials/run_sync3/review",
            json={"action": "approve", "comment": "准"},
        )

        r = client.get("/api/chaotang/memorials/run_sync3")
        assert r.status_code == 200
        assert (
            r.json()["data"]["status"] == "archived"
        ), f"approve 后详情 status 应为 archived,得 {r.json()['data'].get('status')!r}"

    def test_memorial_detail_shows_rejected_after_reject(
        self, client, monkeypatch, tmp_path
    ):
        """reject 后 GET /memorials/{id} 返回的 status 应为 rejected。"""
        import src.chaotang_store as cs

        monkeypatch.setattr(cs, "_DATA_ROOT", tmp_path)
        self._inject_run(monkeypatch, "run_sync4")

        client.post(
            "/api/chaotang/memorials/run_sync4/review",
            json={"action": "reject", "comment": "驳回"},
        )

        r = client.get("/api/chaotang/memorials/run_sync4")
        assert r.status_code == 200
        assert (
            r.json()["data"]["status"] == "rejected"
        ), f"reject 后详情 status 应为 rejected,得 {r.json()['data'].get('status')!r}"

    def test_unreviewed_memorial_status_unchanged(self, client, monkeypatch, tmp_path):
        """未批阅的奏折 get_memorial_status 应返回 None(不误覆盖)。"""
        import src.chaotang_store as cs

        monkeypatch.setattr(cs, "_DATA_ROOT", tmp_path)
        assert cs.get_memorial_status("no_review_run") is None
