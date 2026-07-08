"""Performance-Outcomes 评分-返工环安全护栏（5 技巧 + 3 坑）。

纯函数、无 LLM / 无 DB 依赖 → 可离线单测（沿用 quality.py 范式）。
**不重建评分逻辑**（评分仍归 quality.QualityScore / critic_step / flow_engine，铁律2 SSOT）；
本模块只补现有链路缺的那块：异构裁判、确定性闸短路、冠军回滚、自一致、人在环。
供 flow_engine / critic_step import 复用，禁各处再写平行版本。

技巧映射:
  1 确定性闸前置  -> should_run_llm_judge
  2 异构裁判      -> family_of / bias_risk / pick_heterogeneous_grader
  3 三角色/收敛   -> clamp_revisions / accept_revision（冠军回滚）
  5 偏差校正/人环 -> is_grader_stable / needs_human

安全默认: doer 模型未知时一律按"无法排除同家族"保守处理(bias_risk=True /
拒绝挑裁判) —— 护栏宁可误报转人工,不可静默开闸(2026-06-25 独立会审纠正)。
"""

from __future__ import annotations

import json
import re
import statistics
from typing import Iterable, Optional

UNKNOWN_FAMILY = "inherit"  # doer/模型未指定时的家族占位

# 模型名子串 -> 家族。同家族互评 = 自我增强偏袒（坑1）。
_FAMILY_PATTERNS: list[tuple[tuple[str, ...], str]] = [
    (("opus", "sonnet", "haiku", "claude"), "claude"),
    (("gpt", "codex", "o1", "o3", "openai"), "openai"),
    (("deepseek",), "deepseek"),
    (("gemini", "google"), "google"),
    (("ollama", "qwen", "llama", "gemma", "mistral"), "local"),
]


def _has_token(name: str, needle: str) -> bool:
    """词边界匹配(防 'algemmation' 误命中 'gemma'、'local-bank' 误命中 'local')。"""
    return re.search(rf"(?<![a-z]){re.escape(needle)}(?![a-z])", name) is not None


def family_of(model: Optional[str]) -> str:
    """把模型 id 归一到家族。未指定 -> 'inherit'（= 继承 doer，无法判定）。

    先剥掉 litellm 路由前缀(openai/claude-haiku-4-5 → claude-haiku-4-5),否则 'openai/'
    会把 openai/swarm-deepseek-pro 误判成 openai 家族(P2b TDD 抓到)。
    """
    if not model:
        return UNKNOWN_FAMILY
    s = str(model).lower()
    if "/" in s:
        s = s.split("/", 1)[1]  # 去 provider 路由前缀,只按真实模型名判家族
    for needles, fam in _FAMILY_PATTERNS:
        if any(_has_token(s, n) for n in needles):
            return fam
    return s


def bias_risk(doer_model: Optional[str], grader_model: Optional[str]) -> bool:
    """坑1: grader 未设、doer 家族未知、或两者同家族 → 自评偏袒风险,返 True。

    安全默认: doer 未知时无法排除同家族,保守判 True(宁可转人工,不可开闸)。
    """
    if not grader_model:
        return True
    doer_fam = family_of(doer_model)
    if doer_fam == UNKNOWN_FAMILY:
        return True
    return doer_fam == family_of(grader_model)


def pick_heterogeneous_grader(
    doer_model: Optional[str], candidates: Iterable[str]
) -> Optional[str]:
    """技巧2: 从候选里挑第一个与 doer 不同家族的当裁判。

    全同家族、或 doer 家族未知(无法保证异构)时返 None,让调用方告警/转人工。
    """
    doer_fam = family_of(doer_model)
    if doer_fam == UNKNOWN_FAMILY:
        return None
    for c in candidates:
        if family_of(c) != doer_fam:
            return c
    return None


def should_run_llm_judge(deterministic_passed: bool) -> bool:
    """技巧1: 确定性闸没过就别烧 LLM(免费检查先挡掉,省 token 第一原则)。"""
    return bool(deterministic_passed)


def clamp_revisions(n: int, lo: int = 0, hi: int = 3) -> int:
    """坑3: maxRevisions 硬钳 lo..hi,杜绝 token 黑洞。lo>hi 视为契约违反,直接报错。"""
    if lo > hi:
        raise ValueError(f"clamp_revisions: lo ({lo}) 必须 <= hi ({hi})")
    return max(lo, min(hi, int(n)))


def accept_revision(
    champion_score: float, candidate_score: float, min_improvement: float = 1.0
) -> bool:
    """坑3 冠军机制: 仅当返工至少超过冠军 min_improvement 才采纳;
    否则回滚保留冠军(根治越改越差 + 边际递减早停)。"""
    return (candidate_score - champion_score) >= min_improvement


def is_grader_stable(scores: list[float], tolerance: float = 2.0) -> bool:
    """技巧5 自一致: 多次打分极差 <= tolerance 才算稳定;单采样视为稳定。
    空采样无数据 → 不算稳定(False)。不稳定 = grader 复现不了分数,不可信。"""
    if not scores:
        return False
    if len(scores) == 1:
        return True
    return (max(scores) - min(scores)) <= tolerance


def needs_human(*, passed: bool, bias: bool, grader_stable: bool) -> bool:
    """技巧5 人在环: 未过 / 有自评偏袒 / 打分不稳,任一成立都不可自动放行,转人工。"""
    if not passed:
        return True
    if bias:
        return True
    if not grader_stable:
        return True
    return False


DEFAULT_GRADER_MODEL = "openai/claude-haiku-4-5"  # 异构裁判(对 swarm-deepseek doer 不同家族);:4444 openai 兼容需 openai/ 前缀


def parse_judge_verdict(text: str, *, threshold: float = 8.0) -> dict:
    """从裁判输出(可能带 ```json 围栏/说明文字)鲁棒提取 {score, passed, feedback}。

    解析失败一律保守:score=0、passed=False(宁可转人工,不可把没解析出来的当通过)。
    """
    raw = (text or "").strip()
    obj: dict = {}
    start = raw.find(
        "{"
    )  # 从第一个 { 起 raw_decode,容忍 ```json 围栏/嵌套对象/尾部说明
    if start != -1:
        try:
            decoded, _ = json.JSONDecoder().raw_decode(raw[start:])
            obj = decoded if isinstance(decoded, dict) else {}
        except (ValueError, TypeError):
            obj = {}
    try:
        score = float(obj.get("score"))
    except (TypeError, ValueError):
        return {
            "score": 0.0,
            "passed": False,
            "feedback": "裁判输出无法解析",
            "parse_ok": False,
        }
    passed = bool(obj.get("passed")) if "passed" in obj else (score >= threshold)
    return {
        "score": score,
        "passed": passed,
        "feedback": str(obj.get("feedback") or ""),
        "parse_ok": True,
    }


def run_llm_judge(
    brief_text: str,
    *,
    call,
    grader_model: str = DEFAULT_GRADER_MODEL,
    threshold: float = 8.0,
    samples: int = 1,
) -> dict | None:
    """技巧1下半+2+5: 真调异构裁判给 brief 打分。call 注入(prod 传 ModelAdapter.call,测试传 fake)。

    多采样取中位数(自一致);任一异常/全解析失败返 None,让上层优雅降级(judge_pending 留 True)。
    """
    sys_prompt = (
        "你是严格的质检裁判。只输出 JSON。对抗性评审,拿不准判不过。"
        f'返回 {{"score": 0-10 整数, "passed": bool(>= {threshold} 才 true), "feedback": "不过给修法,过则空串"}}。'
    )
    scores: list[float] = []
    verdicts: list[dict] = []
    for _ in range(max(1, samples)):
        try:
            res = call(
                system_prompt=sys_prompt,
                user_prompt=f"评审以下奏折/brief:\n{brief_text}",
                model=grader_model,
            )
        except Exception:  # noqa: BLE001 — 裁判调用失败 → 降级,不崩主流程
            continue
        if not res or res.get("status") != "success":
            continue
        v = parse_judge_verdict(res.get("output", ""), threshold=threshold)
        if v.get("parse_ok"):
            scores.append(v["score"])
            verdicts.append(v)
    if not scores:
        return None
    med = statistics.median(scores)  # 偶数采样取真中位数,不偏向放行
    rep = min(verdicts, key=lambda v: abs(v["score"] - med))
    stable = is_grader_stable(scores)
    return {
        "score": med,
        "passed": (med >= threshold) and stable,
        "feedback": rep.get("feedback", ""),
        "samples": scores,
        "stable": stable,
        "grader_model": grader_model,
    }


def enrich_quality_result(
    gate: dict,
    *,
    grader_model_planned: str = DEFAULT_GRADER_MODEL,
    judge_call=None,
    doer_model: str | None = None,
    brief_text: str | None = None,
    threshold: float = 8.0,
    samples: int = 1,
) -> dict:
    """把 Performance-Outcomes 元数据附加进确定性 gate 结果(原 gate 字段全保留)。

    P2a(judge_call=None,默认): 不调 LLM,judge_pending=True,needs_human 仅从确定性信号推导(preliminary)。
    P2b(传 judge_call): 确定性闸过(技巧1 短路)才真调异构裁判打分,judge_pending=False,
      needs_human 叠加真 bias(技巧2)+ 自一致(技巧5);裁判调不通则优雅降级回 P2a 形态。

    judge_call 注入(prod=ModelAdapter.call,测试=fake)。本函数不输出 id/swarm_run_id/created_at。
    """
    passed = bool(gate.get("passed"))
    warnings = gate.get("warnings") or []
    high_risk = "high_risk_requires_human_confirmation" in warnings
    out = {
        **gate,
        "should_run_llm_judge": should_run_llm_judge(passed),
        "judge_pending": True,
        "grader_model_planned": grader_model_planned,
        "needs_human": needs_human(
            passed=passed and not high_risk, bias=False, grader_stable=True
        ),
    }
    # P2a: 不接裁判,或确定性没过(短路省 token),保持 preliminary 形态
    if judge_call is None or not should_run_llm_judge(passed):
        return out

    verdict = run_llm_judge(
        brief_text if brief_text is not None else str(gate.get("revised_output") or ""),
        call=judge_call,
        grader_model=grader_model_planned,
        threshold=threshold,
        samples=samples,
    )
    if verdict is None:  # 裁判调不通 → 优雅降级,不伪造分数(守 §13.2#3)
        return out

    bias = bias_risk(doer_model, grader_model_planned)
    judged_pass = bool(verdict["passed"]) and not bias  # 自评偏袒不算真过
    out.update(
        {
            "judge_pending": False,
            "judge_score": verdict["score"],
            "judge_samples": verdict["samples"],
            "judge_passed": judged_pass,
            "judge_feedback": verdict["feedback"],
            "grader_model": verdict["grader_model"],
            "bias_risk": bias,
            "grader_stable": verdict["stable"],
            "needs_human": needs_human(
                passed=judged_pass and not high_risk,
                bias=bias,
                grader_stable=verdict["stable"],
            ),
        }
    )
    return out
