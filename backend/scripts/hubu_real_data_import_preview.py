#!/usr/bin/env python3
"""Prepare a local Hubu finance import folder from selected real Excel files.

This CLI is intentionally explicit: it reads only the files passed as
arguments and writes only the selected output directory. It does not scan user
drives, write databases, change accounting books, execute payments, file taxes,
or call external services.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from scripts.hubu_finance_import_preview import _summary  # noqa: E402
from src.hubu_finance_csv_loader import build_hubu_finance_fact_pack_from_csv  # noqa: E402
from src.hubu_finance_intake import build_hubu_finance_intake_preview  # noqa: E402
from src.hubu_real_data_importer import build_hubu_real_data_import_workspace  # noqa: E402


def _run_preview(import_dir: Path, *, case_id: str, title: str, period: str) -> dict:
    fact_pack = build_hubu_finance_fact_pack_from_csv(import_dir, case_id=case_id, title=title, period=period)
    return build_hubu_finance_intake_preview(fact_pack)


def main() -> int:
    parser = argparse.ArgumentParser(description="从显式选择的真实 Excel 文件生成户部本地导入预览 CSV")
    parser.add_argument("--balance-sheet", required=True, help="发生额及余额表 Excel 路径")
    parser.add_argument("--output-dir", required=True, help="输出目录；如果在仓库内，必须位于 local_data/ 下")
    parser.add_argument("--procurement-ledger", help="可选：采购合同台账 Excel 路径")
    parser.add_argument("--contract-limit", type=int, default=80, help="最多导入多少条采购合同聚合记录")
    parser.add_argument("--force", action="store_true", help="允许覆盖输出目录中的同名模板 CSV")
    parser.add_argument("--case-id", default="hubu-real-data-preview", help="预览 caseId")
    parser.add_argument("--title", default="户部真实数据本地预览", help="预览标题")
    parser.add_argument("--period", default="2025", help="期间，例如 2025 或 2026-06")
    parser.add_argument("--preview", action="store_true", help="生成 CSV 后立即运行 side-effect-free intake preview")
    args = parser.parse_args()

    try:
        result = build_hubu_real_data_import_workspace(
            balance_sheet_path=args.balance_sheet,
            procurement_ledger_path=args.procurement_ledger,
            output_dir=args.output_dir,
            force=args.force,
            contract_limit=args.contract_limit,
        )
        payload = {"prepared": result.as_dict()}
        if args.preview:
            preview = _run_preview(result.output_dir, case_id=args.case_id, title=args.title, period=args.period)
            payload["preview"] = _summary(preview)
    except Exception as exc:  # noqa: BLE001
        print(json.dumps({"success": False, "error": str(exc)}, ensure_ascii=False, indent=2), file=sys.stderr)
        return 2

    print(json.dumps({"success": True, "data": payload}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
