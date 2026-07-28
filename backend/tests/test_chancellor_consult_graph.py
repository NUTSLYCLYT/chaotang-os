"""Tests for ``app.agents.chancellor_consult.graph``.

Fully offline: every test injects a fake ``chat_model`` callable, so no test
in this module ever touches ``backend/config/providers.yaml``, any dotenv
file, an environment variable, or the network -- and no real DeepSeek API
usage is ever produced.

This module also carries the static import-isolation proof required by
``docs/product/tasks/2026-07-28-study-side-drawers.md`` (module B) and
``docs/decisions/0030-chancellor-consult-chat-contract.md``: the
``chancellor_consult`` subpackage must never import (directly or indirectly)
any decree/evidence business flow module governed by ADR 0028.
"""

from __future__ import annotations

import ast
from pathlib import Path

import pytest

from app.agents.chancellor_consult.graph import (
    ChancellorConsultGraphInvocationError,
    build_chancellor_consult_graph,
)
from app.agents.chancellor_consult.prompts import CHANCELLOR_CONSULT_SYSTEM_PROMPT

_PACKAGE_DIR = Path(__file__).resolve().parents[1] / "app" / "agents" / "chancellor_consult"
_API_MODULE_PATH = Path(__file__).resolve().parents[1] / "app" / "api" / "chancellor_consult.py"

def test_production_consult_graph_keeps_default_text_output(monkeypatch):
    calls = []
    fake_config = object()
    monkeypatch.setattr(
        "app.agents.chancellor_consult.graph.load_deepseek_provider_config",
        lambda: fake_config,
    )

    def fake_builder(config, dotenv_path, *, json_output=False):
        calls.append((config, dotenv_path, json_output))
        return lambda _messages: "ok"

    monkeypatch.setattr(
        "app.agents.chancellor_consult.graph.build_deepseek_chat_model",
        fake_builder,
    )

    build_chancellor_consult_graph()

    assert calls == [(fake_config, None, False)]


# Every ADR 0028 decree/evidence business flow module (and its submodules).
# A module name is forbidden when it equals one of these prefixes exactly, or
# starts with one of these prefixes followed by a dot (so this subpackage's
# own name, "app.agents.chancellor_consult", is *not* incorrectly flagged by
# the "app.agents.chancellor" prefix -- it does not start with
# "app.agents.chancellor.").
_FORBIDDEN_MODULE_PREFIXES = (
    "app.agents.chancellor",
    "app.agents.ministries",
    "app.agents.junjichu",
    "app.agents.bureaus",
    "app.agents.evidence_protocol",
    "app.jinyiwei",
    "app.shiguan",
    "app.junjichu_cases",
)


def _is_forbidden(module_name: str) -> bool:
    return any(
        module_name == prefix or module_name.startswith(f"{prefix}.")
        for prefix in _FORBIDDEN_MODULE_PREFIXES
    )


def _imported_module_names(source: str) -> set[str]:
    tree = ast.parse(source)
    names: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                names.add(alias.name)
        elif isinstance(node, ast.ImportFrom) and node.module is not None:
            names.add(node.module)
    return names


@pytest.mark.parametrize(
    "module_path",
    [
        _PACKAGE_DIR / "__init__.py",
        _PACKAGE_DIR / "graph.py",
        _PACKAGE_DIR / "prompts.py",
        _API_MODULE_PATH,
    ],
    ids=["agents_init", "agents_graph", "agents_prompts", "api_route"],
)
def test_module_never_imports_decree_evidence_flow_modules(module_path):
    source = module_path.read_text(encoding="utf-8")
    imported = _imported_module_names(source)
    forbidden_hits = {name for name in imported if _is_forbidden(name)}
    assert forbidden_hits == set(), (
        f"{module_path} imports forbidden decree/evidence flow module(s): "
        f"{sorted(forbidden_hits)}"
    )


def test_module_never_imports_forbidden_names_even_as_own_package_name():
    """Regression guard for the prefix-matching pitfall itself.

    ``"app.agents.chancellor_consult"`` (this subpackage's own name) must
    never be misclassified as forbidden by the ``"app.agents.chancellor"``
    prefix check above -- it is a sibling package, not a submodule of
    ``app.agents.chancellor``.
    """
    assert _is_forbidden("app.agents.chancellor_consult") is False
    assert _is_forbidden("app.agents.chancellor_consult.graph") is False
    assert _is_forbidden("app.agents.chancellor") is True
    assert _is_forbidden("app.agents.chancellor.graph") is True
    assert _is_forbidden("app.shiguan.archive_decree") is True
    assert _is_forbidden("app.jinyiwei.models") is True
    assert _is_forbidden("app.junjichu_cases") is True


def test_consult_graph_calls_model_exactly_once_and_prepends_system_prompt():
    calls: list[list[dict[str, str]]] = []

    def fake_chat_model(messages: list[dict[str, str]]) -> str:
        calls.append(messages)
        return "咨询意见：建议先核实数据来源。"

    graph = build_chancellor_consult_graph(chat_model=fake_chat_model)
    result = graph.invoke(
        {"messages": [{"role": "user", "content": "国库存银大概是多少？"}]}
    )

    assert len(calls) == 1
    assert calls[0][0] == {"role": "system", "content": CHANCELLOR_CONSULT_SYSTEM_PROMPT}
    assert calls[0][1] == {"role": "user", "content": "国库存银大概是多少？"}
    assert result["reply"] == "咨询意见：建议先核实数据来源。"


def test_system_prompt_declares_advisory_only_scope():
    for phrase in ("咨询", "不代表下旨", "审批", "执行", "归档", "下旨"):
        assert phrase in CHANCELLOR_CONSULT_SYSTEM_PROMPT


def test_consult_graph_forwards_multi_turn_history_unmodified():
    calls: list[list[dict[str, str]]] = []

    def fake_chat_model(messages: list[dict[str, str]]) -> str:
        calls.append(messages)
        return "回复。"

    graph = build_chancellor_consult_graph(chat_model=fake_chat_model)
    history = [
        {"role": "user", "content": "第一问"},
        {"role": "assistant", "content": "第一答"},
        {"role": "user", "content": "第二问"},
    ]
    graph.invoke({"messages": history})

    assert len(calls) == 1
    assert calls[0][1:] == history


def test_consult_graph_wraps_model_exception_without_leaking_original_message():
    secret_marker = "sk-consult-adversarial-should-not-leak-13579"

    def failing_chat_model(_messages: list[dict[str, str]]) -> str:
        raise RuntimeError(f"simulated SDK failure, key={secret_marker}")

    graph = build_chancellor_consult_graph(chat_model=failing_chat_model)

    with pytest.raises(ChancellorConsultGraphInvocationError) as excinfo:
        graph.invoke({"messages": [{"role": "user", "content": "测试"}]})

    assert secret_marker not in str(excinfo.value)


@pytest.mark.parametrize("empty_reply", ["", "   "])
def test_consult_graph_rejects_empty_model_response(empty_reply):
    graph = build_chancellor_consult_graph(chat_model=lambda _messages: empty_reply)

    with pytest.raises(ChancellorConsultGraphInvocationError):
        graph.invoke({"messages": [{"role": "user", "content": "测试"}]})


def test_consult_graph_strips_surrounding_whitespace_from_reply():
    graph = build_chancellor_consult_graph(
        chat_model=lambda _messages: "  带空白的回复  "
    )

    result = graph.invoke({"messages": [{"role": "user", "content": "测试"}]})

    assert result["reply"] == "带空白的回复"
