# Mainland A-Share Resolution and Quote Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve any Shanghai, Shenzhen, or Beijing A-share company or explicit code into one canonical instrument, then obtain only the requested quote facts through Shiguan-first, approved read-only MCP fallback without company-specific mappings.

**Architecture:** Add a provider-neutral A-share identity module under `app/jinyiwei/`, keep provider result parsing in the existing deterministic MCP mapper, and let `McpEvidenceSource` run one bounded identity-resolution chain per logical instrument. Add explicit market metrics so the registry selects quote versus minute tools by fact semantics, while the evidence protocol limits an explicit price-only decree to a single `LAST_PRICE` requirement.

**Tech Stack:** Python 3.11+, Pydantic v2 frozen contracts, FastAPI/LangGraph existing runtime, SQLite existing stores, pytest, Ruff, YAML MCP registry.

## Global Constraints

- Product scope is A-shares listed on SSE, SZSE, or BSE only.
- Hong Kong, Stock Connect, US and other overseas equities, B-shares, funds, ETFs, bonds, futures, forex, indices, and sectors are out of scope.
- MCP access remains administrator-registered, schema-pinned, credential-free in configuration, and `READ_ONLY`.
- Shiguan remains first; MCP is used only for missing or stale required facts.
- Do not add provider conditionals to the coordinator or evidence protocol.
- Do not hard-code company-to-ticker mappings.
- Name resolution permits the original normalized name plus at most one controlled legal-suffix-stripped retry.
- An ambiguous identity must fail closed; never select the first search result.
- Instrument identity may be cached independently; quote freshness remains minute-level and is not extended.
- Preserve all existing uncommitted user changes. Do not stage, commit, push, migrate a runtime database, or run a new real-network smoke without separate explicit authorization for that action.
- Ordinary tests must use temporary SQLite files, fixtures, fake DNS/socket/client implementations, and no credentials or real network.
- The approved design is `docs/superpowers/specs/2026-07-24-mainland-a-share-resolution-and-quote-design.md`.

## File Structure

- Create `backend/app/jinyiwei/instruments.py`: pure A-share identity types, identifier extraction, controlled name normalization, and deterministic candidate selection.
- Create `backend/tests/test_jinyiwei_instruments.py`: pure unit tests for names, codes, scope rejection, and ambiguity.
- Modify `backend/app/jinyiwei/models.py`: add explicit `MarketMetric` to market facts.
- Modify `backend/app/jinyiwei/mcp/contracts.py`: approve market metrics and exchange subject patterns as immutable registry data.
- Modify `backend/app/jinyiwei/mcp/mapping.py`: map provider candidates into the pure identity model and map a resolved instrument to provider arguments.
- Modify `backend/app/jinyiwei/mcp/registry.py`: select tools by category, scope, jurisdiction, and market metric.
- Modify `backend/app/jinyiwei/sources/mcp.py`: execute a bounded identity plan once per logical instrument and reuse it across facts.
- Modify `backend/app/agents/evidence_protocol.py`: require `market_metric` in market requests and constrain explicit A-share price-only requests.
- Modify `backend/config/jinyiwei_mcp.yaml`: declare the verified Tencent SSE/SZSE patterns and tool metric capabilities; do not claim BSE support.
- Modify focused MCP, coordinator, evidence-protocol, and configuration tests.
- Modify `backend/AGENTS.md`, `ARCHITECTURE.md`, the product task, and add an ADR for the new identity boundary.

---

### Task 1: Pure Mainland A-Share Identity Domain

**Files:**
- Create: `backend/app/jinyiwei/instruments.py`
- Create: `backend/tests/test_jinyiwei_instruments.py`
- Modify: `backend/app/jinyiwei/__init__.py`

**Interfaces:**
- Produces: `AShareExchange`, `InstrumentRef`, `InstrumentCandidate`, `InstrumentHint`, `InstrumentResolution`, `InstrumentResolutionStatus`.
- Produces: `extract_instrument_hints(*texts: str) -> tuple[InstrumentHint, ...]`.
- Produces: `has_out_of_scope_market_hint(*texts: str) -> bool`.
- Produces: `instrument_name_queries(subject: str) -> tuple[str, ...]`.
- Produces: `resolve_a_share(candidates, *, hints, accepted_names) -> InstrumentResolution`.
- Consumes: no MCP or provider types; this module must stay pure and offline.

- [ ] **Step 1: Write failing tests for identifier normalization and bounded name queries**

Add tests with these exact expectations:

```python
from app.jinyiwei.instruments import (
    AShareExchange,
    extract_instrument_hints,
    instrument_name_queries,
)


def test_extracts_equivalent_szse_identifiers() -> None:
    for text in ("002594.SZ", "SZSE:002594", "sz002594"):
        assert extract_instrument_hints(text) == (
            InstrumentHint(exchange=AShareExchange.SZSE, ticker="002594"),
        )


def test_extracts_sse_and_bse_identifiers_without_prefix_guessing() -> None:
    assert extract_instrument_hints("600519.SH") == (
        InstrumentHint(exchange=AShareExchange.SSE, ticker="600519"),
    )
    assert extract_instrument_hints("BSE:430047") == (
        InstrumentHint(exchange=AShareExchange.BSE, ticker="430047"),
    )
    assert extract_instrument_hints("代码 002594") == (
        InstrumentHint(exchange=None, ticker="002594"),
    )


def test_detects_explicit_non_mainland_market_identifiers() -> None:
    assert has_out_of_scope_market_hint("1211.HK")
    assert has_out_of_scope_market_hint("hk01211")
    assert has_out_of_scope_market_hint("NASDAQ:AAPL")
    assert not has_out_of_scope_market_hint("002594.SZ")


def test_name_queries_are_original_plus_one_controlled_alias() -> None:
    assert instrument_name_queries(" 比亚迪股份有限公司 ") == (
        "比亚迪股份有限公司",
        "比亚迪",
    )
    assert instrument_name_queries("贵州茅台") == ("贵州茅台",)
    assert instrument_name_queries("股份有限公司") == ("股份有限公司",)
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```powershell
cd backend
.venv\Scripts\python.exe -m pytest tests/test_jinyiwei_instruments.py -q
```

Expected: collection fails because `app.jinyiwei.instruments` does not exist.

- [ ] **Step 3: Implement immutable identity types and normalization**

Create the module with these public definitions and equivalent complete behavior:

```python
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from enum import StrEnum
from typing import Iterable


class AShareExchange(StrEnum):
    SSE = "SSE"
    SZSE = "SZSE"
    BSE = "BSE"


class InstrumentResolutionStatus(StrEnum):
    RESOLVED = "RESOLVED"
    AMBIGUOUS = "AMBIGUOUS"
    NOT_FOUND = "NOT_FOUND"


@dataclass(frozen=True, slots=True)
class InstrumentHint:
    exchange: AShareExchange | None
    ticker: str


@dataclass(frozen=True, slots=True)
class InstrumentRef:
    canonical_name: str
    exchange: AShareExchange
    ticker: str
    instrument_type: str = "A_SHARE"
    currency: str = "CNY"


@dataclass(frozen=True, slots=True)
class InstrumentCandidate:
    instrument: InstrumentRef
    provider_subject: str
    aliases: tuple[str, ...] = ()


@dataclass(frozen=True, slots=True)
class InstrumentResolution:
    status: InstrumentResolutionStatus
    instrument: InstrumentRef | None = None
    provider_subject: str | None = None


_EXPLICIT_PATTERNS = (
    (re.compile(r"(?<![A-Z0-9])SH(?:SE)?:?([0-9]{6})(?![0-9])", re.I), AShareExchange.SSE),
    (re.compile(r"(?<![A-Z0-9])SZ(?:SE)?:?([0-9]{6})(?![0-9])", re.I), AShareExchange.SZSE),
    (re.compile(r"(?<![A-Z0-9])B(?:J|SE):?([0-9]{6})(?![0-9])", re.I), AShareExchange.BSE),
    (re.compile(r"(?<![0-9])([0-9]{6})\.SH(?![A-Z])", re.I), AShareExchange.SSE),
    (re.compile(r"(?<![0-9])([0-9]{6})\.SZ(?![A-Z])", re.I), AShareExchange.SZSE),
    (re.compile(r"(?<![0-9])([0-9]{6})\.BJ(?![A-Z])", re.I), AShareExchange.BSE),
)
_BARE_TICKER = re.compile(r"(?<![0-9])([0-9]{6})(?![0-9])")
_OUT_OF_SCOPE_MARKET = re.compile(
    r"(?i)(?:\bHK[0-9]{5}\b|\b[0-9]{4,5}\.HK\b|"
    r"\b(?:NASDAQ|NYSE|AMEX|LSE|TSE|JPX):[A-Z0-9.]+\b)"
)
_LEGAL_SUFFIXES = ("股份有限公司", "集团有限公司", "有限责任公司", "有限公司")


def _name(value: str) -> str:
    return " ".join(unicodedata.normalize("NFKC", value).split())


def extract_instrument_hints(*texts: str) -> tuple[InstrumentHint, ...]:
    found: list[InstrumentHint] = []
    occupied: set[tuple[str, int, int]] = set()
    for raw in texts:
        text = unicodedata.normalize("NFKC", raw).upper()
        for pattern, exchange in _EXPLICIT_PATTERNS:
            for match in pattern.finditer(text):
                hint = InstrumentHint(exchange=exchange, ticker=match.group(1))
                if hint not in found:
                    found.append(hint)
                occupied.add((text, match.start(1), match.end(1)))
        for match in _BARE_TICKER.finditer(text):
            if (text, match.start(1), match.end(1)) in occupied:
                continue
            hint = InstrumentHint(exchange=None, ticker=match.group(1))
            if hint not in found:
                found.append(hint)
    return tuple(found)


def has_out_of_scope_market_hint(*texts: str) -> bool:
    return any(
        _OUT_OF_SCOPE_MARKET.search(unicodedata.normalize("NFKC", text))
        is not None
        for text in texts
    )


def instrument_name_queries(subject: str) -> tuple[str, ...]:
    original = _name(subject)
    if not original:
        return ()
    values = [original]
    for suffix in _LEGAL_SUFFIXES:
        if original.endswith(suffix):
            alias = original[: -len(suffix)].strip()
            if alias:
                values.append(alias)
            break
    return tuple(values)
```

Export the new public names from `app/jinyiwei/__init__.py`.

- [ ] **Step 4: Add candidate selection tests**

Add:

```python
from app.jinyiwei.instruments import (
    InstrumentCandidate,
    InstrumentRef,
    InstrumentResolutionStatus,
    resolve_a_share,
)


def _candidate(name: str, exchange: AShareExchange, ticker: str, subject: str):
    return InstrumentCandidate(
        instrument=InstrumentRef(
            canonical_name=name,
            exchange=exchange,
            ticker=ticker,
        ),
        provider_subject=subject,
    )


def test_explicit_exchange_and_ticker_win_over_name_variation() -> None:
    result = resolve_a_share(
        (
            _candidate("比亚迪", AShareExchange.SZSE, "002594", "sz002594"),
            _candidate("另一公司", AShareExchange.SSE, "002594", "sh002594"),
        ),
        hints=(InstrumentHint(AShareExchange.SZSE, "002594"),),
        accepted_names=("比亚迪股份有限公司", "比亚迪"),
    )
    assert result.status is InstrumentResolutionStatus.RESOLVED
    assert result.instrument == InstrumentRef(
        canonical_name="比亚迪",
        exchange=AShareExchange.SZSE,
        ticker="002594",
    )
    assert result.provider_subject == "sz002594"


def test_name_alias_can_resolve_only_one_a_share_candidate() -> None:
    result = resolve_a_share(
        (_candidate("比亚迪", AShareExchange.SZSE, "002594", "sz002594"),),
        hints=(),
        accepted_names=("比亚迪股份有限公司", "比亚迪"),
    )
    assert result.status is InstrumentResolutionStatus.RESOLVED


def test_multiple_matching_candidates_are_ambiguous() -> None:
    result = resolve_a_share(
        (
            _candidate("同名科技", AShareExchange.SSE, "600001", "sh600001"),
            _candidate("同名科技", AShareExchange.SZSE, "000001", "sz000001"),
        ),
        hints=(),
        accepted_names=("同名科技",),
    )
    assert result.status is InstrumentResolutionStatus.AMBIGUOUS
    assert result.instrument is None
```

- [ ] **Step 5: Implement deterministic unique selection**

Append:

```python
def _identity(value: str) -> str:
    return re.sub(r"[\s·・•._\-（）()]+", "", _name(value)).casefold()


def resolve_a_share(
    candidates: Iterable[InstrumentCandidate],
    *,
    hints: tuple[InstrumentHint, ...],
    accepted_names: tuple[str, ...],
) -> InstrumentResolution:
    values = tuple(candidates)
    if hints:
        explicit = tuple(
            candidate
            for candidate in values
            if any(
                candidate.instrument.ticker == hint.ticker
                and (
                    hint.exchange is None
                    or candidate.instrument.exchange is hint.exchange
                )
                for hint in hints
            )
        )
        matches = explicit
    else:
        names = {_identity(value) for value in accepted_names if _identity(value)}
        matches = tuple(
            candidate
            for candidate in values
            if _identity(candidate.instrument.canonical_name) in names
            or any(_identity(alias) in names for alias in candidate.aliases)
        )
    unique = {
        (
            candidate.instrument.exchange,
            candidate.instrument.ticker,
        ): candidate
        for candidate in matches
    }
    if not unique:
        return InstrumentResolution(InstrumentResolutionStatus.NOT_FOUND)
    if len(unique) != 1:
        return InstrumentResolution(InstrumentResolutionStatus.AMBIGUOUS)
    selected = next(iter(unique.values()))
    return InstrumentResolution(
        InstrumentResolutionStatus.RESOLVED,
        selected.instrument,
        selected.provider_subject,
    )
```

- [ ] **Step 6: Run identity tests and lint**

Run:

```powershell
cd backend
.venv\Scripts\python.exe -m pytest tests/test_jinyiwei_instruments.py -q
.venv\Scripts\python.exe -m ruff check app/jinyiwei/instruments.py tests/test_jinyiwei_instruments.py
```

Expected: all tests pass and Ruff reports `All checks passed!`.

- [ ] **Step 7: Commit checkpoint only if separately authorized**

```powershell
git add backend/app/jinyiwei/instruments.py backend/app/jinyiwei/__init__.py backend/tests/test_jinyiwei_instruments.py
git commit -m "feat(jinyiwei): add mainland A-share identity model"
```

---

### Task 2: Metric-Aware Fact and MCP Approval Contracts

**Files:**
- Modify: `backend/app/jinyiwei/models.py`
- Modify: `backend/app/jinyiwei/mcp/contracts.py`
- Modify: `backend/app/jinyiwei/mcp/registry.py`
- Modify: `backend/config/jinyiwei_mcp.yaml`
- Modify: `backend/tests/test_jinyiwei_models.py`
- Modify: `backend/tests/test_jinyiwei_mcp_registry.py`

**Interfaces:**
- Produces: `MarketMetric` with `LAST_PRICE`, `VOLUME`, `CHANGE_PERCENT`,
  `INTRADAY_SERIES`, `PE_RATIO`, `PB_RATIO`, `MARKET_CAP`, and
  `PRICE_TREND_30D`.
- Changes: `RequiredFact.market_metric: MarketMetric | None`.
- Changes: `McpToolApproval.market_metrics: tuple[MarketMetric, ...]`.
- Changes: `McpEntityResolver.exchange_subject_patterns: Mapping[AShareExchange, str]`.
- Consumes: Task 1 `AShareExchange`.

- [ ] **Step 1: Write failing model tests**

```python
import pytest
from pydantic import ValidationError

from app.jinyiwei.models import (
    DataScope,
    FactCategory,
    MarketMetric,
    RequiredFact,
)


def test_market_quote_requires_market_metric() -> None:
    with pytest.raises(ValidationError, match="market_metric"):
        RequiredFact(
            key="price",
            description="最新价格",
            category=FactCategory.MARKET_QUOTE,
            data_scope=DataScope.EXTERNAL_PUBLIC,
            subject="比亚迪",
        )


def test_non_market_fact_rejects_market_metric() -> None:
    with pytest.raises(ValidationError, match="market_metric"):
        RequiredFact(
            key="profile",
            description="公司介绍",
            category=FactCategory.ENTITY_REFERENCE,
            data_scope=DataScope.EXTERNAL_PUBLIC,
            subject="比亚迪",
            market_metric=MarketMetric.LAST_PRICE,
        )
```

- [ ] **Step 2: Run the two tests and verify RED**

Run:

```powershell
cd backend
.venv\Scripts\python.exe -m pytest tests/test_jinyiwei_models.py -q
```

Expected: tests fail because `MarketMetric` and `market_metric` are absent.

- [ ] **Step 3: Add the metric contract and cross-field validator**

In `models.py`:

```python
class MarketMetric(StrEnum):
    LAST_PRICE = "LAST_PRICE"
    VOLUME = "VOLUME"
    CHANGE_PERCENT = "CHANGE_PERCENT"
    INTRADAY_SERIES = "INTRADAY_SERIES"
    PE_RATIO = "PE_RATIO"
    PB_RATIO = "PB_RATIO"
    MARKET_CAP = "MARKET_CAP"
    PRICE_TREND_30D = "PRICE_TREND_30D"


class RequiredFact(_FrozenContract):
    # existing fields stay unchanged
    market_metric: MarketMetric | None = None

    @model_validator(mode="after")
    def _metric_matches_category(self) -> RequiredFact:
        if self.category is FactCategory.MARKET_QUOTE:
            if self.market_metric is None:
                raise ValueError("MARKET_QUOTE requires market_metric")
        elif self.market_metric is not None:
            raise ValueError("market_metric is only valid for MARKET_QUOTE")
        return self
```

Update existing test fixtures and production constructors so every existing
`MARKET_QUOTE` fact declares its actual metric. The existing smoke `_quote_fact`
uses `LAST_PRICE`.

- [ ] **Step 4: Write failing registry tests for metric and exchange capabilities**

Add fixtures proving:

```python
def test_quote_tool_matches_last_price_but_not_intraday(registry) -> None:
    assert [tool.tool_name for tool in registry.tools_for((_fact(MarketMetric.LAST_PRICE),))] == [
        "data_quote"
    ]
    assert [tool.tool_name for tool in registry.tools_for((_fact(MarketMetric.INTRADAY_SERIES),))] == [
        "data_minute"
    ]


def test_tencent_resolver_does_not_claim_bse(registry) -> None:
    quote = registry.approval("westock", "data_quote")
    patterns = quote.mapping.entity_resolution.exchange_subject_patterns
    assert set(patterns) == {AShareExchange.SSE, AShareExchange.SZSE}
```

- [ ] **Step 5: Extend immutable approval contracts**

Add to `McpEntityResolver`:

```python
exchange_subject_patterns: Mapping[AShareExchange, StrictStr]
```

Validate every regex compiles, every key is unique after enum normalization, and
the mapping is non-empty. Serialize it with the existing immutable mapping
serializer.

Add to `McpToolApproval`:

```python
market_metrics: tuple[MarketMetric, ...] = ()
```

Extend the approval validator:

```python
if FactCategory.MARKET_QUOTE in self.fact_categories:
    if not self.market_metrics:
        raise ValueError("market_quote_requires_market_metrics")
elif self.market_metrics:
    raise ValueError("market_metrics_require_market_quote")
```

Extend `matches_fact` with:

```python
and (
    fact.category is not FactCategory.MARKET_QUOTE
    or fact.market_metric in self.market_metrics
)
```

- [ ] **Step 6: Declare only verified Tencent capabilities**

In `jinyiwei_mcp.yaml`:

```yaml
market_metrics:
  - INTRADAY_SERIES
```

for `data_minute`, and:

```yaml
market_metrics:
  - LAST_PRICE
```

for `data_quote`.

For both resolvers add:

```yaml
exchange_subject_patterns:
  SSE: sh[0-9]{6}
  SZSE: sz[0-9]{6}
```

Do not add `BSE` until a real source is proven and separately approved.
Recompute only the affected pinned approval fingerprints using the repository's
existing fingerprint helper, then place the exact generated values into the YAML.

- [ ] **Step 7: Run contract and registry tests**

Run:

```powershell
cd backend
.venv\Scripts\python.exe -m pytest tests/test_jinyiwei_models.py tests/test_jinyiwei_mcp_registry.py -q
.venv\Scripts\python.exe -m ruff check app/jinyiwei/models.py app/jinyiwei/mcp/contracts.py app/jinyiwei/mcp/registry.py tests/test_jinyiwei_models.py tests/test_jinyiwei_mcp_registry.py
```

Expected: all selected tests pass and Ruff passes.

- [ ] **Step 8: Commit checkpoint only if separately authorized**

```powershell
git add backend/app/jinyiwei/models.py backend/app/jinyiwei/mcp/contracts.py backend/app/jinyiwei/mcp/registry.py backend/config/jinyiwei_mcp.yaml backend/tests
git commit -m "feat(jinyiwei): declare A-share quote capabilities"
```

---

### Task 3: Deterministic Provider Candidate Mapping

**Files:**
- Modify: `backend/app/jinyiwei/mcp/mapping.py`
- Modify: `backend/tests/test_jinyiwei_mcp_mapping.py`

**Interfaces:**
- Produces: `DeterministicMcpMapper.instrument_candidates(tool, result) -> tuple[InstrumentCandidate, ...]`.
- Produces: `DeterministicMcpMapper.arguments_for_instrument(tool, fact, resolved) -> dict[str, object]`.
- Keeps: payload path extraction, unsafe-control rejection, schema pinning, units, and evidence mapping fail closed.
- Consumes: Task 1 identity types and Task 2 exchange patterns.

- [ ] **Step 1: Write failing candidate mapping tests**

Use an approved fake resolver and fixed `McpToolResult`:

```python
def test_maps_only_approved_mainland_a_share_candidates() -> None:
    candidates = mapper.instrument_candidates(
        quote_approval,
        search_result(
            [
                {"name": "比亚迪", "code": "sz002594", "type": "GP-A"},
                {"name": "比亚迪股份", "code": "hk01211", "type": "GP"},
                {"name": "比亚迪ETF", "code": "sh512000", "type": "ETF"},
            ]
        ),
    )
    assert candidates == (
        InstrumentCandidate(
            instrument=InstrumentRef(
                canonical_name="比亚迪",
                exchange=AShareExchange.SZSE,
                ticker="002594",
            ),
            provider_subject="sz002594",
        ),
    )


def test_rejects_subject_matching_zero_or_multiple_exchange_patterns() -> None:
    with pytest.raises(McpMappingError, match="entity_not_resolved"):
        mapper.instrument_candidates(quote_approval, search_result([
            {"name": "未知", "code": "xx002594", "type": "GP-A"}
        ]))
```

- [ ] **Step 2: Run focused mapping tests and verify RED**

Run:

```powershell
cd backend
.venv\Scripts\python.exe -m pytest tests/test_jinyiwei_mcp_mapping.py -q
```

Expected: new tests fail because `instrument_candidates` does not exist.

- [ ] **Step 3: Split candidate extraction from unique selection**

Refactor the existing `resolve_subject` loop into:

```python
def instrument_candidates(
    self,
    tool: McpToolApproval,
    result: McpToolResult,
) -> tuple[InstrumentCandidate, ...]:
    resolution = self._validated_resolution_result(tool, result)
    raw_candidates = _extract(result.payload, resolution.candidates_path)
    if isinstance(raw_candidates, str | bytes | bytearray) or not isinstance(
        raw_candidates, Sequence
    ):
        raise McpMappingError("mapped_field_missing")
    mapped: list[InstrumentCandidate] = []
    for raw in raw_candidates:
        try:
            name = _clean_text(_string(_extract(raw, resolution.candidate_name_path)))
            provider_subject = _clean_text(
                _string(_extract(raw, resolution.candidate_subject_path))
            )
            security_type = _clean_text(
                _string(_extract(raw, resolution.candidate_type_path))
            )
        except McpMappingError:
            continue
        exchanges = tuple(
            exchange
            for exchange, pattern in resolution.exchange_subject_patterns.items()
            if re.fullmatch(pattern, provider_subject) is not None
        )
        allowed_types = resolution.required_types_by_market.get("CN", ())
        if len(exchanges) != 1 or not any(
            security_type.casefold() == value.casefold()
            for value in allowed_types
        ):
            continue
        exchange = exchanges[0]
        ticker = re.search(r"([0-9]{6})$", provider_subject)
        if ticker is None:
            continue
        mapped.append(
            InstrumentCandidate(
                instrument=InstrumentRef(
                    canonical_name=name,
                    exchange=exchange,
                    ticker=ticker.group(1),
                ),
                provider_subject=provider_subject,
            )
        )
    if not mapped:
        raise McpMappingError("entity_not_resolved")
    return tuple(mapped)
```

Keep all existing raw control, maximum length, subject pattern, approved type,
unit, server ID, tool name, and success-path checks in the extracted validation
helpers. Do not weaken them while moving code.

- [ ] **Step 4: Add provider argument tests**

```python
def test_resolved_instrument_supplies_only_approved_target_argument() -> None:
    resolved = InstrumentResolution(
        status=InstrumentResolutionStatus.RESOLVED,
        instrument=InstrumentRef("比亚迪", AShareExchange.SZSE, "002594"),
        provider_subject="sz002594",
    )
    assert mapper.arguments_for_instrument(quote_approval, price_fact, resolved) == {
        "code": "sz002594"
    }
```

- [ ] **Step 5: Implement resolved-instrument arguments and compatibility wrapper**

Add:

```python
def arguments_for_instrument(
    self,
    tool: McpToolApproval,
    fact: RequiredFact,
    resolved: InstrumentResolution,
) -> dict[str, object]:
    if (
        resolved.status is not InstrumentResolutionStatus.RESOLVED
        or resolved.instrument is None
        or resolved.provider_subject is None
    ):
        raise McpMappingError("entity_resolution_required")
    return self.arguments_for(
        tool,
        fact,
        resolved_subject=resolved.provider_subject,
    )
```

Retain `resolve_subject` temporarily as a thin compatibility wrapper for the smoke
CLI and existing callers. It must call `instrument_candidates` plus
`resolve_a_share`, not retain a second candidate-matching implementation.

- [ ] **Step 6: Run mapper tests and lint**

Run:

```powershell
cd backend
.venv\Scripts\python.exe -m pytest tests/test_jinyiwei_mcp_mapping.py tests/test_jinyiwei_mcp_smoke.py -q
.venv\Scripts\python.exe -m ruff check app/jinyiwei/mcp/mapping.py tests/test_jinyiwei_mcp_mapping.py
```

Expected: selected tests and Ruff pass.

- [ ] **Step 7: Commit checkpoint only if separately authorized**

```powershell
git add backend/app/jinyiwei/mcp/mapping.py backend/tests/test_jinyiwei_mcp_mapping.py
git commit -m "feat(jinyiwei): map MCP A-share candidates"
```

---

### Task 4: Bounded Resolution Once Per Investigation

**Files:**
- Modify: `backend/app/jinyiwei/sources/mcp.py`
- Modify: `backend/tests/test_jinyiwei_mcp_source.py`

**Interfaces:**
- Consumes: `extract_instrument_hints`, `instrument_name_queries`, `resolve_a_share`.
- Produces: one `InstrumentResolution` per logical market subject and server during a `fetch`.
- Error mapping: `instrument_ambiguous`, `instrument_not_found`, `provider_capability_missing`, or existing safe client errors.
- Error mapping also includes `market_out_of_scope` for an explicit HK or overseas
  identifier.

- [ ] **Step 1: Write failing source tests for explicit code and alias fallback**

Build fake MCP responses and assert exact call sequences:

```python
def test_explicit_code_in_question_resolves_without_full_name_equality() -> None:
    client = _ResolutionClient.for_byd()
    source = _resolution_source(client)
    result = source.fetch(query(
        question="查询比亚迪股份有限公司 002594.SZ 最新股价",
        facts=(price_fact(subject="比亚迪股份有限公司"),),
    ))
    assert result.status is SourceAttemptStatus.SUCCEEDED
    assert client.calls == [
        ("data_search", {"query": "002594.SZ"}),
        ("data_quote", {"code": "sz002594"}),
    ]


def test_full_legal_name_falls_back_once_to_short_name() -> None:
    client = _ResolutionClient.for_byd(full_name_empty=True)
    source = _resolution_source(client)
    result = source.fetch(query(
        question="查询比亚迪股票价格",
        facts=(price_fact(subject="比亚迪股份有限公司"),),
    ))
    assert result.status is SourceAttemptStatus.SUCCEEDED
    assert client.calls == [
        ("data_search", {"query": "比亚迪股份有限公司"}),
        ("data_search", {"query": "比亚迪"}),
        ("data_quote", {"code": "sz002594"}),
    ]
```

The first test may use the explicit code as the search query because the current
approved Tencent resolver requires a search call. It may skip search only if a
future approval explicitly permits verified direct-code resolution.

Add `_ResolutionClient` as a deterministic extension of the existing `_Client`:
it returns configured `structuredContent.data` candidate arrays for
`data_search`, returns the existing fixed quote payload for `data_quote`, and
records `(tool_name, arguments)` in `calls`. Add `_resolution_source(client)`
using `_registry()` plus the entity-resolution mapping fixture, and extend
`_query` to accept the shown `question` and `facts` keyword arguments. These
helpers contain no network or credential access.

- [ ] **Step 2: Write failing reuse, ambiguity, and capability tests**

```python
def test_multiple_quote_facts_share_one_resolution() -> None:
    client = _ResolutionClient.for_byd()
    source = _resolution_source(client)
    result = source.fetch(query(
        question="查询比亚迪价格和成交量",
        facts=(price_fact(), volume_fact()),
    ))
    assert [name for name, _ in client.calls].count("data_search") == 1


def test_ambiguous_candidates_fail_closed() -> None:
    client = _ResolutionClient.for_ambiguous_name()
    source = _resolution_source(client)
    result = source.fetch(query_for("同名科技"))
    assert result.status is SourceAttemptStatus.FAILED
    assert result.error == "instrument_ambiguous"
    assert all(name != "data_quote" for name, _ in client.calls)


def test_bse_without_approved_provider_capability_is_skipped() -> None:
    client = _ResolutionClient.for_byd()
    source = _resolution_source(client)
    result = source.fetch(query_for("BSE:430047"))
    assert result.error == "provider_capability_missing"
    assert client.calls == []


def test_explicit_hk_identifier_is_out_of_scope_without_mcp_calls() -> None:
    client = _ResolutionClient.for_byd()
    source = _resolution_source(client)
    result = source.fetch(query_for("腾讯控股 0700.HK"))
    assert result.error == "market_out_of_scope"
    assert client.calls == []
```

- [ ] **Step 3: Run the new source tests and verify RED**

Run:

```powershell
cd backend
.venv\Scripts\python.exe -m pytest tests/test_jinyiwei_mcp_source.py -q
```

Expected: new call sequence and error assertions fail on the current per-fact
single-query implementation.

- [ ] **Step 4: Add a fetch-local resolution cache and bounded resolver**

Inside `fetch`, create:

```python
resolution_cache: dict[
    tuple[str, tuple[str, ...], tuple[InstrumentHint, ...]],
    InstrumentResolution,
] = {}
```

Add a private method with this contract:

```python
def _resolve_instrument(
    self,
    *,
    query: SourceQuery,
    fact: RequiredFact,
    server: McpServerConfig,
    approval: McpToolApproval,
    resolver: McpToolApproval,
    call_audits: list[McpCallAudit],
) -> InstrumentResolution:
```

Its algorithm must be:

```python
texts = (query.request.question, fact.subject, fact.description)
if has_out_of_scope_market_hint(*texts):
    raise McpMappingError("market_out_of_scope")
hints = extract_instrument_hints(*texts)
names = instrument_name_queries(fact.subject)
searches = tuple(
    dict.fromkeys(
        [f"{hint.ticker}.{_suffix(hint.exchange)}" for hint in hints if hint.exchange]
        + [hint.ticker for hint in hints if hint.exchange is None]
        + list(names)
    )
)
for search in searches:
    result, audit = self._call_tool(
        server,
        resolver,
        {"query": search},
        fact_freshness_seconds=query.request.freshness.max_age_seconds,
    )
    call_audits.append(audit)
    try:
        candidates = self._mapper.instrument_candidates(approval, result)
    except McpMappingError as exc:
        if str(exc) == "entity_not_resolved":
            continue
        raise
    resolved = resolve_a_share(
        candidates,
        hints=hints,
        accepted_names=names,
    )
    if resolved.status is not InstrumentResolutionStatus.NOT_FOUND:
        return resolved
return InstrumentResolution(InstrumentResolutionStatus.NOT_FOUND)
```

Enforce no more than the distinct explicit identifiers plus two name queries.
The legal-name branch itself remains strictly capped at original plus one alias.
Use one cached resolution for all facts with the same server, hints, and normalized
name candidates.

- [ ] **Step 5: Map resolution states to stable safe errors**

Before calling the data tool:

```python
if resolved.status is InstrumentResolutionStatus.AMBIGUOUS:
    raise McpMappingError("instrument_ambiguous")
if resolved.status is InstrumentResolutionStatus.NOT_FOUND:
    raise McpMappingError("instrument_not_found")
```

If the explicit hint is BSE and no approved tool resolver declares BSE, return a
failed/skipped attempt with `provider_capability_missing` before any MCP call.
Keep response bodies and candidate payloads out of the error.

- [ ] **Step 6: Use the resolved instrument for all matching facts**

Replace direct `resolution_arguments_for`/`resolve_subject` calls with the cached
resolution and:

```python
arguments = self._mapper.arguments_for_instrument(approval, fact, resolved)
```

Continue passing `resolved.provider_subject` and the approved `CNY` unit into
`mapper.map`. Preserve existing rate limits, call cache, freshness checks,
deadline handling, audit hashes, and source ordering.

- [ ] **Step 7: Run source, coordinator, and verification regression tests**

Run:

```powershell
cd backend
.venv\Scripts\python.exe -m pytest tests/test_jinyiwei_mcp_source.py tests/test_jinyiwei_coordinator.py tests/test_jinyiwei_verification.py -q
.venv\Scripts\python.exe -m ruff check app/jinyiwei/sources/mcp.py tests/test_jinyiwei_mcp_source.py
```

Expected: all selected tests and Ruff pass.

- [ ] **Step 8: Commit checkpoint only if separately authorized**

```powershell
git add backend/app/jinyiwei/sources/mcp.py backend/tests/test_jinyiwei_mcp_source.py
git commit -m "fix(jinyiwei): resolve A-share identities once"
```

---

### Task 5: Price-Only Evidence Request Scope

**Files:**
- Modify: `backend/app/agents/evidence_protocol.py`
- Modify: `backend/tests/test_agent_evidence_protocol.py`
- Modify: `backend/app/agents/market_intent.py`
- Modify: `backend/tests/test_market_intent.py`

**Interfaces:**
- Produces: `requested_market_metrics(decree_text: str) -> tuple[MarketMetric, ...]`.
- Changes: evidence draft prompt requires `market_metric` for `MARKET_QUOTE`.
- Changes: explicit price-only decrees retain exactly one required `LAST_PRICE` fact before investigation.
- Does not change: Chancellor `departments` parsing or routing order.

- [ ] **Step 1: Write failing intent-scope tests**

```python
from app.agents.market_intent import requested_market_metrics
from app.jinyiwei.models import MarketMetric


def test_price_only_decree_requests_only_last_price() -> None:
    assert requested_market_metrics("帮我看看比亚迪的股票价格") == (
        MarketMetric.LAST_PRICE,
    )


def test_price_and_volume_request_keeps_both_metrics() -> None:
    assert requested_market_metrics("查一下比亚迪股价和成交量") == (
        MarketMetric.LAST_PRICE,
        MarketMetric.VOLUME,
    )


def test_non_market_text_has_no_market_metric_scope() -> None:
    assert requested_market_metrics("介绍比亚迪公司历史") == ()
```

- [ ] **Step 2: Implement narrow deterministic metric extraction**

In `market_intent.py`, use the existing security-term and quote-term guard, then
return only metrics explicitly named:

```python
def requested_market_metrics(decree_text: str) -> tuple[MarketMetric, ...]:
    if not is_market_quote_intent(decree_text):
        return ()
    normalized = decree_text.casefold()
    metrics: list[MarketMetric] = []
    if any(term in normalized for term in ("价格", "股价", "现价", "报价", "price", "quote")):
        metrics.append(MarketMetric.LAST_PRICE)
    if any(term in normalized for term in ("成交量", "volume")):
        metrics.append(MarketMetric.VOLUME)
    if any(term in normalized for term in ("涨跌幅", "涨幅", "跌幅", "change percent")):
        metrics.append(MarketMetric.CHANGE_PERCENT)
    if any(term in normalized for term in ("分时", "日内走势", "intraday")):
        metrics.append(MarketMetric.INTRADAY_SERIES)
    if any(term in normalized for term in ("市盈率", "pe ratio", "pe")):
        metrics.append(MarketMetric.PE_RATIO)
    if any(term in normalized for term in ("市净率", "pb ratio", "pb")):
        metrics.append(MarketMetric.PB_RATIO)
    if any(term in normalized for term in ("市值", "market cap")):
        metrics.append(MarketMetric.MARKET_CAP)
    if any(term in normalized for term in ("30日走势", "一个月走势", "月度走势")):
        metrics.append(MarketMetric.PRICE_TREND_30D)
    return tuple(dict.fromkeys(metrics))
```

Do not infer PE, PB, market cap, ratings, or monthly trend unless the decree
explicitly names the corresponding concept.

- [ ] **Step 3: Write failing evidence draft tests**

Add a fake bureau response that requests `LAST_PRICE`, PE, PB, market cap, and
30-day trend for the price-only decree. Assert the normalized investigation
request contains only:

```python
assert [(fact.key, fact.market_metric) for fact in request.required_facts] == [
    ("BYD_STOCK_PRICE", MarketMetric.LAST_PRICE)
]
```

Add a separate explicit “股价和成交量” case proving both explicitly requested
facts survive scope normalization. Tool capability selection may still report
`provider_capability_missing` for a metric that no approved tool supports.

- [ ] **Step 4: Require metrics in the protocol prompt and parser**

Change the documented fact JSON to:

```text
"market_metric":"LAST_PRICE"
```

Immediately after the example, list the complete allowed set:
`LAST_PRICE`, `VOLUME`, `CHANGE_PERCENT`, `INTRADAY_SERIES`, `PE_RATIO`,
`PB_RATIO`, `MARKET_CAP`, `PRICE_TREND_30D`, or JSON `null`. State that
`MARKET_QUOTE` requires one of the eight strings and all other categories require
`null`. Let `RequiredFact.model_validate` enforce the same rule after JSON
parsing.

- [ ] **Step 5: Normalize explicit price-query facts before investigation**

Add a pure helper:

```python
def _constrain_market_facts(
    decree_text: str,
    facts: tuple[RequiredFact, ...],
) -> tuple[RequiredFact, ...]:
    requested = requested_market_metrics(decree_text)
    if not requested:
        return facts
    allowed = set(requested)
    selected = tuple(
        fact
        for fact in facts
        if fact.category is FactCategory.MARKET_QUOTE
        and fact.market_metric in allowed
    )
    if selected:
        return selected
    raise EvidenceProtocolError("data_gap_invalid")
```

Call this only after the model response has passed JSON/schema validation and only
for an explicit market quote intent. It must not modify non-market investigations.
For price-only intent, if multiple `LAST_PRICE` facts describe A- and H-shares,
retain the CN/A-share fact and drop the HK fact; if no fact is safely identifiable
as mainland A-share, fail closed rather than inventing one.

- [ ] **Step 6: Prove partial evidence remains usable**

Use a fake coordinator returning a `PARTIAL` pack with a valid `LAST_PRICE`
evidence and one unresolved optional fact. Assert the resumed bureau response may
cite the price evidence and is not converted to `UNAVAILABLE`. This should use the
existing coordinator status behavior rather than adding a new status enum.

- [ ] **Step 7: Run protocol and market-intent regressions**

Run:

```powershell
cd backend
.venv\Scripts\python.exe -m pytest tests/test_market_intent.py tests/test_agent_evidence_protocol.py tests/test_bureaus_agent.py tests/test_ministries_agent.py -q
.venv\Scripts\python.exe -m ruff check app/agents/market_intent.py app/agents/evidence_protocol.py tests/test_market_intent.py tests/test_agent_evidence_protocol.py
```

Expected: all selected tests and Ruff pass.

- [ ] **Step 8: Commit checkpoint only if separately authorized**

```powershell
git add backend/app/agents/market_intent.py backend/app/agents/evidence_protocol.py backend/tests/test_market_intent.py backend/tests/test_agent_evidence_protocol.py
git commit -m "fix(agents): constrain A-share quote fact scope"
```

---

### Task 6: Failure Semantics, Documentation, and End-to-End Verification

**Files:**
- Modify: `backend/app/jinyiwei/sources/mcp.py`
- Modify: `backend/tests/test_jinyiwei_coordinator.py`
- Modify: `backend/AGENTS.md`
- Modify: `ARCHITECTURE.md`
- Modify: `docs/product/tasks/2026-07-24-stock-decree-routing-recovery.md`
- Create: `docs/decisions/0024-mainland-a-share-identity-and-provider-adapters.md`
- Modify: `scripts/check_harness.mjs`

**Interfaces:**
- Consumes all previous tasks.
- Produces documented stable internal errors and complete offline/live evidence.

- [ ] **Step 1: Add coordinator-level regression cases**

Add exact scenarios:

```python
def test_price_evidence_resolves_when_nonrequired_metric_is_absent():
    pack = _investigate_with_price_document_and_no_optional_document()
    assert pack.status is EvidencePackStatus.RESOLVED
    assert pack.resolved_facts == ("BYD_LAST_PRICE",)


@pytest.mark.parametrize(
    ("source_error", "expected_status"),
    [
        ("instrument_not_found", EvidencePackStatus.UNAVAILABLE),
        ("instrument_ambiguous", EvidencePackStatus.UNAVAILABLE),
        ("provider_capability_missing", EvidencePackStatus.UNAVAILABLE),
        ("source_unavailable", EvidencePackStatus.UNAVAILABLE),
        ("market_out_of_scope", EvidencePackStatus.UNAVAILABLE),
    ],
)
def test_identity_failures_are_safe_and_do_not_create_evidence(
    source_error, expected_status
):
    pack = _investigate_with_failed_source(source_error)
    assert pack.status is expected_status
    assert pack.evidence_by_fact["BYD_LAST_PRICE"] == ()
```

Assert source attempts retain only the stable error code and never include result
payloads or credentials. Implement
`_investigate_with_price_document_and_no_optional_document()` with the existing
fixed `SourceDocument` and fake-source helpers. Implement
`_investigate_with_failed_source(error)` with a `SourceResult` containing no
documents and one failed `SourceAttempt(error=error)`.

- [ ] **Step 2: Run coordinator tests and verify expected behavior**

Run:

```powershell
cd backend
.venv\Scripts\python.exe -m pytest tests/test_jinyiwei_coordinator.py -q
```

Expected: all tests pass after Tasks 1–5; if any new test fails, fix only the
stable error propagation or required/optional fact classification demonstrated by
that failure.

- [ ] **Step 3: Record the architecture boundary**

ADR 0024 must record:

- the canonical `InstrumentRef` is provider-neutral;
- provider symbols live only in MCP mapping/adapter results;
- supported first-stage market scope is SSE/SZSE/BSE A-shares;
- Tencent is approved only for proven SSE/SZSE patterns;
- BSE requires a separately proven provider capability;
- identity cache lifetime is independent from quote freshness;
- ambiguity fails closed;
- all MCP tools remain read-only.

Update `ARCHITECTURE.md` and `backend/AGENTS.md` with the same operative rules.
Update the product task implementation plan and acceptance criteria without
marking implementation complete before fresh verification.

- [ ] **Step 4: Extend harness static checks**

Add checks proving:

- the design, plan, and ADR exist;
- `InstrumentRef` and `MarketMetric` are present;
- no company-to-code literal mapping such as `"比亚迪": "sz002594"` exists in
  production Python or YAML;
- Tencent configuration does not claim a BSE pattern before a real approval is
  registered.

Run:

```powershell
node scripts/check_harness.mjs
node scripts/check_harness.mjs --self-test
node .agents/hooks/check-harness.mjs --self-test
node .agents/skills/product-flow/scripts/run-claude-delivery.mjs --self-test
```

Expected: all four commands pass.

- [ ] **Step 5: Run focused and full offline verification**

Run without setting external-network or credential variables:

```powershell
cd backend
.venv\Scripts\python.exe -m pytest tests/test_jinyiwei_instruments.py tests/test_jinyiwei_mcp_registry.py tests/test_jinyiwei_mcp_mapping.py tests/test_jinyiwei_mcp_source.py tests/test_jinyiwei_coordinator.py tests/test_agent_evidence_protocol.py tests/test_market_intent.py -q
.venv\Scripts\python.exe -m pytest
.venv\Scripts\python.exe -m ruff check .
cd ..
git diff --check
```

Expected: every command exits 0. Record exact test counts and warnings in the
product task; do not describe old results as fresh evidence.

- [ ] **Step 6: Perform an independent diff review**

Review the entire diff against:

- no provider branching outside MCP configuration/mapping;
- no hard-coded company mapping;
- bounded name searches;
- no raw response or credential logging;
- BSE support is not claimed without evidence;
- non-market evidence behavior is unchanged;
- `departments` routing remains outside scope.

Resolve all correctness findings, then rerun the affected focused tests and full
Ruff.

- [ ] **Step 7: Real read-only verification only after separate authorization**

With an administrator present and after offline gates pass:

```powershell
cd backend
$env:JINYIWEI_EXTERNAL_NETWORK_ENABLED = "true"
try {
  .venv\Scripts\python.exe -m app.jinyiwei.mcp.oauth status --server westock
  .venv\Scripts\python.exe -m app.jinyiwei.mcp.smoke --server westock --tool data_quote --query 比亚迪 --jurisdiction CN --credential-source local
} finally {
  Remove-Item Env:JINYIWEI_EXTERNAL_NETWORK_ENABLED -ErrorAction SilentlyContinue
}
```

Expected redacted output has `status` equal to `valid` for OAuth, `status` equal
to `ok` for the quote, `security_code` equal to `sz002594`, a non-null ISO-8601
`market_time`, and a positive integer `response_bytes`. The output shape is:

```json
{"server":"westock","status":"valid"}
{"server":"westock","tool":"data_quote","security_code":"sz002594","market_time":"2026-07-23T16:00:00Z","status":"ok","response_bytes":2468}
```

The timestamp and byte count shown are the prior successful sample; the fresh run
may differ and must be recorded exactly rather than compared to those two values.

Run a separately approved, redacted BSE capability probe. Record only supported or
unsupported status; never add a BSE pattern based on an assumption.

- [ ] **Step 8: Restart local backend and verify `/study` only after authorization**

Start the backend with explicit local credential and network gates, then submit:

```text
帮我看看比亚迪的股票价格
```

Expected:

- the investigation request contains one mainland `LAST_PRICE` fact;
- MCP resolution ends at `sz002594`;
- evidence count is at least one;
- the evidence has positive price, `CNY`, source, and valid market time;
- the response no longer says data is insufficient because of legal-name mapping;
- any unrelated `departments` failure remains a separately reported known issue.

- [ ] **Step 9: Final commit or push only if separately authorized**

Before staging, show the exact scoped file list and exclude runtime databases,
credentials, logs, `.env.example`, caches, and unrelated user changes. Obtain
explicit authorization for that literal list. The proposed commit message is
`feat(jinyiwei): resolve mainland A-share quotes`; the proposed push target for
this worktree is:

```powershell
git push origin harness-only
```
