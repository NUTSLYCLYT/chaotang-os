from .models import (
    ChancellorEntrypoint,
    ChancellorSkillId,
    RuntimeService,
    RuntimeSkillDefinition,
)

CONSULT_SERVICES = frozenset({RuntimeService.CONSULT_MODEL})
DRAFT_SERVICES = frozenset(
    {
        RuntimeService.DRAFT_MODEL,
        RuntimeService.DRAFT_AUTHORITY,
    }
)
EXECUTE_SERVICES = frozenset(
    {
        RuntimeService.DECREE_GRAPH,
        RuntimeService.MINISTRIES,
        RuntimeService.JUNJICHU,
        RuntimeService.EVIDENCE_PROTOCOL,
        RuntimeService.SHIGUAN,
        RuntimeService.REPORT_ARTIFACTS,
    }
)
FOLLOW_UP_SERVICES = frozenset(
    {
        RuntimeService.OWNER_SCOPED_FOLLOW_UP_READS,
    }
)

RUNTIME_SKILLS = (
    RuntimeSkillDefinition(
        skill_id=ChancellorSkillId.CONSULT,
        version="1.0.0",
        description="Clarify questions, compare options, and prepare decisions.",
        enabled=True,
        allowed_entrypoints=(ChancellorEntrypoint.CONSULT,),
        allowed_services=CONSULT_SERVICES,
        forbidden_actions=(
            "invoke ministries, evidence services, MCP, or archive writes",
            "execute another runtime skill",
        ),
        authorization_policy="The consultation entrypoint selects this skill.",
    ),
    RuntimeSkillDefinition(
        skill_id=ChancellorSkillId.DRAFT_DECREE,
        version="1.0.0",
        description="Prepare a reviewable decree draft and its one-time authority.",
        enabled=True,
        allowed_entrypoints=(ChancellorEntrypoint.DRAFT,),
        allowed_services=DRAFT_SERVICES,
        forbidden_actions=(
            "create a formal case or archive reply",
            "execute the decree",
        ),
        authorization_policy="The draft entrypoint selects this skill.",
    ),
    RuntimeSkillDefinition(
        skill_id=ChancellorSkillId.EXECUTE_DECREE,
        version="1.0.0",
        description="Execute an explicitly approved decree through the existing workflow.",
        enabled=True,
        allowed_entrypoints=(ChancellorEntrypoint.EXECUTE,),
        allowed_services=EXECUTE_SERVICES,
        forbidden_actions=(
            "call MCP directly",
            "expand or replay consumed decree authority",
        ),
        authorization_policy=(
            "The execute entrypoint requires valid owner-scoped one-time draft authority."
        ),
    ),
    RuntimeSkillDefinition(
        skill_id=ChancellorSkillId.FOLLOW_UP,
        version="0.0.0-disabled",
        description="Review owner-scoped outcomes for future follow-up.",
        enabled=False,
        allowed_entrypoints=(),
        allowed_services=FOLLOW_UP_SERVICES,
        forbidden_actions=(
            "create or execute a decree",
            "scan data outside the current owner scope",
        ),
        authorization_policy="Disabled pending a separately approved product task.",
    ),
)
