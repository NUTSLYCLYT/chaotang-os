from .models import (
    ChancellorEntrypoint,
    ChancellorSkillId,
    RuntimeSkillDefinition,
)
from .skills import RUNTIME_SKILLS


class ChancellorSkillRegistryError(ValueError):
    audit: object | None = None


class ChancellorSkillRegistry:
    def __init__(self, skills: tuple[RuntimeSkillDefinition, ...]) -> None:
        self._skills: dict[ChancellorSkillId, RuntimeSkillDefinition] = {}
        for skill in skills:
            if skill.skill_id in self._skills:
                raise ChancellorSkillRegistryError("duplicate_skill_id")
            self._skills[skill.skill_id] = skill

    def get(self, skill_id: ChancellorSkillId) -> RuntimeSkillDefinition:
        try:
            return self._skills[skill_id]
        except KeyError as exc:
            raise ChancellorSkillRegistryError("skill_not_registered") from exc

    def resolve(self, entrypoint: ChancellorEntrypoint) -> RuntimeSkillDefinition:
        matches = tuple(
            skill
            for skill in self._skills.values()
            if skill.enabled and entrypoint in skill.allowed_entrypoints
        )
        if not matches:
            raise ChancellorSkillRegistryError("entrypoint_not_registered")
        if len(matches) > 1:
            raise ChancellorSkillRegistryError("entrypoint_ambiguous")
        return matches[0]

    def require_allowed(
        self,
        entrypoint: ChancellorEntrypoint,
        skill_id: ChancellorSkillId,
    ) -> RuntimeSkillDefinition:
        skill = self.get(skill_id)
        if not skill.enabled:
            raise ChancellorSkillRegistryError("skill_disabled")
        selected = self.resolve(entrypoint)
        if selected.skill_id is not skill.skill_id:
            raise ChancellorSkillRegistryError("skill_not_allowed")
        return skill


def build_default_skill_registry() -> ChancellorSkillRegistry:
    return ChancellorSkillRegistry(RUNTIME_SKILLS)
