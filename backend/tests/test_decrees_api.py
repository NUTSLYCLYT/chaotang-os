"""Tests for ``POST /api/v1/decrees/chancellor``.

Fully offline: ``get_chancellor_graph`` is always monkeypatched before a
request is made, so no test in this module ever touches
``backend/config/providers.yaml``, any dotenv file, an environment variable,
or the network -- and no real DeepSeek API usage is ever produced.

The validation-failure tests below are a direct regression test for a
verified FastAPI pitfall: if the Chancellor graph provider were wired via
``Depends()`` instead of being called explicitly from inside the endpoint
body, it would still be invoked even when the request body subsequently
fails Pydantic validation. Each validation-failure test asserts the
monkeypatched provider's call count is exactly ``0`` to guard against that
regression.
"""

from __future__ import annotations

import tomllib
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

import app.api.decrees as decrees_module
from app.agents.chancellor import CHANCELLOR_IDENTITY, ChancellorGraphInvocationError
from app.langgraph_runtime.deepseek_client import DeepSeekModelNameError
from app.langgraph_runtime.deepseek_config import DeepSeekApiKeyError
from app.main import app

client = TestClient(app)

DECREE_URL = "/api/v1/decrees/chancellor"


class _FakeGraph:
    """A minimal stand-in for a compiled LangGraph graph.

    ``invoke_result`` is returned as-is unless ``invoke_error`` is set, in
    which case it is raised instead. ``invoke_calls`` records every state
    dict passed to ``.invoke()`` so tests can assert on call count/args.
    """

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
    """Stand-in for ``get_chancellor_graph`` that records its call count.

    Optionally raises ``build_error`` instead of returning ``graph``, to
    simulate ``build_chancellor_graph()`` failing fast on bad configuration
    (as it does for a real, un-injected chat model).
    """

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


@pytest.fixture
def fake_provider(monkeypatch):
    """Install a fresh ``_FakeProvider`` and return it for configuration.

    Tests set ``.graph`` / ``.build_error`` on the returned instance (or
    replace it entirely) before issuing a request.
    """

    def _install(provider: _FakeProvider) -> _FakeProvider:
        monkeypatch.setattr(decrees_module, "get_chancellor_graph", provider)
        return provider

    return _install


def test_submit_decree_success_returns_expected_contract(fake_provider):
    graph = _FakeGraph(invoke_result={"memorial_text": "臣已知晓旨意，建议如下。"})
    provider = fake_provider(_FakeProvider(graph=graph))

    response = client.post(DECREE_URL, json={"decree_text": "整顿吏治"})

    assert response.status_code == 200
    body = response.json()
    assert set(body.keys()) == {"status", "chancellor", "memorial_text"}
    assert body["status"] == "ok"
    assert body["chancellor"] == CHANCELLOR_IDENTITY
    assert body["memorial_text"] == "臣已知晓旨意，建议如下。"
    assert body["memorial_text"]
    assert provider.call_count == 1
    assert graph.invoke_calls == [{"decree_text": "整顿吏治", "memorial_text": ""}]


def test_submit_decree_strips_surrounding_whitespace_before_agent_call(fake_provider):
    graph = _FakeGraph(invoke_result={"memorial_text": "  臣已知晓旨意。  "})
    fake_provider(_FakeProvider(graph=graph))

    response = client.post(DECREE_URL, json={"decree_text": "  整顿吏治  "})

    assert response.status_code == 200
    assert response.json()["memorial_text"] == "臣已知晓旨意。"
    assert graph.invoke_calls == [{"decree_text": "整顿吏治", "memorial_text": ""}]


@pytest.mark.parametrize(
    "make_request",
    [
        pytest.param(
            lambda c: c.post(DECREE_URL, json={"decree_text": "   "}), id="blank_decree_text"
        ),
        pytest.param(
            lambda c: c.post(DECREE_URL, json={"decree_text": "x" * 2001}),
            id="too_long_decree_text",
        ),
        pytest.param(lambda c: c.post(DECREE_URL, json={}), id="missing_decree_text_field"),
        pytest.param(
            lambda c: c.post(
                DECREE_URL,
                content=b"{not valid json",
                headers={"content-type": "application/json"},
            ),
            id="invalid_json_body",
        ),
    ],
)
def test_validation_failures_return_4xx_and_never_call_the_agent(fake_provider, make_request):
    graph = _FakeGraph(invoke_result={"memorial_text": "应当不会被调用"})
    provider = fake_provider(_FakeProvider(graph=graph))

    response = make_request(client)

    assert 400 <= response.status_code < 500
    assert provider.call_count == 0
    assert graph.invoke_calls == []


def test_config_error_maps_to_sanitized_503(fake_provider):
    secret_marker = "sk-decree-adversarial-should-not-leak-24680"
    build_error = DeepSeekApiKeyError(f"DEEPSEEK_API_KEY unusable near secret={secret_marker}")
    provider = fake_provider(_FakeProvider(build_error=build_error))

    response = client.post(DECREE_URL, json={"decree_text": "整顿吏治"})

    assert response.status_code == 503
    body = response.json()
    assert body == {
        "status": "error",
        "reason": "config_unavailable",
        "message": "丞相暂时无法处理旨意，请稍后再试",
    }
    raw_text = response.text
    assert secret_marker not in raw_text
    assert "DEEPSEEK_API_KEY" not in raw_text
    assert "providers.yaml" not in raw_text
    assert provider.call_count == 1


def test_model_name_error_maps_to_sanitized_503(fake_provider):
    internal_marker = "provider-model-internal-marker"
    provider = fake_provider(
        _FakeProvider(build_error=DeepSeekModelNameError(internal_marker))
    )

    response = client.post(DECREE_URL, json={"decree_text": "整顿吏治"})

    assert response.status_code == 503
    assert response.json()["reason"] == "config_unavailable"
    assert internal_marker not in response.text
    assert provider.call_count == 1


def test_model_error_maps_to_sanitized_502(fake_provider):
    secret_marker = "sk-decree-adversarial-should-not-leak-97531"
    original_error = RuntimeError(f"simulated SDK failure, key={secret_marker}")
    invocation_error = ChancellorGraphInvocationError(
        "Chancellor graph node failed to obtain a model response"
    )
    invocation_error.__cause__ = original_error

    graph = _FakeGraph(invoke_error=invocation_error)
    provider = fake_provider(_FakeProvider(graph=graph))

    response = client.post(DECREE_URL, json={"decree_text": "整顿吏治"})

    assert response.status_code == 502
    body = response.json()
    assert body == {
        "status": "error",
        "reason": "model_unavailable",
        "message": "丞相暂时无法处理旨意，请稍后再试",
    }
    assert secret_marker not in response.text
    assert provider.call_count == 1


@pytest.mark.parametrize("empty_memorial", ["", "   "])
def test_empty_memorial_maps_to_sanitized_502(fake_provider, empty_memorial):
    graph = _FakeGraph(invoke_result={"memorial_text": empty_memorial})
    provider = fake_provider(_FakeProvider(graph=graph))

    response = client.post(DECREE_URL, json={"decree_text": "整顿吏治"})

    assert response.status_code == 502
    assert response.json()["reason"] == "model_unavailable"
    assert provider.call_count == 1


def _expected_version() -> str:
    pyproject_path = Path(__file__).resolve().parent.parent / "pyproject.toml"
    with pyproject_path.open("rb") as pyproject_file:
        data = tomllib.load(pyproject_file)
    return str(data["project"]["version"])


def test_health_endpoint_is_unaffected_by_the_new_decree_route():
    """Regression guard: registering the decree router/exception handlers
    must not change ``GET /health`` in any way."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/json")
    assert response.json() == {
        "status": "ok",
        "service": "chaotang-os-backend",
        "version": _expected_version(),
    }
