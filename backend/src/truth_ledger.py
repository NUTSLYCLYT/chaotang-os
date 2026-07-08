"""真值台账 truth_ledger —— 一个台账答完飞轮三问。

所有真尺子(pack_rd_check / quotation_real_score / sourcing_check)的**确定性判定**统一写这里。
回归门只读本台账的确定性判定,不读 LLM 自评分(qa_score)。

飞轮三问:
  1) 会复利吗   —— 判定写入台账 → 回归门读它 → 影响下次放行，回路闭合(非写入即丢)。
  2) 燃料干净吗 —— record() 用内容哈希幂等:同一(swarm,case,checker,verdict,score,evidence)只记一次,杜绝重放投毒。
  3) 能看见转吗 —— health() 给出 flywheel_health 数字(总数/通过率/各 swarm·checker 明细),账面区分'在转/空转'。

存储: eval/truth_ledger.jsonl (append-only, 每行一条判定)。
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

# 遗留/默认租户账本路径(向后兼容:default 租户仍写这里,不孤立既有数据)。
LEDGER = Path(__file__).resolve().parent.parent / "eval" / "truth_ledger.jsonl"


def _ledger_path() -> Path:
    """按租户解析账本路径(2026-07-07 · 会审 CRITICAL 第0步a:A 的判定不得污染 B 的风险读数)。

    default 租户 → 遗留全局路径(向后兼容);真租户 → data/<tenant>/eval/truth_ledger.jsonl。
    读失败/无租户上下文 → 遗留路径兜底(fail-safe,不静默丢记录)。
    """
    try:
        from src.tenant import (
            DEFAULT_TENANT_SLUG,
            get_current_tenant,
            get_tenant_data_dir,
        )

        slug = get_current_tenant()
        if slug == DEFAULT_TENANT_SLUG:
            return LEDGER
        return get_tenant_data_dir("eval") / "truth_ledger.jsonl"
    except Exception:
        return LEDGER


_DETERMINISTIC = {
    "pack_rd_check",
    "quotation_real_score",
    "sourcing_check",
    "archive_check",
    "intel_check",
    "recruit_check",
    "forecast_check",
    "forecast_backtest",
    "supply_chain_check",
    "haolong_check",
    "sourcing_outcome",
    "hire_outcome",
    "ima_grounding_check",
    "gongbu_review_check",
    "jinyiwei_vet",
    "knowledge_vet",
}


def _entry_hash(
    swarm: str, case_id: str, checker: str, verdict: str, score, evidence: str
) -> str:
    raw = f"{swarm}|{case_id}|{checker}|{verdict}|{score}|{evidence}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]


def _load() -> list[dict]:
    path = _ledger_path()
    if not path.exists():
        return []
    return [
        json.loads(x)
        for x in path.read_text(encoding="utf-8").splitlines()
        if x.strip()
    ]


def record(
    swarm: str,
    checker: str,
    verdict: str,
    score=None,
    detail: str = "",
    case_id: str = "",
    evidence: str = "",
    ts: str | None = None,
    provenance: str = "unknown",
) -> dict:
    """登记一条确定性判定。幂等:相同内容哈希不重复写(燃料干净)。返回该条目。

    provenance: 来源鉴权(飞轮第二问'燃料干净'在源头)。
      authenticated=run_id 在 data/fengqun.db 有对应任务记录(不可随意伪造);
      orphan=只在文件系统有、数据库查不到(疑似投毒/测试残留);
      unknown=未做鉴权(如直接调检查器)。
    """
    h = _entry_hash(swarm, case_id, checker, verdict, score, evidence)
    for e in _load():
        if e.get("hash") == h:
            return e  # 已存在 → 幂等跳过
    entry = {
        "hash": h,
        "ts": ts or datetime.now(timezone.utc).isoformat(),
        "swarm": swarm,
        "checker": checker,
        "deterministic": checker in _DETERMINISTIC,
        "provenance": provenance,
        "case_id": case_id,
        "verdict": verdict,
        "score": score,
        "detail": detail,
        "evidence": evidence,
    }
    path = _ledger_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")
    return entry


def latest_verdict(swarm: str, case_id: str, checker: str | None = None) -> dict | None:
    """取某 swarm+case(+checker)最近一条判定(回归门用)。"""
    out = [
        e
        for e in _load()
        if e.get("swarm") == swarm
        and e.get("case_id") == case_id
        and (checker is None or e.get("checker") == checker)
    ]
    return out[-1] if out else None


def gate(swarm: str, case_id: str, checker: str | None = None) -> bool:
    """回归门:最近一条确定性判定为 PASS 才放行。无记录=不放行(默认拒,真证伪)。"""
    e = latest_verdict(swarm, case_id, checker)
    return bool(
        e and e.get("deterministic") and str(e.get("verdict", "")).upper() == "PASS"
    )


def health() -> dict:
    """flywheel_health:账面区分'在转/空转'。"""
    rows = _load()
    det = [r for r in rows if r.get("deterministic")]

    def _v(r):
        return str(r.get("verdict", "")).upper()

    passed = [r for r in det if _v(r) == "PASS"]
    failed = [r for r in det if _v(r) == "FAIL"]
    unknown = [r for r in det if _v(r) == "UNKNOWN"]
    judged = len(passed) + len(failed)  # UNKNOWN 不算"判过"——抽不出不等于通过/不通过
    authed = [r for r in det if r.get("provenance") == "authenticated"]
    orphan = [r for r in det if r.get("provenance") == "orphan"]
    by_swarm: dict[str, dict] = {}
    for r in det:
        s = by_swarm.setdefault(r["swarm"], {"pass": 0, "fail": 0, "unknown": 0})
        s[{"PASS": "pass", "FAIL": "fail"}.get(_v(r), "unknown")] += 1
    # worst_swarm:聚合分会掩盖局部灾难(Deming)——账面第一眼顶出最该救的蜂群。
    # 按失败率排(judged≥3 才纳入,避免1-2条样本误判),失败率高者优先。
    worst = None
    for name, s in by_swarm.items():
        jg = s["pass"] + s["fail"]
        if jg < 3:
            continue
        fr = round(s["fail"] / jg, 3)
        if worst is None or fr > worst["fail_rate"]:
            worst = {"swarm": name, "fail_rate": fr, "fail": s["fail"], "judged": jg}
    return {
        "total_entries": len(rows),
        "deterministic_entries": len(det),
        "deterministic_ratio": round(len(det) / len(rows), 3) if rows else 0.0,
        "pass": len(passed),
        "fail": len(failed),
        "unknown": len(unknown),
        "judged": judged,
        # pass_rate 只在"判过的"上算,不被 UNKNOWN 稀释
        "pass_rate": round(len(passed) / judged, 3) if judged else 0.0,
        # blind_rate=检查器抽不出的占比,越高说明检查器越脆(指向 #8 升级抽取器)
        "blind_rate": round(len(unknown) / len(det), 3) if det else 0.0,
        # authenticated_ratio=源头鉴权过的真血占比(飞轮第二问'燃料干净'在源头的度量)
        "authenticated": len(authed),
        "orphan": len(orphan),
        "authenticated_ratio": round(len(authed) / len(det), 3) if det else 0.0,
        # worst_swarm=失败率最高的蜂群,直接顶到账面(别看被高分稀释的总分,看最该救的)
        "worst_swarm": worst,
        "by_swarm": by_swarm,
        "checkers": sorted({r["checker"] for r in det}),
    }


def _cli() -> int:
    import argparse

    ap = argparse.ArgumentParser(description="真值台账(flywheel_health + 回归门)")
    sub = ap.add_subparsers(dest="cmd")
    sub.add_parser("health")
    g = sub.add_parser("gate")
    g.add_argument("--swarm", required=True)
    g.add_argument("--case-id", required=True)
    g.add_argument("--checker")
    r = sub.add_parser("record")
    for k in ("swarm", "checker", "verdict"):
        r.add_argument(f"--{k}", required=True)
    r.add_argument("--score")
    r.add_argument("--case-id", default="")
    r.add_argument("--detail", default="")
    r.add_argument("--evidence", default="")
    a = ap.parse_args()
    if a.cmd == "health":
        print(json.dumps(health(), ensure_ascii=False, indent=2))
    elif a.cmd == "gate":
        ok = gate(a.swarm, a.case_id, a.checker)
        print(
            f"{'✅ PASS 放行' if ok else '❌ 拒绝(无确定性PASS判定)'}: {a.swarm}/{a.case_id}"
        )
        return 0 if ok else 1
    elif a.cmd == "record":
        e = record(
            a.swarm, a.checker, a.verdict, a.score, a.detail, a.case_id, a.evidence
        )
        print(json.dumps(e, ensure_ascii=False))
    else:
        ap.print_help()
    return 0


if __name__ == "__main__":
    import sys

    sys.exit(_cli())
