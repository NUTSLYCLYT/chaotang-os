import inspect
from collections.abc import Callable

import pytest
from pydantic import ValidationError

from app.agents.chancellor_runtime import (
    ChancellorAgent,
    ChancellorEntrypoint,
    ChancellorRuntimeError,
    ChancellorSkillId,
    ChancellorSkillInvocationError,
    ChancellorSkillRegistryError,
    GraphSkillHandler,
    build_default_skill_registry,
)
from app.agents.chancellor_runtime import agent as agent_module


def test_agent_invokes_only_entrypoint_selected_skill() -> None:
    seen: list[dict[str, object]] = []

    def handler(payload: dict[str, object]) -> dict[str, object]:
        seen.append(payload)
        return {"reply": "ok"}

    agent = ChancellorAgent(
        registry=build_default_skill_registry(),
        handlers={ChancellorSkillId.CONSULT: handler},
    )

    result = agent.invoke(
        entrypoint=ChancellorEntrypoint.CONSULT,
        requested_skill=ChancellorSkillId.CONSULT,
        owner_user_id="user-1",
        request_id="request-1",
        payload={"messages": [{"role": "user", "content": "问"}]},
    )

    assert result.skill_id is ChancellorSkillId.CONSULT
    assert result.output == {"reply": "ok"}
    assert seen == [{"messages": [{"role": "user", "content": "问"}]}]


def test_agent_rejects_skill_not_selected_by_entrypoint_before_handler_call() -> None:
    called = False

    def handler(payload: dict[str, object]) -> dict[str, object]:
        nonlocal called
        called = True
        return payload

    agent = ChancellorAgent(
        registry=build_default_skill_registry(),
        handlers={ChancellorSkillId.EXECUTE_DECREE: handler},
    )

    with pytest.raises(ChancellorSkillRegistryError, match="skill_not_allowed"):
        agent.invoke(
            entrypoint=ChancellorEntrypoint.CONSULT,
            requested_skill=ChancellorSkillId.EXECUTE_DECREE,
            owner_user_id="user-1",
            request_id="request-1",
            payload={},
        )

    assert called is False


def test_agent_rejects_disabled_skill_before_handler_call() -> None:
    called = False

    def handler(payload: dict[str, object]) -> dict[str, object]:
        nonlocal called
        called = True
        return payload

    agent = ChancellorAgent(
        registry=build_default_skill_registry(),
        handlers={ChancellorSkillId.FOLLOW_UP: handler},
    )

    with pytest.raises(ChancellorSkillRegistryError, match="skill_disabled"):
        agent.invoke(
            entrypoint=ChancellorEntrypoint.FOLLOW_UP,
            requested_skill=ChancellorSkillId.FOLLOW_UP,
            owner_user_id="user-1",
            request_id="request-1",
            payload={},
        )

    assert called is False


def test_agent_reports_missing_handler_with_sanitized_error() -> None:
    agent = ChancellorAgent(
        registry=build_default_skill_registry(),
        handlers={},
    )

    with pytest.raises(ChancellorRuntimeError, match="^handler_unavailable$"):
        agent.invoke(
            entrypoint=ChancellorEntrypoint.CONSULT,
            requested_skill=ChancellorSkillId.CONSULT,
            owner_user_id="user-1",
            request_id="request-1",
            payload={},
        )


def test_agent_sanitizes_handler_exceptions() -> None:
    secret = "provider-key-secret"

    def handler(payload: dict[str, object]) -> dict[str, object]:
        raise RuntimeError(secret)

    agent = ChancellorAgent(
        registry=build_default_skill_registry(),
        handlers={ChancellorSkillId.CONSULT: handler},
    )

    with pytest.raises(
        ChancellorRuntimeError,
        match="^skill_invocation_failed$",
    ) as exc_info:
        agent.invoke(
            entrypoint=ChancellorEntrypoint.CONSULT,
            requested_skill=ChancellorSkillId.CONSULT,
            owner_user_id="user-1",
            request_id="request-1",
            payload={},
        )

    assert secret not in str(exc_info.value)
    assert isinstance(exc_info.value, ChancellorSkillInvocationError)
    assert isinstance(exc_info.value.__cause__, RuntimeError)


def test_agent_attaches_sanitized_failure_audit_without_emitting(monkeypatch) -> None:
    emissions = []
    monkeypatch.setattr(
        agent_module._AUDIT_LOGGER,
        "info",
        lambda *_args, **_kwargs: emissions.append((_args, _kwargs)),
    )

    def handler(_payload: dict[str, object]) -> dict[str, object]:
        raise RuntimeError("secret exception text")

    agent = ChancellorAgent(
        registry=build_default_skill_registry(),
        handlers={ChancellorSkillId.CONSULT: handler},
    )

    with pytest.raises(ChancellorSkillInvocationError) as exc_info:
        agent.invoke(
            entrypoint=ChancellorEntrypoint.CONSULT,
            requested_skill=ChancellorSkillId.CONSULT,
            owner_user_id="user-1",
            request_id="request-1",
            payload={"prompt": "secret prompt"},
        )

    audit = exc_info.value.audit
    assert audit is not None
    assert audit.result == "failure"
    assert audit.failure_code == "skill_invocation_failed"
    serialized = audit.model_dump_json()
    assert "secret prompt" not in serialized
    assert "secret exception text" not in serialized
    assert audit.model_config["frozen"] is True
    assert emissions == []


def test_agent_failure_audit_carries_only_stable_failure_stage() -> None:
    class StagedFailure(RuntimeError):
        failure_stage = "bureau"

    def handler(_payload: dict[str, object]) -> dict[str, object]:
        raise StagedFailure("secret bureau response")

    agent = ChancellorAgent(
        registry=build_default_skill_registry(),
        handlers={ChancellorSkillId.EXECUTE_DECREE: handler},
    )

    with pytest.raises(ChancellorSkillInvocationError) as exc_info:
        agent.invoke(
            entrypoint=ChancellorEntrypoint.EXECUTE,
            requested_skill=ChancellorSkillId.EXECUTE_DECREE,
            owner_user_id="user-1",
            request_id="request-1",
            payload={"decree_text": "secret decree"},
        )

    assert exc_info.value.audit.failure_stage == "bureau"
    serialized = exc_info.value.audit.model_dump_json()
    assert "secret bureau response" not in serialized
    assert "secret decree" not in serialized


def test_agent_public_constructor_has_no_audit_emitter_binding() -> None:
    assert "audit_sink" not in inspect.signature(ChancellorAgent).parameters


def test_registry_rejection_attaches_failed_audit_without_handler_call() -> None:
    called = False

    def handler(_payload):
        nonlocal called
        called = True
        return {}

    agent = ChancellorAgent(
        registry=build_default_skill_registry(),
        handlers={ChancellorSkillId.EXECUTE_DECREE: handler},
    )

    with pytest.raises(ChancellorSkillRegistryError, match="skill_not_allowed") as exc_info:
        agent.invoke(
            entrypoint=ChancellorEntrypoint.CONSULT,
            requested_skill=ChancellorSkillId.EXECUTE_DECREE,
            owner_user_id="user-1",
            request_id="request-1",
            payload={"prompt": "secret"},
        )

    assert called is False
    audit = exc_info.value.audit
    assert audit is not None
    assert audit.authorization_result == "rejected"
    assert audit.failure_code == "skill_not_allowed"
    assert "secret" not in audit.model_dump_json()


@pytest.mark.parametrize(
    ("agent", "entrypoint", "skill_id", "failure_code"),
    [
        (
            ChancellorAgent(build_default_skill_registry(), handlers={}),
            ChancellorEntrypoint.CONSULT,
            ChancellorSkillId.CONSULT,
            "handler_unavailable",
        ),
        (
            ChancellorAgent(
                build_default_skill_registry(),
                handlers={
                    ChancellorSkillId.CONSULT: lambda _payload: (_ for _ in ()).throw(
                        ChancellorRuntimeError("private runtime detail")
                    )
                },
            ),
            ChancellorEntrypoint.CONSULT,
            ChancellorSkillId.CONSULT,
            "runtime_failure",
        ),
        (
            ChancellorAgent(
                build_default_skill_registry(),
                handlers={ChancellorSkillId.CONSULT: lambda _payload: "invalid"},
            ),
            ChancellorEntrypoint.CONSULT,
            ChancellorSkillId.CONSULT,
            "skill_result_invalid",
        ),
    ],
)
def test_every_runtime_owned_failure_carries_sanitized_audit(
    agent, entrypoint, skill_id, failure_code
) -> None:
    with pytest.raises(ChancellorRuntimeError) as exc_info:
        agent.invoke(
            entrypoint=entrypoint,
            requested_skill=skill_id,
            owner_user_id="user-1",
            request_id="request-1",
            payload={"prompt": "secret prompt"},
        )

    assert exc_info.value.audit.failure_code == failure_code
    serialized = exc_info.value.audit.model_dump_json()
    assert "secret prompt" not in serialized
    assert "private runtime detail" not in serialized


@pytest.mark.parametrize(
    "handler",
    [
        lambda payload: "not-a-dict",
        lambda payload: None,
    ],
)
def test_agent_requires_plain_dictionary_result(
    handler: Callable[[dict[str, object]], object],
) -> None:
    agent = ChancellorAgent(
        registry=build_default_skill_registry(),
        handlers={ChancellorSkillId.CONSULT: handler},
    )

    with pytest.raises(
        ChancellorRuntimeError,
        match="^skill_result_invalid$",
    ):
        agent.invoke(
            entrypoint=ChancellorEntrypoint.CONSULT,
            requested_skill=ChancellorSkillId.CONSULT,
            owner_user_id="user-1",
            request_id="request-1",
            payload={},
        )


def test_result_records_invocation_metadata_and_is_immutable() -> None:
    agent = ChancellorAgent(
        registry=build_default_skill_registry(),
        handlers={ChancellorSkillId.CONSULT: lambda payload: {"reply": "ok"}},
    )

    result = agent.invoke(
        entrypoint=ChancellorEntrypoint.CONSULT,
        requested_skill=ChancellorSkillId.CONSULT,
        owner_user_id="user-1",
        request_id="request-1",
        payload={},
    )

    assert result.owner_user_id == "user-1"
    assert result.request_id == "request-1"
    assert result.entrypoint is ChancellorEntrypoint.CONSULT
    assert result.skill_id is ChancellorSkillId.CONSULT
    assert result.skill_version == "1.0.0"
    assert result.output == {"reply": "ok"}
    assert "exception" not in result.model_dump()
    assert result.audit.model_dump(mode="json") == {
        "request_id": "request-1",
        "owner_user_id": "user-1",
        "entrypoint": "POST /api/v1/chancellor-consult",
        "skill_id": "consult",
        "skill_version": "1.0.0",
        "authorization_policy": "The consultation entrypoint selects this skill.",
        "authorization_checked": True,
        "authorization_result": "allowed",
        "result": "success",
        "failure_code": None,
        "failure_stage": None,
        "side_effects": [],
    }
    serialized = result.audit.model_dump_json()
    assert "messages" not in serialized
    assert "reply" not in serialized
    assert "credential" not in serialized
    assert "mcp" not in serialized.lower()
    with pytest.raises(ValidationError):
        result.request_id = "changed"


def test_graph_skill_handler_builds_graph_lazily() -> None:
    events: list[object] = []

    class Graph:
        def invoke(self, payload: dict[str, object]) -> dict[str, object]:
            events.append(payload)
            return {"reply": "ok"}

    def factory() -> Graph:
        events.append("factory")
        return Graph()

    handler = GraphSkillHandler(factory)

    assert events == []
    assert handler({"question": "问"}) == {"reply": "ok"}
    assert events == ["factory", {"question": "问"}]


def test_graph_skill_handler_requires_dictionary_result() -> None:
    class Graph:
        def invoke(self, payload: dict[str, object]) -> str:
            return "not-a-dict"

    handler = GraphSkillHandler(Graph)

    with pytest.raises(
        ChancellorRuntimeError,
        match="^skill_result_invalid$",
    ):
        handler({})


def test_graph_skill_invalid_result_leaving_agent_carries_audit() -> None:
    class Graph:
        def invoke(self, _payload):
            return "private graph output"

    agent = ChancellorAgent(
        registry=build_default_skill_registry(),
        handlers={ChancellorSkillId.CONSULT: GraphSkillHandler(Graph)},
    )

    with pytest.raises(ChancellorRuntimeError) as exc_info:
        agent.invoke(
            entrypoint=ChancellorEntrypoint.CONSULT,
            requested_skill=ChancellorSkillId.CONSULT,
            owner_user_id="user-1",
            request_id="request-1",
            payload={},
        )

    assert exc_info.value.audit.failure_code == "skill_result_invalid"
    assert "private graph output" not in exc_info.value.audit.model_dump_json()
