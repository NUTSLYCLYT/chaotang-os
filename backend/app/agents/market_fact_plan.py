from __future__ import annotations

import re
import unicodedata
from collections.abc import Callable

from pydantic import ValidationError

from app.agents.fact_plans import FactPlanDisposition, FactPlanResult
from app.agents.market_intent import requested_market_metrics
from app.agents.structured_output import StructuredOutputError, parse_strict_json_object
from app.jinyiwei.instruments import (
    AShareExchange,
    extract_instrument_hints,
    has_out_of_scope_market_hint,
)
from app.jinyiwei.models import (
    DataGapDraft,
    DataScope,
    FactCategory,
    FreshnessRequirement,
    MarketMetric,
    RequiredFact,
    SourceType,
)

_COMPANY_PATTERNS = (
    re.compile(
        r"(?P<subject>[^，。！？!?\n]{1,80}?)(?:的股票|的股价|的证券行情)"
    ),
    re.compile(r"(?P<subject>[^，。！？!?\n]{1,80}?)(?:股票|股价|证券行情)"),
)
_REQUEST_PREFIXES = (
    "请帮我看看",
    "帮我看看",
    "请查询",
    "请查看",
    "请问",
    "查一下",
    "查询",
    "查看",
    "看看",
)
_AMBIGUOUS_SUBJECTS = frozenset({"该", "这", "这只", "相关", "有关", "某", "某只"})
_SOURCE_SCOPE = (SourceType.SHIGUAN, SourceType.MCP)
_REQUEST_LIKE_ENTITY = re.compile(
    r"(?:请|帮我|查询|查看|看看|查一下|请问|股票价格|股价|现价|报价|多少钱)"
)
_ENTITY_SYSTEM_PROMPT = """
从用户的中国大陆证券最新价请求中只提取一个证券实体。
只返回严格 JSON：{"entity_type":"name|ticker","value":"<entity>"}。
entity_type 只能是 name 或 ticker；value 只能是一个公司名称或一个大陆 A 股代码。
不要回答价格，不要增加其它键，不要返回多个实体。
""".strip()
_ENTITY_FORMAT_CORRECTION = """
上一响应不符合格式。不要复述上一响应。
只返回严格 JSON：{"entity_type":"name|ticker","value":"<entity>"}。
""".strip()


def _normalize_subject(value: str) -> str:
    subject = " ".join(unicodedata.normalize("NFKC", value).split())
    subject = subject.strip(" ，,：:")
    changed = True
    while changed:
        changed = False
        for prefix in _REQUEST_PREFIXES:
            if subject.startswith(prefix):
                subject = subject[len(prefix) :].strip(" ，,：:")
                changed = True
                break
    if subject in _AMBIGUOUS_SUBJECTS:
        return ""
    return subject


def _market_subject(
    decree_text: str,
    entity_extractor: Callable[[str], str | None] | None,
) -> str | None:
    hints = extract_instrument_hints(decree_text)
    if len(hints) == 1:
        hint = hints[0]
        suffix = {
            AShareExchange.SSE: ".SH",
            AShareExchange.SZSE: ".SZ",
            AShareExchange.BSE: ".BJ",
            None: "",
        }[hint.exchange]
        return f"{hint.ticker}{suffix}"
    if len(hints) > 1:
        return None
    for pattern in _COMPANY_PATTERNS:
        match = pattern.search(decree_text)
        if match is not None:
            subject = _normalize_subject(match.group("subject"))
            if subject:
                return subject
    if entity_extractor is None:
        return None
    extracted = entity_extractor(decree_text)
    return _normalize_subject(extracted or "") or None


def extract_mainland_market_entity(
    decree_text: str,
    chat_model: Callable[[list[dict[str, str]]], str],
) -> str | None:
    """Narrow model fallback for one Mainland security entity."""

    messages = [
        {"role": "system", "content": _ENTITY_SYSTEM_PROMPT},
        {"role": "user", "content": decree_text},
    ]
    try:
        first = chat_model(messages)
    except Exception:  # noqa: BLE001 - transport/model failures are not retried
        return None
    format_valid, entity = _parse_extracted_entity(first)
    if format_valid:
        return entity
    try:
        corrected = chat_model(
            [
                *messages,
                {"role": "system", "content": _ENTITY_FORMAT_CORRECTION},
            ]
        )
    except Exception:  # noqa: BLE001 - correction transport failure is final
        return None
    return _parse_extracted_entity(corrected)[1]


def _parse_extracted_entity(value: object) -> tuple[bool, str | None]:
    if not isinstance(value, str) or not value.strip():
        return False, None
    try:
        parsed = parse_strict_json_object(value)
    except StructuredOutputError:
        return False, None
    if (
        set(parsed) != {"entity_type", "value"}
        or parsed.get("entity_type") not in {"name", "ticker"}
        or not isinstance(parsed.get("value"), str)
    ):
        return False, None

    entity_type = parsed["entity_type"]
    candidate = _normalize_subject(parsed["value"])
    if (
        not candidate
        or len(candidate) > 80
        or has_out_of_scope_market_hint(candidate)
        or _REQUEST_LIKE_ENTITY.search(candidate) is not None
    ):
        return True, None
    hints = extract_instrument_hints(candidate)
    if entity_type == "name":
        return True, candidate if not hints else None
    if len(hints) != 1:
        return True, None
    hint = hints[0]
    suffix = {
        AShareExchange.SSE: ".SH",
        AShareExchange.SZSE: ".SZ",
        AShareExchange.BSE: ".BJ",
        None: "",
    }[hint.exchange]
    return True, f"{hint.ticker}{suffix}"


def compile_mainland_last_price_plan(
    *,
    decree_text: str,
    node_id: str,
    entity_extractor: Callable[[str], str | None] | None = None,
) -> FactPlanResult:
    if requested_market_metrics(decree_text) != (MarketMetric.LAST_PRICE,):
        return FactPlanResult(FactPlanDisposition.NOT_APPLICABLE)
    if has_out_of_scope_market_hint(decree_text):
        return FactPlanResult(
            FactPlanDisposition.REJECTED,
            reason="market_out_of_scope",
        )

    subject = _market_subject(decree_text, entity_extractor)
    if subject is None:
        return FactPlanResult(
            FactPlanDisposition.REJECTED,
            reason="entity_ambiguous",
        )

    try:
        draft = DataGapDraft(
            requesting_agent=node_id,
            question=decree_text,
            required_facts=(
                RequiredFact(
                    key="market_quote:last_price",
                    description=(
                        f"查询{subject}在中国大陆证券市场的最新可得价格"
                    ),
                    category=FactCategory.MARKET_QUOTE,
                    data_scope=DataScope.EXTERNAL_PUBLIC,
                    subject=subject,
                    jurisdiction="CN",
                    expected_unit="CNY",
                    expected_shape="number",
                    market_metric=MarketMetric.LAST_PRICE,
                ),
            ),
            decision_context="回答明确证券行情查询",
            freshness=FreshnessRequirement(max_age_seconds=3600),
        )
    except ValidationError:
        return FactPlanResult(
            FactPlanDisposition.REJECTED,
            reason="data_plan_invalid",
        )
    return FactPlanResult(
        FactPlanDisposition.PLANNED,
        draft=draft,
        source_scope=_SOURCE_SCOPE,
    )
