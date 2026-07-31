from __future__ import annotations

import json
from collections.abc import Callable

from app.langgraph_runtime import build_deepseek_graph


class QintianProviderUnavailable(RuntimeError):
    """Stable boundary for all provider/config/output failures."""


def _invoke_text(prompt: str) -> str:
    try:
        graph = build_deepseek_graph()
        result = graph.invoke({"input_text": prompt, "response_text": ""})
        text = result.get("response_text") if isinstance(result, dict) else None
        if not isinstance(text, str) or not text.strip():
            raise ValueError("empty provider response")
        return text.strip()
    except Exception as exc:  # noqa: BLE001
        raise QintianProviderUnavailable("qintian provider unavailable") from exc


def build_consult_provider() -> Callable[[list[dict[str, str]]], str]:
    def consult(messages: list[dict[str, str]]) -> str:
        prompt = (
            "你是钦天监，只讨论时机、风险、未知与改变判断的信号；"
            "不得声称执行下旨，也不得伪造实时事实。\n" + json.dumps(messages, ensure_ascii=False)
        )
        return _invoke_text(prompt)

    return consult


def build_forecast_provider() -> Callable[[dict], dict]:
    def forecast(payload: dict) -> dict:
        prompt = (
            "你是钦天监。仅依据输入输出 JSON，不得补造事实或概率。"
            "字段必须为 judgment,confidence,confidence_basis,scenarios,"
            "assumptions,triggers,human_signoff_required。scenarios 严格为"
            "OPTIMISTIC/BASELINE/PESSIMISTIC，且包含 summary,impact,time_window,"
            "counterfactual,probability_interval；无概率依据时必须为 null。"
            "assumptions 为 {statement,critical}；triggers 为"
            "{signal,threshold,window}。\n" + json.dumps(payload, ensure_ascii=False)
        )
        try:
            value = json.loads(_invoke_text(prompt))
        except (json.JSONDecodeError, TypeError) as exc:
            raise QintianProviderUnavailable("invalid provider output") from exc
        if not isinstance(value, dict):
            raise QintianProviderUnavailable("invalid provider output")
        return value

    return forecast
