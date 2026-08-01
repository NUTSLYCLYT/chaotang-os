from enum import StrEnum

from pydantic import BaseModel, ConfigDict, field_validator


class ChancellorSkillId(StrEnum):
    CONSULT = "consult"
    DRAFT_DECREE = "draft_decree"
    EXECUTE_DECREE = "execute_decree"
    FOLLOW_UP = "follow_up"


class ChancellorEntrypoint(StrEnum):
    CONSULT = "POST /api/v1/chancellor-consult"
    DRAFT = "POST /api/v1/chancellor-drafts"
    EXECUTE = "POST /api/v1/decrees/chancellor"
    FOLLOW_UP = "INTERNAL follow_up"


class RuntimeService(StrEnum):
    CONSULT_MODEL = "consult_model"
    DRAFT_MODEL = "draft_model"
    DRAFT_AUTHORITY = "draft_authority"
    DECREE_GRAPH = "decree_graph"
    MINISTRIES = "ministries"
    JUNJICHU = "junjichu"
    EVIDENCE_PROTOCOL = "evidence_protocol"
    SHIGUAN = "shiguan"
    REPORT_ARTIFACTS = "report_artifacts"
    OWNER_SCOPED_FOLLOW_UP_READS = "owner_scoped_follow_up_reads"


class RuntimeSkillDefinition(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    skill_id: ChancellorSkillId
    version: str
    description: str
    enabled: bool
    allowed_entrypoints: tuple[ChancellorEntrypoint, ...]
    allowed_services: frozenset[RuntimeService]
    forbidden_actions: tuple[str, ...]
    authorization_policy: str

    @field_validator("version", "description", "authorization_policy")
    @classmethod
    def require_nonempty_text(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("value_must_be_nonempty")
        return value

    @field_validator("forbidden_actions")
    @classmethod
    def require_nonempty_forbidden_actions(
        cls,
        value: tuple[str, ...],
    ) -> tuple[str, ...]:
        if not value or any(not action.strip() for action in value):
            raise ValueError("forbidden_actions_must_be_nonempty")
        return value
