# tests/test_chaotang_sansheng.py
"""T-be4:三省机制朝堂语义化 SSE 测试。

覆盖:
  1. step_to_sheng() 步骤名映射正确性
  2. translate_event() 在三省相关事件上附 sheng 字段
  3. run_chaotang_task() 三省 sansheng 事件序列:
     - 中书省 active(首个 council_* 步骤开始时)
     - 中书省 progress(每个 council_* 完成)
     - 尚书省 active(首个 group_*/aggregate 步骤)
     - 尚书省 done(council.aggregated 时)
     - 门下省 active(aggregate 完成后注入)
     - 门下省 done(memorial.drafted 后注入)
"""
from __future__ import annotations

import queue
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from src.chaotang_orchestrator import step_to_sheng, translate_event


# ──────────────── 1. step_to_sheng 映射 ────────────────

class TestStepToSheng:
    @pytest.mark.parametrize("name,expected", [
        ("council_hu_bu", "zhongshu"),
        ("council_xing_bu", "zhongshu"),
        ("council_any_dept", "zhongshu"),
        ("group_finlaw", "shangshu"),
        ("group_finlaw_dispatch", "shangshu"),
        ("group_rnd", "shangshu"),
        ("aggregate", "shangshu"),
        ("decree", None),
        ("flow_start", None),
        ("", None),
        ("unknown_step", None),
    ])
    def test_mapping(self, name, expected):
        assert step_to_sheng(name) == expected


# ──────────────── 2. translate_event() sheng 字段 ────────────────

class TestTranslateEventShengField:
    def test_minister_opinion_running_has_sheng_zhongshu(self):
        ev = {"type": "step_start", "step": 1, "name": "council_hu_bu", "status": "running"}
        out = translate_event(ev)
        assert out is not None
        assert out["sheng"] == "zhongshu"
        assert out["type"] == "minister.opinion"

    def test_minister_opinion_done_has_sheng_zhongshu(self):
        ev = {"type": "step", "step": 1, "name": "council_xing_bu",
              "status": "success", "output": "法务意见"}
        out = translate_event(ev)
        assert out is not None
        assert out["sheng"] == "zhongshu"

    def test_group_dispatch_has_sheng_shangshu(self):
        ev = {"type": "step_start", "step": 3, "name": "group_finlaw", "status": "running"}
        out = translate_event(ev)
        assert out is not None
        assert out["sheng"] == "shangshu"
        assert out["type"] == "group.dispatch"

    def test_group_aggregated_has_sheng_shangshu(self):
        ev = {"type": "step", "step": 3, "name": "group_rnd",
              "status": "success", "output": "研发结论"}
        out = translate_event(ev)
        assert out is not None
        assert out["sheng"] == "shangshu"
        assert out["type"] == "group.aggregated"

    def test_council_aggregated_has_sheng_shangshu(self):
        ev = {"type": "step", "step": 5, "name": "aggregate",
              "status": "success", "output": "汇总完成"}
        out = translate_event(ev)
        assert out is not None
        assert out["sheng"] == "shangshu"
        assert out["type"] == "council.aggregated"

    def test_decree_no_sheng(self):
        ev = {"type": "step", "step": 0, "name": "decree", "output": "了解意图"}
        out = translate_event(ev)
        # decree 产出 decree.understood,不带 sheng
        assert out is None or out.get("sheng") is None

    def test_flow_start_no_sheng(self):
        ev = {"type": "flow_start", "total": 5, "steps": ["decree", "council_hu_bu"]}
        out = translate_event(ev)
        assert out is not None
        assert out.get("sheng") is None


# ──────────────── 3. run_chaotang_task() sansheng 事件序列 ────────────────

def _make_stub_run_log(run_id="run_test_001"):
    """构造一个最小 RunLog stub,满足 run_chaotang_task 后处理所需字段。"""
    rl = SimpleNamespace(
        run_id=run_id,
        run_status="normal",
        final_output={"background": "test", "objective": "test", "opinions": [],
                      "risks": [], "recommendation": "ok", "executionPath": [],
                      "decisionsNeeded": [], "nextSteps": []},
        quality_score={"total_score": 4.2},
        qa_result={"pass": True},
        steps=[],
    )
    return rl


def _drain_queue(q: queue.Queue) -> list[dict]:
    items = []
    while not q.empty():
        items.append(q.get_nowait())
    return items


class TestRunChaotangTaskSansheng:
    """通过 monkeypatch FlowEngine 验证 run_chaotang_task 产出的 sansheng 事件序列。"""

    def _run(self, monkeypatch, tmp_path, ministers=None, groups=None):
        """组装 flow → 运行 → 返回 queue 中所有事件。"""
        from src import chaotang_orchestrator as orch

        ministers = ministers or ["hu_bu", "xing_bu"]
        groups = groups or ["finlaw"]

        plan = {"intent": "测试", "ministers": ministers, "groups": groups}
        flow_path = orch.assemble_flow(plan, task_id="t_sansheng", out_dir=tmp_path)

        stub_log = _make_stub_run_log()

        # FlowEngine stub:立即调用所有回调,模拟一次完整运行
        def fake_engine_init(self_inner, path, *, qa_version="v2"):
            self_inner._path = path

        def fake_engine_run(self_inner, task_input, *, on_flow_start=None, on_step_start=None,
                            on_step_done=None, on_token=None):
            step_names = (
                ["decree"]
                + [f"council_{m}" for m in ministers]
                + [f"group_{g}_dispatch" for g in groups]
                + [f"group_{g}" for g in groups]
                + ["aggregate"]
            )
            if on_flow_start:
                on_flow_start(len(step_names), "test_flow", step_names)
            for i, name in enumerate(step_names):
                if on_step_start:
                    on_step_start(i, name)
                if on_step_done:
                    on_step_done(i, len(step_names), name, 0.1, "success",
                                 output=f"{name} output")
            return stub_log

        with patch("src.chaotang_orchestrator.FlowEngine") as MockEngine:
            MockEngine.return_value.run = lambda *a, **kw: fake_engine_run(
                MockEngine.return_value, *a, **kw)
            MockEngine.side_effect = None

            # 用 side_effect 代替 return_value 以兼顾 __init__
            instance = MagicMock()
            instance.run.side_effect = lambda ti, **kw: fake_engine_run(instance, ti, **kw)
            MockEngine.return_value = instance

            with patch("web.task_registry.mark_status"), \
                 patch("web.task_registry.update_monitor"):
                q: queue.Queue = queue.Queue()
                orch.run_chaotang_task(
                    "t_sansheng", q, flow_path=flow_path, task_input="测试任务"
                )

        return _drain_queue(q)

    def test_sansheng_events_emitted(self, monkeypatch, tmp_path):
        events = self._run(monkeypatch, tmp_path)
        sansheng = [e for e in events if e.get("type") == "sansheng"]
        assert sansheng, "应有至少一条 sansheng 事件"

    def test_zhongshu_active_emitted_once(self, monkeypatch, tmp_path):
        events = self._run(monkeypatch, tmp_path)
        zhongshu_active = [e for e in events
                           if e.get("type") == "sansheng"
                           and e.get("sheng") == "zhongshu"
                           and e.get("status") == "active"]
        assert len(zhongshu_active) == 1, \
            f"中书省 active 应发且仅发一次,实发 {len(zhongshu_active)} 次"

    def test_zhongshu_progress_per_minister(self, monkeypatch, tmp_path):
        ministers = ["hu_bu", "xing_bu"]
        events = self._run(monkeypatch, tmp_path, ministers=ministers)
        progress = [e for e in events
                    if e.get("type") == "sansheng"
                    and e.get("sheng") == "zhongshu"
                    and e.get("status") == "progress"]
        assert len(progress) == len(ministers), \
            f"中书省 progress 应每位大臣发一次,期望 {len(ministers)},实发 {len(progress)}"

    def test_shangshu_active_emitted_once(self, monkeypatch, tmp_path):
        events = self._run(monkeypatch, tmp_path)
        shangshu_active = [e for e in events
                           if e.get("type") == "sansheng"
                           and e.get("sheng") == "shangshu"
                           and e.get("status") == "active"]
        assert len(shangshu_active) == 1, \
            f"尚书省 active 应发且仅发一次,实发 {len(shangshu_active)} 次"

    def test_shangshu_done_emitted(self, monkeypatch, tmp_path):
        events = self._run(monkeypatch, tmp_path)
        shangshu_done = [e for e in events
                         if e.get("type") == "sansheng"
                         and e.get("sheng") == "shangshu"
                         and e.get("status") == "done"]
        assert len(shangshu_done) >= 1, "尚书省 done 应至少发一次"

    def test_menxia_active_after_aggregate(self, monkeypatch, tmp_path):
        events = self._run(monkeypatch, tmp_path)
        menxia_active = [e for e in events
                         if e.get("type") == "sansheng"
                         and e.get("sheng") == "menxia"
                         and e.get("status") == "active"]
        assert len(menxia_active) == 1, \
            f"门下省 active 应发且仅发一次,实发 {len(menxia_active)} 次"

    def test_menxia_done_after_memorial_drafted(self, monkeypatch, tmp_path):
        events = self._run(monkeypatch, tmp_path)
        # menxia done 应在 memorial.drafted 之后
        menxia_done = [e for e in events
                       if e.get("type") == "sansheng"
                       and e.get("sheng") == "menxia"
                       and e.get("status") == "done"]
        assert len(menxia_done) == 1, \
            f"门下省 done 应发且仅发一次,实发 {len(menxia_done)} 次"

        drafted_idx = next(
            (i for i, e in enumerate(events) if e.get("type") == "memorial.drafted"), None)
        done_idx = events.index(menxia_done[0])
        assert drafted_idx is not None, "应有 memorial.drafted 事件"
        assert done_idx > drafted_idx, \
            "门下省 done 应在 memorial.drafted 之后发出"

    def test_sansheng_sheng_name_chinese(self, monkeypatch, tmp_path):
        events = self._run(monkeypatch, tmp_path)
        sansheng = [e for e in events if e.get("type") == "sansheng"]
        name_map = {"zhongshu": "中书省", "menxia": "门下省", "shangshu": "尚书省"}
        for e in sansheng:
            sheng = e.get("sheng")
            assert e.get("shengName") == name_map.get(sheng), \
                f"sheng={sheng} 的 shengName 应为 {name_map.get(sheng)},实为 {e.get('shengName')}"

    def test_sansheng_order_zhongshu_shangshu_menxia(self, monkeypatch, tmp_path):
        """三省事件应按 中书→尚书→门下 顺序出现(active 事件顺序)。"""
        events = self._run(monkeypatch, tmp_path)

        def first_active_idx(sheng):
            for i, e in enumerate(events):
                if e.get("type") == "sansheng" and e.get("sheng") == sheng \
                        and e.get("status") == "active":
                    return i
            return None

        zb = first_active_idx("zhongshu")
        sb = first_active_idx("shangshu")
        mb = first_active_idx("menxia")
        assert zb is not None and sb is not None and mb is not None, \
            "三省 active 事件均应出现"
        assert zb < sb < mb, \
            f"三省顺序应为 中书({zb}) < 尚书({sb}) < 门下({mb})"
