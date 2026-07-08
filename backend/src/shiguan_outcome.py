"""史馆成果回执 + outcome 加权 prior 回灌(2026-07-07 · 三层递归架构第5步收尾)。

闭环:丞相 genius_next_step 引用旧案(log_citation)→ 30 天后没回执的引用进催收清单
(pending_receipts,由 cron/前端向用户讨"这条建议后来成了没")→ 人回执(record_outcome,
谁回执的必留名)→ 下次召回按 outcome 加权(weight_hits):被证实的旧案上浮,被打脸的深降权
但**不删除**——反面教材也是教材,带 outcome 标签诚实亮出来,绝不静默抹掉打脸记录。

存储:data/<tenant>/shiguan/{citations,outcomes}.jsonl,append-only 留痕,天然租户隔离(第0步a)。
纯确定性,不调 LLM。
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# 被证实的旧案上浮/被打脸的深降权(仍可见)。无回执=1.0 中性,不奖不罚。
PRIOR_WEIGHTS = {"confirmed": 1.2, "refuted": 0.5}
RECEIPT_DAYS = 30  # 引用后多少天没回执进催收清单

_VALID_OUTCOMES = ("confirmed", "refuted")


def _shiguan_dir() -> Path:
    from src.tenant import get_tenant_data_dir

    return get_tenant_data_dir("shiguan")


def _append(filename: str, record: dict[str, Any]) -> None:
    path = _shiguan_dir() / filename
    with path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")


def _read_jsonl(filename: str) -> list[dict[str, Any]]:
    path = _shiguan_dir() / filename
    if not path.exists():
        return []
    out: list[dict[str, Any]] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            out.append(json.loads(line))
        except json.JSONDecodeError:
            continue  # 单行损坏跳过,不炸整本账
    return out


# ── 引用留痕(genius_next_step 每次引用旧案时调)──────────────────────


def log_citation(
    sources: list[str], *, cited_at: str | None = None, task_ref: str = ""
) -> None:
    """记下丞相这次引用了哪些旧案——30 天回执的催收基座。失败只告警,不打断召回。

    task_ref:与任务/会话 join 的联结键(会审Deming:第0天焊上,否则账本将来做不了归因)。"""
    ts = cited_at or datetime.now().astimezone().isoformat()
    try:
        for s in dict.fromkeys(s for s in sources if s and s != "?"):
            _append(
                "citations.jsonl", {"source": s, "cited_at": ts, "task_ref": task_ref}
            )
    except OSError as e:
        logger.warning("史馆引用留痕失败(不打断召回): %s", e)


# ── 成果回执(人回填:这条建议后来成了没)────────────────────────────


def record_outcome(
    source: str, outcome: str, *, recorded_by: str, note: str = ""
) -> dict[str, Any]:
    """回执落账。outcome: confirmed(成了)/refuted(被打脸);recorded_by 必填(谁回执的,可追责)。"""
    if outcome not in _VALID_OUTCOMES:
        raise ValueError(f"outcome 只能是 {_VALID_OUTCOMES},收到: {outcome}")
    if not (recorded_by or "").strip():
        raise ValueError("recorded_by 不能为空:回执必须留名(同签字纪律)")
    rec = {
        "source": source,
        "outcome": outcome,
        "recorded_by": recorded_by,
        "note": note,
        "recorded_at": datetime.now().astimezone().isoformat(),
    }
    _append("outcomes.jsonl", rec)
    return rec


def outcomes_by_source() -> dict[str, dict[str, Any]]:
    """每个旧案的最新回执(append-only 账本,后写覆盖先写)。"""
    latest: dict[str, dict[str, Any]] = {}
    for rec in _read_jsonl("outcomes.jsonl"):
        if rec.get("source"):
            latest[rec["source"]] = rec
    return latest


def pending_receipts(days: int = RECEIPT_DAYS) -> list[dict[str, Any]]:
    """催收清单:引用超过 days 天且没有任何回执的旧案(每案一条,带最早引用时间)。"""
    outcomes = outcomes_by_source()
    cutoff = datetime.now().astimezone() - timedelta(days=days)
    first_cited: dict[str, str] = {}
    for rec in _read_jsonl("citations.jsonl"):
        s = rec.get("source", "")
        ts = rec.get("cited_at", "")
        if s and ts and (s not in first_cited or ts < first_cited[s]):
            first_cited[s] = ts
    out = []
    for source, ts in sorted(first_cited.items(), key=lambda kv: kv[1]):
        if source in outcomes:
            continue
        try:
            cited = datetime.fromisoformat(ts)
        except ValueError:
            continue
        if cited <= cutoff:
            out.append(
                {
                    "source": source,
                    "first_cited_at": ts,
                    "ask": f"旧案「{source}」被引用超 {days} 天:这条建议后来成了没?(confirmed/refuted)",
                }
            )
    return out


# ── prior 回灌:召回按 outcome 加权 ───────────────────────────────────


def weight_hits(hits: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """RAG 命中按 outcome prior 加权重排:证实上浮/打脸深降权(不删),每条带 outcome 标签。

    稳定排序:同权重保持原相似度序。失败原样返回(prior 层故障不丢召回)。
    """
    try:
        outcomes = outcomes_by_source()
    except Exception as e:
        logger.warning("史馆 outcome 读取失败,本次召回不加权: %s", e)
        return hits
    weighted = []
    for h in hits:
        rec = outcomes.get(h.get("source", ""))
        outcome = rec.get("outcome") if rec else None
        prior = PRIOR_WEIGHTS.get(outcome, 1.0)
        weighted.append(
            {
                **h,
                "outcome": outcome,
                "prior": prior,
                "weighted_score": round(float(h.get("score", 0.0)) * prior, 4),
            }
        )
    weighted.sort(key=lambda x: x["weighted_score"], reverse=True)
    return weighted
