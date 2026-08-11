from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path
from unittest.mock import MagicMock

import pytest

import app.agents.chancellor.graph as decree_graph_module
import app.agents.chancellor_draft.graph as draft_graph_module
from app.langgraph_runtime.provider_budget import (
    configure_provider_attempt_budget,
    get_provider_attempt_budget,
)

BACKEND_ROOT = Path(__file__).resolve().parents[1]


def _fresh_process_env() -> dict[str, str]:
    env = os.environ.copy()
    inherited_pythonpath = env.get("PYTHONPATH", "")
    env["PYTHONPATH"] = os.pathsep.join(
        part for part in (str(BACKEND_ROOT), inherited_pythonpath) if part
    )
    return env


@pytest.fixture(autouse=True)
def restore_unbounded_budget():
    configure_provider_attempt_budget(None)
    yield
    configure_provider_attempt_budget(None)


def test_draft_and_decree_factories_receive_same_process_budget(monkeypatch):
    configure_provider_attempt_budget(8)
    shared = get_provider_attempt_budget()
    captured: list[object] = []

    def fake_builder(*_args, **kwargs):
        captured.append(kwargs["attempt_budget"])
        return MagicMock(return_value=json.dumps({
            "status": "CLARIFYING",
            "understanding": "synthetic",
            "expert_example": "synthetic example",
            "recommendation_reason": "synthetic reason",
            "assumptions": [],
            "revision_prompt": "synthetic revision",
            "draft": None,
        }))

    for module in (draft_graph_module, decree_graph_module):
        monkeypatch.setattr(module, "load_deepseek_provider_config", MagicMock())
        monkeypatch.setattr(module, "build_deepseek_chat_model", fake_builder)

    draft_graph = draft_graph_module.build_chancellor_draft_graph()
    assert captured == []
    decree_graph_module.build_chancellor_graph(
        owner_user_id="provider-budget-test-owner"
    )
    draft_graph.invoke({
        "messages": [{"role": "user", "content": "synthetic request"}],
        "version": 1,
    })

    assert captured == [shared, shared]


@pytest.mark.parametrize("value", ["0", "-1", "not-a-number", "1.5"])
def test_invalid_budget_environment_fails_app_import_before_serving(value):
    env = _fresh_process_env()
    env["CHAOTANG_PROVIDER_ATTEMPT_BUDGET"] = value

    result = subprocess.run(
        [sys.executable, "-c", "import app.main"],
        cwd=BACKEND_ROOT,
        env=env,
        capture_output=True,
        text=True,
        timeout=30,
        check=False,
    )

    assert result.returncode != 0
    assert "DEEPSEEK" not in result.stdout + result.stderr


def test_missing_budget_environment_preserves_unbounded_startup():
    env = _fresh_process_env()
    env.pop("CHAOTANG_PROVIDER_ATTEMPT_BUDGET", None)

    result = subprocess.run(
        [
            sys.executable,
            "-c",
            "import app.main; "
            "from app.langgraph_runtime.provider_budget import get_provider_attempt_budget; "
            "assert get_provider_attempt_budget() is None",
        ],
        cwd=BACKEND_ROOT,
        env=env,
        capture_output=True,
        text=True,
        timeout=30,
        check=False,
    )

    assert result.returncode == 0, result.stderr


def test_positive_budget_environment_configures_fresh_app_process():
    env = _fresh_process_env()
    env["CHAOTANG_PROVIDER_ATTEMPT_BUDGET"] = "8"

    result = subprocess.run(
        [
            sys.executable,
            "-c",
            "import app.main; "
            "from app.langgraph_runtime.provider_budget import get_provider_attempt_budget; "
            "budget = get_provider_attempt_budget(); "
            "assert budget is not None and budget.max_attempts == 8",
        ],
        cwd=BACKEND_ROOT,
        env=env,
        capture_output=True,
        text=True,
        timeout=30,
        check=False,
    )

    assert result.returncode == 0, result.stderr
