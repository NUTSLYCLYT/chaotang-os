"""Public interface for the dedicated Chancellor consultation
(丞相非业务咨询) agent.

See ``backend/app/agents/chancellor_consult/graph.py`` for the full module
docstring describing the isolation guarantee from the decree/evidence
business flow (ADR 0028) and ``docs/decisions/0030-chancellor-consult-chat-contract.md``
for the product-level contract this subpackage implements.
"""

from __future__ import annotations

from app.agents.chancellor_consult.graph import (
    ChancellorConsultGraphInvocationError,
    ChancellorConsultGraphState,
    build_chancellor_consult_graph,
)
from app.agents.chancellor_consult.prompts import CHANCELLOR_CONSULT_IDENTITY

__all__ = [
    "CHANCELLOR_CONSULT_IDENTITY",
    "ChancellorConsultGraphInvocationError",
    "ChancellorConsultGraphState",
    "build_chancellor_consult_graph",
]
