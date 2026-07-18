"""Regression tests for decree archival atomicity and recall semantics."""

from types import SimpleNamespace

import pytest

from app.agents.bureaus import bureau_profiles_for
from app.agents.chancellor.graph import build_chancellor_graph
from app.shiguan import archive_decree, db, storage
from app.shiguan.errors import ArchiveValidationError, ShiguanStorageError
from app.shiguan.recall import RecallContext


def _response(**overrides):
    values = {
        "departments": ["户部"],
        "processing_path": ["丞相", "户部"],
        "rationale": "交户部办理",
        "council_verdict": None,
        "final_verdict": "准奏",
    }
    values.update(overrides)
    return SimpleNamespace(**values)


def test_linked_pair_rolls_back_as_a_unit(tmp_path):
    path = tmp_path / "atomic.sqlite3"
    memorial = {
        "type": "MEMORIAL",
        "title": "奏折",
        "content": "内容",
        "matter_type": "综合事项",
        "department": "户部",
    }
    invalid_decision = {
        "type": "DECISION",
        "title": "决策",
        "content": "结论",
        "matter_type": "综合事项",
        "department": "户部",
        # Deliberately omit all required DECISION-only fields.
    }

    with pytest.raises(ArchiveValidationError):
        storage.create_linked_archive_pair(memorial, invalid_decision, db_path=path)

    assert storage.list_archives(db_path=path) == []


def test_archival_result_is_assertable_and_single_department_is_recallable(
    tmp_path, monkeypatch
):
    path = tmp_path / "decree.sqlite3"
    monkeypatch.setattr(db, "_DEFAULT_DB_PATH", path)

    result = archive_decree.archive_chancellor_decree("请核定年度预算", _response())

    assert result.archived is True
    assert result.memorial_id and result.decision_id
    recalled = storage.list_archives(department="户部", db_path=path)
    assert {item.type for item in recalled} == {"MEMORIAL", "DECISION"}
    decision = next(item for item in recalled if item.type == "DECISION")
    assert decision.department == "户部"
    assert decision.matter_type == "综合事项"
    assert decision.participating_departments == ["户部"]


def test_archival_failure_is_degraded_without_partial_success(monkeypatch):
    def _fail(*_args, **_kwargs):
        raise ShiguanStorageError("史馆写入失败，请稍后再试")

    monkeypatch.setattr(storage, "create_linked_archive_pair", _fail)
    result = archive_decree.archive_chancellor_decree("请核定年度预算", _response())
    assert result.archived is False
    assert result.memorial_id is None
    assert result.decision_id is None


def test_graph_fetches_one_context_and_reuses_unavailable_degradation(monkeypatch):
    calls: list[str] = []

    def _recall(department: str) -> RecallContext:
        calls.append(department)
        return RecallContext(available=False, reason="shiguan_unavailable")

    monkeypatch.setattr(
        "app.agents.chancellor.graph.safe_recall_context_for_department", _recall
    )
    bureau = bureau_profiles_for("户部")[0].bureau
    responses = iter(
        [
            '{"route_type":"single","rationale":"交户部","departments":["户部"]}',
            f'{{"rationale":"交本司","bureaus":["{bureau}"]}}',
            '{"opinion":"司级意见"}',
            '{"opinion":"部级意见"}',
            '{"summary":"丞相总结","recommendations":["甲","乙","丙"]}',
        ]
    )
    prompts: list[str] = []

    def _model(messages):
        prompts.append(messages[-1]["content"])
        return next(responses)

    result = build_chancellor_graph(chat_model=_model).invoke({"decree_text": "请核定预算"})

    assert calls == ["户部"]
    assert result["recall_contexts"]["户部"]["available"] is False
    assert sum("shiguan_unavailable" in prompt for prompt in prompts) == 1
