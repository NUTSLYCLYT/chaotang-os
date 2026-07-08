"""src/persona_eval.py — 大神个人评分台 + 升席棘轮(钦天监方案 B)。

让"世界顶尖大神"= 每位大神都有一组可跑的 golden 判例 + 一个 eval 分,
而不是靠人设。观点席要**过 eval 判例**才升判官席(接那道硬棘轮门的精神)。

判例格式(scripts/persona_cases/<persona>.json):
  {"persona": "deming", "cases": [
     {"prompt": "...", "reference": "理想回答要点", "must_not": "绝不能说的话"}
  ]}

打分依赖 LLM-as-judge(需 provider/LiteLLM 网关),故 score_persona() 默认是
**离线占位**:不调 LLM,返回 needs_gateway。真实打分由运维配好网关后开 with_llm=True。
升席判定 promotion_gate() 是**纯函数**,可离线单测——这是"真有牙"的可验证内核。
"""
from __future__ import annotations

import json
from pathlib import Path

from src import capability_scoring as cap
from src import persona_registry as pr

_CASES_DIR = Path(__file__).resolve().parent.parent / "scripts" / "persona_cases"

# 升判官席的 eval 门槛(0-10);接 quality_baseline 的口径。
JUDGE_PROMOTION_THRESHOLD = 7.5
MIN_CASES_FOR_PROMOTION = 3


def load_cases(persona: str, cases_dir: Path | None = None) -> list[dict]:
    """读某大神的判例;无判例返回空列表(= 还没法评分,不能升席)。"""
    root = cases_dir or _CASES_DIR
    f = root / f"{persona}.json"
    if not f.exists():
        return []
    data = json.loads(f.read_text(encoding="utf-8"))
    return data.get("cases", []) if isinstance(data, dict) else []


def promotion_gate(
    persona: str,
    eval_score: float | None,
    case_count: int,
    *,
    threshold: float = JUDGE_PROMOTION_THRESHOLD,
    min_cases: int = MIN_CASES_FOR_PROMOTION,
) -> dict:
    """观点席能否升判官席?纯函数,接硬棘轮门精神:无判例/分不够一律不升。

    返回 {promote, reason}。拒绝必带理由,绝不静默。
    """
    # 样本置信走公共层(与司 profile 同一把尺,防漂移;小样本护栏 = eval_validity 纪律)
    confidence = cap.sample_confidence(case_count)
    if eval_score is None or case_count == 0:
        return {"promote": False, "confidence": confidence,
                "reason": "无 eval 判例 → 不能升席(没料可验=不给权威)"}
    if case_count < min_cases:
        return {"promote": False, "confidence": confidence,
                "reason": f"判例不足({case_count}<{min_cases})→ 证据太薄,暂不升席"}
    if eval_score >= threshold:
        return {"promote": True, "confidence": confidence,
                "reason": f"eval {eval_score} ≥ {threshold} 且判例≥{min_cases} → 升判官席"}
    return {"promote": False, "confidence": confidence,
            "reason": f"eval {eval_score} < {threshold} → 未过判例,留观点席"}


def eval_readiness(cases_dir: Path | None = None, persona_dir: Path | None = None) -> dict:
    """离线诊断:每位入役大神有没有判例、能不能进入评分。供飞轮日报用。

    不调 LLM。照出"谁连判例都没有"——那是升判官席前的第一道坎。
    """
    rc = pr.reconcile_roster(persona_dir=persona_dir)
    served = list(rc["served_judge"]) + list(rc["served_advisor"])
    with_cases, without_cases = [], []
    for name in sorted(served):
        n = len(load_cases(name, cases_dir))
        (with_cases if n > 0 else without_cases).append(name)
    return {
        "served_total": len(served),
        "with_cases": with_cases,
        "without_cases": without_cases,   # 这些大神还没法被评分 → 升席前必补
        "coverage": round(len(with_cases) / len(served), 3) if served else 0.0,
    }


def score_persona(persona: str, *, with_llm: bool = False,
                   cases_dir: Path | None = None) -> dict:
    """跑某大神的判例打分。默认离线占位(不调 LLM)。

    真实打分(with_llm=True)需 provider/LiteLLM 网关:对每个 case 让大神作答 →
    LLM-as-judge 比对 reference/must_not → 取均分。此处不内联 LLM 调用以免无网关时挂起;
    由 scripts 层在网关就绪后接 src 现有 eval_ci/_judge 实现。
    """
    cases = load_cases(persona, cases_dir)
    if not cases:
        return {"persona": persona, "scored": False, "reason": "无判例"}
    if not with_llm:
        return {"persona": persona, "scored": False, "case_count": len(cases),
                "reason": "needs_gateway:离线占位,配好 LLM 网关后 with_llm=True 实打分"}
    raise NotImplementedError(
        "with_llm 实打分需接 LLM 网关(复用 scripts/eval_ci._judge);"
        "网关就绪后在 scripts 层接入,避免无网关时阻塞。"
    )
