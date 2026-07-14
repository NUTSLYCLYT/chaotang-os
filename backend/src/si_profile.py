"""src/si_profile.py — 司档案:把每个司当"员工"建履历/能力分析表/工作贡献。

司级二级页的后端契约(钦天监 2026-07-02 签字:司用 si 复用部门骨架 + 员工档案)。
三块,镜像大神 eval 的问责逻辑:
  ① 履历 resume     :这个司干过什么(近期经手的案子)
  ② 能力分析 capability:干得怎么样(接地率/结论通过/复盘分 → 雷达图)
  ③ 工作贡献 contribution:产出多少(奏折数/升阶解决/价值)

禁假(接 eval 纪律):没数据就诚实空,**绝不编造司的履历/能力**。数据由 case 归档按
dept+si 标签积累;标签没铺开前,档案是"待出勤"空态,而非杜撰的漂亮数字。
records_fn 可注入(测试/接不同数据源),默认从 case_archive 取。
"""
from __future__ import annotations

from pathlib import Path
from typing import Callable

import yaml

from src import capability_scoring as cap
from src.department_identity import validate_identity_consumer_keys

_REGISTRY_PATH = Path(__file__).resolve().parent.parent / "config" / "si_registry.yaml"


def _load_registry(path: Path = _REGISTRY_PATH) -> dict:
    registry = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    if not isinstance(registry, dict):
        raise ValueError("si_registry must be a mapping")
    departments = registry.get("departments", {})
    if not isinstance(departments, dict):
        raise ValueError("si_registry.departments must be a mapping")
    validate_identity_consumer_keys(
        "si_registry",
        departments,
        namespace="canonical_id",
    )
    return registry


def list_si(dept: str) -> list[dict]:
    """某部门下的司列表(前端司级导航用)。"""
    return (_load_registry().get("departments", {}) or {}).get(dept, []) or []


def _find_si(dept: str, si_code: str) -> dict | None:
    for s in list_si(dept):
        if s.get("code") == si_code:
            return s
    return None


def _card(r: dict) -> dict:
    return {"case_id": r.get("case_id"), "title": (r.get("title") or "")[:60],
            "verdict": r.get("verdict"), "date": r.get("date")}


def _highlight(records: list[dict]) -> dict:
    """张小龙:履历要讲故事——最近一次立功 + 最近一次翻车,比六个百分比更让人记住这个司。

    records 已按日期倒序,取各类最近一条。
    """
    win = next((r for r in records if r.get("verdict") in ("PASS", "准奏", "green")), None)
    stumble = next((r for r in records
                    if r.get("verdict") in ("驳回", "FAIL", "red") or r.get("reworked")), None)
    return {"win": (_card(win) if win else None),
            "stumble": (_card(stumble) if stumble else None)}


def build_si_profile(
    dept: str,
    si_code: str,
    *,
    records_fn: Callable[[str, str], list[dict]] | None = None,
) -> dict:
    """司的员工档案。records_fn(dept,si)->[{case_id,title,verdict,grounded,reworked,date}]。"""
    si = _find_si(dept, si_code)
    if si is None:
        raise ValueError(f"未注册的司:{dept}/{si_code}(请在 config/si_registry.yaml 登记)")

    records = []
    if records_fn is not None:
        try:
            records = records_fn(dept, si_code) or []
        except Exception:
            records = []
    records = sorted(records, key=lambda r: str(r.get("date", "")), reverse=True)

    resume = {
        "since": (records[-1].get("date") if records else None),   # 首次出勤,无则 null 不编
        "case_count": len(records),
        "recent": [_card(r) for r in records[:8]],
        "highlight": _highlight(records),      # 立功/翻车两张故事卡(张小龙)
        "note": (None if records else "暂无履历:该司尚未经手归档案例"),
    }
    memorials = len(records)
    escalations = sum(1 for r in records if r.get("escalated"))
    contribution = {
        "memorials": memorials,                       # 出具奏折数
        "escalations_resolved": escalations,          # 升阶并解决数
        "value_note": ("" if records else "待出勤:贡献随归档积累"),
    }
    return {
        "identity": {
            "dept": dept,
            "si": si_code,
            "name": si.get("name", si_code),
            "duty": si.get("duty", ""),
        },
        "resume": resume,                         # 履历(含立功/翻车故事卡)
        "capability": cap.score_from_records(records),   # 能力分析表(公共层,含小样本护栏)
        "contribution": contribution,                    # 工作贡献
    }
