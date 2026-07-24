# Jinyiwei Local OAuth and Market Freshness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the local `/study` runtime explicitly reuse the administrator-authorized OAuth credential and adopt the latest available market quote without misrepresenting a closed-market price as a live tick.

**Architecture:** Add one fail-closed runtime credential selector whose default remains `env` and whose `local` mode uses the existing encrypted DPAPI store. Centralize freshness evaluation so MCP candidate selection and coordinator adoption apply the same rule: ordinary facts remain `as_of`-fresh, while freshly retrieved professional market quotes may represent the latest available close and must retain their source timestamp.

**Tech Stack:** Python 3.11+, FastAPI, Pydantic, pytest, existing pinned HTTPS/MCP/OAuth modules.

## Global Constraints

- `JINYIWEI_MCP_CREDENTIAL_SOURCE` accepts only `env` or `local`; missing means `env`.
- Local credentials remain under `backend/data/credentials/`, encrypted by current-user DPAPI, and are never copied to logs, YAML, Git, or response bodies.
- Real external access still requires the independent `JINYIWEI_EXTERNAL_NETWORK_ENABLED=true` gate.
- Market evidence always retains its actual `as_of`; the policy changes adoption semantics, not the displayed market timestamp.
- Non-market facts and Shiguan evidence keep the existing strict `as_of` freshness semantics.
- No provider-name branch is added to coordinator or freshness code.

---

### Task 1: Explicit runtime credential source

**Files:**
- Create: `backend/app/jinyiwei/mcp/runtime.py`
- Modify: `backend/app/agents/evidence_protocol.py`
- Test: `backend/tests/test_jinyiwei_mcp_runtime.py`

**Interfaces:**
- Produces: `build_runtime_credential_provider(*, environ=None, credential_store=None) -> CredentialProvider`.
- Consumes: existing `EnvCredentialProvider`, `StoredOAuthCredentialProvider`, and `OAuthCredentialStore`.

- [ ] **Step 1: Write failing tests**

```python
def test_runtime_credentials_default_to_env() -> None:
    provider = build_runtime_credential_provider(environ={})
    assert isinstance(provider, EnvCredentialProvider)


def test_runtime_credentials_use_injected_store_only_in_explicit_local_mode() -> None:
    store = FakeStore()
    provider = build_runtime_credential_provider(
        environ={"JINYIWEI_MCP_CREDENTIAL_SOURCE": "local"},
        credential_store=store,
    )
    assert isinstance(provider, StoredOAuthCredentialProvider)


@pytest.mark.parametrize("value", ["LOCAL", "file", "auto", " local "])
def test_runtime_credentials_reject_unknown_or_noncanonical_modes(value: str) -> None:
    with pytest.raises(McpCredentialError, match="credential_source_invalid"):
        build_runtime_credential_provider(
            environ={"JINYIWEI_MCP_CREDENTIAL_SOURCE": value}
        )
```

- [ ] **Step 2: Verify RED**

Run: `backend\.venv\Scripts\python.exe -m pytest backend/tests/test_jinyiwei_mcp_runtime.py -q`

Expected: collection/import failure because `app.jinyiwei.mcp.runtime` does not exist.

- [ ] **Step 3: Implement the selector**

```python
LOCAL_CREDENTIAL_SOURCE_ENV = "JINYIWEI_MCP_CREDENTIAL_SOURCE"


def build_runtime_credential_provider(*, environ=None, credential_store=None):
    selected = (os.environ if environ is None else environ).get(
        LOCAL_CREDENTIAL_SOURCE_ENV, "env"
    )
    if selected == "env":
        return EnvCredentialProvider(environ=environ)
    if selected != "local":
        raise McpCredentialError("credential_source_invalid")
    store = credential_store or OAuthCredentialStore(default_credential_store_path())
    return StoredOAuthCredentialProvider(store=store, approved_endpoints={})
```

Wire `build_default_evidence_session()` to this selector. Construction stays lazy and performs no credential or network I/O.

- [ ] **Step 4: Verify GREEN**

Run: `backend\.venv\Scripts\python.exe -m pytest backend/tests/test_jinyiwei_mcp_runtime.py backend/tests/test_agent_evidence_protocol.py -q`

Expected: all selected tests pass.

### Task 2: Stable credential and network diagnostics

**Files:**
- Modify: `backend/app/jinyiwei/mcp/client.py`
- Modify: `backend/app/jinyiwei/sources/mcp.py`
- Test: `backend/tests/test_jinyiwei_mcp_client.py`
- Test: `backend/tests/test_jinyiwei_mcp_source.py`

**Interfaces:**
- Produces stable errors `credential_unavailable`, `credential_source_invalid`, and `external_network_disabled`.
- Does not expose credential values, endpoints beyond approved configuration, request headers, or response bodies.

- [ ] **Step 1: Write failing tests**

```python
def test_discovery_wraps_credential_failure_as_stable_client_error() -> None:
    client = McpClient(credentials=FailingCredentialProvider(), registry=registry())
    with pytest.raises(McpClientError, match="^credential_unavailable$"):
        client.discover(server())


def test_mcp_source_preserves_safe_credential_failure_reason() -> None:
    result = source(client=CredentialFailingClient()).fetch(query())
    assert result.attempt.error == "credential_unavailable"
    assert result.documents == ()
```

- [ ] **Step 2: Verify RED**

Run: `backend\.venv\Scripts\python.exe -m pytest backend/tests/test_jinyiwei_mcp_client.py backend/tests/test_jinyiwei_mcp_source.py -q`

Expected: raw `McpCredentialError` escapes the client or the source reports `fact_unavailable`.

- [ ] **Step 3: Implement minimal wrapping and classification**

Catch `McpCredentialError` at the client credential boundary and rethrow `McpClientError` with the stable code. Add only approved operational codes to `_CLIENT_ERROR_CODES`; keep unknown exceptions mapped to `fact_unavailable`.

- [ ] **Step 4: Verify GREEN**

Run the same command and expect all selected tests to pass.

### Task 3: Latest-available market freshness

**Files:**
- Create: `backend/app/jinyiwei/freshness.py`
- Modify: `backend/app/jinyiwei/sources/mcp.py`
- Modify: `backend/app/jinyiwei/coordinator.py`
- Test: `backend/tests/test_jinyiwei_freshness.py`
- Test: `backend/tests/test_jinyiwei_mcp_source.py`
- Test: `backend/tests/test_jinyiwei_coordinator.py`

**Interfaces:**
- Produces `is_evidence_fresh(*, as_of, retrieved_at, request, fact_key, source_type, now) -> bool`.
- Market exception applies only to `MARKET_QUOTE` from `MCP` or `PUBLIC_API`.

- [ ] **Step 1: Write failing tests**

```python
def test_freshly_retrieved_market_close_is_latest_available_after_close() -> None:
    assert is_evidence_fresh(
        as_of="2026-07-23T07:00:00Z",
        retrieved_at="2026-07-23T14:55:00Z",
        request=market_request(max_age_seconds=300),
        fact_key="byd_stock_price",
        source_type=SourceType.MCP,
        now=datetime(2026, 7, 23, 14, 56, tzinfo=UTC),
    )


def test_old_retrieval_never_becomes_fresh_because_market_is_closed() -> None:
    assert not is_evidence_fresh(
        as_of="2026-07-23T07:00:00Z",
        retrieved_at="2026-07-23T14:40:00Z",
        request=market_request(max_age_seconds=300),
        fact_key="byd_stock_price",
        source_type=SourceType.MCP,
        now=datetime(2026, 7, 23, 14, 56, tzinfo=UTC),
    )


def test_shiguan_market_snapshot_keeps_strict_as_of_freshness() -> None:
    assert not is_evidence_fresh(
        as_of="2026-07-23T07:00:00Z",
        retrieved_at="2026-07-23T14:55:00Z",
        request=market_request(max_age_seconds=300),
        fact_key="byd_stock_price",
        source_type=SourceType.SHIGUAN,
        now=datetime(2026, 7, 23, 14, 56, tzinfo=UTC),
    )
```

Also add source and coordinator integration tests proving both layers adopt the same freshly retrieved close and reject an old retrieval.

- [ ] **Step 2: Verify RED**

Run: `backend\.venv\Scripts\python.exe -m pytest backend/tests/test_jinyiwei_freshness.py backend/tests/test_jinyiwei_mcp_source.py backend/tests/test_jinyiwei_coordinator.py -q`

Expected: import failure for the new shared policy or the close remains `fact_stale`.

- [ ] **Step 3: Implement the shared rule**

For ordinary evidence, compare `as_of` with `max_age_seconds` exactly as today. For external market quotes, compare the freshly executed source retrieval time with `max_age_seconds`, reject future timestamps and `not_before` violations, and cap the market observation age at 14 days. This represents “latest available price queried now,” while preserving `as_of` for honest UI disclosure.

- [ ] **Step 4: Verify GREEN**

Run the same command and expect all selected tests to pass.

### Task 4: Documentation, ADR, and live verification

**Files:**
- Create: `docs/decisions/0022-explicit-local-mcp-runtime-and-market-freshness.md`
- Modify: `ARCHITECTURE.md`
- Modify: `backend/AGENTS.md`
- Modify: `scripts/check_harness.mjs`

**Interfaces:**
- Documents exact local startup environment and production-default behavior.

- [ ] **Step 1: Record the decision**

The ADR must contain `Status`, `Context`, `Decision`, `Consequences`, and `Verification`, including the distinction between retrieval freshness and market observation time.

- [ ] **Step 2: Run offline gates**

```powershell
cd backend
.venv\Scripts\python.exe -m pytest
.venv\Scripts\python.exe -m ruff check .
cd ..
node scripts/check_harness.mjs
node scripts/check_harness.mjs --self-test
node .agents/hooks/check-harness.mjs --self-test
node .agents/skills/product-flow/scripts/run-claude-delivery.mjs --self-test
git diff --check
```

Expected: all commands exit zero.

- [ ] **Step 3: Restart local services explicitly**

Start the backend with:

```powershell
$env:JINYIWEI_EXTERNAL_NETWORK_ENABLED = "true"
$env:JINYIWEI_MCP_CREDENTIAL_SOURCE = "local"
.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

The frontend remains on `http://127.0.0.1:3000`.

- [ ] **Step 4: Verify the real read-only path**

Issue the BYD price decree or run the bounded read-only smoke. Confirm the investigation records `data_search` and `data_minute`/`data_quote` audits, evidence count is nonzero, `as_of` is the actual market time, and no token, header, account data, or response body appears in logs.

## Self-Review

- Spec coverage: explicit local OAuth, independent network gate, closed-market semantics, safe diagnostics, docs, and real verification are each assigned.
- Placeholder scan: no deferred implementation placeholders remain.
- Type consistency: both source selection and coordinator adoption consume the same `is_evidence_fresh` interface.
- Execution mode: the user already approved implementation in this active session, so execution proceeds inline with TDD checkpoints.
