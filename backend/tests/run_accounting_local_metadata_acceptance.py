from __future__ import annotations

import json
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))


def _empty_evidence(status: str, reason: str) -> dict[str, object]:
    return {
        "status": status,
        "reason": reason,
        "requested_years": [2025],
        "schemas": [],
        "source_hashes": [],
        "source_dimensions": [],
        "normalized_ledger_rows": None,
        "normalized_statement_rows": None,
        "manifest_fingerprint": None,
    }


def _build_evidence() -> dict[str, object]:
    from app.accounting_reports import (
        ReportPeriod,
        build_accounting_source_manifest,
        resolve_accounting_source_dir,
    )
    from app.accounting_reports.source_adapters import (
        inspect_accounting_source_dimensions,
        load_accounting_dataset,
    )
    from app.accounting_reports.sources import AccountingSourceError

    try:
        manifest = build_accounting_source_manifest(
            resolve_accounting_source_dir(), ReportPeriod(2025, 2025)
        )
        dimensions = tuple(
            inspect_accounting_source_dimensions(item) for item in manifest.files
        )
    except AccountingSourceError:
        return _empty_evidence("NEEDS_INPUT", "source_unavailable")
    safe_manifest = {
        "schemas": [item.schema_id for item in manifest.files],
        "source_hashes": [item.sha256 for item in manifest.files],
        "source_dimensions": [
            {
                "schema": item.schema_id,
                "sha256": item.sha256,
                "sheet_count": dimension[0],
                "row_count": dimension[1],
            }
            for item, dimension in zip(manifest.files, dimensions, strict=True)
        ],
        "manifest_fingerprint": manifest.fingerprint,
    }
    try:
        dataset = load_accounting_dataset(manifest)
    except AccountingSourceError:
        return {
            **_empty_evidence("NEEDS_INPUT", "source_unavailable"),
            **safe_manifest,
        }
    return {
        "status": "PASS",
        "reason": "resolved",
        "requested_years": [2025],
        **safe_manifest,
        "normalized_ledger_rows": len(dataset.ledger_rows),
        "normalized_statement_rows": len(dataset.statement_rows),
    }


def main() -> int:
    try:
        evidence = _build_evidence()
    except Exception:
        evidence = _empty_evidence("FAIL", "unexpected_error")
        exit_code = 1
    else:
        exit_code = 0
    print(json.dumps(evidence, ensure_ascii=False, sort_keys=True))
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
