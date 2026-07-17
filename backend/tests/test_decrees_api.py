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

This module also exercises the module 3 HTTP contract that replaced the old
single-paragraph ``memorial_text`` field with the full routing/processing
result produced by ``build_chancellor_graph()`` (module 1's single-department
route and module 2's 军机处 multi-department council route alike) -- see
``docs/decisions/0012-decree-six-ministries-joint-review.md``.
"""

from __future__ import annotations

import tomllib
from copy import deepcopy
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

import app.api.decrees as decrees_module
from app.agents.chancellor import (
    CHANCELLOR_IDENTITY,
    ChancellorGraphInvocationError,
    build_chancellor_graph,
)
from app.langgraph_runtime.deepseek_client import DeepSeekModelNameError
from app.langgraph_runtime.deepseek_config import DeepSeekApiKeyError
from app.main import app

client = TestClient(app)

DECREE_URL = "/api/v1/decrees/chancellor"

_SINGLE_ROUTE_RESULT = {
    "decree_text": "整顿吏治",
    "chancellor_rationale": "此事职责明确，交由吏部办理即可。",
    "route_type": "single",
    "departments": ["吏部"],
    "processing_path": [
        "上书房",
        "丞相（首次分流）",
        "吏部",
        "吏部·任免司",
        "吏部（部级补充）",
        "丞相（最终汇总）",
    ],
    "ministry_opinions": [
        {
            "department": "吏部",
            "bureau_opinions": [{"bureau": "任免司", "opinion": "建议核查官员考绩。"}],
            "opinion": "臣部补充：同步核对职责匹配与晋升记录。",
        }
    ],
    "council_verdict": None,
    "final_verdict": "丞相汇总：先核查考绩，再审视职责匹配。",
    "recommendations": ["核查近期考绩", "复核职责匹配", "制定整改时限"],
}

_MULTI_ROUTE_RESULT = {
    "decree_text": "兴修水利并征调粮草以工代赈",
    "chancellor_rationale": "此事涉及工程与钱粮，需户部、工部会同办理。",
    "route_type": "multi",
    "departments": ["户部", "工部"],
    "processing_path": [
        "上书房",
        "丞相（首次分流）",
        "军机处（召集）",
        "户部",
        "户部·预算司",
        "户部（部级补充）",
        "工部",
        "工部·进度司",
        "工部（部级补充）",
        "军机处（会审）",
        "丞相（最终汇总）",
    ],
    "ministry_opinions": [
        {
            "department": "户部",
            "bureau_opinions": [{"bureau": "预算司", "opinion": "可拨付部分钱粮。"}],
            "opinion": "臣部补充：分期拨付并设置预算门槛。",
        },
        {
            "department": "工部",
            "bureau_opinions": [{"bureau": "进度司", "opinion": "可按两期兴工。"}],
            "opinion": "臣部补充：先勘察后分阶段验收。",
        },
    ],
    "council_verdict": "军机处会审：同意分期拨付、分段验收。",
    "final_verdict": "丞相汇总：准予兴修水利，户部与工部依会审结论协同。",
    "recommendations": ["先完成勘察", "分期拨付预算", "按里程碑验收"],
}


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


def test_submit_decree_single_route_returns_full_contract(fake_provider):
    graph = _FakeGraph(invoke_result=_SINGLE_ROUTE_RESULT)
    provider = fake_provider(_FakeProvider(graph=graph))

    response = client.post(DECREE_URL, json={"decree_text": "整顿吏治"})

    assert response.status_code == 200
    body = response.json()
    assert set(body.keys()) == {
        "status",
        "chancellor",
        "route_type",
        "rationale",
        "processing_path",
        "departments",
        "ministry_opinions",
        "council_verdict",
        "final_verdict",
        "recommendations",
    }
    assert body["status"] == "ok"
    assert body["chancellor"] == CHANCELLOR_IDENTITY
    assert body["route_type"] == "single"
    assert body["rationale"] == "此事职责明确，交由吏部办理即可。"
    assert body["processing_path"] == _SINGLE_ROUTE_RESULT["processing_path"]
    assert len(body["departments"]) == 1
    assert body["departments"] == ["吏部"]
    assert len(body["ministry_opinions"]) == 1
    assert body["ministry_opinions"][0]["department"] == "吏部"
    assert body["ministry_opinions"][0]["bureau_opinions"] == [
        {"bureau": "任免司", "opinion": "建议核查官员考绩。"}
    ]
    assert body["ministry_opinions"][0]["opinion"]
    assert body["council_verdict"] is None
    assert body["final_verdict"]
    assert len(body["recommendations"]) == 3
    assert provider.call_count == 1
    assert graph.invoke_calls == [{"decree_text": "整顿吏治"}]


def test_submit_decree_multi_route_returns_full_contract(fake_provider):
    graph = _FakeGraph(invoke_result=_MULTI_ROUTE_RESULT)
    fake_provider(_FakeProvider(graph=graph))

    response = client.post(DECREE_URL, json={"decree_text": "兴修水利并征调粮草以工代赈"})

    assert response.status_code == 200
    body = response.json()
    assert body["route_type"] == "multi"
    assert "军机处（召集）" in body["processing_path"]
    assert "军机处（会审）" in body["processing_path"]
    for department in body["departments"]:
        assert department in body["processing_path"]
    assert len(body["departments"]) >= 2
    assert len(set(body["departments"])) == len(body["departments"])
    assert len(body["ministry_opinions"]) == len(body["departments"])
    opinion_pairs = zip(body["departments"], body["ministry_opinions"], strict=True)
    for department, opinion_entry in opinion_pairs:
        assert opinion_entry["department"] == department
        assert opinion_entry["opinion"]
    assert body["final_verdict"]
    assert body["final_verdict"] not in {entry["opinion"] for entry in body["ministry_opinions"]}
    assert body["council_verdict"] == "军机处会审：同意分期拨付、分段验收。"
    assert body["recommendations"] == ["先完成勘察", "分期拨付预算", "按里程碑验收"]


def test_real_graph_single_route_keeps_api_contract_and_exposes_named_bureau_opinion(
    fake_provider,
):
    responses = iter(
        [
            '{"route_type": "single", "rationale": "交由礼部办理", '
            '"departments": ["礼部"]}',
            '{"rationale": "交由品牌司办理", "bureaus": ["品牌司"]}',
            '{"opinion": "统一品牌表达与视觉资产"}',
            '{"opinion": "礼部补充：对外口径须统一并完成发布门禁。"}',
            '{"summary": "丞相汇总：统一品牌表达并设置发布门禁。", '
            '"recommendations": ["统一对外口径", "校验视觉资产", "设置发布门禁"]}',
        ]
    )
    graph = build_chancellor_graph(chat_model=lambda _messages: next(responses))
    fake_provider(_FakeProvider(graph=graph))

    response = client.post(DECREE_URL, json={"decree_text": "统一品牌对外表达"})

    assert response.status_code == 200
    body = response.json()
    assert body["route_type"] == "single"
    assert body["departments"] == ["礼部"]
    assert body["ministry_opinions"] == [
        {
            "department": "礼部",
            "bureau_opinions": [{"bureau": "品牌司", "opinion": "统一品牌表达与视觉资产"}],
            "opinion": "礼部补充：对外口径须统一并完成发布门禁。",
        }
    ]
    assert body["council_verdict"] is None
    assert body["final_verdict"] == "丞相汇总：统一品牌表达并设置发布门禁。"
    assert body["recommendations"] == ["统一对外口径", "校验视觉资产", "设置发布门禁"]


def test_submit_decree_strips_surrounding_whitespace_before_agent_call(fake_provider):
    graph = _FakeGraph(invoke_result=_SINGLE_ROUTE_RESULT)
    fake_provider(_FakeProvider(graph=graph))

    response = client.post(DECREE_URL, json={"decree_text": "  整顿吏治  "})

    assert response.status_code == 200
    assert graph.invoke_calls == [{"decree_text": "整顿吏治"}]


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
    graph = _FakeGraph(invoke_result=_SINGLE_ROUTE_RESULT)
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


@pytest.mark.parametrize("empty_opinion", ["", "   "])
def test_empty_ministry_opinion_from_real_graph_maps_to_sanitized_502(
    fake_provider, empty_opinion
):
    responses = iter(
        [
            '{"route_type": "single", "rationale": "交由户部办理", '
            '"departments": ["户部"]}',
            '{"rationale": "交由预算司办理", "bureaus": ["预算司"]}',
            f'{{"opinion": "{empty_opinion}"}}',
        ]
    )
    graph = build_chancellor_graph(chat_model=lambda _messages: next(responses))
    provider = fake_provider(_FakeProvider(graph=graph))

    response = client.post(DECREE_URL, json={"decree_text": "核查国库存银"})

    assert response.status_code == 502
    assert response.json() == {
        "status": "error",
        "reason": "model_unavailable",
        "message": "丞相暂时无法处理旨意，请稍后再试",
    }
    assert "opinion" not in response.text
    assert "户部" not in response.text
    assert provider.call_count == 1


def test_malformed_bureau_response_from_real_graph_maps_to_sanitized_502(
    fake_provider,
):
    secret_marker = "sk-bureau-output-must-not-leak-86420"
    responses = iter(
        [
            '{"route_type": "single", "rationale": "交由刑部办理", '
            '"departments": ["刑部"]}',
            '{"rationale": "交由合同司办理", "bureaus": ["合同司"]}',
            f'not-json provider-output key={secret_marker}',
        ]
    )
    graph = build_chancellor_graph(chat_model=lambda _messages: next(responses))
    provider = fake_provider(_FakeProvider(graph=graph))

    response = client.post(DECREE_URL, json={"decree_text": "审查合同"})

    assert response.status_code == 502
    assert response.json() == {
        "status": "error",
        "reason": "model_unavailable",
        "message": "丞相暂时无法处理旨意，请稍后再试",
    }
    assert secret_marker not in response.text
    assert "not-json" not in response.text
    assert provider.call_count == 1


@pytest.mark.parametrize("empty_final_verdict", ["", "   "])
def test_empty_final_verdict_maps_to_sanitized_502(fake_provider, empty_final_verdict):
    invoke_result = {**_SINGLE_ROUTE_RESULT, "final_verdict": empty_final_verdict}
    graph = _FakeGraph(invoke_result=invoke_result)
    provider = fake_provider(_FakeProvider(graph=graph))

    response = client.post(DECREE_URL, json={"decree_text": "整顿吏治"})

    assert response.status_code == 502
    assert response.json()["reason"] == "model_unavailable"
    assert provider.call_count == 1


@pytest.mark.parametrize(
    "mutate",
    [
        pytest.param(
            lambda result: result.update(route_type="unexpected"), id="invalid_route_type"
        ),
        pytest.param(
            lambda result: result["ministry_opinions"][0].update(department="工部"),
            id="department_opinion_mismatch",
        ),
        pytest.param(
            lambda result: result["ministry_opinions"][0].update(bureau_opinions=[]),
            id="empty_bureau_opinions",
        ),
        pytest.param(
            lambda result: result["ministry_opinions"][0].update(extra="unexpected"),
            id="extra_ministry_opinion_field",
        ),
        pytest.param(
            lambda result: result["ministry_opinions"][0]["bureau_opinions"][0].update(
                extra="unexpected"
            ),
            id="extra_bureau_opinion_field",
        ),
        pytest.param(
            lambda result: result["ministry_opinions"][0]["bureau_opinions"][0].update(
                opinion="   "
            ),
            id="blank_bureau_opinion",
        ),
        pytest.param(
            lambda result: result["ministry_opinions"][0].update(opinion="   "),
            id="blank_ministry_opinion",
        ),
        pytest.param(
            lambda result: result.update(council_verdict="不应存在"),
            id="single_has_council_verdict",
        ),
        pytest.param(
            lambda result: result.update(recommendations=["建议一", "建议二"]),
            id="recommendations_not_three",
        ),
        pytest.param(
            lambda result: result.update(
                recommendations=["建议一", "建议二", "建议三", "建议四"]
            ),
            id="recommendations_more_than_three",
        ),
        pytest.param(
            lambda result: result.update(recommendations=["建议一", "   ", "建议三"]),
            id="recommendations_contains_blank",
        ),
        pytest.param(
            lambda result: result.update(recommendations=["建议一", 2, "建议三"]),
            id="recommendations_contains_non_string",
        ),
        pytest.param(
            lambda result: result.update(recommendations=["同一建议", " 同一建议 ", "建议三"]),
            id="recommendations_not_unique_after_stripping",
        ),
    ],
)
def test_invalid_layered_result_maps_to_sanitized_502(fake_provider, mutate):
    invoke_result = deepcopy(_SINGLE_ROUTE_RESULT)
    mutate(invoke_result)
    graph = _FakeGraph(invoke_result=invoke_result)
    fake_provider(_FakeProvider(graph=graph))

    response = client.post(DECREE_URL, json={"decree_text": "整顿吏治"})

    assert response.status_code == 502
    assert response.json() == {
        "status": "error",
        "reason": "model_unavailable",
        "message": "丞相暂时无法处理旨意，请稍后再试",
    }


def test_multi_without_council_verdict_maps_to_sanitized_502(fake_provider):
    invoke_result = {**_MULTI_ROUTE_RESULT, "council_verdict": None}
    graph = _FakeGraph(invoke_result=invoke_result)
    fake_provider(_FakeProvider(graph=graph))

    response = client.post(DECREE_URL, json={"decree_text": "兴修水利"})

    assert response.status_code == 502
    assert response.json()["reason"] == "model_unavailable"


@pytest.mark.parametrize(
    "missing_field",
    [
        "chancellor_rationale",
        "route_type",
        "processing_path",
        "departments",
        "ministry_opinions",
        "council_verdict",
        "final_verdict",
        "recommendations",
    ],
)
def test_incomplete_routing_result_maps_to_sanitized_502(fake_provider, missing_field):
    invoke_result = dict(_SINGLE_ROUTE_RESULT)
    del invoke_result[missing_field]
    graph = _FakeGraph(invoke_result=invoke_result)
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
