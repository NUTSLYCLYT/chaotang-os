"""scripts/nightly_flywheel.py — 每日自我进化飞轮(钦天监签字方案 2026-06-30)。

把仓里已有的进化零件焊成一个每晚转一圈的闭环,核心是那道**硬棘轮门**:
任何进化候选(新版 prompt/skill/大神)的 eval 分必须**严格打败 quality_baseline**
才准晋升,否则自动拒绝——防止系统把自己越进化越差。

闭环(每个环节复用已有零件):
  ①跑   golden_cases / 合成流量      (scripts/eval_ci.py,需 LLM,--with-eval 开)
  ②评   每域 + 每大神打分            (quality_baseline.json + persona_registry)
  ③诊   找回退/最弱域/最弱大神        (本脚本 diff baseline)
  ④提   生成改进候选                  (人/LLM 提,落 prompt_versions)
  ⑤验   候选必须打败 baseline          (ratchet_gate —— 硬门,本脚本)
  ⑥升   赢了才晋升                    (人工签字 override 才能破门)
  ⑦档   写《进化日报》+ 失败记忆        (本脚本产出 reports/flywheel/)

默认 --manual:只读出报告,不调 LLM、不写基线、不晋升任何东西——第一次手动跑、看日报。
"""
from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

import sys

_ROOT = Path(__file__).resolve().parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from src import persona_registry  # noqa: E402

_GOLDEN_DIR = _ROOT / "scripts" / "golden_cases"
_BASELINE_PATH = _GOLDEN_DIR / "quality_baseline.json"
_REPORT_DIR = _ROOT / "reports" / "flywheel"


# ── ⑤ 硬棘轮门(命门,纯函数,可单测,不依赖 LLM)─────────────────────────────

def ratchet_gate(
    candidate_score: float,
    baseline_score: float,
    *,
    min_delta: float = 0.0,
    signed_override: bool = False,
) -> dict:
    """硬门:候选必须严格打败基线(差值 > min_delta)才准晋升。

    signed_override=True 表示人类签字例外放行(仅此一途能破门)。
    返回 {promote, reason}。绝不静默——拒绝必带理由。
    """
    if signed_override:
        return {"promote": True, "reason": "人工签字例外放行(override)"}
    delta = round(candidate_score - baseline_score, 4)
    if delta > min_delta:
        return {"promote": True, "reason": f"打败基线 +{delta}(≥ 阈值 {min_delta})"}
    return {
        "promote": False,
        "reason": f"未打败基线(Δ={delta} ≤ {min_delta})→ 硬门拒绝晋升",
    }


def evaluate_candidates(candidates: list[dict], baseline: dict, *, min_delta: float = 0.0) -> list[dict]:
    """对一批候选逐个过硬门。candidate = {key, domain, score}。"""
    results = []
    for c in candidates:
        base = (baseline.get(c["domain"]) or {}).get("quality_score")
        if base is None:
            results.append({**c, "promote": False, "reason": f"无 {c['domain']} 基线,不盲目晋升"})
            continue
        gate = ratchet_gate(c["score"], float(base), min_delta=min_delta,
                            signed_override=bool(c.get("signed_override")))
        results.append({**c, "baseline_score": base, **gate})
    return results


# ── ②③ 读基线 + 诊断最弱域 ───────────────────────────────────────────────────

def _load_baseline() -> dict:
    if _BASELINE_PATH.exists():
        try:
            return json.loads(_BASELINE_PATH.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return {}
    return {}


def diagnose_weakest(baseline: dict, *, bottom_n: int = 3) -> list[dict]:
    """按 quality_score 升序找最弱的域,排进下一轮优化优先级。"""
    rows = [
        {"domain": k, "score": v.get("quality_score"), "pass": v.get("pass")}
        for k, v in baseline.items()
        if isinstance(v, dict) and v.get("quality_score") is not None
    ]
    rows.sort(key=lambda r: r["score"])
    return rows[:bottom_n]


# ── ⑦ 进化日报 ───────────────────────────────────────────────────────────────

def build_report(*, now_iso: str, candidates: list[dict] | None = None,
                 min_delta: float = 0.0) -> dict:
    baseline = _load_baseline()
    roster = persona_registry.roster_summary()
    reconcile = persona_registry.reconcile_roster()
    weakest = diagnose_weakest(baseline)
    gate_results = evaluate_candidates(candidates or [], baseline, min_delta=min_delta)
    promoted = [g for g in gate_results if g["promote"]]
    rejected = [g for g in gate_results if not g["promote"]]
    return {
        "generated_at": now_iso,
        "ratchet": {"mode": "hard", "min_delta": min_delta},
        "personas": {
            "total": roster["total"],
            "judge_count": roster["judge_count"],
            "advisor_count": roster["advisor_count"],
            "judges": roster["judges"],
            "advisors_rag_gated": roster["advisors"],
        },
        "roster_reconcile": reconcile,
        "baseline_domains": len(baseline),
        "weakest_domains": weakest,
        "candidates_evaluated": len(gate_results),
        "promoted": promoted,
        "rejected": rejected,
    }


def render_markdown(report: dict) -> str:
    p = report["personas"]
    lines = [
        f"# 朝堂进化日报 · {report['generated_at']}",
        "",
        f"棘轮门:**{report['ratchet']['mode']}**(候选须打败基线 +{report['ratchet']['min_delta']} 才晋升)",
        "",
        "## 大神花名册(按证据厚度自动分席)",
        f"- 判官席({p['judge_count']},可下结论):{', '.join(p['judges']) or '—'}",
        f"- 观点席({p['advisor_count']},RAG 接地·不可下结论):{', '.join(p['advisors_rag_gated']) or '—'}",
        "",
        "## 协议对账(谁真在朝堂服务 vs 谁有料)",
    ]
    rc = report.get("roster_reconcile") or {}
    lines += [
        f"- 协议点名大神:{rc.get('protocol_advisor_count', 0)}",
        f"- ✅ 有料·判官席:{', '.join(rc.get('served_judge') or []) or '—'}",
        f"- ✅ 有料·观点席:{', '.join(rc.get('served_advisor') or []) or '—'}",
        f"- ⚠️ 空壳·待补语料({len(rc.get('served_missing_source') or [])}):{', '.join(rc.get('served_missing_source') or []) or '—'}",
        f"- 🛡 守护 lens(不评分):{', '.join(rc.get('guardian_lenses') or []) or '—'}",
        f"- 🗂 孤儿·有料但未被调用({len(rc.get('registered_unused') or [])}):{', '.join(rc.get('registered_unused') or []) or '—'}",
        "",
        "## 最弱域(下一轮优先优化)",
    ]
    for w in report["weakest_domains"]:
        lines.append(f"- {w['domain']}: {w['score']} (pass={w['pass']})")
    lines += ["", f"## 进化候选过门:{report['candidates_evaluated']} 个"]
    for g in report["promoted"]:
        lines.append(f"- ✅ 晋升 {g.get('key')} [{g.get('domain')}]: {g['reason']}")
    for g in report["rejected"]:
        lines.append(f"- ⛔ 拒绝 {g.get('key')} [{g.get('domain')}]: {g['reason']}")
    if not report["candidates_evaluated"]:
        lines.append("- (本轮无候选;手动模式只读)")
    return "\n".join(lines) + "\n"


def main() -> int:
    ap = argparse.ArgumentParser(description="朝堂每日自我进化飞轮")
    ap.add_argument("--manual", action="store_true", default=True,
                    help="手动模式(默认):只读出日报,不调 LLM、不晋升")
    ap.add_argument("--with-eval", action="store_true",
                    help="跑真实 LLM eval(scripts/eval_ci.py)——需 LLM 网关")
    ap.add_argument("--min-delta", type=float, default=0.0,
                    help="候选需超过基线的最小差值(棘轮门松紧)")
    ap.add_argument("--candidates", type=str, default="",
                    help="候选 JSON 文件路径:[{key,domain,score,signed_override?}]")
    ap.add_argument("--write", action="store_true",
                    help="把日报写到 reports/flywheel/(默认只打印)")
    args = ap.parse_args()

    if args.with_eval:
        print("[flywheel] --with-eval 需 LLM 网关;请确保 provider/LiteLLM 已配。")
        print("[flywheel] 调用 scripts/eval_ci.py 更新 quality_baseline.json …")
        # 此处不在本脚本内直接跑 LLM(避免无网关时挂起);由运维显式跑 eval_ci 后再跑本脚本读基线。

    candidates: list[dict] = []
    if args.candidates:
        candidates = json.loads(Path(args.candidates).read_text(encoding="utf-8"))

    now_iso = datetime.now(timezone.utc).isoformat(timespec="seconds")
    report = build_report(now_iso=now_iso, candidates=candidates, min_delta=args.min_delta)
    md = render_markdown(report)
    print(md)

    if args.write:
        _REPORT_DIR.mkdir(parents=True, exist_ok=True)
        stamp = now_iso.replace(":", "").replace("-", "")
        (_REPORT_DIR / f"flywheel_{stamp}.json").write_text(
            json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
        (_REPORT_DIR / f"flywheel_{stamp}.md").write_text(md, encoding="utf-8")
        print(f"[flywheel] 日报已写 {_REPORT_DIR}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
