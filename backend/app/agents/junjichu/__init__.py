"""Public interface for the 军机处 (Grand Council) multi-department agent package.

Exposes 军机处's identity constant, its system prompt builder, its own
council-verdict invocation helper, and the full serial multi-department
council sequence (:func:`run_junjichu_council`) that
``app.agents.chancellor.graph``'s multi-department branch (module 2) calls
once ``decide_route`` has classified a decree as ``"multi"``.
"""

from __future__ import annotations

from app.agents.junjichu.agent import (
    JunjichuCouncilInvocationResult,
    invoke_junjichu_council,
    invoke_junjichu_council_with_report,
    run_junjichu_council,
    run_junjichu_council_with_report,
)
from app.agents.junjichu.prompts import JUNJICHU_IDENTITY, junjichu_system_prompt

__all__ = [
    "JUNJICHU_IDENTITY",
    "JunjichuCouncilInvocationResult",
    "invoke_junjichu_council",
    "invoke_junjichu_council_with_report",
    "junjichu_system_prompt",
    "run_junjichu_council",
    "run_junjichu_council_with_report",
]
