# 锦衣卫史馆优先与通用 MCP 补证 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让锦衣卫先使用满足覆盖及时效要求的史馆业务证据，只对缺失或过期事实调用管理员批准的只读 MCP，并把原司最终采用的证据按版本归档回史馆。

**Architecture:** 在现有 `InvestigationCoordinator` 的史馆优先顺序上增加显式数据范围和历史证据通道，再以通用 MCP Registry、凭据提供器、受限 Streamable HTTP 客户端和确定性结果映射实现外部补证。MCP 输出仍进入现有验证、冻结、采用与史馆归档链路；核心代码不感知腾讯自选股等具体提供商。

**Tech Stack:** Python 3.11+、Pydantic v2、SQLite、FastAPI、PyYAML、标准库 `http.client`/TLS、pytest、ruff、现有 LangGraph Agent 协议。

## Global Constraints

- 史馆必须先于 MCP 查询；MCP 只接收史馆未覆盖或已过期的事实槽位。
- 锦衣卫只调用管理员批准的 `READ_ONLY` 工具；任何写工具永久拒绝。
- 普通用户和模型不能添加 MCP、提供 URL、选择凭据或扩大工具权限。
- MCP 可连接内部业务系统、专业数据服务或公共来源；通达信明确不接入。
- 腾讯自选股使用系统专用共享服务账号，普通用户不登录。
- Token、Cookie、授权头不得进入数据库业务字段、日志、证据、缓存键、异常文本或模型上下文。
- 新证据追加归档，不覆盖史馆旧版本；未被原司采用的调查结果不进入史馆。
- 常规测试必须完全离线；真实腾讯 MCP 验收是显式开启、无副作用且只读的独立步骤。
- 不提交密钥、真实环境文件、运行态数据库或用户数据。
- 未获得用户对具体 Git 动作的授权前，不执行 `git add` 或 `git commit`。

## File Structure

- Modify `backend/app/jinyiwei/models.py`: 增加数据范围、MCP 来源类型和历史证据分组契约。
- Modify `backend/app/agents/evidence_protocol.py`: 修复空事实声明绕过 `NEEDS_DATA` 的问题，并序列化历史证据。
- Modify `backend/app/agents/bureaus/agent.py`: 提示词要求声明事实依赖和数据范围。
- Modify `backend/app/jinyiwei/db.py`: 迁移事实槽位及证据元数据的规范化列。
- Modify `backend/app/jinyiwei/storage.py`: 持久化和重建新增字段。
- Modify `backend/app/jinyiwei/coordinator.py`: 史馆优先、历史证据保留、只路由未满足事实。
- Modify `backend/app/jinyiwei/verification.py`: 区分当前可用证据和历史背景证据。
- Create `backend/app/jinyiwei/mcp/contracts.py`: MCP 服务、工具、批准版本和调用结果的不可变契约。
- Create `backend/app/jinyiwei/mcp/registry.py`: 加载并验证管理员批准的 MCP 配置，执行能力匹配。
- Create `backend/app/jinyiwei/mcp/credentials.py`: 解析秘密引用、内存刷新 OAuth、生成敏感请求头。
- Create `backend/app/jinyiwei/mcp/client.py`: 实现 MCP 初始化、通知、`tools/list` 和 `tools/call`。
- Create `backend/app/jinyiwei/mcp/mapping.py`: 用受限字段路径把 MCP JSON 结果确定性映射为来源文档。
- Create `backend/app/jinyiwei/mcp/smoke.py`: 显式授权下执行脱敏、只读的真实 MCP 冒烟。
- Create `backend/app/jinyiwei/sources/mcp.py`: 将通用 MCP 能力暴露为现有 `EvidenceSource`。
- Modify `backend/app/jinyiwei/network.py`: 在保留 DNS/对端固定和总时限的前提下支持受限 POST。
- Modify `backend/pyproject.toml`: 将运行时 JSON Schema 校验依赖移入主依赖。
- Create `backend/config/jinyiwei_mcp.yaml`: 只含非秘密的 MCP 与获批工具配置，腾讯源默认关闭。
- Modify `backend/app/shiguan/models.py`: 归档快照保存数据范围和 MCP 来源元数据。
- Modify `backend/app/shiguan/archive_decree.py`: 仅将明确采用的新增证据追加归档。
- Modify `backend/AGENTS.md`, `ARCHITECTURE.md`, `docs/decisions/0018-central-jinyiwei-evidence-service.md`: 同步运行、安全和架构边界。

---

### Task 1: 严格事实依赖和数据范围契约

**Files:**
- Modify: `backend/app/jinyiwei/models.py`
- Modify: `backend/app/agents/evidence_protocol.py`
- Modify: `backend/app/agents/bureaus/agent.py`
- Test: `backend/tests/test_jinyiwei_models.py`
- Test: `backend/tests/test_agent_evidence_protocol.py`
- Test: `backend/tests/test_bureaus_agent.py`

**Interfaces:**
- Produces: `DataScope`, `RequiredFact.data_scope`, `SourceType.MCP`, `EvidencePack.historical_evidence_by_fact`。
- Produces: `ReadyEnvelope.factual_claims` 必须覆盖意见中的结构化事实依赖；存在未获支持的外部事实时拒绝 `READY`。
- Consumes: 现有 `FactCategory`、`DataGapDraft`、`AgentEvidenceSession`。

- [ ] **Step 1: 写失败测试，锁定数据范围和空声明绕过**

```python
def test_required_fact_requires_explicit_data_scope() -> None:
    fact = RequiredFact(
        key="quote",
        description="比亚迪当前股价",
        category="MARKET_QUOTE",
        data_scope="EXTERNAL_PUBLIC",
        subject="比亚迪",
        jurisdiction="CN",
    )
    assert fact.data_scope is DataScope.EXTERNAL_PUBLIC


def test_ready_cannot_hide_external_fact_dependency_with_empty_claims() -> None:
    with pytest.raises(EvidenceProtocolError, match="unsupported_factual_dependency"):
        parse_ready_for_test(
            '{"status":"READY","result":{"opinion":"比亚迪现价为 300 元",'
            '"factual_claims":[],"fact_basis":"NOT_REQUIRED"},"adopted_evidence_ids":[]}',
            prompt="看看比亚迪股票价格",
            known_evidence_ids=(),
        )
```

- [ ] **Step 2: 运行失败测试**

Run: `cd backend; .venv\Scripts\python.exe -m pytest tests/test_jinyiwei_models.py tests/test_agent_evidence_protocol.py tests/test_bureaus_agent.py -q`

Expected: FAIL because `DataScope`/`data_scope` do not exist and the current READY parser accepts the empty claim list.

- [ ] **Step 3: 实现最小严格契约**

```python
class DataScope(StrEnum):
    INTERNAL_BUSINESS = "INTERNAL_BUSINESS"
    EXTERNAL_PUBLIC = "EXTERNAL_PUBLIC"
    HYBRID = "HYBRID"


class SourceType(StrEnum):
    SHIGUAN = "SHIGUAN"
    MCP = "MCP"
    PUBLIC_API = "PUBLIC_API"
    PUBLIC_WEB = "PUBLIC_WEB"


class RequiredFact(_FrozenContract):
    key: StrictStr
    description: StrictStr
    category: FactCategory
    data_scope: DataScope
    subject: StrictStr
    jurisdiction: StrictStr | None = None
    expected_unit: StrictStr | None = None
    expected_shape: StrictStr | None = None
```

在 `request_fingerprint` 中加入 `data_scope`；在 `EvidencePack` 中加入：

```python
historical_evidence_by_fact: Mapping[StrictStr, tuple[EvidenceItem, ...]]
```

将司级提示词固定为：所有依赖当前外部或当前业务系统状态的意见必须输出 `NEEDS_DATA`；
`READY` 的 `factual_claims` 不能用空列表表达“没有依赖”。使用一个确定性的依赖声明字段，
要求模型逐项声明 `NORMATIVE`、`USER_PROVIDED`、`ARCHIVED` 或 `CITED`，解析器拒绝意见中出现
但声明中不存在的数值、日期、价格、状态或“当前/最新”事实表达。

- [ ] **Step 4: 运行聚焦测试并更新所有固定 fixture 的 `data_scope`**

Run: `cd backend; .venv\Scripts\python.exe -m pytest tests/test_jinyiwei_models.py tests/test_agent_evidence_protocol.py tests/test_bureaus_agent.py tests/test_ministries_agent.py tests/test_junjichu_agent.py -q`

Expected: PASS; 所有旧 fixture 显式声明数据范围，不依赖默认值。

- [ ] **Step 5: 审查检查点**

Run: `git diff --check -- backend/app/jinyiwei/models.py backend/app/agents/evidence_protocol.py backend/app/agents/bureaus/agent.py backend/tests`

Expected: no output. 若用户已明确授权提交，再提交 `fix: require explicit evidence dependencies`。

### Task 2: 规范化存储事实范围和证据来源元数据

**Files:**
- Modify: `backend/app/jinyiwei/db.py`
- Modify: `backend/app/jinyiwei/storage.py`
- Modify: `backend/app/jinyiwei/read_models.py`
- Test: `backend/tests/test_shiguan_migrations.py`
- Test: `backend/tests/test_jinyiwei_storage.py`
- Test: `backend/tests/test_jinyiwei_api.py`

**Interfaces:**
- Consumes: Task 1 的 `DataScope`、`SourceType.MCP` 和历史证据分组。
- Produces: schema version 2；`requested_fact_slots(category, data_scope, subject, jurisdiction)`；证据详情可重建 MCP 元数据。

- [ ] **Step 1: 写失败的迁移与往返测试**

```python
def test_schema_v2_normalizes_required_fact_identity(tmp_path) -> None:
    path = tmp_path / "jinyiwei.sqlite3"
    initialize_database(path)
    columns = table_columns(path, "requested_fact_slots")
    assert {"category", "data_scope", "subject", "jurisdiction"} <= columns
    assert user_version(path) == 2


def test_mcp_evidence_round_trip_preserves_source_metadata(tmp_path) -> None:
    pack = pack_with_mcp_evidence(data_scope="EXTERNAL_PUBLIC")
    store_evidence_pack(pack, db_path=tmp_path / "jinyiwei.sqlite3")
    restored = get_evidence_pack(pack.pack_id, db_path=tmp_path / "jinyiwei.sqlite3")
    item = restored.evidence_by_fact["quote"][0]
    assert item.source_type is SourceType.MCP
    assert item.coverage == ("CN", "MARKET_QUOTE")
```

- [ ] **Step 2: 运行失败测试**

Run: `cd backend; .venv\Scripts\python.exe -m pytest tests/test_shiguan_migrations.py tests/test_jinyiwei_storage.py tests/test_jinyiwei_api.py -q`

Expected: FAIL because schema v1 omits the normalized fields and reconstruction does not know historical groups.

- [ ] **Step 3: 实现幂等 schema v1→v2 迁移和严格往返**

将 `initialize_database()` 接受版本 `0, 1, 2`，在同一 `BEGIN IMMEDIATE` 中为
`requested_fact_slots` 增加四个字段并从 `data_gap_requests.canonical_json` 回填；无法验证的旧行
必须回滚并抛出 `sqlite3.DatabaseError("invalid legacy fact slot")`。新写入同时填规范化列和
canonical JSON。历史证据分组继续以 canonical pack 为权威，但读 API 必须完整重建。

- [ ] **Step 4: 运行迁移、存储和 API 测试**

Run: `cd backend; .venv\Scripts\python.exe -m pytest tests/test_shiguan_migrations.py tests/test_jinyiwei_storage.py tests/test_jinyiwei_api.py -q`

Expected: PASS, including fresh DB, v1 migration, repeated initialization and rollback cases.

- [ ] **Step 5: 审查检查点**

Run: `git diff --check -- backend/app/jinyiwei/db.py backend/app/jinyiwei/storage.py backend/app/jinyiwei/read_models.py backend/tests`

Expected: no output. 若获授权，提交 `feat: persist evidence scope metadata`。

### Task 3: 强制史馆优先并保留过期历史背景

**Files:**
- Modify: `backend/app/jinyiwei/coordinator.py`
- Modify: `backend/app/jinyiwei/verification.py`
- Modify: `backend/app/jinyiwei/sources/shiguan.py`
- Test: `backend/tests/test_jinyiwei_coordinator.py`
- Test: `backend/tests/test_jinyiwei_verification.py`
- Test: `backend/tests/test_jinyiwei_shiguan_source.py`

**Interfaces:**
- Consumes: Task 1 的 `historical_evidence_by_fact`。
- Produces: `ArchiveResolution(current, historical, unresolved)`；只有 `unresolved` 进入后续来源。
- Preserves: 一个旨意的绝对 deadline、抽取预算、缓存与稳定错误码。

- [ ] **Step 1: 写失败的史馆短路和过期补全测试**

```python
def test_fresh_archive_fact_prevents_all_external_calls() -> None:
    coordinator, mcp = coordinator_with_sources(shiguan_items=(fresh_archive_item(),))
    pack = coordinator.investigate(request_for("current_status"), department="户部", matter_type="客户")
    assert pack.resolved_facts == ("current_status",)
    assert mcp.calls == []


def test_stale_archive_is_background_and_only_stale_fact_reaches_mcp() -> None:
    coordinator, mcp = coordinator_with_sources(shiguan_items=(stale_archive_item("stock"),))
    pack = coordinator.investigate(two_fact_request(), department="户部", matter_type="库存")
    assert tuple(pack.historical_evidence_by_fact) == ("stock",)
    assert mcp.calls[0].unresolved_fact_keys == ("stock",)
```

- [ ] **Step 2: 运行失败测试**

Run: `cd backend; .venv\Scripts\python.exe -m pytest tests/test_jinyiwei_coordinator.py tests/test_jinyiwei_verification.py tests/test_jinyiwei_shiguan_source.py -q`

Expected: FAIL because stale史馆 evidence is currently discarded and no explicit archive-resolution result exists.

- [ ] **Step 3: 实现史馆阶段与外部阶段的硬边界**

```python
@dataclass(frozen=True, slots=True)
class ArchiveResolution:
    current: tuple[EvidenceItem, ...]
    historical: tuple[EvidenceItem, ...]
    unresolved_fact_keys: tuple[str, ...]
```

协调器必须单独执行 `SourceType.SHIGUAN`，验证后形成 `ArchiveResolution`；随后构造新的
`SourceQuery`，其 `unresolved_fact_keys` 仅包含史馆未覆盖或过期槽位。史馆过期候选进入
`historical_evidence_by_fact`，不计入 `resolved_facts`。外部来源返回的过期数据仍拒绝，不进入
历史背景。

- [ ] **Step 4: 运行协调器回归测试**

Run: `cd backend; .venv\Scripts\python.exe -m pytest tests/test_jinyiwei_coordinator.py tests/test_jinyiwei_verification.py tests/test_jinyiwei_shiguan_source.py tests/test_agent_evidence_protocol.py -q`

Expected: PASS; fresh archive short-circuits, stale archive triggers only scoped补证, evidence message separates `historical_context` and `current_evidence`.

- [ ] **Step 5: 审查检查点**

Run: `git diff --check -- backend/app/jinyiwei/coordinator.py backend/app/jinyiwei/verification.py backend/app/jinyiwei/sources/shiguan.py backend/tests`

Expected: no output. 若获授权，提交 `feat: enforce archive-first evidence resolution`。

### Task 4: 通用 MCP 注册、发现和批准契约

**Files:**
- Create: `backend/app/jinyiwei/mcp/__init__.py`
- Create: `backend/app/jinyiwei/mcp/contracts.py`
- Create: `backend/app/jinyiwei/mcp/registry.py`
- Create: `backend/config/jinyiwei_mcp.yaml`
- Modify: `backend/pyproject.toml`
- Test: `backend/tests/test_jinyiwei_mcp_registry.py`

**Interfaces:**
- Produces: `McpServerConfig`, `McpToolApproval`, `McpRegistry.tools_for(facts)`。
- Produces: `approval_fingerprint(server, discovered_tool_schema)`；不一致即 `source_schema_changed`。
- Consumes: `RequiredFact`、`FactCategory`、`DataScope`。

- [ ] **Step 1: 写失败的注册和批准测试**

```python
def test_registry_returns_only_enabled_approved_read_tools() -> None:
    registry = McpRegistry.from_mapping(config_fixture())
    tools = registry.tools_for((quote_fact(),))
    assert [tool.tool_name for tool in tools] == ["data_quote"]


def test_discovered_schema_change_invalidates_approval() -> None:
    approval = approved_quote_tool()
    changed = {"name": "data_quote", "inputSchema": {"type": "object", "required": ["ticker"]}}
    assert approval.accepts_discovered_tool(changed) is False


def test_write_capability_is_rejected_even_when_named_query() -> None:
    with pytest.raises(McpRegistryError, match="tool_effect_not_read_only"):
        McpToolApproval(effect="WRITE", **approval_fields())
```

- [ ] **Step 2: 运行失败测试**

Run: `cd backend; .venv\Scripts\python.exe -m pytest tests/test_jinyiwei_mcp_registry.py -q`

Expected: FAIL because the MCP package does not exist.

- [ ] **Step 3: 实现冻结配置和能力匹配**

```python
class ToolEffect(StrEnum):
    READ_ONLY = "READ_ONLY"


class McpSourceKind(StrEnum):
    INTERNAL_SYSTEM = "INTERNAL_SYSTEM"
    PROFESSIONAL_DATA = "PROFESSIONAL_DATA"
    PUBLIC_INFORMATION = "PUBLIC_INFORMATION"


class McpRegistry:
    def __init__(self, approvals: tuple[McpToolApproval, ...]) -> None:
        self._approvals = approvals

    @classmethod
    def from_mapping(cls, payload: Mapping[str, object]) -> "McpRegistry":
        raw_tools = payload.get("tools")
        if not isinstance(raw_tools, list):
            raise McpRegistryError("invalid_tools_config")
        return cls(tuple(McpToolApproval.model_validate(item) for item in raw_tools))

    def tools_for(
        self, facts: tuple[RequiredFact, ...]
    ) -> tuple[McpToolApproval, ...]:
        return tuple(
            approval
            for approval in self._approvals
            if approval.enabled
            and approval.effect is ToolEffect.READ_ONLY
            and any(approval.matches_fact(fact) for fact in facts)
        )

    def verify_discovery(
        self, server_id: str, tools: tuple[DiscoveredTool, ...]
    ) -> None:
        discovered = {tool.name: tool for tool in tools}
        for approval in self._approvals:
            if approval.server_id != server_id:
                continue
            current = discovered.get(approval.tool_name)
            if current is None or not approval.accepts_discovered_tool(current):
                raise McpRegistryError("source_schema_changed")
```

实现代码不得接受模型提供的配置或 URL。`backend/config/jinyiwei_mcp.yaml` 只登记腾讯服务器、
能力和 `credential_ref`，默认 `enabled: false`；不包含 Token。审批哈希使用规范 JSON 和 SHA-256。
把 `jsonschema>=4.17` 从 dev-only 移入主 `dependencies`，因为运行时必须验证 MCP 参数和响应；
不得新增第二套 HTTP 客户端依赖。

- [ ] **Step 4: 运行 registry 测试**

Run: `cd backend; .venv\Scripts\python.exe -m pytest tests/test_jinyiwei_mcp_registry.py -q`

Expected: PASS for duplicate IDs, unknown categories, non-HTTPS URL, private target without internal approval, changed schema and deterministic ordering.

- [ ] **Step 5: 审查检查点**

Run: `git diff --check -- backend/app/jinyiwei/mcp backend/config/jinyiwei_mcp.yaml backend/tests/test_jinyiwei_mcp_registry.py`

Expected: no output. 若获授权，提交 `feat: add approved mcp capability registry`。

### Task 5: 凭据隔离和受限 MCP Streamable HTTP 客户端

**Files:**
- Modify: `backend/app/jinyiwei/network.py`
- Create: `backend/app/jinyiwei/mcp/credentials.py`
- Create: `backend/app/jinyiwei/mcp/client.py`
- Test: `backend/tests/test_jinyiwei_network.py`
- Test: `backend/tests/test_jinyiwei_mcp_credentials.py`
- Test: `backend/tests/test_jinyiwei_mcp_client.py`

**Interfaces:**
- Produces: `CredentialProvider.headers_for(server) -> SensitiveHeaders`。
- Produces: `McpClient.discover(server) -> tuple[DiscoveredTool, ...]`。
- Produces: `McpClient.call(server, approval, arguments) -> McpToolResult`。
- Consumes: Task 4 的 server/tool contracts。

- [ ] **Step 1: 写失败的安全传输与凭据泄露测试**

```python
def test_mcp_client_sends_post_and_session_header_without_logging_token() -> None:
    transport = FakePinnedTransport(initialize_response(), tools_response())
    client = McpClient(transport=transport, credentials=credential_provider("secret-token"))
    client.discover(server_config())
    assert transport.requests[0].method == "POST"
    assert transport.requests[0].headers["authorization"] == "Bearer secret-token"
    assert "secret-token" not in repr(transport.requests)


def test_oauth_refresh_failure_is_sanitized() -> None:
    provider = EnvCredentialProvider(environ=expired_oauth_environment())
    with pytest.raises(McpCredentialError) as exc:
        provider.headers_for(server_config())
    assert "token" not in str(exc.value).casefold()
```

- [ ] **Step 2: 运行失败测试**

Run: `cd backend; .venv\Scripts\python.exe -m pytest tests/test_jinyiwei_network.py tests/test_jinyiwei_mcp_credentials.py tests/test_jinyiwei_mcp_client.py -q`

Expected: FAIL because the existing transport is GET-only and MCP credentials/client do not exist.

- [ ] **Step 3: 实现安全 POST、敏感头和 MCP 会话**

保留 `PinnedHTTPSClient.fetch()` 的现有行为，新增内部通用请求方法，方法只允许 `GET`/`POST`，
POST 必须显式传 `application/json`，并继续执行 DNS 固定、对端 IP 校验、TLS、总时限、响应大小
和重定向校验。MCP 客户端依次发送：

```json
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"chaotang-jinyiwei","version":"1"}}}
```

随后发送 `notifications/initialized`，再允许 `tools/list` 或获批 `tools/call`。保存
`Mcp-Session-Id` 但不持久化。接受 `application/json` 和 `text/event-stream`，SSE 只解析完整的
`data:` JSON-RPC 事件并受同一字节上限约束。

`EnvCredentialProvider` 仅解析配置中的 `env://VARIABLE_NAME`。OAuth 凭据 JSON 包含
`access_token`、`expires_at`、`refresh_token`、`client_id` 和固定 `token_endpoint`；刷新结果只
保存在进程内存，不写磁盘。

- [ ] **Step 4: 运行安全与协议测试**

Run: `cd backend; .venv\Scripts\python.exe -m pytest tests/test_jinyiwei_network.py tests/test_jinyiwei_mcp_credentials.py tests/test_jinyiwei_mcp_client.py -q`

Expected: PASS for JSON/SSE, 401, timeout, schema change, oversized body, private IP, redirect, token refresh and secret-redaction cases.

- [ ] **Step 5: 修复现有 TLS 测试的时间竞态并复跑**

将 `test_tls_handshake_is_explicit_and_watchdog_closes_actual_tls_socket` 改用注入的确定性 monotonic
和 watchdog phase，不提高生产超时。运行：

Run: `cd backend; .venv\Scripts\python.exe -m pytest tests/test_jinyiwei_network.py -q --count=20`

Expected: 20 runs PASS with no timing-dependent failure. 若未安装 repeat 插件，则用 PowerShell `1..20 | ForEach-Object { .venv\Scripts\python.exe -m pytest tests/test_jinyiwei_network.py -q; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }`。

- [ ] **Step 6: 审查检查点**

Run: `git diff --check -- backend/app/jinyiwei/network.py backend/app/jinyiwei/mcp backend/tests`

Expected: no output. 若获授权，提交 `feat: add bounded mcp http client`。

### Task 6: 确定性 MCP 映射和通用证据源

**Files:**
- Create: `backend/app/jinyiwei/mcp/mapping.py`
- Create: `backend/app/jinyiwei/sources/mcp.py`
- Modify: `backend/app/jinyiwei/sources/__init__.py`
- Modify: `backend/app/jinyiwei/coordinator.py`
- Test: `backend/tests/test_jinyiwei_mcp_mapping.py`
- Test: `backend/tests/test_jinyiwei_mcp_source.py`
- Test: `backend/tests/test_jinyiwei_coordinator.py`

**Interfaces:**
- Produces: `DeterministicMcpMapper.map(tool, fact, result, retrieved_at) -> SourceDocument`。
- Produces: `McpSource.fetch(query) -> SourceResult`。
- Consumes: Task 3 unresolved fact keys、Task 4 registry、Task 5 client。

- [ ] **Step 1: 写失败的映射、注入和精确路由测试**

```python
def test_mapper_extracts_only_approved_paths() -> None:
    document = mapper.map(quote_tool(), quote_fact(), quote_result(), NOW)
    assert document.metadata["instrument_id"] == "sz002594"
    assert document.as_of == "2026-07-22T07:00:00Z"
    assert "ignore previous instructions" not in document.text


def test_mcp_source_receives_only_archive_unresolved_facts() -> None:
    source.fetch(query_with_unresolved("quote"))
    assert client.calls == [("westock", "data_quote", {"code": "sz002594"})]
```

- [ ] **Step 2: 运行失败测试**

Run: `cd backend; .venv\Scripts\python.exe -m pytest tests/test_jinyiwei_mcp_mapping.py tests/test_jinyiwei_mcp_source.py tests/test_jinyiwei_coordinator.py -q`

Expected: FAIL because mapper/source do not exist and coordinator has no `SourceType.MCP` stage.

- [ ] **Step 3: 实现受限字段路径和 MCP Source**

字段路径语法只允许点分隔对象键和固定整数数组下标，例如 `data.quote.price` 和
`content.0.text`；禁止过滤器、表达式、函数、递归下降和动态代码。映射输出必须提供
`value`、`as_of`、`publisher`、`source_url` 和 `quality_ceiling`。MCP 返回的说明文字只作为
数据值处理，删除控制字符，不解释其中的指令。

在 `_SOURCE_ORDER` 中使用：

```python
_SOURCE_ORDER = (
    SourceType.SHIGUAN,
    SourceType.MCP,
    SourceType.PUBLIC_API,
    SourceType.PUBLIC_WEB,
)
```

兼容的公共 API/Web 暂时保留为后备源，但它们同样只能收到尚未解决的事实。

- [ ] **Step 4: 运行映射、来源和协调器测试**

Run: `cd backend; .venv\Scripts\python.exe -m pytest tests/test_jinyiwei_mcp_mapping.py tests/test_jinyiwei_mcp_source.py tests/test_jinyiwei_coordinator.py tests/test_jinyiwei_extractor.py -q`

Expected: PASS; malformed path、missing timestamp、wrong unit、unexpected tool、prompt injection and response-size cases fail closed with stable codes.

- [ ] **Step 5: 审查检查点**

Run: `git diff --check -- backend/app/jinyiwei/mcp/mapping.py backend/app/jinyiwei/sources backend/app/jinyiwei/coordinator.py backend/tests`

Expected: no output. 若获授权，提交 `feat: route unresolved facts through approved mcp tools`。

### Task 7: 腾讯自选股首个真实配置和离线端到端验收

**Files:**
- Modify: `backend/config/jinyiwei_mcp.yaml`
- Create: `backend/tests/fixtures/mcp/westock_initialize.json`
- Create: `backend/tests/fixtures/mcp/westock_tools_list.json`
- Create: `backend/tests/fixtures/mcp/westock_search_byd.json`
- Create: `backend/tests/fixtures/mcp/westock_quote_byd.json`
- Create: `backend/tests/test_jinyiwei_westock.py`
- Modify: `backend/tests/test_chancellor_graph.py`
- Modify: `backend/tests/test_decrees_api.py`

**Interfaces:**
- Produces: 获批 `data_search` 与 `data_quote` 的配置化 BYD 查询链；其余只读工具保持禁用直到有独立 fixture 和映射。
- Consumes: Task 4–6 通用 MCP 能力，不新增腾讯专用 Python connector。

- [ ] **Step 1: 写失败的 BYD 两段式查询和 `/study` 等价后端链路测试**

```python
def test_byd_quote_uses_search_then_quote_and_returns_cited_evidence() -> None:
    pack = run_fixture_investigation("看看比亚迪股票价格")
    item = pack.evidence_by_fact["current_quote"][0]
    assert item.value["instrument_id"] == "sz002594"
    assert item.value["currency"] == "CNY"
    assert item.source_type is SourceType.MCP
    assert item.publisher == "腾讯自选股"
```

- [ ] **Step 2: 运行失败测试**

Run: `cd backend; .venv\Scripts\python.exe -m pytest tests/test_jinyiwei_westock.py tests/test_chancellor_graph.py tests/test_decrees_api.py -q`

Expected: FAIL because no approved WeStock fixture mapping exists.

- [ ] **Step 3: 登记最小腾讯工具和确定性实体消歧**

配置固定服务地址 `https://stockbuddy.qq.com/cgi/cgi-bin/openai/mcp/mcp`、Streamable HTTP、
`SERVICE_AUTHENTICATED_FREE` 和 `env://WESTOCK_MCP_CREDENTIAL`。首期批准：

- `data_search`：只用于名称到证券代码解析；
- `data_quote`：只用于行情快照。

对“比亚迪”搜索结果必须按名称、证券类型、目标 jurisdiction/market 三者匹配；多个合法结果
仍有歧义时返回 `fact_conflicted`，不得默认选择 A 股或港股。受 Task 7 离线、无凭据硬约束
限制，测试 fixture 使用“本机已安装 WorkBuddy skill 的只读工具契约观察 + 合成结果样本”，
不是认证后的真实 MCP 响应；不得含真实 Token、Cookie、账号 ID 或运行时用户数据。认证后的
`tools/list`/只读调用验证延后到 Task 9，且必须获得用户另行授权并配置专用服务账号。

- [ ] **Step 4: 运行离线端到端测试**

Run: `cd backend; .venv\Scripts\python.exe -m pytest tests/test_jinyiwei_westock.py tests/test_chancellor_graph.py tests/test_decrees_api.py tests/test_agent_evidence_protocol.py -q`

Expected: PASS for archive hit、archive stale→MCP、archive miss→MCP、ambiguous BYD、401、stale quote and unavailable source.

- [ ] **Step 5: 审查检查点**

Run: `git diff --check -- backend/config/jinyiwei_mcp.yaml backend/tests/fixtures/mcp backend/tests/test_jinyiwei_westock.py backend/tests/test_chancellor_graph.py backend/tests/test_decrees_api.py`

Expected: no output. 若获授权，提交 `feat: configure westock quote evidence`。

### Task 8: 采用后版本化归档和完整回归

**Files:**
- Modify: `backend/app/shiguan/models.py`
- Modify: `backend/app/shiguan/archive_decree.py`
- Modify: `backend/app/shiguan/storage.py`
- Modify: `backend/app/agents/evidence_protocol.py`
- Test: `backend/tests/test_shiguan_adopted_evidence.py`
- Test: `backend/tests/test_shiguan_storage.py`
- Test: `backend/tests/test_jinyiwei_shiguan_source.py`

**Interfaces:**
- Consumes: 现有 `adopted_evidence_ids`、Task 1 数据范围、MCP source metadata。
- Produces: 只追加的 `ArchiveEvidenceSnapshot`；后续 `ShiguanSource` 可召回并重新判断时效。

- [ ] **Step 1: 写失败的采用归档和版本保留测试**

```python
def test_only_adopted_mcp_evidence_is_archived_as_new_version(tmp_path) -> None:
    outcome = archive_reply_with_evidence(
        adopted=(current_quote("e-new"),),
        unadopted=(current_quote("e-unused"),),
        existing_archive=old_quote("e-old"),
        path=tmp_path,
    )
    snapshots = load_reply(outcome.reply_id).evidence_references
    assert [item.evidence_id for item in snapshots] == ["e-new"]
    assert load_archive("old-reply").evidence_references[0].evidence_id == "e-old"
```

- [ ] **Step 2: 运行失败测试**

Run: `cd backend; .venv\Scripts\python.exe -m pytest tests/test_shiguan_adopted_evidence.py tests/test_shiguan_storage.py tests/test_jinyiwei_shiguan_source.py -q`

Expected: FAIL until snapshot and recall preserve data scope, MCP metadata and historical version semantics.

- [ ] **Step 3: 完成归档契约和召回闭环**

`ArchiveEvidenceSnapshot` 保存 `data_scope`、`source_type`、`source_url`、`publisher`、`as_of`、
`retrieved_at`、`content_hash`、`coverage`、`license_note`，并深度冻结 JSON 值。继续使用现有
pending→史馆写入→confirmed 协议；归档失败不得影响成功回奏 HTTP 契约，后续 reconciliation
只按 `reply_id` 补偿。相同 evidence/reply 幂等，不允许用新内容覆写旧哈希。

- [ ] **Step 4: 运行归档、召回和 API 回归**

Run: `cd backend; .venv\Scripts\python.exe -m pytest tests/test_shiguan_adopted_evidence.py tests/test_shiguan_storage.py tests/test_jinyiwei_shiguan_source.py tests/test_decrees_api.py -q`

Expected: PASS; adopted-only、idempotency、atomic failure、reconciliation、old/new version recall all pass.

- [ ] **Step 5: 审查检查点**

Run: `git diff --check -- backend/app/shiguan backend/app/agents/evidence_protocol.py backend/tests`

Expected: no output. 若获授权，提交 `feat: archive adopted mcp evidence versions`。

### Task 9: 文档、全量验证和显式只读公网冒烟

**Files:**
- Create: `backend/app/jinyiwei/mcp/smoke.py`
- Test: `backend/tests/test_jinyiwei_mcp_smoke.py`
- Modify: `ARCHITECTURE.md`
- Modify: `backend/AGENTS.md`
- Modify: `docs/decisions/0018-central-jinyiwei-evidence-service.md`
- Modify: `docs/product/tasks/2026-07-22-jinyiwei-general-evidence-routing.md`
- Reference: `docs/superpowers/specs/2026-07-22-jinyiwei-approved-mcp-query-routing-design.md`

**Interfaces:**
- Documents: 史馆优先、MCP 只读准入、共享服务账号、密钥边界、离线验证和冒烟开关。
- Produces: 产品任务 Implementation Report 和逐项验收证据。

- [ ] **Step 1: 更新文档中的准确边界和命令**

明确说明：默认网络关闭；配置文件不含秘密；`WESTOCK_MCP_CREDENTIAL` 是本地/部署秘密；
通达信不接；真实冒烟只执行 `tools/list`、`data_search` 和 `data_quote`，不调用任何 portfolio、
alert、paper trade 或写工具。

同时实现 `smoke.py`：只接受配置中已登记的 server ID 和固定的 `data_search`/`data_quote`
组合；标准输出只包含脱敏状态字段。测试注入假客户端，断言任何响应正文、价格、凭据和请求头
都不出现在 stdout/stderr。

- [ ] **Step 2: 运行静态检查和全量离线测试**

Run: `cd backend; .venv\Scripts\python.exe -m ruff check .`

Expected: PASS.

Run: `cd backend; .venv\Scripts\python.exe -m pytest -q`

Expected: PASS with no network and no real credentials.

Run: `node scripts/check_harness.mjs; node scripts/check_harness.mjs --self-test; node .agents/hooks/check-harness.mjs --self-test`

Expected: all commands exit 0.

- [ ] **Step 3: 运行敏感信息和范围扫描**

Run: `rg -n "access_token|refresh_token|Authorization: Bearer|TDX|txmcp" backend/config backend/app docs`

Expected: 无真实值；`access_token`/`refresh_token` 仅出现在凭据字段名、测试假值和安全文档中；无通达信运行配置。

- [ ] **Step 4: 在用户另行明确授权且已配置专用服务账号后运行真实只读冒烟**

Run: `cd backend; $env:JINYIWEI_EXTERNAL_NETWORK_ENABLED='true'; .venv\Scripts\python.exe -m app.jinyiwei.mcp.smoke --server westock --query 比亚迪 --tool data_quote`

Expected: 只输出服务名、工具名、证券代码、行情时间、状态和响应字节数；不输出价格正文、Token、请求头、账号信息或完整 MCP 响应。命令结束后删除进程环境中的开关和凭据。

- [ ] **Step 5: 更新产品任务实施报告并做最终 diff 检查**

记录实际运行的命令、退出状态、未运行的真实冒烟及原因、剩余的服务条款/再分发风险。运行：

Run: `git diff --check`

Expected: no output. 若用户明确授权提交，再按已审查的文件范围创建最终提交；否则保持未暂存并报告。

## Final Review Checklist

- [ ] 逐条映射设计规格的产品目标、事实范围、Archive Resolver、MCP Registry、凭据、客户端、路由、映射、归档、安全、故障和验收要求。
- [ ] 搜索计划与实现中不存在占位标记、未定义接口或含糊的延后实现语句。
- [ ] 核对 `DataScope`、`SourceType.MCP`、`McpToolApproval`、`historical_evidence_by_fact` 和凭据接口在所有任务中命名一致。
- [ ] 确认腾讯只通过配置接入，核心 Python 模块没有 `westock`/`stockbuddy` 条件分支。
- [ ] 确认所有常规测试离线，真实 MCP 调用保持显式授权门禁。
