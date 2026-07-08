#!/usr/bin/env python3
"""Create a local Hubu finance import workspace from checked-in templates.

The generated workspace is for real local data entry and preview only. The
default target lives under local_data/, which is ignored by git. This script
does not read drives recursively, write databases, start services, or run the
Hubu intake preview.
"""

from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_TEMPLATE_DIR = ROOT / "templates" / "hubu_finance_import"
DEFAULT_TARGET_DIR = ROOT / "local_data" / "hubu_finance_import_demo"


README_TEXT = """# Hubu Finance Import Workspace

Fill these CSV files with real local finance data, then run:

```bash
.venv/bin/python scripts/hubu_finance_import_preview.py {target}
```

Rules:
- Do not put passwords, API keys, login cookies, or production credentials into CSV.
- Keep sourceLabel/sourceRef filled for every business row.
- Keep contractId, invoiceId, payment request id, and bank matchRef consistent.
- This directory is local working data and should not be committed.
"""


def init_workspace(template_dir: Path, target_dir: Path, *, force: bool = False) -> list[Path]:
    """Copy template CSV files into a local workspace."""
    if not template_dir.is_dir():
        raise ValueError(f"template_dir does not exist or is not a directory: {template_dir}")
    if target_dir.exists() and any(target_dir.iterdir()) and not force:
        raise FileExistsError(f"target_dir already exists and is not empty: {target_dir}")

    target_dir.mkdir(parents=True, exist_ok=True)
    copied: list[Path] = []
    for src in sorted(template_dir.glob("*.csv")):
        dst = target_dir / src.name
        shutil.copy2(src, dst)
        copied.append(dst)

    readme = target_dir / "README.md"
    readme.write_text(README_TEXT.format(target=target_dir), encoding="utf-8")
    copied.append(readme)
    return copied


def main() -> int:
    parser = argparse.ArgumentParser(description="创建户部财务 CSV 本地工作区")
    parser.add_argument("--template-dir", default=str(DEFAULT_TEMPLATE_DIR), help="模板目录")
    parser.add_argument("--target-dir", default=str(DEFAULT_TARGET_DIR), help="输出工作区目录")
    parser.add_argument("--force", action="store_true", help="允许覆盖目标目录内同名模板文件")
    args = parser.parse_args()

    try:
        copied = init_workspace(Path(args.template_dir), Path(args.target_dir), force=args.force)
    except Exception as exc:  # noqa: BLE001
        print(f"error: {exc}", file=sys.stderr)
        return 2

    print(f"created: {Path(args.target_dir)}")
    for path in copied:
        print(f"- {path}")
    print("\nnext:")
    print(f".venv/bin/python scripts/hubu_finance_import_preview.py {Path(args.target_dir)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
