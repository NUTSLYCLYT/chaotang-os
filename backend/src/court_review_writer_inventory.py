"""Frozen P4.5 baseline for production ``CourtReview`` constructor calls.

The architecture test scans production Python ASTs independently and compares
the resulting ``(path, enclosing function) -> call count`` multiset with this
inventory.  Update this baseline only through an explicitly reviewed semantic
change; it is not imported by the runtime.
"""

from __future__ import annotations

from typing import Final


COURT_REVIEW_WRITER_BASELINE: Final[dict[tuple[str, str], int]] = {
    ("src/execution/canonical_court_dispatch.py", "dispatch_compat_court_task"): 1,
    ("web/routers/shangshufang.py", "shangshufang_confirm_edict"): 2,
    ("web/routers/shangshufang.py", "shangshufang_swarm_deepen"): 2,
    ("web/routers/shangshufang.py", "shangshufang_pack_swarm_loop"): 1,
    (
        "web/routers/shangshufang.py",
        "shangshufang_finance_intel_loop_complete",
    ): 1,
    ("web/routers/shangshufang.py", "shangshufang_research_budget_loop"): 1,
}
