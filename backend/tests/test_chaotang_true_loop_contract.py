from __future__ import annotations

import importlib.util
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
RUNNER_PATH = ROOT / "harness" / "chaotang-true-loop" / "scripts" / "run_true_loop_contract.py"


def _load_runner():
    spec = importlib.util.spec_from_file_location("true_loop_runner", RUNNER_PATH)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_true_loop_golden_contract_passes():
    runner = _load_runner()

    result = runner.run()

    assert result["passed"] is True
    assert result["cases"] == 1
    record = result["records"][0]
    assert record["case_id"] == "shangshufang_live_swarm_to_shiguan_v1"
    assert record["failures"] == []


def test_true_loop_blocks_mock_or_missing_required_steps():
    runner = _load_runner()
    case = runner.load_cases()[0]
    bad_case = {
        **case,
        "truth_steps": [
            *case["truth_steps"],
            {"id": "replay_artifact", "state": "mock", "path": "/api/swarm/sessions/{session_id}"},
        ],
    }

    result = runner.validate_case(bad_case)

    assert result["passed"] is False
    assert any("blocking states" in failure for failure in result["failures"])


def test_true_loop_requires_shiguan_replay_owner():
    runner = _load_runner()
    case = runner.load_cases()[0]
    bad_case = {
        **case,
        "replay_artifact": {
            **case["replay_artifact"],
            "owner": "command-center",
        },
    }

    result = runner.validate_case(bad_case)

    assert result["passed"] is False
    assert "replay artifact owner must be shiguan" in result["failures"]
