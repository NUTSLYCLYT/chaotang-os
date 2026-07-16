"""P5 guard: primary schema writes are migration-only in production code."""

from __future__ import annotations

from pathlib import Path

_BACKEND = Path(__file__).resolve().parent.parent
_PRIMARY_SCHEMA_FILES = (
    _BACKEND / "web" / "main.py",
    _BACKEND / "src" / "tenant.py",
    _BACKEND / "src" / "db" / "flow_store.py",
    _BACKEND / "src" / "formal_memorial.py",
)
_RETIRED_SCHEMA_HELPERS = (
    "ensure_retrospective_outcome_column",
    "ensure_decree_execution_event_sequence_column",
    "ensure_decree_execution_event_ledger_columns",
    "ensure_jinyiwei_evidence_unique_constraint",
    "ensure_build_ledger_ownership_columns",
    "ensure_final_memorial_table",
)


def test_primary_runtime_files_contain_no_schema_ddl() -> None:
    forbidden = ("CREATE TABLE", "ALTER TABLE", "CREATE INDEX", ".create_all(", ".create(")
    violations = []
    for path in _PRIMARY_SCHEMA_FILES:
        text = path.read_text(encoding="utf-8")
        for token in forbidden:
            if token in text:
                violations.append(f"{path.relative_to(_BACKEND)} contains {token}")
    assert violations == []


def test_retired_runtime_schema_helpers_have_no_production_callers() -> None:
    violations = []
    for root in (_BACKEND / "src", _BACKEND / "web"):
        for path in root.rglob("*.py"):
            text = path.read_text(encoding="utf-8")
            for helper in _RETIRED_SCHEMA_HELPERS:
                if helper in text:
                    violations.append(f"{path.relative_to(_BACKEND)} references {helper}")
    assert violations == []


def test_frozen_dadian_compatibility_shim_is_the_only_legacy_schema_reference() -> None:
    helper = "ensure_task_result_json_column"
    references = []
    for root in (_BACKEND / "src", _BACKEND / "web"):
        for path in root.rglob("*.py"):
            if helper in path.read_text(encoding="utf-8"):
                references.append(str(path.relative_to(_BACKEND)))
    assert sorted(references) == ["src/db/flow_store.py", "web/routers/dadian.py"]


def test_service_entrypoints_pin_effective_strict_schema_mode() -> None:
    service_files = (
        _BACKEND / "scripts" / "jiqun_ai.service",
        _BACKEND.parent / "frontend" / "deploy" / "services" / "jiqun.service.template",
    )
    for path in service_files:
        text = path.read_text(encoding="utf-8")
        assert "Environment=FENGQUN_SCHEMA_MODE=strict" in text
        assert "ExecStart=/usr/bin/env FENGQUN_SCHEMA_MODE=strict " in text
