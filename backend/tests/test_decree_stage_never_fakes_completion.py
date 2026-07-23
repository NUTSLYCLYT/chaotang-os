"""R0-REQ-022 源码回归哨兵：direct 回执/worker ACK 不得在任何位置被写成 "completed"。

2026-07-23 修复前，三个独立位置都把零质量门的 direct/receipt-only 路径写成
"completed"：`decree_status._STAGE_MAP`（人类可见的当前阶段派生）、
`shangshufang.py` 的 `memorial.direct_completed` 时间线事件、
`canonical_court_dispatch.py` 兼容入口的 `dispatch.queued` 时间线事件。逻辑层测试
（test_decree_execution_status.py 等）只锁行为，不锁"有没有人手滑把某一处改回去"——
这里对源码字符串做穷举检查，四处修复缺一不可。
"""

from __future__ import annotations

import inspect


def test_stage_map_never_maps_direct_or_archived_to_bare_completed() -> None:
    import src.chancellor.decree_status as decree_status_module

    src = inspect.getsource(decree_status_module)
    assert '"direct_completed": "completed"' not in src
    assert '"archived": "completed"' not in src


def test_shangshufang_direct_completed_timeline_event_stage_is_not_completed() -> None:
    import web.routers.shangshufang as shangshufang_module

    src = inspect.getsource(shangshufang_module)
    idx = src.index('event_type="memorial.direct_completed"')
    preceding = src[max(0, idx - 400) : idx]
    assert 'stage="receipt_only"' in preceding
    assert 'stage="completed"' not in preceding


def test_canonical_court_dispatch_never_marks_direct_dispatch_completed() -> None:
    import src.execution.canonical_court_dispatch as canonical_court_dispatch_module

    src = inspect.getsource(canonical_court_dispatch_module)
    assert '"completed" if is_direct else "executing"' not in src
