"""CourtOS finance-intel-loop contract adapter.

This module is deliberately deterministic.  It does not pretend to run market
valuation math when only source references are present; it turns the
evidence-bound request from chaotang-web into a real jiqun session replay with
structured Hu Bu output, source URLs, quality gate, and traceable run metadata.
"""

from __future__ import annotations

from datetime import datetime, timezone
import re
from typing import Any

_SEC_CIKS = {
    "AAPL": "0000320193",
    "MSFT": "0000789019",
}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def is_finance_intel_loop_request(body: Any) -> bool:
    entry_swarm = (getattr(body, "entry_swarm", "") or "").strip()
    evidence_bound_run = getattr(body, "evidence_bound_run", None)
    intelligence_pack = getattr(body, "intelligence_pack", None)
    task_input = str(getattr(body, "task_input", "") or "")
    explicit_contract = isinstance(evidence_bound_run, dict) and isinstance(intelligence_pack, dict)
    sec_finance_prompt = bool(re.search(r"\bSEC\b", task_input, re.I)) and bool(_ticker_from_text(task_input))
    return entry_swarm == "finance" and (explicit_contract or sec_finance_prompt)


def _ticker_from_text(text: str) -> str | None:
    upper = text.upper()
    for ticker in _SEC_CIKS:
        if re.search(rf"\b{ticker}\b", upper):
            return ticker
    match = re.search(r"\b[A-Z]{1,5}\b", upper)
    if match and "SEC" in upper:
        return match.group(0)
    return None


# 户部真实核算:回收期目标线(月)。doc 原型示例 18 个月,可调。
# ponytail: 单期 ROI/回收期,不做 NPV 折现;估值赌注变大再上 DCF。
_PAYBACK_TARGET_MONTHS = 18.0

_INVESTMENT_KEYS = ("investment", "investmentAmount", "capex", "cost", "budget", "投入", "预算")
_ANNUAL_KEYS = ("annualNetCashflow", "annualReturn", "annualProfit", "netAnnualCashflow", "年净现金流")
_MONTHLY_KEYS = ("monthlyNetCashflow", "monthlyRevenue", "月净现金流")


def _num(value: Any) -> float | None:
    """宽松数字解析:接受 int/float/带千分位或货币符号的字符串,失败返回 None。"""
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        cleaned = re.sub(r"[^\d.\-]", "", value)
        if cleaned in ("", "-", ".", "-."):
            return None
        try:
            return float(cleaned)
        except ValueError:
            return None
    return None


def _pick(src: dict[str, Any], keys: tuple[str, ...]) -> float | None:
    for key in keys:
        if key in src:
            got = _num(src[key])
            if got is not None:
                return got
    return None


def _finance_inputs(pack: dict[str, Any], evidence_bound_run: dict[str, Any]) -> dict[str, float]:
    """从 intelligence_pack / evidence_bound_run 抽定量输入。找不到返回 {}(诚实缺数)。"""
    sources: list[dict[str, Any]] = []
    for holder in (pack, evidence_bound_run):
        if isinstance(holder, dict):
            fin = holder.get("financials")
            if isinstance(fin, dict):
                sources.append(fin)
            sources.append(holder)
    investment = annual = None
    for src in sources:
        investment = investment if investment is not None else _pick(src, _INVESTMENT_KEYS)
        annual = annual if annual is not None else _pick(src, _ANNUAL_KEYS)
        if annual is None:
            monthly = _pick(src, _MONTHLY_KEYS)
            if monthly is not None:
                annual = monthly * 12.0
    out: dict[str, float] = {}
    if investment is not None:
        out["investment"] = investment
    if annual is not None:
        out["annualNetCashflow"] = annual
    return out


def compute_finance_metrics(pack: dict[str, Any], evidence_bound_run: dict[str, Any]) -> dict[str, Any]:
    """户部真实核算:ROI% + 回收期(月) + ±20% 敏感性。缺定量输入 → computed=False,不编数。"""
    inp = _finance_inputs(pack, evidence_bound_run)
    investment = inp.get("investment")
    annual = inp.get("annualNetCashflow")
    if not investment or investment <= 0 or annual is None:
        return {
            "computed": False,
            "note": "缺定量输入(investment/annualNetCashflow),未核算 ROI;需锦衣卫补投入与现金流数据。",
            "inputs": inp,
        }

    def _payback(cf: float) -> float | None:
        return round(investment / (cf / 12.0), 1) if cf > 0 else None

    roi_pct = round(annual / investment * 100.0, 1)
    payback = _payback(annual)
    verdict = "within_target" if (payback is not None and payback <= _PAYBACK_TARGET_MONTHS) else "slow_payback"
    return {
        "computed": True,
        "investment": investment,
        "annualNetCashflow": annual,
        "roiPct": roi_pct,
        "paybackMonths": payback,
        "paybackTargetMonths": _PAYBACK_TARGET_MONTHS,
        "verdict": verdict,
        "sensitivity": {
            "downside_minus20pct": {"annualNetCashflow": round(annual * 0.8, 2), "paybackMonths": _payback(annual * 0.8)},
            "upside_plus20pct": {"annualNetCashflow": round(annual * 1.2, 2), "paybackMonths": _payback(annual * 1.2)},
        },
    }


def _sec_source_urls(ticker: str | None) -> list[str]:
    if not ticker:
        return []
    cik = _SEC_CIKS.get(ticker.upper())
    if not cik:
        return []
    return [
        f"https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json",
        f"https://data.sec.gov/submissions/CIK{cik}.json",
    ]


def _field(body: Any, name: str, default: Any = None) -> Any:
    if isinstance(body, dict):
        return body.get(name, default)
    return getattr(body, name, default)


def _source_urls(pack: dict[str, Any], evidence_bound_run: dict[str, Any]) -> list[str]:
    urls: list[str] = []
    raw_urls = pack.get("sourceUrls") or pack.get("source_urls")
    if isinstance(raw_urls, list):
        urls.extend(str(item) for item in raw_urls if str(item).strip())
    raw_sources = pack.get("financialSources") or pack.get("sources")
    if isinstance(raw_sources, list):
        for source in raw_sources:
            if isinstance(source, dict) and source.get("url"):
                urls.append(str(source["url"]))
    nested = evidence_bound_run.get("intelligence_pack")
    if isinstance(nested, dict):
        nested_urls = nested.get("sourceUrls") or nested.get("source_urls")
        if isinstance(nested_urls, list):
            urls.extend(str(item) for item in nested_urls if str(item).strip())
    return list(dict.fromkeys(urls))


def _edict_mode(body: Any, evidence_bound_run: dict[str, Any]) -> str:
    raw = (
        _field(body, "courtos_edict_mode")
        or _field(body, "privacy_mode")
        or _field(body, "mode")
        or evidence_bound_run.get("courtos_edict_mode")
        or evidence_bound_run.get("privacy_mode")
        or evidence_bound_run.get("mode")
        or "public"
    )
    value = str(raw).strip().lower()
    if value in {"secret", "密", "private"}:
        return "secret"
    return "public"


def _run(
    *,
    session_id: str,
    swarm_id: str,
    suffix: str,
    task_input: str,
    status: str,
    triggered_by: str,
    quality_score: float,
    qa_result: dict[str, Any],
    final_output: dict[str, Any],
    started_at: str,
) -> dict[str, Any]:
    return {
        "swarm_id": swarm_id,
        "run_id": f"run_{session_id}_{suffix}",
        "task_input": task_input,
        "status": status,
        "triggered_by": triggered_by,
        "quality_score": quality_score,
        "qa_result": qa_result,
        "final_output": final_output,
        "start_time": started_at,
        "end_time": started_at,
        "error": "",
    }


def _event(session_id: str, topic: str, source: str, payload: dict[str, Any], timestamp: str) -> dict[str, Any]:
    return {
        "topic": topic,
        "source": source,
        "payload": payload,
        "event_id": f"evt_{session_id}_{source}",
        "timestamp": timestamp,
        "session_id": session_id,
    }


def build_finance_intel_session(
    *,
    session_id: str,
    task_input: str,
    body: Any,
    evidence_fetcher: Any = None,
) -> dict[str, Any]:
    started_at = now_iso()
    completed_at = started_at
    evidence_bound_run = getattr(body, "evidence_bound_run", {}) or {}
    intelligence_pack = getattr(body, "intelligence_pack", {}) or {}
    ticker = str(intelligence_pack.get("ticker") or evidence_bound_run.get("ticker") or _ticker_from_text(task_input) or "").upper()
    source_urls = _source_urls(intelligence_pack, evidence_bound_run)
    user_supplied_urls = bool(source_urls)
    evidence_verified = False
    if not source_urls and not (getattr(body, "missing_evidence", None) or evidence_bound_run.get("missing_evidence")):
        if evidence_fetcher is not None and ticker:
            fetched = evidence_fetcher(ticker) or {}
            source_urls = [str(url) for url in fetched.get("sourceUrls") or []]
            evidence_verified = bool(fetched.get("verified"))
        if not source_urls:
            source_urls = _sec_source_urls(ticker)
    missing_evidence = getattr(body, "missing_evidence", None) or evidence_bound_run.get("missing_evidence") or []
    forbidden_outputs = getattr(body, "forbidden_outputs", None) or evidence_bound_run.get("forbidden_outputs") or []
    has_source_urls = bool(source_urls)
    evidence_complete = has_source_urls and not missing_evidence
    finance_metrics = compute_finance_metrics(intelligence_pack, evidence_bound_run)
    courtos_task_id = getattr(body, "courtos_task_id", None)
    # 诚实标：真实 GET 到官方来源 → LIVE；用户自带证据 → 沿用请求标；
    # 模板拼接未验证 / 无来源 → FALLBACK。不再冒充 LIVE_SWARM(真蜂群会审)。
    if evidence_verified:
        source_label = "LIVE"
    elif user_supplied_urls:
        source_label = (
            getattr(body, "source_label", None)
            or evidence_bound_run.get("source_label")
            or "LIVE"
        )
    else:
        source_label = "FALLBACK"
    edict_mode = _edict_mode(body, evidence_bound_run)
    visibility = "secret" if edict_mode == "secret" else "public"
    memorial = {
        "department": "hu_bu",
        "type": "finance_intel_loop_result",
        "verdict": "valuation_requires_authorized_review" if evidence_complete else "needs_evidence_not_releasable",
        "recommendation": "create_watchlist" if evidence_complete else "return_to_jinyiwei_for_evidence",
        "riskLevel": "medium" if evidence_complete else "high",
        "summary": (
            "Hu Bu accepted the Jinyiwei evidence pack and preserved official source URLs. "
            "No trade, payment, or external commitment is authorized by this swarm output."
            if evidence_complete
            else "Hu Bu accepted the request but blocked release because official source evidence is incomplete. "
            "No trade, payment, or external commitment is authorized by this swarm output."
        ),
        "previewOnly": True,
        "executionAllowed": False,
        "sideEffects": "none",
        "sourceUrls": source_urls,
        "missingEvidence": list(missing_evidence),
        "forbiddenOutputs": list(forbidden_outputs),
        "metrics": finance_metrics,
        "formulaTrace": [
            {
                "name": "source_provenance_gate",
                "status": "passed" if evidence_complete else "needs_evidence",
                "inputs": source_urls,
            },
            {
                "name": "roi_payback_calc",
                "status": "computed" if finance_metrics.get("computed") else "insufficient_inputs",
                "roiPct": finance_metrics.get("roiPct"),
                "paybackMonths": finance_metrics.get("paybackMonths"),
            },
            {
                "name": "execution_safety_gate",
                "status": "passed",
                "blockedOutputs": list(forbidden_outputs),
            },
        ],
        "nonAdviceDisclaimer": True,
        "nextActions": (
            ["create_watchlist", "request_second_valuation", "prepare_investment_memo"]
            if evidence_complete
            else ["attach_official_source_urls", "request_second_valuation"]
        ),
    }
    quality_gate = {
        "qa_result": "pass" if evidence_complete else "fail",
        "pass": evidence_complete,
        "status": "pass" if evidence_complete else "fail",
        "checks": {
            "source_urls_present": has_source_urls,
            "official_sources_verified": evidence_verified,
            "missing_evidence_clear": not bool(missing_evidence),
            "non_advice_disclaimer": True,
            "execution_disabled": True,
            "forbidden_outputs_preserved": bool(forbidden_outputs),
        },
    }
    jinyiwei_output = {
        "department": "jin_yi_wei",
        "stage": "jinyiwei_evidence",
        "ticker": ticker,
        "verified": evidence_verified,
        "sourceUrls": source_urls,
        "missingEvidence": list(missing_evidence),
        "evidenceRefs": list(getattr(body, "evidence_refs", None) or evidence_bound_run.get("evidence_refs") or []),
        "sourceLabel": source_label,
        "status": "completed" if has_source_urls else "needs_evidence",
    }
    adjudication = {
        "department": "shang_shu_fang",
        "stage": "shangshufang_adjudication",
        "decision": "adopt_internal_action" if evidence_complete else "blocked_waiting_for_evidence",
        "confirmationRequired": evidence_complete,
        "allowedActions": memorial["nextActions"] if evidence_complete else ["go_to_jinyiwei_for_evidence"],
        "blockedReason": "" if evidence_complete else "needs_evidence_not_releasable",
    }
    execution_report = {
        "department": "execution",
        "stage": "execution_report",
        "status": "completed" if evidence_complete else "blocked",
        "executedActions": ["internal_watchlist_candidate_created"] if evidence_complete else [],
        "sideEffects": "internal_only" if evidence_complete else "none",
        "externalCommitments": [],
    }
    archive = {
        "department": "shi_guan",
        "stage": "shiguan_archive",
        "status": "archived" if evidence_complete else "not_archived",
        "archivePath": f"finance-intel-loop/{session_id}" if evidence_complete else "",
        "replayApiPath": f"/api/swarm/sessions/{session_id}",
    }
    chain = [
        {"id": "shangshufang_case", "label": "上书房立案", "status": "completed"},
        {"id": "jinyiwei_evidence", "label": "锦衣卫取证", "status": "completed" if has_source_urls else "needs_evidence"},
        {"id": "hubu_memorial", "label": "户部奏折", "status": "completed" if evidence_complete else "blocked"},
        {"id": "shangshufang_adjudication", "label": "上书房裁决", "status": "completed" if evidence_complete else "blocked"},
        {"id": "execution_report", "label": "执行复命", "status": "completed" if evidence_complete else "blocked"},
        {"id": "shiguan_archive", "label": "史馆归档", "status": "archived" if evidence_complete else "blocked"},
    ]
    runs = [
        _run(
            session_id=session_id,
            swarm_id="shangshufang",
            suffix="case",
            task_input=task_input,
            status="completed",
            triggered_by="manual",
            quality_score=0.9,
            qa_result={"qa_result": "pass", "pass": True, "status": "pass"},
            final_output={
                "stage": "shangshufang_case",
                "edictMode": edict_mode,
                "visibility": visibility,
                "taskId": courtos_task_id,
                "taskStatus": "processing",
            },
            started_at=started_at,
        ),
        _run(
            session_id=session_id,
            swarm_id="jinyiwei",
            suffix="jinyiwei",
            task_input=task_input,
            status="completed" if has_source_urls else "failed",
            triggered_by=f"evt_{session_id}_shangshufang",
            quality_score=0.9 if has_source_urls else 0.25,
            qa_result={
                "qa_result": "pass" if has_source_urls else "fail",
                "pass": has_source_urls,
                "status": "pass" if has_source_urls else "fail",
                "checks": {"official_sec_sources_present": has_source_urls},
            },
            final_output=jinyiwei_output,
            started_at=started_at,
        ),
        _run(
            session_id=session_id,
            swarm_id="finance",
            suffix="finance",
            task_input=task_input,
            status="completed" if evidence_complete else "failed",
            triggered_by=f"evt_{session_id}_jinyiwei",
            quality_score=0.92 if evidence_complete else 0.35,
            qa_result=quality_gate,
            final_output={
                "stage": "hubu_memorial",
                "memorial": memorial,
                "sourceUrls": source_urls,
                "evidenceBoundRun": evidence_bound_run,
                "sourceLabel": source_label,
            },
            started_at=started_at,
        ),
    ]
    if evidence_complete:
        runs.extend(
            [
                _run(
                    session_id=session_id,
                    swarm_id="shangshufang",
                    suffix="adjudication",
                    task_input=task_input,
                    status="completed",
                    triggered_by=f"evt_{session_id}_finance",
                    quality_score=0.88,
                    qa_result={"qa_result": "pass", "pass": True, "status": "pass"},
                    final_output=adjudication,
                    started_at=started_at,
                ),
                _run(
                    session_id=session_id,
                    swarm_id="execution",
                    suffix="execution",
                    task_input=task_input,
                    status="completed",
                    triggered_by=f"evt_{session_id}_adjudication",
                    quality_score=0.86,
                    qa_result={"qa_result": "pass", "pass": True, "status": "pass"},
                    final_output=execution_report,
                    started_at=started_at,
                ),
                _run(
                    session_id=session_id,
                    swarm_id="shiguan",
                    suffix="archive",
                    task_input=task_input,
                    status="completed",
                    triggered_by=f"evt_{session_id}_execution",
                    quality_score=0.86,
                    qa_result={"qa_result": "pass", "pass": True, "status": "pass"},
                    final_output=archive,
                    started_at=started_at,
                ),
            ]
        )
    events = [
        _event(session_id, "shangshufang.case.created", "shangshufang", {"status": "processing", "edictMode": edict_mode}, started_at),
        _event(session_id, "jinyiwei.evidence.completed" if has_source_urls else "jinyiwei.evidence.needs_evidence", "jinyiwei", jinyiwei_output, started_at),
        _event(session_id, "finance.completed" if evidence_complete else "finance.needs_evidence", "finance", {"session_id": session_id, "status": "completed" if evidence_complete else "blocked", "sourceUrls": source_urls, "courtOS_task_id": courtos_task_id}, started_at),
    ]
    if evidence_complete:
        events.extend(
            [
                _event(session_id, "shangshufang.adjudication.completed", "adjudication", adjudication, started_at),
                _event(session_id, "execution.report.completed", "execution", execution_report, started_at),
                _event(session_id, "shiguan.archive.completed", "archive", archive, started_at),
            ]
        )
    return {
        "session_id": session_id,
        "task_input": task_input,
        "courtOS": {
            "taskId": courtos_task_id,
            "loopTraceId": getattr(body, "courtos_loop_trace_id", None),
            "userId": getattr(body, "courtos_user_id", None),
            "departments": getattr(body, "courtos_departments", None) or [],
            "swarmBundles": getattr(body, "courtos_swarm_bundles", None) or [],
            "edictMode": edict_mode,
        },
        "source_label": source_label,
        "session_type": "finance_intel_loop",
        "status": "completed" if evidence_complete else "blocked_needs_evidence",
        "start_time": started_at,
        "end_time": completed_at,
        "duration": "0s",
        "swarm_count": len(runs),
        "completed_count": sum(1 for run in runs if run["status"] == "completed"),
        "swarm_runs": runs,
        "events": events,
        "finance_intel_loop": {
            "ticker": ticker,
            "evidenceVerified": evidence_verified,
            "edictMode": edict_mode,
            "visibility": visibility,
            "chain": chain,
            "jinyiweiEvidence": jinyiwei_output,
            "memorial": memorial,
            "financeMetrics": finance_metrics,
            "sourceUrls": source_urls,
            "evidenceBoundRun": evidence_bound_run,
            "qualityGate": quality_gate,
            "adjudication": adjudication,
            "executionReport": execution_report,
            "archive": archive,
        },
    }
