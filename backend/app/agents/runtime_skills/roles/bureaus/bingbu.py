"""兵部 compatibility Skill-ID export."""

from app.agents.runtime_skills.roles.bureaus.skill_registry import BUREAU_SKILL_SPECS

SKILL_IDS = {
    spec.bureau: spec.skill_id for spec in BUREAU_SKILL_SPECS if spec.department == "兵部"
}
