#!/usr/bin/env python3
"""大神判例 LLM-as-judge 实打分（网关就绪后跑）。

闭环:大神作答 → LLM-as-judge 比对 reference/must_not → 均分 → promotion_gate 判升席。
接地(deming 关切):律师类喂 skills/personas/<p>/references/statutes.md 作可引用依据,
判例 must_not 已封"编造条号",judge 据真值 reference 扣分 → 关键词堆砌骗不过。

用法:
  python scripts/eval_personas.py                 # 跑全部有判例的大神
  python scripts/eval_personas.py contract-lawyer  # 只跑一个(控成本)
  python scripts/eval_personas.py --limit 1        # 每个大神只跑首个 case(冒烟)
成本提示:每 case = 1 次作答 + 1 次判分。默认 deepseek 网关(见 .env)。
"""
from __future__ import annotations

import argparse
import os
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

# .env 必须在 import eval_ci 前加载:eval_ci 模块级按 DEEPSEEK_API_KEY 定网关
_ENV = ROOT / ".env"
if _ENV.exists():
    for _line in _ENV.read_text(encoding="utf-8").splitlines():
        _line = _line.strip()
        if _line and not _line.startswith("#") and "=" in _line:
            _k, _v = _line.split("=", 1)
            os.environ.setdefault(_k, _v)

from scripts.eval_ci import GATEWAY, JUDGE_MODEL, _judge  # noqa: E402
from src.persona_eval import load_cases, promotion_gate  # noqa: E402
from src.persona_registry import PERSONA_GROUNDING_RULE  # noqa: E402

CASES_DIR = ROOT / "scripts" / "persona_cases"
PERSONA_DIR = ROOT / "skills" / "personas"


def _retry(fn, *, tries: int = 3, base_delay: float = 2.0):
    """瞬时网络抖动(SSL EOF/连接重置)不该摧毁全批:重试几次再放弃。"""
    last = None
    for i in range(tries):
        try:
            return fn()
        except Exception as e:  # noqa: BLE001 — 网关抖动全兜住,交由上层记失败
            last = e
            if i < tries - 1:
                time.sleep(base_delay * (i + 1))
    raise last  # type: ignore[misc]


def _persona_asset(persona: str, *parts: str) -> str:
    """在 <persona> 与 <persona>-perspective 两种命名下找资产文件。"""
    for cand in (persona, f"{persona}-perspective"):
        f = PERSONA_DIR.joinpath(cand, *parts)
        if f.exists():
            return f.read_text(encoding="utf-8")
    return ""


def _answer(persona: str, prompt: str) -> str:
    """让大神作答。律师类带 statutes 接地(有据才答)。"""
    from openai import OpenAI

    base = _persona_asset(persona, "SKILL.md")[:2500] or (
        f"你是{persona},以你的专业视角简洁作答:人话结论在前,依据/条号在后,给可执行改法。"
    )
    sys_p = base + "\n\n" + PERSONA_GROUNDING_RULE  # 禁编造真人真事(飞轮实证:防幻觉扣分)
    ground = _persona_asset(persona, "references", "statutes.md")[:4000]
    user = f"【可引用依据(只用其中真实条款,勿编造)】\n{ground}\n\n【问题】{prompt}" if ground else prompt
    client = OpenAI(base_url=GATEWAY, api_key=os.environ.get("DEEPSEEK_API_KEY", ""))
    # 作答温度默认 0:eval 是 benchmark,要可复现(MSA 实测:排名噪音来自作答变异,非 judge)。
    # 需要采样多样性时 env ANSWER_TEMP 覆盖。
    temp = float(os.environ.get("ANSWER_TEMP", "0"))
    resp = _retry(lambda: client.chat.completions.create(
        model=JUDGE_MODEL,
        messages=[{"role": "system", "content": sys_p}, {"role": "user", "content": user}],
        temperature=temp,
    ))
    return resp.choices[0].message.content or ""


def score_persona_live(persona: str, limit: int | None = None, dump: list | None = None) -> dict | None:
    cases = load_cases(persona, CASES_DIR)
    if not cases:
        return None
    if limit:
        cases = cases[:limit]
    scores, details, errs = [], [], 0
    for i, c in enumerate(cases, 1):
        try:
            ans = _answer(persona, c["prompt"])
            v = _retry(lambda: _judge(c["prompt"], c.get("reference", ""), c.get("must_not", ""), ans))
        except Exception as e:  # noqa: BLE001 — 单 case 失败记账跳过,不崩全批
            errs += 1
            print(f"  case{i}: ⚠️ 跳过(网关抖动 {type(e).__name__})")
            continue
        ov = float(v.get("overall", 0) or 0)
        scores.append(ov)
        details.append({"i": i, "overall": ov, "verdict": v.get("verdict", "")})
        if dump is not None:  # 低分可回溯:存答案+判词,飞轮据此改 prompt/statutes
            dump.append({"persona": persona, "case": i, "overall": ov,
                         "verdict": v.get("verdict", ""), "reasons": v.get("reasons", ""),
                         "prompt": c["prompt"], "answer": ans})
        print(f"  case{i}: {ov:.1f}/10  {v.get('verdict','')[:60]}")
    if not scores:
        return {"persona": persona, "n": 0, "avg": 0.0, "details": [], "errs": errs,
                "gate": {"promote": False, "reason": f"全部 case 网关失败({errs})→ 无有效分"}}
    avg = round(sum(scores) / len(scores), 2) if scores else 0.0
    gate = promotion_gate(persona, avg, len(load_cases(persona, CASES_DIR)))
    return {"persona": persona, "n": len(scores), "avg": avg, "details": details, "gate": gate}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("personas", nargs="*", help="指定大神(默认全部有判例的)")
    ap.add_argument("--limit", type=int, default=None, help="每个大神只跑前 N 个 case(冒烟控成本)")
    ap.add_argument("--dump", metavar="PATH", default=None,
                    help="把每 case 的答案+判词写 JSONL(低分回溯,飞轮据此改 prompt/statutes)")
    args = ap.parse_args()

    targets = args.personas or sorted(p.stem for p in CASES_DIR.glob("*.json"))
    if not os.environ.get("DEEPSEEK_API_KEY"):
        print("❌ 无 DEEPSEEK_API_KEY,网关不通(检查 .env)")
        return 1

    dump: list | None = [] if args.dump else None
    results = []
    for p in targets:
        print(f"\n=== {p} ===")
        try:
            r = score_persona_live(p, limit=args.limit, dump=dump)
        except Exception as e:  # noqa: BLE001 — 单大神彻底失败不堵后面的
            print(f"  ⚠️ {p} 整体失败,跳过:{type(e).__name__}")
            continue
        if r is None:
            print("  (无判例,跳过)")
            continue
        mark = "✅升判官席" if r["gate"]["promote"] else "○留观点席"
        print(f"  均分 {r['avg']}/10  ({r['n']} case)  → {mark}  {r['gate']['reason']}")
        results.append(r)

    if results:
        print("\n" + "=" * 48)
        promoted = [r["persona"] for r in results if r["gate"]["promote"]]
        print(f"汇总:{len(results)} 位打分,{len(promoted)} 位达判官席门槛")
        for r in sorted(results, key=lambda x: -x["avg"]):
            print(f"  {r['avg']:>5}/10  {r['persona']}")
        low = [d for d in (dump or []) if d["overall"] < 7.5]
        if low:
            print(f"\n低分 case({len(low)} 条,飞轮优先看):")
            for d in sorted(low, key=lambda x: x["overall"]):
                print(f"  {d['overall']:>4}/10  {d['persona']} case{d['case']}  {str(d.get('reasons',''))[:70]}")
    if dump is not None:
        import json
        Path(args.dump).write_text(
            "\n".join(json.dumps(d, ensure_ascii=False) for d in dump), encoding="utf-8")
        print(f"\n明细已写:{args.dump}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
