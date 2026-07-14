"""朝会自转端点 — 供上书房(皇帝单屏)读最新《今日朝报》。

daily_court_session.py 跑完把朝报写到 reports/court_session/今日朝报-<stamp>.md
(八部 grounded 上奏→御史核真库→军机处矛盾→可信度章)。本端点读最新一份返回,
上书房渲染成皇帝单屏作战室。
"""

from __future__ import annotations

import re
from pathlib import Path

from fastapi import APIRouter, Depends

from web.deps import get_current_user
from web.routers._envelope import ok
from web.schemas.auth import CurrentUser
from src.runtime_paths import resolve_runtime_paths

router = APIRouter(prefix="/api/court-session", tags=["court-session"])

_REPORT_DIR = (
    resolve_runtime_paths().reports / "court_session"
)


def _latest_report() -> Path | None:
    if not _REPORT_DIR.is_dir():
        return None
    reports = sorted(_REPORT_DIR.glob("今日朝报-*.md"))
    return reports[-1] if reports else None


def _parse(content: str) -> dict:
    """从朝报 markdown 抽结构:部数/有据数/矛盾数(供上书房卡片摘要)。"""
    grounded = content.count("✅有据")
    ungrounded = content.count("⚠️无据")
    depts = len(re.findall(r"^- \*\*", content, re.MULTILINE))
    conflicts = content.count("↔")
    return {
        "deptCount": depts,
        "groundedCount": grounded,
        "ungroundedCount": ungrounded,
        "conflictCount": conflicts,
    }


@router.get("/latest")
def latest_court_session(_: CurrentUser = Depends(get_current_user)) -> dict:
    report = _latest_report()
    if not report:
        return ok(
            {
                "available": False,
                "sourceLabel": "FALLBACK",
                "stamp": "",
                "content": "",
                "summary": {
                    "deptCount": 0,
                    "groundedCount": 0,
                    "ungroundedCount": 0,
                    "conflictCount": 0,
                },
                "note": "暂无朝报;运行 scripts/daily_court_session.py 生成。",
            }
        )
    content = report.read_text(encoding="utf-8")
    stamp = report.stem.replace("今日朝报-", "")
    return ok(
        {
            "available": True,
            "sourceLabel": "MIXED",
            "stamp": stamp,
            "content": content,
            "summary": _parse(content),
        }
    )
