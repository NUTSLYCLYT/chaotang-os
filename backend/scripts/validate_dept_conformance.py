"""scripts/validate_dept_conformance.py — 部门宪法一致性校验器(全院铁律强制器)。

把 docs/architecture/dept_constitution.md 的条款变成可跑检查:逐部门出遵宪记分卡,
违宪红灯(exit 1)。加进 CI,新部门不守宪进不来——让"全院遵循"从盼望变强制。

不依赖 LLM,纯静态检查,可在 CI / nightly flywheel 里跑。
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parent.parent
_DESIGN = _ROOT / "docs" / "dept_design"
_PROTOCOL = _ROOT / "config" / "advisor_protocols.yaml"
_COURT_DOC = _ROOT / "schemas" / "court_doc.json"

# 全 11 部门(slug)
DEPTS = [
    "xingbu", "hubu", "libu", "bingbu", "gongbu", "libu_personnel",
    "qintianjian", "shiguan", "jinyiwei", "yushi", "prime_minister",
]
# 已接 court_doc 的实现引擎(L1):slug → 模块。
# 刑部/工部/户部有专用确定性引擎;其余经 src/dept_doc.py 通用桥(数据源由上游插入)。
_DEDICATED = {
    "xingbu": "src/xingbu_verdict.py",
    "gongbu": "src/gongbu_review_verdict.py",
    "hubu": "src/hubu_memorial_verdict.py",
}
IMPLEMENTED = {
    **_DEDICATED,
    **{d: "src/dept_doc.py" for d in (
        "libu", "bingbu", "libu_personnel", "qintianjian",
        "shiguan", "jinyiwei", "yushi", "prime_minister",
    )},
}


def _check_global_invariant() -> tuple[bool, str]:
    """C2 源头:global_contract 仍声明'大神不是放行人'。"""
    import yaml
    try:
        d = yaml.safe_load(_PROTOCOL.read_text(encoding="utf-8")) or {}
    except Exception as e:  # noqa: BLE001
        return False, f"协议无法解析: {e}"
    principle = (d.get("global_contract") or {}).get("principle", "")
    ok = ("不是" in principle and "放行人" in principle)
    return ok, principle[:60]


def check_dept(slug: str) -> dict:
    doc = _DESIGN / f"{slug}.md"
    has_doc = doc.exists()
    text = doc.read_text(encoding="utf-8") if has_doc else ""
    refs_court_doc = "court_doc" in text                       # C3
    has_tier_or_layer = any(k in text for k in ("P0", "P1", "P2", "P3", "御史", "court_doc"))  # C1/C4 痕迹
    implemented = slug in IMPLEMENTED
    level = "L1" if implemented else ("L0" if (has_doc and refs_court_doc) else "—")
    violations = []
    if not has_doc:
        violations.append("缺设计文档(C1)")
    if has_doc and not refs_court_doc:
        violations.append("未引用 court_doc(C3)")
    return {
        "dept": slug, "has_doc": has_doc, "refs_court_doc": refs_court_doc,
        "implemented": implemented, "level": level, "violations": violations,
    }


def main() -> int:
    inv_ok, inv_txt = _check_global_invariant()
    rows = [check_dept(s) for s in DEPTS]

    print("朝堂部门宪法 · 遵宪记分卡")
    print(f"全局不变量 C2(大神不是放行人): {'✅' if inv_ok else '❌'}  「{inv_txt}」")
    print(f"court_doc 单一聚合标准 C3: {'✅ 存在' if _COURT_DOC.exists() else '❌ 缺失'}")
    print("-" * 56)
    print(f"{'部门':<16}{'文书':<6}{'court_doc':<11}{'等级':<6}违宪")
    n_viol = 0
    for r in rows:
        v = "; ".join(r["violations"]) or "—"
        if r["violations"]:
            n_viol += 1
        print(f"{r['dept']:<16}{'✓' if r['has_doc'] else '✗':<6}"
              f"{'✓' if r['refs_court_doc'] else '✗':<11}{r['level']:<6}{v}")
    l0 = sum(1 for r in rows if r["level"] in ("L0", "L1"))
    l1 = sum(1 for r in rows if r["level"] == "L1")
    print("-" * 56)
    print(f"守宪(≥L0): {l0}/{len(rows)} | 已实现(L1): {l1}/{len(rows)}")

    failed = (not inv_ok) or (not _COURT_DOC.exists()) or n_viol > 0
    print("结果:", "❌ 有违宪" if failed else "✅ 全院守宪")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
