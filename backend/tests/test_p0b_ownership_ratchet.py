"""P0-B 归属过滤棘轮门(2026-07-14 新建)。

问题:P0-B(DecisionTask 按 id 裸查、无 user_id 归属校验)的"未修清单"以前
写在文档里(roadmap/plan 的硬编码行号),而 shangshufang.py 被并发 session
频繁重写,行号第二天就失真——文档清单天生腐烂。

本测试把清单变成可执行事实源(棘轮):
- 精确计数每个 router 文件里 `query(DecisionTask).filter_by(id=` 的出现次数;
- 与基线严格相等:多了 = 有人新增了裸查(P0-B 债务增长,立即失败);
  少了 = 有人修掉了一处(好事,但必须有意识地下调基线,让修复被记录)。
- 行号一律不进基线,只进计数——行号会漂移,计数不会说谎。

基线(2026-07-14 实测):
- jinyiwei.py 的 1 处带完整归属检查(task.user_id != requester_id → 拒绝),
  是修复样板,计入原始计数但标注 guarded;
- 其余 9 处(shangshufang×8 + swarm_runs×1)无归属检查,即 P0-B 待修债务;
- court_compat.py 曾有 1 处,并发 session 重写后已消失(2026-07-14 复核)。

P0-B 清零的定义:UNGUARDED 部分归零(全部补上归属检查后,把它们挪进
GUARDED 基线),不是把裸查删掉。
"""

from __future__ import annotations

import re
from pathlib import Path

ROUTERS = Path(__file__).resolve().parent.parent / "web" / "routers"

_PATTERN = re.compile(r"query\(DecisionTask\)\.filter_by\(id=")

# 文件名 → 预期裸查次数。修复一处 = 把该文件计数下调并在 commit message 里说明。
_BASELINE_GUARDED = {
    "jinyiwei.py": 1,  # task.user_id != requester_id 检查在场(修复样板)
}
_BASELINE_UNGUARDED = {
    "shangshufang.py": 8,
    "swarm_runs.py": 1,
}


def _count_lookups() -> dict[str, int]:
    counts: dict[str, int] = {}
    for path in sorted(ROUTERS.glob("*.py")):
        n = len(_PATTERN.findall(path.read_text(encoding="utf-8")))
        if n:
            counts[path.name] = n
    return counts


def test_p0b_decision_task_lookup_ratchet():
    expected = {**_BASELINE_GUARDED, **_BASELINE_UNGUARDED}
    actual = _count_lookups()
    assert actual == expected, (
        f"DecisionTask 裸查计数偏离基线。actual={actual} expected={expected}。"
        "多了:你新增了无归属校验的 DecisionTask 查询——禁止,照 jinyiwei.py 的"
        "requester_id 检查补上归属校验;少了:你修复了 P0-B 债务,请下调本文件"
        "基线并在 commit message 记录修的是哪个端点。"
    )


def test_p0b_unguarded_debt_direction():
    """债务只许减不许增:unguarded 基线总数是 9,P0-B 清零即此数归 0。"""
    assert sum(_BASELINE_UNGUARDED.values()) <= 9, (
        "P0-B unguarded 基线只能下调(修复)不能上调(新增债务)"
    )
