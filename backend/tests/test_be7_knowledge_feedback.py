# tests/test_be7_knowledge_feedback.py
"""T-be7 后端:知识条目 count + 反哺触发端点 验收测试。

覆盖:
  P1-4  GET  /api/chaotang/archive/knowledge/count  → {count, source}
  CL-2  POST /api/chaotang/archive/knowledge/feedback → {processed, succeeded, totalKnowledgeCount, source}
  路由优先级:静态 /archive/knowledge/* 不被 /archive/{task_id}/retrospective 通配拦截
  count_knowledge_items() 单元:RAG 可用时返真值,不可用时静默 0
  feedback 幂等:二次调用不增加条目数
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient


# ──────────────── fixtures ────────────────

@pytest.fixture()
def client(monkeypatch):
    monkeypatch.setenv("FENGQUN_AUTH", "false")
    from web.main import app
    return TestClient(app)


# ──────────────── P1-4: GET /archive/knowledge/count ────────────────

class TestArchiveKnowledgeCount:
    def test_envelope_success(self, client):
        r = client.get("/api/chaotang/archive/knowledge/count")
        assert r.status_code == 200
        body = r.json()
        assert body["success"] is True

    def test_required_fields(self, client):
        data = client.get("/api/chaotang/archive/knowledge/count").json()["data"]
        assert "count" in data, "响应 data 应含 count 字段"
        assert "source" in data, "响应 data 应含 source 字段"

    def test_count_is_int(self, client):
        data = client.get("/api/chaotang/archive/knowledge/count").json()["data"]
        assert isinstance(data["count"], int), f"count 应为 int,得 {type(data['count'])}"

    def test_source_is_chaotang_approved(self, client):
        data = client.get("/api/chaotang/archive/knowledge/count").json()["data"]
        assert data["source"] == "chaotang_approved"

    def test_count_not_negative(self, client):
        data = client.get("/api/chaotang/archive/knowledge/count").json()["data"]
        assert data["count"] >= 0

    def test_rag_failure_returns_zero_not_error(self, client, monkeypatch):
        """RAG 不可用时 count 应为 0,不返回 5xx。"""
        import src.chaotang_store as cs
        monkeypatch.setattr(cs, "count_knowledge_items", lambda: 0)
        r = client.get("/api/chaotang/archive/knowledge/count")
        assert r.status_code == 200
        assert r.json()["data"]["count"] == 0


# ──────────────── 路由优先级:静态不被 {task_id} 通配 ────────────────

class TestKnowledgeRouteNotSwallowed:
    """GET /archive/knowledge/count 不应被 /archive/{task_id}/retrospective 拦截。"""

    def test_count_route_is_not_404(self, client):
        r = client.get("/api/chaotang/archive/knowledge/count")
        # 若被 {task_id} 拦截则 task_id="knowledge",_validate_id 通过但返 fail("无效 task_id")
        # 或 chaotang_store.get_retrospective("knowledge") 走回顾逻辑 → data 字段不含 count
        assert r.status_code == 200
        data = r.json().get("data", {})
        assert "count" in data, (
            "/archive/knowledge/count 应返回 count 字段,若被 {task_id} 拦截则无此字段: "
            + str(r.json())
        )

    def test_feedback_route_is_post_not_get(self, client, monkeypatch):
        """POST /archive/knowledge/feedback 不与 GET /archive/{task_id}/retrospective 混淆。"""
        import web.routers.throne as th
        monkeypatch.setattr(th, "_build_memorial_list", lambda: [])
        r = client.post("/api/chaotang/archive/knowledge/feedback")
        assert r.status_code == 200
        data = r.json().get("data", {})
        assert "processed" in data, "feedback 端点应返回 processed 字段"

    def test_retrospective_still_works_after_new_routes(self, client):
        """新增静态路由后,/archive/{task_id}/retrospective 仍正常。"""
        r = client.get("/api/chaotang/archive/some_run_id/retrospective")
        assert r.status_code == 200
        # 不存在的 run_id 会返回 synthetic 复盘,data 应含 score
        data = r.json().get("data", {})
        assert "score" in data, "retrospective 端点应返回 score 字段"


# ──────────────── CL-2: POST /archive/knowledge/feedback ────────────────

class TestArchiveKnowledgeFeedback:
    def _patch_empty_memorials(self, monkeypatch):
        import web.routers.throne as th
        monkeypatch.setattr(th, "_build_memorial_list", lambda: [])

    def test_envelope_success(self, client, monkeypatch):
        self._patch_empty_memorials(monkeypatch)
        r = client.post("/api/chaotang/archive/knowledge/feedback")
        assert r.status_code == 200
        assert r.json()["success"] is True

    def test_required_fields(self, client, monkeypatch):
        self._patch_empty_memorials(monkeypatch)
        data = client.post("/api/chaotang/archive/knowledge/feedback").json()["data"]
        for field in ("processed", "succeeded", "totalKnowledgeCount", "source"):
            assert field in data, f"feedback 响应缺 {field} 字段"

    def test_source_is_chaotang_approved(self, client, monkeypatch):
        self._patch_empty_memorials(monkeypatch)
        data = client.post("/api/chaotang/archive/knowledge/feedback").json()["data"]
        assert data["source"] == "chaotang_approved"

    def test_no_approved_memorials_processed_zero(self, client, monkeypatch):
        """无已批准奏折时 processed=0,succeeded=0。"""
        import web.routers.throne as th
        monkeypatch.setattr(th, "_build_memorial_list", lambda: [
            {"id": "r1", "status": "pending", "title": "待审", "summary": "摘要"},
            {"id": "r2", "status": "running", "title": "进行中", "summary": "摘要"},
        ])
        data = client.post("/api/chaotang/archive/knowledge/feedback").json()["data"]
        assert data["processed"] == 0
        assert data["succeeded"] == 0

    def test_approved_memorials_processed(self, client, monkeypatch):
        """有 approved/archived 奏折时 processed >= 1。"""
        import web.routers.throne as th
        import src.chaotang_store as cs
        monkeypatch.setattr(th, "_build_memorial_list", lambda: [
            {"id": "r_approved", "status": "approved", "title": "已批准", "summary": "内容摘要"},
            {"id": "r_archived", "status": "archived", "title": "已归档", "summary": "归档摘要"},
            {"id": "r_pending", "status": "pending", "title": "待审", "summary": ""},
        ])
        # stub feedback_to_knowledge 避免真写 RAG
        feedback_calls: list[tuple] = []
        monkeypatch.setattr(cs, "feedback_to_knowledge",
                            lambda title, content: feedback_calls.append((title, content)) or True)
        monkeypatch.setattr(cs, "count_knowledge_items", lambda: len(feedback_calls))

        data = client.post("/api/chaotang/archive/knowledge/feedback").json()["data"]
        assert data["processed"] == 2, f"应处理 2 条 approved/archived,得 {data['processed']}"
        assert data["succeeded"] == 2

    def test_idempotent_double_call(self, client, monkeypatch):
        """二次调用 processed 相同,totalKnowledgeCount 不增加(upsert 幂等)。"""
        import web.routers.throne as th
        import src.chaotang_store as cs
        monkeypatch.setattr(th, "_build_memorial_list", lambda: [
            {"id": "r_idem", "status": "approved", "title": "幂等测试", "summary": "内容"},
        ])
        call_count = {"n": 0}
        def _fake_feedback(title, content):
            call_count["n"] += 1
            return True
        # count 模拟 upsert 幂等:无论调用多少次,结果固定为 1
        monkeypatch.setattr(cs, "feedback_to_knowledge", _fake_feedback)
        monkeypatch.setattr(cs, "count_knowledge_items", lambda: 1)

        d1 = client.post("/api/chaotang/archive/knowledge/feedback").json()["data"]
        d2 = client.post("/api/chaotang/archive/knowledge/feedback").json()["data"]
        assert d1["processed"] == d2["processed"] == 1
        assert d1["totalKnowledgeCount"] == d2["totalKnowledgeCount"] == 1

    def test_rag_failure_does_not_crash(self, client, monkeypatch):
        """RAG 不可用时 feedback 端点不 crash,succeeded=0。"""
        import web.routers.throne as th
        import src.chaotang_store as cs
        monkeypatch.setattr(th, "_build_memorial_list", lambda: [
            {"id": "r_fail", "status": "approved", "title": "测试", "summary": "内容"},
        ])
        monkeypatch.setattr(cs, "feedback_to_knowledge", lambda t, c: False)
        monkeypatch.setattr(cs, "count_knowledge_items", lambda: 0)

        r = client.post("/api/chaotang/archive/knowledge/feedback")
        assert r.status_code == 200
        data = r.json()["data"]
        assert data["succeeded"] == 0
        assert data["totalKnowledgeCount"] == 0


# ──────────────── count_knowledge_items 单元测试 ────────────────

class TestCountKnowledgeItemsUnit:
    def test_returns_int(self):
        from src.chaotang_store import count_knowledge_items
        result = count_knowledge_items()
        assert isinstance(result, int)
        assert result >= 0

    def test_rag_exception_returns_zero(self, monkeypatch):
        """RAG 初始化抛异常时 count_knowledge_items 静默返 0。"""
        import src.chaotang_store as cs
        original = cs.count_knowledge_items

        def _bad():
            try:
                from src import knowledge_rag as kr
                orig_get_rag = kr.get_rag
                monkeypatch.setattr(kr, "get_rag", lambda: (_ for _ in ()).throw(RuntimeError("RAG down")))
            except Exception:
                pass
            return 0

        result = _bad()
        assert result == 0
