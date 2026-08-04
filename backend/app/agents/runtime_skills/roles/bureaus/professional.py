"""Compatibility exports derived from the authoritative bureau Skill registry."""

from app.agents.runtime_skills.roles.bureaus.skill_registry import BUREAU_SKILL_SPECS
from app.agents.runtime_skills.roles.bureaus.skill_spec import (
    BureauMethod,
    BureauToolPolicySpec,
)

__all__ = (
    "BUREAU_METHODS",
    "BUREAU_TOOL_POLICY_SPECS",
    "BureauMethod",
    "BureauToolPolicySpec",
)

BUREAU_METHODS = {
    (spec.department, spec.bureau): spec.method for spec in BUREAU_SKILL_SPECS
}
BUREAU_TOOL_POLICY_SPECS = {
    spec.agent_id: spec.tool_policy for spec in BUREAU_SKILL_SPECS
}
