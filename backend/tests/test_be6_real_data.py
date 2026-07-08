# tests/test_be6_real_data.py
"""T-be6 后端真数据完善验收测试。

覆盖:
  P1-2  aggregate_ministers 注入 running_task_depts → 大臣状态反映在跑任务
  P1-10 task_snapshot 携带 departments 字段 → dept active_tasks 按部门过滤
  P1-9  _build_key_metrics 从奏折/任务计数动态派生,不再是全静态

测行为契约,不测内部实现细节。
"""

from __future__ import annotations

import pytest

# ──────────────── P1-2: aggregate_ministers running_task_depts ────────────────


class TestAggregateMinistersRunningTaskDepts:
    """aggregate_ministers 的 running_task_depts 参数注入逻辑。"""

    def _no_memorials(self) -> list:
        return []

    def _memorial_idle(self, dept: str) -> dict:
        """无风险、已批准的奏折 → 无任务时 done。"""
        return {
            "sourceDepartment": dept,
            "status": "approved",
            "riskLevel": "low",
            "title": "test",
            "createdAt": "2026-01-01T00:00:00",
        }

    def test_no_running_tasks_finance_idle_with_no_memorials(self):
        from src.chaotang_api import aggregate_ministers

        ministers = aggregate_ministers([], running_task_depts=None)
        finance = next(m for m in ministers if m["department"] == "finance")
        assert finance["status"] == "idle"

    def test_running_task_for_finance_promotes_to_processing(self):
        from src.chaotang_api import aggregate_ministers

        ministers = aggregate_ministers([], running_task_depts=["finance"])
        finance = next(m for m in ministers if m["department"] == "finance")
        assert finance["status"] == "processing"

    def test_running_task_only_affects_named_dept(self):
        from src.chaotang_api import aggregate_ministers

        ministers = aggregate_ministers([], running_task_depts=["finance"])
        legal = next(m for m in ministers if m["department"] == "legal")
        # 法务无任务且无奏折 → 仍是 idle
        assert legal["status"] == "idle"

    def test_multiple_running_depts(self):
        from src.chaotang_api import aggregate_ministers

        running_depts = ["finance", "legal", "market"]
        ministers = aggregate_ministers([], running_task_depts=running_depts)
        by_dept = {m["department"]: m["status"] for m in ministers}
        for d in running_depts:
            assert by_dept[d] == "processing", f"{d} 应为 processing,得 {by_dept[d]}"

    def test_risk_overrides_running_task(self):
        """risk 级奏折的部门即使有在跑任务,状态仍为 risk(风险优先)。"""
        from src.chaotang_api import aggregate_ministers

        memorials = [
            {
                "sourceDepartment": "finance",
                "status": "pending",
                "riskLevel": "critical",
                "title": "危急奏折",
                "createdAt": "2026-01-01T00:00:00",
            }
        ]
        ministers = aggregate_ministers(memorials, running_task_depts=["finance"])
        finance = next(m for m in ministers if m["department"] == "finance")
        assert finance["status"] == "risk"

    def test_running_task_depts_empty_list_no_change(self):
        """空列表 = 无在跑任务。"""
        from src.chaotang_api import aggregate_ministers

        ministers_none = aggregate_ministers([], running_task_depts=None)
        ministers_empty = aggregate_ministers([], running_task_depts=[])
        statuses_none = {m["department"]: m["status"] for m in ministers_none}
        statuses_empty = {m["department"]: m["status"] for m in ministers_empty}
        assert statuses_none == statuses_empty

    def test_approved_memorial_dept_with_running_task_is_processing(self):
        """有 approved 奏折的部门新增在跑任务 → 状态从 done 升为 processing。"""
        from src.chaotang_api import aggregate_ministers

        memorials = [self._memorial_idle("legal")]
        ministers_no_task = aggregate_ministers(memorials, running_task_depts=None)
        legal_no_task = next(m for m in ministers_no_task if m["department"] == "legal")
        assert legal_no_task["status"] == "done"

        ministers_with_task = aggregate_ministers(
            memorials, running_task_depts=["legal"]
        )
        legal_with_task = next(
            m for m in ministers_with_task if m["department"] == "legal"
        )
        assert legal_with_task["status"] == "processing"


# ──────────────── P1-10: register_task departments 字段 ────────────────


class TestRegisterTaskDepartments:
    """register_task 存储 departments;task_snapshot 携带该字段。"""

    def test_register_task_stores_departments(self):
        from web.task_registry import register_task, get_task

        tid = "test_be6_dept_field"
        register_task(tid, departments=["finance", "legal"])
        t = get_task(tid)
        assert t is not None
        assert t["departments"] == ["finance", "legal"]

    def test_register_task_no_departments_defaults_empty(self):
        from web.task_registry import register_task, get_task

        tid = "test_be6_no_dept"
        register_task(tid)
        t = get_task(tid)
        assert t["departments"] == []

    def test_task_snapshot_carries_departments(self):
        from web.task_registry import register_task, task_snapshot

        tid = "test_be6_snapshot_dept"
        register_task(tid, departments=["market"])
        snap = task_snapshot()
        assert tid in snap
        assert snap[tid]["departments"] == ["market"]

    def test_register_task_departments_none_defaults_empty(self):
        from web.task_registry import register_task, get_task

        tid = "test_be6_dept_none"
        register_task(tid, departments=None)
        t = get_task(tid)
        assert t["departments"] == []


# ──────────────── P1-10: dept active_tasks 按部门过滤 ────────────────


class TestDeptActiveTasksFiltered:
    """dept_overview active_tasks 只包含本部门任务,不跨漏其他部门。"""

    @pytest.fixture()
    def client(self, monkeypatch):
        monkeypatch.setenv("FENGQUN_AUTH", "false")
        from web.main import app
        from fastapi.testclient import TestClient

        return TestClient(app)

    def _inject_tasks(self, monkeypatch, tasks_by_id: dict):
        """直接 monkeypatch task_registry._task_registry。"""
        import web.task_registry as tr
        import web.routers.dept as dept_mod

        fake_snap = {tid: {**t, "queue": None} for tid, t in tasks_by_id.items()}
        monkeypatch.setattr(tr, "_task_registry", fake_snap)
        # dept_overview 通过 task_snapshot() 读,需同步 patch
        monkeypatch.setattr(
            dept_mod,
            "_progress",
            lambda t: 50,
        )

    def _inject_memorials(self, monkeypatch, memorials):
        import web.routers.throne as th

        monkeypatch.setattr(th, "_build_memorial_list", lambda: memorials)

    def test_finance_task_appears_in_finance_not_legal(self, client, monkeypatch):
        import web.task_registry as tr

        monkeypatch.setattr(
            tr,
            "_task_registry",
            {
                "task_fin": {
                    "status": "running",
                    "departments": ["finance"],
                    "task_input": "户部任务",
                    "completed_steps": 1,
                    "total_steps": 4,
                },
                "task_leg": {
                    "status": "running",
                    "departments": ["legal"],
                    "task_input": "刑部任务",
                    "completed_steps": 0,
                    "total_steps": 3,
                },
            },
        )
        self._inject_memorials(monkeypatch, [])

        finance_data = client.get("/api/chaotang/dept/finance/overview").json()["data"]
        legal_data = client.get("/api/chaotang/dept/legal/overview").json()["data"]

        fin_ids = {t["taskId"] for t in finance_data["activeTasks"]}
        leg_ids = {t["taskId"] for t in legal_data["activeTasks"]}

        assert "task_fin" in fin_ids, "户部任务应在 finance activeTasks"
        assert "task_leg" not in fin_ids, "刑部任务不应出现在 finance"
        assert "task_leg" in leg_ids, "刑部任务应在 legal activeTasks"
        assert "task_fin" not in leg_ids, "户部任务不应出现在 legal"

    def test_task_without_departments_not_in_any_dept(self, client, monkeypatch):
        import web.task_registry as tr

        monkeypatch.setattr(
            tr,
            "_task_registry",
            {
                "task_no_dept": {
                    "status": "running",
                    "departments": [],  # 未记录部门
                    "task_input": "旧任务",
                    "completed_steps": 0,
                    "total_steps": 0,
                },
            },
        )
        self._inject_memorials(monkeypatch, [])

        data = client.get("/api/chaotang/dept/finance/overview").json()["data"]
        ids = {t["taskId"] for t in data["activeTasks"]}
        assert "task_no_dept" not in ids, "无部门任务不应出现在 finance"

    def test_running_task_promotes_minister_status(self, client, monkeypatch):
        import web.task_registry as tr

        monkeypatch.setattr(
            tr,
            "_task_registry",
            {
                "task_market": {
                    "status": "running",
                    "departments": ["market"],
                    "task_input": "礼部任务",
                    "completed_steps": 0,
                    "total_steps": 0,
                },
            },
        )
        self._inject_memorials(monkeypatch, [])

        data = client.get("/api/chaotang/dept/market/overview").json()["data"]
        assert (
            data["status"] == "processing"
        ), f"有在跑任务时 market 应为 processing,得 {data['status']!r}"

    def test_completed_task_not_in_active(self, client, monkeypatch):
        import web.task_registry as tr

        monkeypatch.setattr(
            tr,
            "_task_registry",
            {
                "task_done": {
                    "status": "done",
                    "departments": ["finance"],
                    "task_input": "已完成",
                    "completed_steps": 3,
                    "total_steps": 3,
                },
            },
        )
        self._inject_memorials(monkeypatch, [])

        data = client.get("/api/chaotang/dept/finance/overview").json()["data"]
        ids = {t["taskId"] for t in data["activeTasks"]}
        assert "task_done" not in ids, "已完成任务不应出现在 activeTasks"


# ──────────────── P1-9: _build_key_metrics 动态派生 ────────────────


class TestBuildKeyMetrics:
    """_build_key_metrics 从奏折/任务计数派生;验证字段结构 + 计数准确性。"""

    def _memo(self, dept: str, status: str = "pending", risk: str = "low") -> dict:
        return {
            "sourceDepartment": dept,
            "status": status,
            "riskLevel": risk,
            "title": "test",
        }

    def _task(self) -> dict:
        return {"taskId": "t1", "title": "任务", "progressPct": 50}

    def test_finance_shows_real_financial_kpis(self):
        """finance 是特殊部门:展示真实财报 KPI(营收/净利/资产/负债),而非奏折/任务计数。

        设计决策 2026-06-29:真财报信息价值远高于通用计数,finance 刻意破通用模板
        (见 web/routers/dept.py finance 分支,数值来源真实 2025 财务报表)。
        """
        from web.routers.dept import _build_key_metrics

        metrics = _build_key_metrics("finance", [self._memo("finance")], [self._task()])
        labels = {m["label"] for m in metrics}
        # 刻意不含通用计数项
        assert "奏折总量" not in labels
        assert "在跑任务" not in labels
        # 必含四项真财报 KPI(用子串匹配,避免全/半角括号差异)
        for kpi in ("营业收入", "净利润", "资产总计", "负债合计"):
            assert any(
                kpi in m["label"] for m in metrics
            ), f"finance 应有真财报项含 '{kpi}'"
        assert len(metrics) == 4

    def test_legal_pass_rate_derived(self):
        from web.routers.dept import _build_key_metrics

        # 5 件,4 件 approved → 80%
        memorials = [self._memo("legal", "approved")] * 4 + [
            self._memo("legal", "pending")
        ]
        metrics = _build_key_metrics("legal", memorials, [])
        rate_item = next((m for m in metrics if m["label"] == "合规通过率"), None)
        assert rate_item is not None, "legal 应有 '合规通过率'"
        assert rate_item["value"] == "80%"

    def test_legal_empty_memorials_pass_rate_dash(self):
        from web.routers.dept import _build_key_metrics

        metrics = _build_key_metrics("legal", [], [])
        rate_item = next((m for m in metrics if m["label"] == "合规通过率"), None)
        assert rate_item is not None
        assert rate_item["value"] == "—", "无奏折时合规通过率应为 '—'"

    def test_ops_risk_level_high_when_two_risk_memorials(self):
        from web.routers.dept import _build_key_metrics

        memorials = [
            self._memo("ops", risk="critical"),
            self._memo("ops", risk="high"),
        ]
        metrics = _build_key_metrics("ops", memorials, [])
        risk_item = next((m for m in metrics if m["label"] == "当前风险等级"), None)
        assert risk_item is not None, "ops 应有 '当前风险等级'"
        assert (
            risk_item["value"] == "高"
        ), f"两个风险奏折应为 '高',得 {risk_item['value']!r}"

    def test_ops_risk_level_low_when_no_risk(self):
        from web.routers.dept import _build_key_metrics

        metrics = _build_key_metrics("ops", [], [])
        risk_item = next(m for m in metrics if m["label"] == "当前风险等级")
        assert risk_item["value"] == "低"

    def test_physician_exec_rate_derived(self):
        from web.routers.dept import _build_key_metrics

        memorials = [self._memo("physician", "approved")] * 3 + [
            self._memo("physician", "pending")
        ]
        metrics = _build_key_metrics("physician", memorials, [])
        exec_item = next((m for m in metrics if m["label"] == "团队执行达成率"), None)
        assert exec_item is not None, "physician 应有 '团队执行达成率'"
        assert exec_item["value"] == "75%"

    def test_all_codes_return_four_items(self):
        from web.routers.dept import _build_key_metrics

        for code in ("finance", "legal", "market", "guard", "ops", "physician"):
            metrics = _build_key_metrics(code, [], [])
            assert len(metrics) == 4, f"{code} 应返回 4 项 keyMetrics,得 {len(metrics)}"

    def test_all_metrics_have_label_and_value(self):
        from web.routers.dept import _build_key_metrics

        for code in ("finance", "legal", "market", "guard", "ops", "physician"):
            metrics = _build_key_metrics(code, [], [])
            for m in metrics:
                assert "label" in m, f"{code} metric 缺 label: {m}"
                assert "value" in m, f"{code} metric 缺 value: {m}"

    def test_zero_data_never_returns_empty_list(self):
        """全新容器(无奏折/无任务)时 keyMetrics 永不为空——回归 T-be6 hotfix。"""
        from web.routers.dept import _build_key_metrics

        for code in ("finance", "legal", "market", "guard", "ops", "physician"):
            metrics = _build_key_metrics(code, [], [])
            assert metrics, f"{code} 在无数据时 keyMetrics 不应为空列表"
            assert len(metrics) == 4, f"{code} 在无数据时应返回 4 项,得 {len(metrics)}"

    def test_ops_domain_labels_present(self):
        """兵部 keyMetrics 含 PRD 语义标签(今日战况/待决事项/资源占用率/当前风险等级)。"""
        from web.routers.dept import _build_key_metrics

        metrics = _build_key_metrics("ops", [], [])
        labels = {m["label"] for m in metrics}
        assert "今日战况" in labels, f"ops 应含 '今日战况', 得 {labels}"
        assert "待决事项" in labels, f"ops 应含 '待决事项', 得 {labels}"
        assert "资源占用率" in labels, f"ops 应含 '资源占用率', 得 {labels}"
        assert "当前风险等级" in labels, f"ops 应含 '当前风险等级', 得 {labels}"

    def test_physician_domain_labels_present(self):
        """太医 keyMetrics 含 PRD 语义标签(主体健康指数/高层负荷/团队执行达成率/异常风险点)。"""
        from web.routers.dept import _build_key_metrics

        metrics = _build_key_metrics("physician", [], [])
        labels = {m["label"] for m in metrics}
        assert "主体健康指数" in labels, f"physician 应含 '主体健康指数', 得 {labels}"
        assert "高层负荷" in labels, f"physician 应含 '高层负荷', 得 {labels}"
        assert (
            "团队执行达成率" in labels
        ), f"physician 应含 '团队执行达成率', 得 {labels}"
        assert "异常风险点" in labels, f"physician 应含 '异常风险点', 得 {labels}"

    def test_guard_risk_count_reflects_real_count(self):
        from web.routers.dept import _build_key_metrics

        memorials = [
            self._memo("guard", risk="critical"),
            self._memo("guard", risk="high"),
            self._memo("guard", risk="high"),
        ]
        metrics = _build_key_metrics("guard", memorials, [])
        risk_item = next(m for m in metrics if m["label"] == "风险预警")
        assert (
            risk_item["value"] == "3"
        ), f"guard 风险预警应为 3,得 {risk_item['value']!r}"

    def test_guard_anomaly_events_uses_resolved_risk_not_risk_count(self):
        """本月异常事件 = 已处置(archived/approved)的高危奏折数,与风险预警计数语义不同(L-1 fix)。"""
        from web.routers.dept import _build_key_metrics

        memorials = [
            {
                "sourceDepartment": "guard",
                "status": "archived",
                "riskLevel": "critical",
                "title": "t",
            },
            {
                "sourceDepartment": "guard",
                "status": "approved",
                "riskLevel": "high",
                "title": "t",
            },
            {
                "sourceDepartment": "guard",
                "status": "pending",
                "riskLevel": "high",
                "title": "t",
            },
        ]
        metrics = _build_key_metrics("guard", memorials, [])
        risk_item = next(m for m in metrics if m["label"] == "风险预警")
        anomaly_item = next(m for m in metrics if m["label"] == "本月异常事件")
        # 风险预警 = 3 条(全部 critical/high)
        assert risk_item["value"] == "3", f"风险预警应为 3,得 {risk_item['value']!r}"
        # 本月异常事件 = 2 条(archived + approved),不等于 risk_count
        assert (
            anomaly_item["value"] == "2"
        ), f"本月异常事件应为 2(已处置),得 {anomaly_item['value']!r}"
        assert (
            risk_item["value"] != anomaly_item["value"]
        ), "风险预警与本月异常事件不应相同(L-1)"


# ──────────────── throne.py aggregate_ministers 也注入 task_snapshot ────────────────


class TestThroneOverviewRunningTaskDepts:
    """throne_overview 也应把 task_snapshot 注入 aggregate_ministers。"""

    @pytest.fixture()
    def client(self, monkeypatch):
        monkeypatch.setenv("FENGQUN_AUTH", "false")
        from web.main import app
        from fastapi.testclient import TestClient

        return TestClient(app)

    def test_running_task_promotes_minister_in_overview(self, monkeypatch, client):
        import web.task_registry as tr
        import web.routers.throne as th

        monkeypatch.setattr(th, "_build_memorial_list", lambda: [])
        monkeypatch.setattr(
            tr,
            "_task_registry",
            {
                "task_ops": {
                    "status": "running",
                    "departments": ["ops"],
                    "task_input": "兵部任务",
                    "completed_steps": 0,
                    "total_steps": 0,
                    "run_id": None,
                    "error": None,
                },
            },
        )

        r = client.get("/api/throne/overview")
        assert r.status_code == 200
        ministers = r.json()["ministers"]
        ops_m = next((m for m in ministers if m["department"] == "ops"), None)
        assert ops_m is not None
        assert (
            ops_m["status"] == "processing"
        ), f"有在跑任务时 ops 应为 processing,得 {ops_m['status']!r}"
