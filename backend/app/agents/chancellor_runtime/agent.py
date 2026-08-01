import logging
from collections.abc import Callable, Mapping

from pydantic import BaseModel, ConfigDict

from .models import ChancellorEntrypoint, ChancellorSkillId
from .registry import ChancellorSkillRegistry, ChancellorSkillRegistryError


class ChancellorRuntimeError(RuntimeError):
    audit: "ChancellorInvocationAudit | None" = None


class ChancellorSkillInvocationError(ChancellorRuntimeError):
    def __init__(self, message: str, *, audit: "ChancellorInvocationAudit") -> None:
        super().__init__(message)
        self.audit = audit


class ChancellorInvocationAudit(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    request_id: str
    owner_user_id: str
    entrypoint: ChancellorEntrypoint
    skill_id: str
    skill_version: str
    authorization_policy: str
    authorization_checked: bool
    authorization_result: str
    result: str
    failure_code: str | None = None
    failure_stage: str | None = None
    side_effects: tuple[str, ...] = ()


class ChancellorInvocationResult(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    owner_user_id: str
    request_id: str
    entrypoint: ChancellorEntrypoint
    skill_id: ChancellorSkillId
    skill_version: str
    output: dict[str, object]
    audit: ChancellorInvocationAudit | None = None


SkillHandler = Callable[[dict[str, object]], dict[str, object]]
_AUDIT_LOGGER = logging.getLogger("app.chancellor_runtime.audit")
_ALLOWED_FAILURE_STAGES = frozenset(
    {"route", "bureau", "ministry", "report", "council", "finalize"}
)


def _failure_stage(exc: BaseException) -> str | None:
    stage = getattr(exc, "failure_stage", None)
    return stage if stage in _ALLOWED_FAILURE_STAGES else None


def complete_chancellor_audit(
    audit: ChancellorInvocationAudit,
    *,
    side_effects: tuple[str, ...],
    result: str = "success",
    failure_code: str | None = None,
) -> ChancellorInvocationAudit:
    return audit.model_copy(
        update={
            "side_effects": side_effects,
            "result": result,
            "failure_code": failure_code,
        }
    )


def emit_chancellor_audit(audit: ChancellorInvocationAudit) -> None:
    try:
        _AUDIT_LOGGER.info(
            "chancellor_runtime_audit %s",
            audit.model_dump_json(),
        )
    except Exception:  # noqa: BLE001 - audit is best-effort by contract
        return


class ChancellorAgent:
    def __init__(
        self,
        registry: ChancellorSkillRegistry,
        handlers: Mapping[ChancellorSkillId, SkillHandler],
    ) -> None:
        self._registry = registry
        self._handlers = dict(handlers)

    def invoke(
        self,
        *,
        entrypoint: ChancellorEntrypoint,
        requested_skill: ChancellorSkillId,
        owner_user_id: str,
        request_id: str,
        payload: dict[str, object],
    ) -> ChancellorInvocationResult:
        try:
            metadata = self._registry.get(requested_skill)
            skill_version = metadata.version
            authorization_policy = metadata.authorization_policy
        except ChancellorSkillRegistryError:
            skill_version = "unresolved"
            authorization_policy = "unresolved"
        try:
            skill = self._registry.require_allowed(entrypoint, requested_skill)
        except ChancellorSkillRegistryError as exc:
            failure_audit = ChancellorInvocationAudit(
                request_id=request_id,
                owner_user_id=owner_user_id,
                entrypoint=entrypoint,
                skill_id=requested_skill.value,
                skill_version=skill_version,
                authorization_policy=authorization_policy,
                authorization_checked=True,
                authorization_result="rejected",
                result="failure",
                failure_code=str(exc),
            )
            exc.audit = failure_audit
            raise
        audit = ChancellorInvocationAudit(
            request_id=request_id,
            owner_user_id=owner_user_id,
            entrypoint=entrypoint,
            skill_id=skill.skill_id,
            skill_version=skill.version,
            authorization_policy=skill.authorization_policy,
            authorization_checked=True,
            authorization_result="allowed",
            result="success",
        )
        handler = self._handlers.get(skill.skill_id)
        if handler is None:
            failure_audit = audit.model_copy(
                update={"result": "failure", "failure_code": "handler_unavailable"}
            )
            error = ChancellorRuntimeError("handler_unavailable")
            error.audit = failure_audit
            raise error

        try:
            output = handler(payload)
            if not isinstance(output, dict):
                raise ChancellorRuntimeError("skill_result_invalid")
        except ChancellorRuntimeError as exc:
            stable_code = (
                str(exc)
                if str(exc) in {"skill_result_invalid", "handler_unavailable"}
                else "runtime_failure"
            )
            failure_audit = audit.model_copy(
                update={
                    "result": "failure",
                    "failure_code": stable_code,
                    "failure_stage": _failure_stage(exc),
                }
            )
            exc.audit = failure_audit
            raise
        except Exception as exc:
            failure_audit = audit.model_copy(
                update={
                    "result": "failure",
                    "failure_code": "skill_invocation_failed",
                    "failure_stage": _failure_stage(exc),
                }
            )
            raise ChancellorSkillInvocationError(
                "skill_invocation_failed",
                audit=failure_audit,
            ) from exc

        return ChancellorInvocationResult(
            owner_user_id=owner_user_id,
            request_id=request_id,
            entrypoint=entrypoint,
            skill_id=skill.skill_id,
            skill_version=skill.version,
            output=output,
            audit=audit,
        )
