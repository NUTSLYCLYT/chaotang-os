"""AST gate preventing new production imports of legacy flow-store writers."""

from __future__ import annotations

import ast
from pathlib import Path

LEGACY_WRITE_SYMBOLS = frozenset(
    {
        "upsert_persisted_task",
        "patch_persisted_task_result",
        "save_decree_and_task",
        "update_task_status",
        "upsert_memorial",
        "save_review_db",
        "save_retrospective_db",
    }
)

ALLOWED_IMPORTS = {
    "src/chaotang_orchestrator.py": frozenset({"update_task_status", "upsert_memorial"}),
    "src/chaotang_store.py": frozenset({"save_review_db", "save_retrospective_db"}),
    "web/routers/chaotang.py": frozenset(
        {
            "save_decree_and_task",
        }
    ),
    "scripts/backfill_flow_db.py": frozenset({"upsert_memorial", "save_review_db", "save_retrospective_db"}),
}
ALLOWED_MODULE_IMPORTS = frozenset({"src/db/__init__.py"})


def find_legacy_writer_import_violations(backend_root: Path) -> list[str]:
    violations: list[str] = []
    for root_name in ("src", "web", "scripts"):
        scan_root = backend_root / root_name
        if not scan_root.exists():
            continue
        for path in scan_root.rglob("*.py"):
            relative = path.relative_to(backend_root).as_posix()
            try:
                tree = ast.parse(path.read_text(encoding="utf-8"), filename=relative)
            except (OSError, SyntaxError) as exc:
                violations.append(f"{relative}: cannot inspect imports: {exc}")
                continue
            allowed = ALLOWED_IMPORTS.get(relative, frozenset())
            for node in ast.walk(tree):
                if isinstance(node, ast.ImportFrom):
                    if (
                        node.module == "src.db"
                        and any(alias.name == "flow_store" for alias in node.names)
                        and relative not in ALLOWED_MODULE_IMPORTS
                    ):
                        violations.append(f"{relative}:{node.lineno}: forbidden flow_store module import")
                    if node.module == "src.db.flow_store":
                        imported = {alias.name for alias in node.names} & LEGACY_WRITE_SYMBOLS
                        for symbol in sorted(imported - allowed):
                            violations.append(f"{relative}:{node.lineno}: forbidden legacy writer import {symbol}")
                elif (
                    isinstance(node, ast.Import)
                    and any(alias.name == "src.db.flow_store" for alias in node.names)
                    and relative not in ALLOWED_MODULE_IMPORTS
                ):
                    violations.append(f"{relative}:{node.lineno}: forbidden flow_store module import")
    return sorted(violations)
