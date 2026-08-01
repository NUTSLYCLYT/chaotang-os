"""Tests for ``POST /api/v1/chancellor-consult``.

Fully offline: ``get_chancellor_consult_graph`` is always monkeypatched
before a request is made, so no test in this module ever touches
``backend/config/providers.yaml``, any dotenv file, an environment variable,
or the network -- and no real DeepSeek API usage is ever produced.

The validation-failure tests below mirror the same verified FastAPI pitfall
regression covered by ``backend/tests/test_decrees_api.py``: if the
consultation graph provider were wired via ``Depends()`` instead of being
called explicitly from inside the endpoint body, it would still be invoked
even when the request body subsequently fails Pydantic validation. Each
validation-failure test asserts the monkeypatched provider's call count is
exactly ``0`` to guard against that regression.

This module also carries one of the required isolation proofs: a full HTTP
round trip through the consult endpoint must never change 史馆's REPLY
archive count for the authenticated owner, demonstrating the chat path never
enters the decree/evidence business flow governed by ADR 0028.
"""

from __future__ import annotations

from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

import app.api.chancellor_consult as chancellor_consult_module
from app.agents.chancellor_consult import (
    CHANCELLOR_CONSULT_IDENTITY,
    ChancellorConsultGraphInvocationError,
)
from app.agents.chancellor_runtime import (
    ChancellorAgent,
    ChancellorEntrypoint,
    ChancellorRuntimeError,
    ChancellorSkillId,
    ChancellorSkillRegistry,
)
from app.api.chancellor_consult import ChancellorConsultConfigError
from app.auth import configure_auth_db, create_session, create_user
from app.langgraph_runtime.deepseek_client import DeepSeekModelNameError
from app.langgraph_runtime.deepseek_config import DeepSeekApiKeyError
from app.main import app
from app.shiguan import storage as shiguan_storage

client = TestClient(app)

CONSULT_URL = "/api/v1/chancellor-consult"


@pytest.fixture(autouse=True)
def _authenticate_client(isolate_shiguan_default_db_path, tmp_path):
    del isolate_shiguan_default_db_path
    configure_auth_db(tmp_path / "auth.sqlite3")
    user = create_user("consult-user", "consult@example.com", "six-or-more")
    client.headers["Authorization"] = f"Bearer {create_session(user.id)}"
    yield user
    client.headers.pop("Authorization", None)
    configure_auth_db(None)


class _FakeGraph:
    """A minimal stand-in for a compiled LangGraph graph."""

    def __init__(self, invoke_result: dict | None = None, invoke_error: Exception | None = None):
        self.invoke_result = invoke_result
        self.invoke_error = invoke_error
        self.invoke_calls: list[dict] = []

    def invoke(self, state: dict) -> dict:
        self.invoke_calls.append(state)
        if self.invoke_error is not None:
            raise self.invoke_error
        assert self.invoke_result is not None
        return self.invoke_result


class _FakeProvider:
    """Stand-in for ``get_chancellor_consult_graph`` that records calls."""

    def __init__(self, graph: _FakeGraph | None = None, build_error: Exception | None = None):
        self.graph = graph
        self.build_error = build_error
        self.call_count = 0

    def __call__(self) -> _FakeGraph:
        self.call_count += 1
        if self.build_error is not None:
            raise self.build_error
        assert self.graph is not None
        return self.graph


class _FakeChancellorAgent:
    def __init__(self, output: dict[str, object]) -> None:
        self.output = output
        self.calls: list[dict[str, object]] = []

    def invoke(self, **kwargs):
        self.calls.append(kwargs)
        return SimpleNamespace(output=self.output)


@pytest.fixture
def fake_provider(monkeypatch):
    def _install(provider: _FakeProvider) -> _FakeProvider:
        monkeypatch.setattr(chancellor_consult_module, "get_chancellor_consult_graph", provider)
        return provider

    return _install


def test_submit_consult_routes_through_single_chancellor_agent(
    monkeypatch, _authenticate_client
):
    agent = _FakeChancellorAgent({"reply": "consult reply"})
    monkeypatch.setattr(chancellor_consult_module, "get_chancellor_agent", lambda: agent)

    response = client.post(
        CONSULT_URL,
        json={"messages": [{"role": "user", "content": "consult question"}]},
    )

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "consultant": CHANCELLOR_CONSULT_IDENTITY,
        "reply": "consult reply",
    }
    assert len(agent.calls) == 1
    call = agent.calls[0]
    assert call["entrypoint"] is ChancellorEntrypoint.CONSULT
    assert call["requested_skill"] is ChancellorSkillId.CONSULT
    assert call["owner_user_id"] == _authenticate_client.id
    assert call["payload"] == {
        "messages": [{"role": "user", "content": "consult question"}]
    }
    assert isinstance(call["request_id"], str)
    assert len(call["request_id"]) == 32


def test_consult_emits_sanitized_no_side_effect_audit(
    monkeypatch, _authenticate_client
) -> None:
    graph = _FakeGraph(invoke_result={"reply": "private graph output"})
    monkeypatch.setattr(
        chancellor_consult_module, "get_chancellor_consult_graph", lambda: graph
    )
    audits: list[dict[str, object]] = []
    monkeypatch.setattr(
        chancellor_consult_module,
        "emit_chancellor_audit",
        lambda audit: audits.append(audit.model_dump(mode="json")),
    )

    response = client.post(
        CONSULT_URL,
        json={"messages": [{"role": "user", "content": "private prompt"}]},
    )

    assert response.status_code == 200
    assert len(audits) == 1
    assert audits[0]["authorization_checked"] is True
    assert audits[0]["authorization_result"] == "allowed"
    assert audits[0]["side_effects"] == []
    assert "private prompt" not in str(audits[0])
    assert "private graph output" not in str(audits[0])


def test_throwing_consult_audit_emitter_does_not_change_success(monkeypatch) -> None:
    monkeypatch.setattr(
        chancellor_consult_module,
        "get_chancellor_consult_graph",
        lambda: _FakeGraph(invoke_result={"reply": "ok"}),
    )
    monkeypatch.setattr(
        chancellor_consult_module,
        "emit_chancellor_audit",
        lambda _audit: (_ for _ in ()).throw(RuntimeError("sink secret")),
    )

    response = client.post(CONSULT_URL, json=_single_user_message())

    assert response.status_code == 200


def test_consult_postprocessing_failure_emits_final_failed_audit(monkeypatch) -> None:
    monkeypatch.setattr(
        chancellor_consult_module,
        "get_chancellor_consult_graph",
        lambda: _FakeGraph(invoke_result={"reply": " "}),
    )
    audits = []
    monkeypatch.setattr(chancellor_consult_module, "emit_chancellor_audit", audits.append)

    response = client.post(CONSULT_URL, json=_single_user_message())

    assert response.status_code == 502
    assert len(audits) == 1
    assert audits[0].result == "failure"
    assert audits[0].failure_code == "response_invalid"


@pytest.mark.parametrize(
    ("mode", "failure_code"),
    [
        ("registry", "skill_not_registered"),
        ("missing", "handler_unavailable"),
        ("runtime", "runtime_failure"),
        ("invalid", "skill_result_invalid"),
        ("generic", "skill_invocation_failed"),
    ],
)
def test_consult_runtime_failures_reemit_safe_final_audit(
    monkeypatch, mode, failure_code
) -> None:
    def runtime_failure(_payload):
        raise ChancellorRuntimeError("private runtime detail")

    def generic_failure(_payload):
        raise ValueError("private generic detail")

    registry = (
        ChancellorSkillRegistry(())
        if mode == "registry"
        else chancellor_consult_module.build_default_skill_registry()
    )
    handlers = {
        "registry": {},
        "missing": {},
        "runtime": {ChancellorSkillId.CONSULT: runtime_failure},
        "invalid": {ChancellorSkillId.CONSULT: lambda _payload: "private output"},
        "generic": {ChancellorSkillId.CONSULT: generic_failure},
    }[mode]
    monkeypatch.setattr(
        chancellor_consult_module,
        "get_chancellor_agent",
        lambda: ChancellorAgent(registry, handlers=handlers),
    )
    audits = []
    monkeypatch.setattr(chancellor_consult_module, "emit_chancellor_audit", audits.append)

    response = client.post(
        CONSULT_URL,
        json={"messages": [{"role": "user", "content": "private prompt"}]},
    )

    assert response.status_code == 502
    assert len(audits) == 1
    assert audits[-1].failure_code == failure_code
    assert audits[-1].side_effects == ()
    assert "private prompt" not in audits[-1].model_dump_json()
    assert "private runtime detail" not in audits[-1].model_dump_json()
    assert "private generic detail" not in audits[-1].model_dump_json()
    assert "private output" not in audits[-1].model_dump_json()


def test_invalid_consult_request_never_constructs_chancellor_agent(monkeypatch):
    call_count = 0

    def provider():
        nonlocal call_count
        call_count += 1
        return _FakeChancellorAgent({"reply": "unused"})

    monkeypatch.setattr(chancellor_consult_module, "get_chancellor_agent", provider)

    response = client.post(CONSULT_URL, json={"messages": []})

    assert response.status_code == 422
    assert call_count == 0


def _single_user_message(text: str = "国库存银大概是多少？") -> dict:
    return {"messages": [{"role": "user", "content": text}]}


def test_submit_consult_returns_fixed_success_envelope(fake_provider):
    graph = _FakeGraph(invoke_result={"reply": "建议先核实最新奏报再定夺。"})
    provider = fake_provider(_FakeProvider(graph=graph))

    response = client.post(CONSULT_URL, json=_single_user_message())

    assert response.status_code == 200
    body = response.json()
    assert body == {
        "status": "ok",
        "consultant": CHANCELLOR_CONSULT_IDENTITY,
        "reply": "建议先核实最新奏报再定夺。",
    }
    assert provider.call_count == 1
    assert len(graph.invoke_calls) == 1
    assert graph.invoke_calls[0] == {
        "messages": [{"role": "user", "content": "国库存银大概是多少？"}]
    }


def test_submit_consult_forwards_full_multi_turn_history_in_order(fake_provider):
    graph = _FakeGraph(invoke_result={"reply": "继续参详。"})
    fake_provider(_FakeProvider(graph=graph))

    payload = {
        "messages": [
            {"role": "user", "content": "第一问"},
            {"role": "assistant", "content": "第一答"},
            {"role": "user", "content": "第二问"},
        ]
    }
    response = client.post(CONSULT_URL, json=payload)

    assert response.status_code == 200
    assert len(graph.invoke_calls) == 1
    assert graph.invoke_calls[0]["messages"] == payload["messages"]


def test_submit_consult_strips_message_whitespace_before_forwarding(fake_provider):
    graph = _FakeGraph(invoke_result={"reply": "回复。"})
    fake_provider(_FakeProvider(graph=graph))

    response = client.post(
        CONSULT_URL, json={"messages": [{"role": "user", "content": "  带空白的问题  "}]}
    )

    assert response.status_code == 200
    assert graph.invoke_calls[0]["messages"] == [
        {"role": "user", "content": "带空白的问题"}
    ]


def test_unauthenticated_request_returns_401_and_never_calls_provider(fake_provider):
    provider = fake_provider(_FakeProvider(graph=_FakeGraph(invoke_result={"reply": "x"})))
    client.headers.pop("Authorization", None)

    response = client.post(CONSULT_URL, json=_single_user_message())

    assert response.status_code == 401
    assert response.json() == {"message": "invalid credentials"}
    assert provider.call_count == 0


@pytest.mark.parametrize(
    "make_payload",
    [
        pytest.param(lambda: {"messages": []}, id="empty_messages"),
        pytest.param(
            lambda: {
                "messages": [{"role": "user", "content": "x"}] * 21
            },
            id="too_many_messages",
        ),
        pytest.param(
            lambda: {"messages": [{"role": "user", "content": "   "}]},
            id="blank_content",
        ),
        pytest.param(
            lambda: {"messages": [{"role": "user", "content": "x" * 4001}]},
            id="single_message_too_long",
        ),
        pytest.param(
            lambda: {
                "messages": [
                    {"role": "user", "content": "a" * 4000},
                    {"role": "assistant", "content": "b" * 4000},
                    {"role": "user", "content": "c" * 4000},
                    {"role": "assistant", "content": "d" * 4000},
                    {"role": "user", "content": "e" * 4000},
                    {"role": "assistant", "content": "f" * 4000},
                ]
            },
            id="total_length_too_long",
        ),
        pytest.param(
            lambda: {"messages": [{"role": "assistant", "content": "开场白"}]},
            id="does_not_start_with_user",
        ),
        pytest.param(
            lambda: {
                "messages": [
                    {"role": "user", "content": "问"},
                    {"role": "user", "content": "又问"},
                ]
            },
            id="roles_not_alternating",
        ),
        pytest.param(
            lambda: {
                "messages": [
                    {"role": "user", "content": "问"},
                    {"role": "assistant", "content": "答"},
                ]
            },
            id="does_not_end_with_user",
        ),
        pytest.param(
            lambda: {
                "messages": [{"role": "system", "content": "越权系统提示"}]
            },
            id="invalid_role",
        ),
        pytest.param(
            lambda: {
                "messages": [{"role": "user", "content": "问"}],
                "extra_field": "不允许的字段",
            },
            id="unexpected_top_level_field",
        ),
        pytest.param(
            lambda: {
                "messages": [
                    {"role": "user", "content": "问", "extra": "不允许的字段"}
                ]
            },
            id="unexpected_message_field",
        ),
        pytest.param(lambda: {}, id="missing_messages_field"),
    ],
)
def test_validation_failures_return_422_and_never_call_the_model(fake_provider, make_payload):
    graph = _FakeGraph(invoke_result={"reply": "不应被调用"})
    provider = fake_provider(_FakeProvider(graph=graph))

    response = client.post(CONSULT_URL, json=make_payload())

    assert response.status_code == 422
    assert provider.call_count == 0
    assert graph.invoke_calls == []


def test_malformed_json_body_returns_422_and_never_calls_the_model(fake_provider):
    graph = _FakeGraph(invoke_result={"reply": "不应被调用"})
    provider = fake_provider(_FakeProvider(graph=graph))

    response = client.post(
        CONSULT_URL,
        content=b"{not valid json",
        headers={"content-type": "application/json"},
    )

    assert 400 <= response.status_code < 500
    assert provider.call_count == 0
    assert graph.invoke_calls == []


def test_config_error_maps_to_sanitized_503(fake_provider):
    secret_marker = "sk-consult-adversarial-should-not-leak-24680"
    build_error = ChancellorConsultConfigError(
        f"DeepSeek configuration unavailable near secret={secret_marker}"
    )
    provider = fake_provider(_FakeProvider(build_error=build_error))

    response = client.post(CONSULT_URL, json=_single_user_message())

    assert response.status_code == 503
    assert response.json() == {
        "status": "error",
        "reason": "config_unavailable",
        "message": "丞相（咨询）暂时无法回应，请稍后再试",
    }
    raw_text = response.text
    assert secret_marker not in raw_text
    assert "DEEPSEEK_API_KEY" not in raw_text
    assert "providers.yaml" not in raw_text
    assert provider.call_count == 1


def test_model_name_error_maps_to_sanitized_503(fake_provider):
    internal_marker = "provider-model-internal-marker"
    provider = fake_provider(_FakeProvider(build_error=DeepSeekModelNameError(internal_marker)))

    response = client.post(CONSULT_URL, json=_single_user_message())

    assert response.status_code == 503
    assert response.json()["reason"] == "config_unavailable"
    assert internal_marker not in response.text
    assert provider.call_count == 1


def test_get_chancellor_consult_graph_wraps_config_error_in_its_own_type(monkeypatch):
    """Regression guard for the exception-handler-collision fix.

    ``get_chancellor_consult_graph()`` must translate
    ``DeepSeekConfigError``/``DeepSeekModelNameError`` into this module's own
    ``ChancellorConsultConfigError`` *before* FastAPI's exception-handling
    machinery ever sees it, so this module's handler registration (on
    ``ChancellorConsultConfigError``) never collides with
    ``app.api.decrees``'s handler registration for the shared, underlying
    ``DeepSeekConfigError``/``DeepSeekModelNameError`` classes.
    """
    secret_marker = "sk-consult-wrap-should-not-leak-11223"

    def _raise_config_error():
        raise DeepSeekApiKeyError(f"DEEPSEEK_API_KEY unusable near secret={secret_marker}")

    monkeypatch.setattr(
        chancellor_consult_module, "build_chancellor_consult_graph", _raise_config_error
    )

    with pytest.raises(ChancellorConsultConfigError) as excinfo:
        chancellor_consult_module.get_chancellor_consult_graph()

    assert not isinstance(excinfo.value, DeepSeekApiKeyError)
    assert secret_marker not in str(excinfo.value)
    assert isinstance(excinfo.value.__cause__, DeepSeekApiKeyError)


def test_model_error_maps_to_sanitized_502(fake_provider):
    secret_marker = "sk-consult-adversarial-should-not-leak-97531"
    original_error = RuntimeError(f"simulated SDK failure, key={secret_marker}")
    invocation_error = ChancellorConsultGraphInvocationError(
        "Chancellor consultation graph failed to obtain a model response"
    )
    invocation_error.__cause__ = original_error

    graph = _FakeGraph(invoke_error=invocation_error)
    provider = fake_provider(_FakeProvider(graph=graph))

    response = client.post(CONSULT_URL, json=_single_user_message())

    assert response.status_code == 502
    assert response.json() == {
        "status": "error",
        "reason": "model_unavailable",
        "message": "丞相（咨询）暂时无法回应，请稍后再试",
    }
    assert secret_marker not in response.text
    assert provider.call_count == 1


def test_empty_reply_from_graph_result_maps_to_sanitized_502(fake_provider):
    graph = _FakeGraph(invoke_result={"reply": "   "})
    provider = fake_provider(_FakeProvider(graph=graph))

    response = client.post(CONSULT_URL, json=_single_user_message())

    assert response.status_code == 502
    assert response.json()["reason"] == "model_unavailable"
    assert provider.call_count == 1


def test_malformed_graph_result_shape_maps_to_sanitized_502(fake_provider):
    graph = _FakeGraph(invoke_result={"unexpected": "shape"})
    provider = fake_provider(_FakeProvider(graph=graph))

    response = client.post(CONSULT_URL, json=_single_user_message())

    assert response.status_code == 502
    assert response.json()["reason"] == "model_unavailable"
    assert provider.call_count == 1


def test_health_endpoint_is_unaffected_by_the_new_consult_route():
    response = client.get("/health")
    assert response.status_code == 200


def test_consult_round_trip_never_creates_a_shiguan_reply_archive(
    fake_provider, _authenticate_client
):
    owner_user_id = _authenticate_client.id
    graph = _FakeGraph(invoke_result={"reply": "此为咨询意见，不构成办理结果。"})
    fake_provider(_FakeProvider(graph=graph))

    before = shiguan_storage.list_archives(type="REPLY", owner_user_id=owner_user_id)
    assert before == []

    response = client.post(CONSULT_URL, json=_single_user_message())
    assert response.status_code == 200

    after = shiguan_storage.list_archives(type="REPLY", owner_user_id=owner_user_id)
    assert after == []
