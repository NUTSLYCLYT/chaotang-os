"""Regression tests for decree archival and recall semantics."""

from types import SimpleNamespace

from app.agents.bureaus import bureau_profiles_for
from app.agents.chancellor.graph import build_chancellor_graph
from app.shiguan import archive_decree, db, storage
from app.shiguan.errors import ShiguanStorageError
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


def test_archival_result_is_assertable_and_single_department_is_recallable(
    tmp_path, monkeypatch
):
    path = tmp_path / "decree.sqlite3"
    monkeypatch.setattr(db, "_DEFAULT_DB_PATH", path)

    result = archive_decree.archive_chancellor_decree("请核定年度预算", _response())

    assert result.archived is True
    assert result.reply_id
    recalled = storage.list_archives(department="户部", db_path=path)
    assert len(recalled) == 1
    reply = recalled[0]
    assert reply.id == result.reply_id
    assert reply.type == "REPLY"
    assert reply.department == "户部"
    assert reply.matter_type == "综合事项"
    assert reply.source_kind == "DECREE"
    assert reply.source_text == "请核定年度预算"
    assert reply.related_archive_ids == []
    assert reply.participating_departments == ["户部"]
    assert reply.reply_conclusion == "准奏"
    assert reply.respondent == "丞相"


def test_archival_failure_is_degraded_without_partial_success(monkeypatch):
    def _fail(*_args, **_kwargs):
        raise ShiguanStorageError("史馆写入失败，请稍后再试")

    monkeypatch.setattr(storage, "create_reply_with_evidence", _fail)
    result = archive_decree.archive_chancellor_decree("请核定年度预算", _response())
    assert result.archived is False
    assert result.reply_id is not None


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
            '{"status":"READY","result":{"opinion":"建议司级办理",'
            '"factual_claims":[]},"adopted_evidence_ids":[],"fact_basis":"NOT_REQUIRED"}',
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
