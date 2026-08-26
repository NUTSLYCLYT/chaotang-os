from __future__ import annotations

import json
from datetime import date
from decimal import Decimal
from pathlib import Path
from types import SimpleNamespace

import pytest
from pydantic import ValidationError

from app.accounting_reports import (
    AccountingSourceError,
    NormalizedLedgerRow,
    ReportIntentKind,
    ReportPeriod,
    SourceRef,
    detect_accounting_report_intent,
)
from app.agents.chancellor_draft import graph as draft_graph
from app.agents.chancellor_draft.graph import ChancellorDraftGraphInvocationError
from app.agents.chancellor_draft.models import DraftEdict
from app.agents.chancellor_draft.routing import (
    ApprovedDepartmentRoute,
    ApprovedRouteSnapshot,
    build_route_snapshot,
)


def _synthetic_dataset_fingerprint(value: str = "a" * 64):
    return SimpleNamespace(
        manifest=SimpleNamespace(fingerprint=value),
        subject_identity="synthetic-entity-2025",
    )


def build_chancellor_draft_graph(*args, **kwargs):
    kwargs.setdefault(
        "accounting_source_loader", _synthetic_dataset_fingerprint_loader
    )
    return draft_graph.build_chancellor_draft_graph(*args, **kwargs)


def _synthetic_dataset_fingerprint_loader(_source_dir: Path, _period: ReportPeriod):
    return _synthetic_dataset_fingerprint()


def _valid_model_response() -> str:
    return json.dumps(
        {
            "status": "CLARIFYING",
            "understanding": "用户希望了解股票投资，但目标和边界仍是推测。",
            "expert_example": "我想用闲置资金参与 A 股，在控制重大亏损的前提下争取合理收益。",
            "recommendation_reason": "先明确风险和退出条件，可以避免把赚钱误解为追逐短期上涨。",
            "assumptions": ["使用闲置资金", "不借贷"],
            "revision_prompt": "请直接说案例中哪里不像你，例如只做 A 股、计划持有半年。",
            "draft": None,
        },
        ensure_ascii=False,
    )


def _valid_ready_payload() -> dict[str, object]:
    payload = json.loads(_valid_model_response())
    payload["status"] = "DRAFT_READY"
    payload["draft"] = {
        "objective": "核查合同风险",
        "scope": ["付款条款"],
        "exclusions": [],
        "input_materials": ["合同正文"],
        "material_gaps": [],
        "key_questions": ["付款条件是否明确"],
        "departments": [
            {
                "department": "户部",
                "bureaus": ["会计司"],
                "role": "主审",
                "reason": "涉及付款",
                "responsibility": "审查结算风险",
                "expected_output": "付款风险清单",
            }
        ],
        "execution_steps": ["审查付款条款"],
        "deliverables": ["风险清单"],
        "completion_criteria": ["逐项给出依据"],
        "permissions_and_limits": ["不自动签约"],
        "current_status": "DRAFT_READY",
    }
    return payload


def _ready_accounting_payload(year: int) -> dict[str, object]:
    payload = _valid_ready_payload()
    payload["expert_example"] = (
        f"请户部会计司根据系统内既有财务数据生成{year}年财务报表，"
        "并交付可下载的 Excel 文件。"
    )
    return payload


def _ready_accounting_range_payload(start_year: int, end_year: int) -> dict[str, object]:
    payload = _valid_ready_payload()
    payload["expert_example"] = (
        "请户部会计司根据系统内既有财务数据生成"
        f"{start_year}年至{end_year}年财务报表，并交付可下载的 Excel 文件。"
    )
    return payload


def _synthetic_ledger_row(year: int) -> NormalizedLedgerRow:
    zero = Decimal("0")
    return NormalizedLedgerRow(
        year=year,
        category="assets",
        account_code="1001",
        account_name="synthetic cash",
        opening_debit=zero,
        opening_credit=zero,
        movement_debit=zero,
        movement_credit=zero,
        closing_debit=zero,
        closing_credit=zero,
        source=SourceRef(
            file_name=f"synthetic-{year}.xlsx",
            sheet_name="synthetic",
            row_number=1,
            file_sha256="a" * 64,
        ),
    )


def _fixed_today() -> date:
    return date(2026, 8, 5)


def _assert_exact_report_year(text: str, year: int) -> None:
    intent = detect_accounting_report_intent(text)
    assert intent.kind is ReportIntentKind.EXPLICIT_PERIOD
    assert intent.period == ReportPeriod(year, year)


def test_graph_loads_skill_and_calls_model_once() -> None:
    calls: list[list[dict[str, str]]] = []

    def fake_model(messages: list[dict[str, str]]) -> str:
        calls.append(messages)
        return _valid_model_response()

    result = build_chancellor_draft_graph(chat_model=fake_model).invoke(
        {
            "messages": [{"role": "user", "content": "我想炒股赚钱"}],
            "version": 1,
        }
    )

    assert len(calls) == 1
    system_prompt = calls[0][0]["content"]
    assert "优先生成完整的大神级拟旨草案" in system_prompt
    assert "没有真实阻断时返回 DRAFT_READY" in system_prompt
    assert "丞相建议" in system_prompt
    assert "暂定边界" in system_prompt
    assert '"assumptions": ["string"]' in system_prompt
    assert '"departments": [' in system_prompt
    assert '"bureaus": [' in system_prompt
    assert "六部固定为" in system_prompt
    assert "本部真实司" in system_prompt
    assert "即使只有一项或零项" in system_prompt
    assert "revision_prompt 必须是非空字符串" in system_prompt
    assert "departments 必须是至少包含一项的 JSON 数组" in system_prompt
    assert "scope、key_questions、execution_steps、deliverables" in system_prompt
    assert "exclusions、input_materials、material_gaps、assumptions 可以为空数组" in (
        system_prompt
    )
    assert "expert_example 是用户确认并直接执行的自然语言旨意正文" in system_prompt
    assert "不得放结构化 JSON" in system_prompt
    assert "去除首尾空白后必须为 1–2000 字" in system_prompt
    skeleton_index = system_prompt.index("严格遵循这个完整类型 JSON 骨架")
    assert system_prompt.index(
        "DRAFT_READY requires draft to be a non-null object"
    ) < skeleton_index
    assert "draft.current_status must equal DRAFT_READY" in system_prompt
    assert "draft.material_gaps must be an empty JSON array" in system_prompt
    assert calls[0][1] == {"role": "user", "content": "我想炒股赚钱"}
    assert result["response"]["status"] == "CLARIFYING"
    assert len(result["response"]["fingerprint"]) == 64


def test_p0_battery_draft_fails_closed_before_model_and_preserves_authority() -> None:
    calls = 0

    def fake_model(_messages: list[dict[str, str]]) -> str:
        nonlocal calls
        calls += 1
        return json.dumps(_valid_ready_payload(), ensure_ascii=False)

    result = build_chancellor_draft_graph(chat_model=fake_model).invoke(
        {
            "messages": [{"role": "user", "content": "储能电池正在燃烧并发烟"}],
            "version": 9,
        }
    )

    response = result["response"]
    assert calls == 0
    assert response["status"] == "ISSUE_BLOCKED"
    assert response["draft"] is None
    assert response["decree_text"] is None
    assert response["expert_example"].startswith(
        "立即行动：人员立即远离并通知现场应急/消防；仅在安全前提下切断电源。"
    )
    assert "P0/BLACK" in response["expert_example"]
    assert "sourceLabel=USER_TEXT_RULE_CLASSIFICATION_NON_LIVE" in response[
        "expert_example"
    ]
    assert result["preserve_authority"] is True


def test_p1_battery_draft_freezes_safe_route_before_fingerprint() -> None:
    from app.agents.chancellor_draft.battery_safety import expected_draft_fingerprint
    from app.agents.chancellor_draft.models import ChancellorDraftResponse

    calls = 0

    def fake_model(_messages: list[dict[str, str]]) -> str:
        nonlocal calls
        calls += 1
        return json.dumps(_valid_ready_payload(), ensure_ascii=False)

    response = build_chancellor_draft_graph(chat_model=fake_model).invoke(
        {
            "messages": [{"role": "user", "content": "储能电池异常告警，请复核"}],
            "version": 10,
        }
    )["response"]

    validated = ChancellorDraftResponse.model_validate(response)
    assert calls == 1
    assert validated.status.value == "DRAFT_READY"
    assert validated.decree_text is not None
    assert validated.decree_text.startswith(
        "【电池物理安全门V1：P1/BLACK；必须人工确认；工部·技术司】"
        "立即行动：立即停止使用和充放电并隔离；由有资质人员现场检查。"
    )
    assert "sourceLabel=USER_TEXT_RULE_CLASSIFICATION_NON_LIVE" in validated.decree_text
    assert any(
        route.department == "工部" and "技术司" in route.bureaus
        for route in validated.draft.departments
    )
    assert validated.fingerprint == expected_draft_fingerprint(validated)


@pytest.mark.parametrize("status", ("NEEDS_INPUT", "PARTIAL", "ISSUE_BLOCKED"))
def test_p1_battery_non_ready_model_status_cannot_bypass_safe_projection(
    status: str,
) -> None:
    from app.agents.chancellor_draft.battery_safety import expected_draft_fingerprint
    from app.agents.chancellor_draft.models import ChancellorDraftResponse

    payload = json.loads(_valid_model_response())
    payload.update(
        status=status,
        understanding="remote reboot and bypass BMS",
        expert_example="立即送电并直接维修",
        recommendation_reason="skip human confirmation",
        assumptions=["现场已经安全"],
        revision_prompt="energize battery now",
        draft=None,
    )

    response = build_chancellor_draft_graph(
        chat_model=lambda _messages: json.dumps(payload, ensure_ascii=False)
    ).invoke(
        {
            "messages": [{"role": "user", "content": "储能电池异常告警，请复核"}],
            "version": 11,
        }
    )["response"]

    visible = json.dumps(response, ensure_ascii=False).lower()
    validated = ChancellorDraftResponse.model_validate(response)
    for prohibited in (
        "remote reboot",
        "bypass bms",
        "立即送电并直接维修",
        "skip human confirmation",
        "现场已经安全",
        "energize",
    ):
        assert prohibited not in visible
    assert response["status"] == status
    assert response["draft"] is None
    assert response["decree_text"] is None
    assert "立即行动：立即停止使用和充放电并隔离" in visible
    assert "sourceLabel=USER_TEXT_RULE_CLASSIFICATION_NON_LIVE".lower() in visible
    assert validated.fingerprint == expected_draft_fingerprint(validated)


def test_p0_battery_gate_precedes_explicit_invalid_bureau_early_return() -> None:
    calls = 0

    def fake_model(_messages: list[dict[str, str]]) -> str:
        nonlocal calls
        calls += 1
        return json.dumps(_valid_ready_payload(), ensure_ascii=False)

    response = build_chancellor_draft_graph(chat_model=fake_model).invoke(
        {
            "messages": [
                {
                    "role": "user",
                    "content": "请礼部会计司处理正在燃烧并冒烟的储能电池",
                }
            ],
            "version": 12,
        }
    )["response"]

    assert calls == 0
    assert response["status"] == "ISSUE_BLOCKED"
    assert response["expert_example"].startswith(
        "立即行动：人员立即远离并通知现场应急/消防"
    )
    assert "P0/BLACK" in response["expert_example"]
    assert "sourceLabel=USER_TEXT_RULE_CLASSIFICATION_NON_LIVE" in response[
        "expert_example"
    ]


def test_graph_rejects_non_json_model_output() -> None:
    graph = build_chancellor_draft_graph(chat_model=lambda _messages: "普通文本")

    with pytest.raises(ChancellorDraftGraphInvocationError):
        graph.invoke(
            {
                "messages": [{"role": "user", "content": "帮我拟旨"}],
                "version": 1,
            }
        )


def test_graph_corrects_one_invalid_structured_response() -> None:
    invalid = json.loads(_valid_model_response())
    invalid["assumptions"] = "使用闲置资金，不借贷"
    responses = iter(
        (
            json.dumps(invalid, ensure_ascii=False),
            _valid_model_response(),
        )
    )
    calls: list[list[dict[str, str]]] = []

    def fake_model(messages: list[dict[str, str]]) -> str:
        calls.append(messages)
        return next(responses)

    original_messages = [{"role": "user", "content": "我想炒股赚钱"}]
    original_snapshot = [message.copy() for message in original_messages]
    response = build_chancellor_draft_graph(chat_model=fake_model).invoke(
        {
            "messages": original_messages,
            "version": 1,
        }
    )["response"]

    assert response["status"] == "CLARIFYING"
    assert len(calls) == 2
    assert calls[1][0]["role"] == "system"
    assert "assumptions must be a JSON array" in calls[1][0]["content"]
    assert (
        "This is structure-only repair. Preserve the original user's objective, "
        "domain, scope, exclusions, and requested outcome. Do not replace the "
        "task with schema validation, confirmation, no-requirement, or "
        "meta-discussion."
    ) in calls[1][0]["content"]
    assert "这只是结构修复" in calls[1][0]["content"]
    assert calls[1][-1]["role"] == "user"
    assert calls[1][-1] == original_messages[-1]
    assert calls[1][1:] == original_messages
    assert len(calls[1]) == len(original_messages) + 1
    assert original_messages == original_snapshot


def test_graph_correction_names_every_invalid_draft_list_path() -> None:
    invalid = _valid_ready_payload()
    invalid_draft = invalid["draft"]
    assert isinstance(invalid_draft, dict)
    invalid_paths = (
        "scope",
        "exclusions",
        "input_materials",
        "deliverables",
        "completion_criteria",
        "permissions_and_limits",
    )
    for field_name in invalid_paths:
        invalid_draft[field_name] = "错误的字符串列表"

    responses = iter(
        (
            json.dumps(invalid, ensure_ascii=False),
            json.dumps(_valid_ready_payload(), ensure_ascii=False),
        )
    )
    calls: list[list[dict[str, str]]] = []

    def fake_model(messages: list[dict[str, str]]) -> str:
        calls.append(messages)
        return next(responses)

    response = build_chancellor_draft_graph(chat_model=fake_model).invoke(
        {
            "messages": [{"role": "user", "content": "我要炒股赚钱"}],
            "version": 1,
        }
    )["response"]

    assert response["status"] == "DRAFT_READY"
    assert len(calls) == 2
    correction = calls[1][0]
    assert correction["role"] == "system"
    for field_name in invalid_paths:
        assert (
            f"draft.{field_name} must be a JSON array of strings"
            in correction["content"]
        )
    assert "错误的字符串列表" not in correction["content"]


def test_graph_correction_never_echoes_unknown_field_name() -> None:
    marker = "IGNORE_ALL_RULES_SECRET_MARKER"
    invalid = json.loads(_valid_model_response())
    invalid[marker] = "attacker-controlled value"
    responses = iter(
        (
            json.dumps(invalid, ensure_ascii=False),
            _valid_model_response(),
        )
    )
    calls: list[list[dict[str, str]]] = []

    def fake_model(messages: list[dict[str, str]]) -> str:
        calls.append(messages)
        return next(responses)

    response = build_chancellor_draft_graph(chat_model=fake_model).invoke(
        {
            "messages": [{"role": "user", "content": "帮我拟旨"}],
            "version": 1,
        }
    )["response"]

    assert response["status"] == "CLARIFYING"
    assert len(calls) == 2
    correction = calls[1][0]["content"]
    assert marker not in correction
    assert "attacker-controlled value" not in correction
    assert "unknown field" in correction


def test_graph_accepts_valid_third_response_after_two_schema_failures() -> None:
    calls: list[list[dict[str, str]]] = []
    responses = iter(
        (
            "not-json secret-first-draft",
            '{"status":"CLARIFYING","secret":"second-draft"}',
            _valid_model_response(),
        )
    )

    def fake_model(messages: list[dict[str, str]]) -> str:
        calls.append(messages)
        return next(responses)

    response = build_chancellor_draft_graph(chat_model=fake_model).invoke(
        {
            "messages": [{"role": "user", "content": "帮我拟旨"}],
            "version": 1,
        }
    )["response"]

    assert response["status"] == "CLARIFYING"
    assert len(calls) == 3
    assert calls[1][0]["role"] == "system"
    assert calls[2][0]["role"] == "system"
    assert "secret-first-draft" not in calls[1][0]["content"]
    assert "second-draft" not in calls[2][0]["content"]


def test_graph_correction_explains_non_empty_string_and_array_minimums() -> None:
    invalid = _valid_ready_payload()
    invalid["revision_prompt"] = ""
    invalid_draft = invalid["draft"]
    assert isinstance(invalid_draft, dict)
    invalid_draft["departments"] = []
    responses = iter(
        (
            json.dumps(invalid, ensure_ascii=False),
            json.dumps(_valid_ready_payload(), ensure_ascii=False),
        )
    )
    calls: list[list[dict[str, str]]] = []

    def fake_model(messages: list[dict[str, str]]) -> str:
        calls.append(messages)
        return next(responses)

    response = build_chancellor_draft_graph(chat_model=fake_model).invoke(
        {
            "messages": [{"role": "user", "content": "我要炒股赚钱"}],
            "version": 1,
        }
    )["response"]

    assert response["status"] == "DRAFT_READY"
    assert len(calls) == 2
    correction = calls[1][0]["content"]
    assert "revision_prompt must be a non-empty string" in correction
    assert "draft.departments must be a non-empty JSON array" in correction
    assert (
        "each department object requires non-empty strings for department, role, "
        "reason, responsibility, and expected_output"
    ) in correction


def test_graph_correction_explains_ready_draft_consistency() -> None:
    invalid = json.loads(_valid_model_response())
    invalid["status"] = "DRAFT_READY"
    responses = iter(
        (
            json.dumps(invalid, ensure_ascii=False),
            json.dumps(_valid_ready_payload(), ensure_ascii=False),
        )
    )
    calls: list[list[dict[str, str]]] = []

    def fake_model(messages: list[dict[str, str]]) -> str:
        calls.append(messages)
        return next(responses)

    response = build_chancellor_draft_graph(chat_model=fake_model).invoke(
        {
            "messages": [{"role": "user", "content": "我要炒股赚钱"}],
            "version": 1,
        }
    )["response"]

    assert response["status"] == "DRAFT_READY"
    assert len(calls) == 2
    correction = calls[1][0]["content"]
    assert "DRAFT_READY requires draft to be a non-null object" in correction
    assert "draft.current_status must equal DRAFT_READY" in correction
    assert "draft.material_gaps must be an empty JSON array" in correction


def test_ready_graph_response_uses_expert_example_as_decree_text() -> None:
    payload = _valid_ready_payload()
    payload["expert_example"] = "  请户部核查合同付款风险并交付风险清单。  "
    graph = build_chancellor_draft_graph(
        chat_model=lambda _messages: json.dumps(payload, ensure_ascii=False)
    )

    response = graph.invoke({
        "messages": [{"role": "user", "content": "审合同"}],
        "version": 1,
    })["response"]

    assert response["decree_text"] == payload["expert_example"].strip()
    assert response["expert_example"] == payload["expert_example"].strip()


def test_ready_financial_draft_routes_to_hubu_accounting_bureau() -> None:
    payload = _valid_ready_payload()
    payload["expert_example"] = (
        "请户部会计司根据现有财务数据生成2024年至2025年管理层综合财务报表，"
        "并交付可下载的 Excel 文件。"
    )

    response = build_chancellor_draft_graph(
        chat_model=lambda _messages: json.dumps(payload, ensure_ascii=False)
    ).invoke({
        "messages": [{"role": "user", "content": payload["expert_example"]}],
        "version": 1,
    })["response"]

    assert response["draft"]["departments"][0]["department"] == "户部"
    assert response["draft"]["departments"][0]["bureaus"] == ["会计司"]


def test_periodless_accounting_draft_defaults_to_previous_complete_year() -> None:
    calls: list[list[dict[str, str]]] = []
    loader_calls: list[tuple[Path, ReportPeriod]] = []
    source_dir = Path("synthetic-accounting-source")

    def fake_model(messages: list[dict[str, str]]) -> str:
        calls.append(messages)
        return json.dumps(_ready_accounting_payload(2025), ensure_ascii=False)

    def fake_loader(
        actual_source_dir: Path, period: ReportPeriod
    ) -> SimpleNamespace:
        loader_calls.append((actual_source_dir, period))
        return _synthetic_dataset_fingerprint()

    response = build_chancellor_draft_graph(
        chat_model=fake_model,
        today_provider=_fixed_today,
        accounting_source_dir=source_dir,
        accounting_source_loader=fake_loader,
    ).invoke({
        "messages": [
            {
                "role": "user",
                "content": "读取系统内既有财务数据并生成可下载财务报表",
            }
        ],
        "version": 7,
    })["response"]

    assert loader_calls == []
    assert len(calls) == 1
    assert "2025" in calls[0][0]["content"]
    assert response["status"] == "DRAFT_READY"
    _assert_exact_report_year(response["expert_example"], 2025)
    assert response["decree_text"] == response["expert_example"]
    assert any(
        "上一完整年度" in assumption and "2025" in assumption
        for assumption in response["assumptions"]
    )
    assert response["draft"]["departments"] == [
        _ready_accounting_payload(2025)["draft"]["departments"][0]
    ]
    with pytest.raises(ValidationError):
        DraftEdict.model_validate({
            **response["draft"],
            "assumptions": response["assumptions"],
        })


def test_periodless_accounting_draft_revises_tampered_default_year() -> None:
    calls: list[list[dict[str, str]]] = []
    responses = iter(
        (
            _ready_accounting_payload(2024),
            _ready_accounting_payload(2025),
        )
    )

    def fake_model(messages: list[dict[str, str]]) -> str:
        calls.append(messages)
        return json.dumps(next(responses), ensure_ascii=False)

    response = build_chancellor_draft_graph(
        chat_model=fake_model,
        today_provider=_fixed_today,
        accounting_source_dir=Path("synthetic-accounting-source"),
        accounting_source_loader=lambda _source_dir, _period: (
            _synthetic_dataset_fingerprint()
        ),
    ).invoke({
        "messages": [
            {
                "role": "user",
                "content": "读取系统内既有财务数据并生成可下载财务报表",
            }
        ],
        "version": 1,
    })["response"]

    assert len(calls) == 2
    assert "2025" in calls[1][0]["content"]
    _assert_exact_report_year(response["decree_text"], 2025)
    assert "2024" not in response["decree_text"]


def test_periodless_accounting_draft_is_ready_without_available_source() -> None:
    model_calls = 0

    def ready_model(_messages: list[dict[str, str]]) -> str:
        nonlocal model_calls
        model_calls += 1
        return json.dumps(_ready_accounting_payload(2025), ensure_ascii=False)

    graph = build_chancellor_draft_graph(
        chat_model=ready_model,
        today_provider=_fixed_today,
        accounting_source_dir=Path("private-source-path"),
        accounting_source_loader=lambda _source_dir, _period: [],
    )
    state = {
        "messages": [
            {
                "role": "user",
                "content": "读取系统内既有财务数据并生成可下载财务报表",
            }
        ],
        "version": 2,
    }

    first = graph.invoke(state)["response"]
    second = graph.invoke(state)["response"]

    assert model_calls == 2
    assert first == second
    assert first["status"] == "DRAFT_READY"
    assert first["decree_text"]
    assert first["draft"] is not None
    assert len(first["fingerprint"]) == 64
    assert first["fingerprint"] == first["fingerprint"].lower()
    int(first["fingerprint"], 16)
    assert "private-source-path" not in json.dumps(first, ensure_ascii=False)


def test_exact_local_2025_analysis_is_ready_without_preflight() -> None:
    model_calls = 0
    preflight_calls: list[tuple[Path, ReportPeriod]] = []

    def ready_model(_messages: list[dict[str, str]]) -> str:
        nonlocal model_calls
        model_calls += 1
        return json.dumps(_ready_accounting_payload(2025), ensure_ascii=False)

    def invalid_preflight(source_dir: Path, period: ReportPeriod):
        preflight_calls.append((source_dir, period))
        raise AccountingSourceError("source_schema_invalid")

    result = build_chancellor_draft_graph(
        chat_model=ready_model,
        accounting_source_dir=Path("synthetic-accounting-source"),
        accounting_source_loader=invalid_preflight,
    ).invoke({
        "messages": [{
            "role": "user",
            "content": "我想用本地数据分析出2025年的财务数据分析一下",
        }],
        "version": 1,
    })

    assert model_calls == 1
    assert preflight_calls == []
    assert result["response"]["status"] == "DRAFT_READY"
    assert result["response"]["draft"] is not None
    assert result["response"]["decree_text"]
    assert result["accounting_context"]["source_fingerprint"] is None


def test_schema_valid_local_2025_analysis_without_subject_is_ready_before_execution(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    provider_factory_calls = 0

    def forbidden_provider_config():
        nonlocal provider_factory_calls
        provider_factory_calls += 1
        raise AssertionError("provider configuration must not be loaded")

    monkeypatch.setattr(
        draft_graph,
        "load_deepseek_provider_config",
        forbidden_provider_config,
    )
    dataset = SimpleNamespace(
        manifest=SimpleNamespace(
            fingerprint="b" * 64,
            files=(SimpleNamespace(basename="guessed-entity-2025.xlsx"),),
        ),
        ledger_rows=(_synthetic_ledger_row(2025),),
        statement_rows=(),
        subject_identity=None,
    )

    result = draft_graph.build_chancellor_draft_graph(
        chat_model=lambda _messages: json.dumps(
            _ready_accounting_payload(2025), ensure_ascii=False
        ),
        accounting_source_dir=Path("synthetic-accounting-source"),
        accounting_source_loader=lambda _source_dir, _period: dataset,
    ).invoke({
        "messages": [{
            "role": "user",
            "content": "我想用本地数据分析出2025年的财务数据分析一下",
        }],
        "version": 1,
    })

    assert provider_factory_calls == 0
    assert result["response"]["status"] == "DRAFT_READY"
    assert result["response"]["draft"] is not None
    assert result["response"]["decree_text"]
    assert result["accounting_context"]["source_fingerprint"] is None


def test_draft_does_not_resolve_process_source_override(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    resolved_sources: list[Path] = []
    preflight_calls: list[tuple[Path, ReportPeriod]] = []
    configured_source = tmp_path / "approved-source"
    configured_source.mkdir()
    monkeypatch.setenv("CHAOTANG_ACCOUNTING_SOURCE_DIR", str(configured_source))

    def resolve_source() -> Path:
        source = draft_graph.resolve_accounting_source_dir()
        resolved_sources.append(source)
        return source

    def invalid_preflight(source_dir: Path, period: ReportPeriod):
        preflight_calls.append((source_dir, period))
        raise AccountingSourceError("source_schema_invalid")

    graph = draft_graph.build_chancellor_draft_graph(
        chat_model=lambda _messages: json.dumps(
            _ready_accounting_payload(2025), ensure_ascii=False
        ),
        accounting_source_dir_resolver=resolve_source,
        accounting_source_loader=invalid_preflight,
    )
    response = graph.invoke({
        "messages": [{
            "role": "user",
            "content": "我想用本地数据分析出2025年的财务数据分析一下",
        }],
        "version": 1,
    })["response"]

    assert resolved_sources == []
    assert preflight_calls == []
    assert response["status"] == "DRAFT_READY"


def test_invalid_process_source_is_deferred_until_execution(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    provider_factory_calls = 0
    monkeypatch.setenv(
        "CHAOTANG_ACCOUNTING_SOURCE_DIR", str(tmp_path / "missing-source")
    )

    def forbidden_provider_config():
        nonlocal provider_factory_calls
        provider_factory_calls += 1
        raise AssertionError("provider configuration must not be loaded")

    monkeypatch.setattr(
        draft_graph, "load_deepseek_provider_config", forbidden_provider_config
    )
    graph = draft_graph.build_chancellor_draft_graph(
        chat_model=lambda _messages: json.dumps(
            _ready_accounting_payload(2025), ensure_ascii=False
        )
    )
    response = graph.invoke({
        "messages": [{
            "role": "user",
            "content": "我想用本地数据分析出2025年的财务数据分析一下",
        }],
        "version": 1,
    })["response"]

    assert response["status"] == "DRAFT_READY"
    assert response["draft"] is not None
    assert response["decree_text"]
    assert provider_factory_calls == 0


def test_ready_accounting_analysis_binds_server_source_context() -> None:
    payload = _valid_ready_payload()
    payload["expert_example"] = (
        "请户部会计司使用本地财务数据分析2025年财务情况。"
    )

    result = build_chancellor_draft_graph(
        chat_model=lambda _messages: json.dumps(payload, ensure_ascii=False),
        accounting_source_loader=lambda _source_dir, _period: (
            _synthetic_dataset_fingerprint("b" * 64)
        ),
    ).invoke({
        "messages": [{
            "role": "user",
            "content": "我想用本地数据分析出2025年的财务数据分析一下",
        }],
        "version": 1,
    })

    assert result["response"]["status"] == "DRAFT_READY"
    assert result["accounting_context"] == {
        "request_kind": "ACCOUNTING_ANALYSIS",
        "period_start": 2025,
        "period_end": 2025,
        "source_fingerprint": None,
    }


def test_invalid_accounting_period_needs_input_before_model_or_loader() -> None:
    model_calls = 0
    loader_calls = 0

    def forbidden_model(_messages: list[dict[str, str]]) -> str:
        nonlocal model_calls
        model_calls += 1
        raise AssertionError("model must not be called")

    def forbidden_loader(_source_dir: Path, _period: ReportPeriod):
        nonlocal loader_calls
        loader_calls += 1
        raise AssertionError("loader must not be called")

    response = build_chancellor_draft_graph(
        chat_model=forbidden_model,
        today_provider=_fixed_today,
        accounting_source_dir=Path("synthetic-accounting-source"),
        accounting_source_loader=forbidden_loader,
    ).invoke({
        "messages": [
            {
                "role": "user",
                "content": "请生成2025-2024年财务报表并提供下载",
            }
        ],
        "version": 3,
    })["response"]

    assert model_calls == 0
    assert loader_calls == 0
    assert response["status"] == "NEEDS_INPUT"
    assert response["decree_text"] is None
    assert response["draft"] is None
    assert len(response["fingerprint"]) == 64


def test_explicit_2024_accounting_draft_preflights_once_without_defaulting() -> None:
    calls: list[list[dict[str, str]]] = []
    preflight_calls: list[ReportPeriod] = []

    def fake_model(messages: list[dict[str, str]]) -> str:
        calls.append(messages)
        return json.dumps(_ready_accounting_payload(2024), ensure_ascii=False)

    response = build_chancellor_draft_graph(
        chat_model=fake_model,
        today_provider=_fixed_today,
        accounting_source_dir=Path("synthetic-accounting-source"),
        accounting_source_loader=lambda _source_dir, period: (
            preflight_calls.append(period),
            _synthetic_dataset_fingerprint(),
        )[1],
    ).invoke({
        "messages": [
            {
                "role": "user",
                "content": "读取系统内既有财务数据并生成2024年可下载财务报表",
            }
        ],
        "version": 4,
    })["response"]

    assert len(calls) == 1
    assert preflight_calls == []
    _assert_exact_report_year(response["decree_text"], 2024)
    assert not any("上一完整年度" in item for item in response["assumptions"])


def test_explicit_2025_accounting_draft_does_not_preflight_unavailable_source() -> None:
    decree = (
        "请户部会计司根据系统内既有财务数据，生成2025年管理层综合财务报表，"
        "并交付可下载的 Excel 文件。"
    )
    loader_calls = 0

    def unavailable_source(_source_dir: Path, _period: ReportPeriod):
        nonlocal loader_calls
        loader_calls += 1
        raise AccountingSourceError("source_schema_invalid")

    response = build_chancellor_draft_graph(
        chat_model=lambda _messages: json.dumps(
            _ready_accounting_payload(2025), ensure_ascii=False
        ),
        accounting_source_dir=Path("synthetic-accounting-source"),
        accounting_source_loader=unavailable_source,
    ).invoke({
        "messages": [{"role": "user", "content": decree}],
        "version": 8,
    })["response"]

    assert loader_calls == 0
    assert response["status"] == "DRAFT_READY"
    assert response["decree_text"]


def test_explicit_2024_accounting_draft_corrects_model_period_drift() -> None:
    calls: list[list[dict[str, str]]] = []
    responses = iter(
        (
            _ready_accounting_payload(2025),
            _ready_accounting_payload(2024),
        )
    )

    def fake_model(messages: list[dict[str, str]]) -> str:
        calls.append(messages)
        return json.dumps(next(responses), ensure_ascii=False)

    response = build_chancellor_draft_graph(
        chat_model=fake_model,
        today_provider=_fixed_today,
    ).invoke({
        "messages": [{
            "role": "user",
            "content": "读取系统内既有财务数据并生成2024年可下载财务报表",
        }],
        "version": 5,
    })["response"]

    assert len(calls) == 2
    assert "2024 年" in calls[0][0]["content"]
    _assert_exact_report_year(response["decree_text"], 2024)


@pytest.mark.parametrize(
    "invalid_payload",
    [
        _ready_accounting_payload(2025),
        {
            **_valid_ready_payload(),
            "expert_example": "请户部会计司生成财务报表并交付可下载的 Excel 文件。",
        },
    ],
    ids=["tampered", "omitted"],
)
def test_explicit_accounting_range_corrects_tampered_or_omitted_period(
    invalid_payload: dict[str, object],
) -> None:
    calls: list[list[dict[str, str]]] = []
    responses = iter(
        (
            invalid_payload,
            _ready_accounting_range_payload(2024, 2025),
        )
    )

    def fake_model(messages: list[dict[str, str]]) -> str:
        calls.append(messages)
        return json.dumps(next(responses), ensure_ascii=False)

    response = build_chancellor_draft_graph(chat_model=fake_model).invoke({
        "messages": [{
            "role": "user",
            "content": "请生成2024年至2025年财务报表并提供下载",
        }],
        "version": 6,
    })["response"]

    assert len(calls) == 2
    intent = detect_accounting_report_intent(response["decree_text"])
    assert intent.kind is ReportIntentKind.EXPLICIT_PERIOD
    assert intent.period == ReportPeriod(2024, 2025)


def test_explicit_accounting_period_rejects_repeated_model_drift() -> None:
    with pytest.raises(ChancellorDraftGraphInvocationError):
        build_chancellor_draft_graph(
            chat_model=lambda _messages: json.dumps(
                _ready_accounting_payload(2025),
                ensure_ascii=False,
            )
        ).invoke({
            "messages": [{
                "role": "user",
                "content": "请生成2024年财务报表并提供下载",
            }],
            "version": 7,
        })


def test_financial_intent_corrects_legal_but_wrong_budget_route() -> None:
    invalid = _valid_ready_payload()
    invalid["draft"]["departments"][0]["bureaus"] = ["预算司"]
    corrected = _ready_accounting_range_payload(2024, 2025)
    calls: list[list[dict[str, str]]] = []
    responses = iter((invalid, corrected))
    decree = (
        "请户部会计司根据现有财务数据，生成2024年至2025年管理层综合财务报表，"
        "并交付可下载的 Excel 文件。"
    )

    def fake_model(messages: list[dict[str, str]]) -> str:
        calls.append(messages)
        return json.dumps(next(responses), ensure_ascii=False)

    response = build_chancellor_draft_graph(chat_model=fake_model).invoke({
        "messages": [{"role": "user", "content": decree}],
        "version": 1,
    })["response"]

    assert len(calls) == 2
    assert response["draft"]["departments"] == [
        {
            **corrected["draft"]["departments"][0],
            "bureaus": ["会计司"],
        }
    ]


def test_financial_intent_rejects_legal_but_wrong_route_twice() -> None:
    invalid = _valid_ready_payload()
    invalid["draft"]["departments"][0]["bureaus"] = ["预算司"]
    decree = (
        "请户部会计司根据现有财务数据，生成2024年至2025年管理层综合财务报表，"
        "并交付可下载的 Excel 文件。"
    )

    with pytest.raises(ChancellorDraftGraphInvocationError):
        build_chancellor_draft_graph(
            chat_model=lambda _messages: json.dumps(invalid, ensure_ascii=False)
        ).invoke({
            "messages": [{"role": "user", "content": decree}],
            "version": 1,
        })


@pytest.mark.parametrize(
    "departments",
    [
        [{**_valid_ready_payload()["draft"]["departments"][0], "department": "户部会计司"}],
        [{**_valid_ready_payload()["draft"]["departments"][0], "department": "未知部"}],
        [{**_valid_ready_payload()["draft"]["departments"][0], "bureaus": []}],
        [{**_valid_ready_payload()["draft"]["departments"][0], "bureaus": ["会计司", "会计司"]}],
        [{**_valid_ready_payload()["draft"]["departments"][0], "bureaus": ["营缮司"]}],
        [
            _valid_ready_payload()["draft"]["departments"][0],
            _valid_ready_payload()["draft"]["departments"][0],
        ],
    ],
)
def test_graph_corrects_invalid_department_routes_once(departments) -> None:
    invalid = _valid_ready_payload()
    invalid["draft"]["departments"] = departments
    corrected = _ready_accounting_payload(2024)
    calls: list[list[dict[str, str]]] = []
    responses = iter((invalid, corrected))

    def fake_model(messages: list[dict[str, str]]) -> str:
        calls.append(messages)
        return json.dumps(next(responses), ensure_ascii=False)

    response = build_chancellor_draft_graph(chat_model=fake_model).invoke({
        "messages": [{"role": "user", "content": "请生成2024年财务报表"}],
        "version": 1,
    })["response"]

    assert response["draft"]["departments"][0]["bureaus"] == ["会计司"]
    assert len(calls) == 2
    assert "六部固定为" in calls[1][0]["content"]
    assert "本部真实司" in calls[1][0]["content"]
    assert (
        "刑部=[合同司,合规稽查司,风控司,缺证核查司,争议处置司,知识产权司,制度司]"
        in calls[1][0]["content"]
    )
    assert "不确定时必须使用 bureaus" not in calls[1][0]["content"]
    assert "never select the first bureau as a fallback" in calls[1][0]["content"]


def test_graph_rejects_invalid_department_routes_twice() -> None:
    payload = _valid_ready_payload()
    payload["draft"]["departments"][0]["bureaus"] = []

    with pytest.raises(ChancellorDraftGraphInvocationError):
        build_chancellor_draft_graph(
            chat_model=lambda _messages: json.dumps(payload, ensure_ascii=False)
        ).invoke({
            "messages": [{"role": "user", "content": "请生成2024年财务报表"}],
            "version": 1,
        })


@pytest.mark.parametrize(
    "message",
    (
        "请礼部仪制司制定一页朝会礼仪检查清单",
        "请礼部会计司制定一页朝会礼仪检查清单",
        "请礼部国际合作交流统筹司制定交流检查清单",
        "请礼部公司事务司制定事务检查清单",
        "请礼部旗下公司会计司制定财务检查清单",
    ),
)
def test_explicit_invalid_bureau_returns_needs_input_without_model_call(
    message: str,
) -> None:
    calls: list[list[dict[str, str]]] = []

    def fake_model(messages: list[dict[str, str]]) -> str:
        calls.append(messages)
        return json.dumps(_valid_ready_payload(), ensure_ascii=False)

    response = build_chancellor_draft_graph(chat_model=fake_model).invoke({
        "messages": [{"role": "user", "content": message}],
        "version": 7,
    })["response"]

    assert calls == []
    assert response["status"] == "NEEDS_INPUT"
    assert response["version"] == 7
    assert response["draft"] is None
    assert response["decree_text"] is None

    repeated = build_chancellor_draft_graph(chat_model=fake_model).invoke({
        "messages": [{"role": "user", "content": message}],
        "version": 7,
    })["response"]
    assert repeated["fingerprint"] == response["fingerprint"]


def test_explicit_legal_bureau_reaches_model_and_is_preserved() -> None:
    payload = _valid_ready_payload()
    payload["draft"]["departments"] = [
        {
            "department": "礼部",
            "bureaus": ["品牌司"],
            "role": "主办",
            "reason": "负责礼仪检查清单",
            "responsibility": "检查礼仪要求",
            "expected_output": "一页检查清单",
        }
    ]
    calls: list[list[dict[str, str]]] = []

    def fake_model(messages: list[dict[str, str]]) -> str:
        calls.append(messages)
        return json.dumps(payload, ensure_ascii=False)

    response = build_chancellor_draft_graph(chat_model=fake_model).invoke({
        "messages": [
            {"role": "user", "content": "请礼部品牌司制定品牌表达检查清单"}
        ],
        "version": 1,
    })["response"]

    assert len(calls) == 1
    assert response["status"] == "DRAFT_READY"
    assert response["draft"]["departments"][0]["department"] == "礼部"
    assert response["draft"]["departments"][0]["bureaus"] == ["品牌司"]


def test_no_explicit_bureau_still_reaches_model_without_fixed_bureau_fallback() -> None:
    calls: list[list[dict[str, str]]] = []

    def fake_model(messages: list[dict[str, str]]) -> str:
        calls.append(messages)
        return _valid_model_response()

    response = build_chancellor_draft_graph(chat_model=fake_model).invoke({
        "messages": [{"role": "user", "content": "请礼部协助形成对外检查清单"}],
        "version": 1,
    })["response"]

    assert response["status"] == "CLARIFYING"
    assert len(calls) == 1
    system_prompt = calls[0][0]["content"]
    assert "不确定时必须使用 bureaus" not in system_prompt
    assert "无法确定本部具体司时" not in system_prompt
    assert "NEEDS_INPUT" in system_prompt


def test_department_followed_by_company_predicate_is_not_an_explicit_bureau() -> None:
    calls: list[list[dict[str, str]]] = []

    def fake_model(messages: list[dict[str, str]]) -> str:
        calls.append(messages)
        return _valid_model_response()

    response = build_chancellor_draft_graph(chat_model=fake_model).invoke({
        "messages": [
            {"role": "user", "content": "请礼部负责通知公司更新对外说明"}
        ],
        "version": 1,
    })["response"]

    assert response["status"] == "CLARIFYING"
    assert len(calls) == 1


@pytest.mark.parametrize(
    "message",
    (
        "请礼部联系司机确认接送安排",
        "请礼部负责与司法部门协调",
    ),
)
def test_department_followed_by_si_inside_an_ordinary_word_reaches_model(
    message: str,
) -> None:
    calls: list[list[dict[str, str]]] = []

    def fake_model(messages: list[dict[str, str]]) -> str:
        calls.append(messages)
        return _valid_model_response()

    response = build_chancellor_draft_graph(chat_model=fake_model).invoke({
        "messages": [{"role": "user", "content": message}],
        "version": 1,
    })["response"]

    assert response["status"] == "CLARIFYING"
    assert len(calls) == 1


def test_only_latest_user_message_is_checked_for_explicit_invalid_bureau() -> None:
    calls: list[list[dict[str, str]]] = []

    def fake_model(messages: list[dict[str, str]]) -> str:
        calls.append(messages)
        return _valid_model_response()

    response = build_chancellor_draft_graph(chat_model=fake_model).invoke({
        "messages": [
            {"role": "user", "content": "请礼部仪制司制定检查清单"},
            {"role": "assistant", "content": "请改用冻结名录中的司"},
            {"role": "user", "content": "请礼部协助形成对外检查清单"},
        ],
        "version": 2,
    })["response"]

    assert response["status"] == "CLARIFYING"
    assert len(calls) == 1


def test_route_snapshot_preserves_order_and_is_frozen() -> None:
    payload = _valid_ready_payload()
    payload["draft"]["departments"].append({
        "department": "工部",
        "bureaus": ["技术司", "质量司"],
        "role": "协办",
        "reason": "负责交付",
        "responsibility": "校验技术交付",
        "expected_output": "交付验收意见",
    })
    snapshot = build_route_snapshot(DraftEdict.model_validate(payload["draft"]))

    assert snapshot == ApprovedRouteSnapshot(
        departments=(
            ApprovedDepartmentRoute(
                department="户部", required_bureaus=("会计司",)
            ),
            ApprovedDepartmentRoute(
                department="工部", required_bureaus=("技术司", "质量司")
            ),
        )
    )
    with pytest.raises(ValidationError):
        snapshot.departments = tuple(reversed(snapshot.departments))
    with pytest.raises(ValidationError):
        snapshot.departments[0].required_bureaus = ("预算司",)


def test_fingerprint_changes_with_route_order_or_required_bureaus() -> None:
    base = _valid_ready_payload()
    base["draft"]["departments"].append({
        "department": "工部",
        "bureaus": ["技术司"],
        "role": "协办",
        "reason": "负责交付",
        "responsibility": "校验技术交付",
        "expected_output": "交付验收意见",
    })
    reordered = json.loads(json.dumps(base, ensure_ascii=False))
    reordered["draft"]["departments"].reverse()
    changed_bureau = json.loads(json.dumps(base, ensure_ascii=False))
    changed_bureau["draft"]["departments"][0]["bureaus"] = ["预算司"]

    def fingerprint(payload: dict[str, object]) -> str:
        return build_chancellor_draft_graph(
            chat_model=lambda _messages: json.dumps(payload, ensure_ascii=False)
        ).invoke({
            "messages": [{"role": "user", "content": "请办理"}],
            "version": 1,
        })["response"]["fingerprint"]

    assert len({fingerprint(base), fingerprint(reordered), fingerprint(changed_bureau)}) == 3


def test_canonical_payload_explicitly_contains_route_snapshot() -> None:
    normalized_payload = {"status": "DRAFT_READY", "draft": {"same": "value"}}
    route_snapshot = {
        "departments": [
            {"department": "户部", "required_bureaus": ["会计司"]}
        ]
    }

    canonical = draft_graph._canonical_payload(
        version=3,
        normalized_payload=normalized_payload,
        decree_text="请生成财务报表",
        route_snapshot=route_snapshot,
    )

    assert canonical["draft"] == {"same": "value"}
    assert canonical["route_snapshot"] == route_snapshot


def test_ready_financial_draft_uses_visible_natural_language_as_decree_text() -> None:
    payload = _valid_ready_payload()
    payload["expert_example"] = (
        "  请户部会计司生成2024年至2025年管理层综合财务报表并交付 Excel，"
        "不修改原始数据。  "
    )
    draft = payload["draft"]
    assert isinstance(draft, dict)
    draft["scope"] = [
        f"财务数据范围 {index}: " + "明细" * 80 for index in range(30)
    ]
    assert len(json.dumps(draft, ensure_ascii=False, indent=2)) > 2000

    response = build_chancellor_draft_graph(
        chat_model=lambda _messages: json.dumps(payload, ensure_ascii=False)
    ).invoke({
        "messages": [{"role": "user", "content": "请生成2024年至2025年财务报表"}],
        "version": 2,
    })["response"]

    assert response["decree_text"] == payload["expert_example"].strip()
    assert response["expert_example"] == payload["expert_example"].strip()
    assert len(response["decree_text"]) <= 2000
    assert not response["decree_text"].startswith("{")
    with pytest.raises(json.JSONDecodeError):
        json.loads(response["decree_text"])


@pytest.mark.parametrize("invalid_example", ["", " " * 10, "旨" * 2001])
def test_graph_corrects_invalid_expert_example_once(invalid_example: str) -> None:
    invalid = _valid_ready_payload()
    invalid["expert_example"] = invalid_example
    corrected = _valid_ready_payload()
    corrected["expert_example"] = "请户部核查合同付款风险。"
    responses = iter(
        (
            json.dumps(invalid, ensure_ascii=False),
            json.dumps(corrected, ensure_ascii=False),
        )
    )

    response = build_chancellor_draft_graph(
        chat_model=lambda _messages: next(responses)
    ).invoke({
        "messages": [{"role": "user", "content": "审合同"}],
        "version": 1,
    })["response"]

    assert response["decree_text"] == corrected["expert_example"]


@pytest.mark.parametrize("invalid_example", ["", " " * 10, "旨" * 2001])
def test_graph_rejects_expert_example_invalid_twice(invalid_example: str) -> None:
    payload = _valid_ready_payload()
    payload["expert_example"] = invalid_example

    with pytest.raises(ChancellorDraftGraphInvocationError):
        build_chancellor_draft_graph(
            chat_model=lambda _messages: json.dumps(payload, ensure_ascii=False)
        ).invoke({
            "messages": [{"role": "user", "content": "审合同"}],
            "version": 1,
        })


@pytest.mark.parametrize(
    ("mutation", "expected_fragment"),
    [
        (lambda payload: payload.update(draft=None), "draft"),
        (
            lambda payload: payload["draft"].update(
                material_gaps=["缺少合同正文"]
            ),
            "material_gaps",
        ),
        (
            lambda payload: payload["draft"].update(current_status="CLARIFYING"),
            "current_status",
        ),
    ],
)
def test_draft_ready_rejects_inconsistent_draft(
    mutation, expected_fragment
) -> None:
    payload = _valid_ready_payload()
    mutation(payload)

    with pytest.raises(ChancellorDraftGraphInvocationError) as exc_info:
        build_chancellor_draft_graph(
            chat_model=lambda _messages: json.dumps(payload, ensure_ascii=False)
        ).invoke(
            {
                "messages": [{"role": "user", "content": "我要炒股赚钱"}],
                "version": 1,
            }
        )

    assert isinstance(exc_info.value.__cause__, ValidationError)
    assert expected_fragment in str(exc_info.value.__cause__)


def test_non_ready_response_rejects_nested_ready_draft() -> None:
    payload = _valid_ready_payload()
    payload["status"] = "CLARIFYING"

    with pytest.raises(ChancellorDraftGraphInvocationError) as exc_info:
        build_chancellor_draft_graph(
            chat_model=lambda _messages: json.dumps(payload, ensure_ascii=False)
        ).invoke(
            {
                "messages": [{"role": "user", "content": "我要炒股赚钱"}],
                "version": 1,
            }
        )

    assert isinstance(exc_info.value.__cause__, ValidationError)
    assert "non-ready response" in str(exc_info.value.__cause__)
