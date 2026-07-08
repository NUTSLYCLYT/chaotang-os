#!/usr/bin/env python3
"""Preview Hubu finance CSV imports.

Reads a directory containing the Hubu finance CSV templates, converts it to an
intake fact pack, and runs the side-effect-free intake preview. It does not
write files, scan drives, change accounting books, execute payments, file taxes,
or submit financing materials.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from src.hubu_finance_csv_loader import build_hubu_finance_fact_pack_from_csv  # noqa: E402
from src.hubu_finance_intake import build_hubu_finance_intake_preview  # noqa: E402


def _summary(preview: dict) -> dict:
    findings = preview.get("auditFindings") or []
    return {
        "caseId": preview.get("caseId"),
        "title": preview.get("title"),
        "period": preview.get("period"),
        "previewOnly": preview.get("previewOnly"),
        "executionAllowed": preview.get("executionAllowed"),
        "sideEffects": preview.get("sideEffects"),
        "verdict": (preview.get("bossBrief") or {}).get("verdict"),
        "riskLevel": (preview.get("bossBrief") or {}).get("riskLevel"),
        "sourceCoveragePct": (preview.get("sourceInventory") or {}).get("coveragePct"),
        "auditFindingCount": len(findings),
        "auditFindingIds": [item.get("id") for item in findings],
        "archiveEligible": (preview.get("archiveDraft") or {}).get("archiveEligible"),
        "reportingFactPackCaseId": (preview.get("reportingFactPack") or {}).get("caseId"),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="预览户部 CSV 导入总闸结果")
    parser.add_argument("import_dir", help="包含 hubu finance CSV 模板文件的目录")
    parser.add_argument("--case-id", default="hubu-csv-preview", help="caseId")
    parser.add_argument("--title", default="户部 CSV 导入预览", help="标题")
    parser.add_argument("--period", default="2026-06", help="期间，例如 2026-06")
    parser.add_argument("--full", action="store_true", help="输出完整 intake preview；默认只输出摘要")
    args = parser.parse_args()

    try:
        import_dir = Path(args.import_dir)
        if not import_dir.is_dir():
            raise ValueError(f"import_dir 不存在或不是目录: {import_dir}")
        fact_pack = build_hubu_finance_fact_pack_from_csv(
            import_dir,
            case_id=args.case_id,
            title=args.title,
            period=args.period,
        )
        preview = build_hubu_finance_intake_preview(fact_pack)
    except Exception as exc:  # noqa: BLE001
        print(json.dumps({"success": False, "error": str(exc)}, ensure_ascii=False, indent=2), file=sys.stderr)
        return 2

    payload = preview if args.full else _summary(preview)
    print(json.dumps({"success": True, "data": payload}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
