# 锦衣卫通用公共证据路由 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让所有依赖缺失、过期或未可靠覆盖的公共事实的司级办理，统一通过 `NEEDS_DATA` 请求锦衣卫补证，并按事实类别使用受控的免费公开来源。

**Architecture:** 保持“司级提出缺数、锦衣卫取证、原司级恢复一次”的既有边界。将每个事实槽位升级为带类别的契约；司级的首轮响应变为可验证的数据需求判定，锦衣卫按类别和证据质量选择不可变注册表中的来源，返回包含时间与限制的冻结证据包。

**Tech Stack:** Python 3.11、FastAPI、Pydantic、SQLite、pytest、现有 `PinnedHTTPSClient`。

## Global Constraints

- 只使用免费、合法、公开可访问且不需要私人凭据的来源；不使用付费订阅、付费 API、登录、付费墙或验证码。
- 注册表可以覆盖全球，但每个来源必须显式声明实际市场/地域覆盖与适用事实类别；不得宣称单一来源覆盖全部地域。
- 新闻只在相同质量层级内按发布时间从新到旧排序；官方、监管、交易所和原始公告仍优先于新闻和百科。
- 用户和模型均不得提交任意 URL；所有外部读取必须继续经过 `PinnedHTTPSClient` 与现有失败关闭开关。
- 锦衣卫只返回事实和证据，丞相、部级、军机处不得发起调查；原司级 Agent 是唯一形成办理意见的节点。
- 保持每司一次恢复、每旨意三次调查、六次抽取、30 秒总预算和史馆/锦衣卫分库边界。
- 代码实现前先写失败测试；提交、推送或部署只在获得该动作明确授权时执行。

---

## 文件结构

- `backend/app/jinyiwei/models.py`：事实类别、来源覆盖和证据时间语义的冻结契约。
- `backend/app/agents/evidence_protocol.py`：司级首轮数据需求判定、证据恢复和严格响应校验。
- `backend/app/agents/bureaus/agent.py`：向每个司级 Agent 注入统一的缺数与证据引用协议。
- `backend/app/jinyiwei/source_registry.py`：按事实类别、地域和质量声明来源的不可变注册表。
- `backend/app/jinyiwei/sources/public_api.py`：只调用与请求事实类别匹配的注册 API 连接器，并按时间排序文档。
- `backend/app/jinyiwei/coordinator.py`：把来源尝试、事实覆盖和证据包限制写成一致结果。
- `backend/app/jinyiwei/read_models.py`、`backend/app/api/jinyiwei.py`、`frontend/src/lib/backendClient.ts`：将类别、时效、覆盖和来源限制安全地暴露到只读调查台。
- `backend/tests/test_agent_evidence_protocol.py`、`backend/tests/test_bureaus_agent.py`：司级缺数和恢复协议的回归测试。
- `backend/tests/test_jinyiwei_models.py`、`backend/tests/test_jinyiwei_public_sources.py`、`backend/tests/test_jinyiwei_coordinator.py`：契约、来源路由、排序和失败关闭测试。
- `backend/tests/test_jinyiwei_api.py`、`frontend/src/lib/backendClient.test.ts`：只读接口契约测试。

### Task 1: 冻结“事实类别与来源覆盖”契约

**Files:**
- Modify: `backend/app/jinyiwei/models.py`
- Test: `backend/tests/test_jinyiwei_models.py`

**Interfaces:**
- Produces `FactCategory`：`MARKET_QUOTE`、`REGULATORY_FILING`、`NEWS_EVENT`、`PUBLIC_STATISTIC`、`ENTITY_REFERENCE`。
- Produces `RequiredFact.category: FactCategory`、`RequiredFact.jurisdiction: str | None` 与 `RequiredFact.subject: str`。
- Produces source metadata fields `coverage`, `published_at` and `license_note` on immutable source records used by registered connectors.

- [ ] **Step 1: 写失败测试，拒绝无类别、空主体、非法地域与不带时区的发布时间。**

```python
def test_required_fact_requires_category_and_subject() -> None:
    with pytest.raises(ValidationError):
        RequiredFact(key="price", description="最新价", category="MARKET_QUOTE", subject="   ")

def test_required_fact_accepts_global_market_quote() -> None:
    fact = RequiredFact(key="price", description="比亚迪最新成交价", category="MARKET_QUOTE", subject="BYD", jurisdiction=None)
    assert fact.category is FactCategory.MARKET_QUOTE
```

- [ ] **Step 2: 运行失败测试。**

Run: `backend\.venv\Scripts\python.exe -m pytest backend/tests/test_jinyiwei_models.py -q`

Expected: FAIL，因为 `RequiredFact` 还没有 `category`、`subject` 与地域校验。

- [ ] **Step 3: 在 `models.py` 实现 `FactCategory` 和严格字段校验。**

```python
class FactCategory(StrEnum):
    MARKET_QUOTE = "MARKET_QUOTE"
    REGULATORY_FILING = "REGULATORY_FILING"
    NEWS_EVENT = "NEWS_EVENT"
    PUBLIC_STATISTIC = "PUBLIC_STATISTIC"
    ENTITY_REFERENCE = "ENTITY_REFERENCE"

class RequiredFact(_FrozenContract):
    key: StrictStr
    description: StrictStr
    category: FactCategory
    subject: StrictStr
    jurisdiction: StrictStr | None = None
```

Normalize `subject` 和 `jurisdiction`；`jurisdiction=None` 表示未限定地域，不表示来源具有全球覆盖。同步更新所有既有构造点与 fixture，显式把旧 Wikidata/Wikimedia 用例标为 `ENTITY_REFERENCE`。

- [ ] **Step 4: 运行模型与协议定向测试。**

Run: `backend\.venv\Scripts\python.exe -m pytest backend/tests/test_jinyiwei_models.py backend/tests/test_agent_evidence_protocol.py -q`

Expected: PASS。

### Task 2: 将“缺数必请求”落实到司级首轮契约

**Files:**
- Modify: `backend/app/agents/bureaus/agent.py`
- Modify: `backend/app/agents/evidence_protocol.py`
- Test: `backend/tests/test_bureaus_agent.py`
- Test: `backend/tests/test_agent_evidence_protocol.py`

**Interfaces:**
- Consumes `RequiredFact.category`、`subject`、`freshness` 与已知证据 ID。
- Produces首轮严格 envelope：`READY` 时声明 `fact_basis`；`NEEDS_DATA` 时提供带类别的 `DataGapDraft`。
- Produces `EvidenceProtocolError("uncited_fact_dependency")`，用于拒绝声称依赖外部事实却未请求或引用证据的响应。

- [ ] **Step 1: 写失败测试，覆盖实时行情、新闻与纯政策建议三种路径。**

```python
def test_bureau_requests_market_quote_when_current_price_is_needed() -> None:
    first = json.dumps({"status": "NEEDS_DATA", "data_gap": market_quote_gap("BYD")})
    assert invoke_bureau_with_evidence(..., chat_model=sequence(first, ready_after_pack), session=session) == "有证据的意见"

def test_ready_response_rejects_undeclared_external_fact_dependency() -> None:
    with pytest.raises(EvidenceProtocolError, match="uncited_fact_dependency"):
        invoke_bureau_with_evidence(..., chat_model=lambda _: '{"status":"READY","result":{"opinion":"最新股价上涨"},"adopted_evidence_ids":[]}', session=session)

def test_policy_only_opinion_remains_ready_without_external_fact() -> None:
    assert invoke_bureau_with_evidence(..., chat_model=ready_without_fact, session=session) == "建议建立审查流程"
```

- [ ] **Step 2: 运行失败测试。**

Run: `backend\.venv\Scripts\python.exe -m pytest backend/tests/test_agent_evidence_protocol.py backend/tests/test_bureaus_agent.py -q`

Expected: FAIL，因为当前 `READY` envelope 没有事实依赖声明，且提示词允许旧式裸 `opinion`。

- [ ] **Step 3: 改写 `_evidence_protocol_prompt` 和解析器。**

移除启用证据会话时的裸 `{"opinion": ...}` 成功通道。要求：

```json
{"status":"READY","result":{"opinion":"..."},"adopted_evidence_ids":["..."],"fact_basis":"NOT_REQUIRED"}
```

或：

```json
{"status":"NEEDS_DATA","data_gap":{"required_facts":[{"key":"quote","description":"最新成交价","category":"MARKET_QUOTE","subject":"BYD","jurisdiction":"CN"}],"freshness":{"max_age_seconds":300}}}
```

仅在没有外部可核验事实依赖时允许 `fact_basis="NOT_REQUIRED"`；使用史馆或锦衣卫事实时，要求 `fact_basis="CITED"` 且 `adopted_evidence_ids` 非空。为旧档案上下文提供显式引用 ID，而不是将其伪装成无事实依赖。

- [ ] **Step 4: 运行定向测试与全量后端测试。**

Run: `backend\.venv\Scripts\python.exe -m pytest backend/tests/test_agent_evidence_protocol.py backend/tests/test_bureaus_agent.py -q; backend\.venv\Scripts\python.exe -m pytest -q`

Expected: PASS。

### Task 3: 让注册表按类别、地域与质量选择免费公开连接器

**Files:**
- Modify: `backend/app/jinyiwei/source_registry.py`
- Modify: `backend/app/jinyiwei/sources/public_api.py`
- Test: `backend/tests/test_jinyiwei_public_sources.py`

**Interfaces:**
- Produces `PublicApiConnector.categories: frozenset[FactCategory]`、`jurisdictions: frozenset[str] | None`、`license_note: str` 与 `quality_ceiling`。
- Produces `PublicApiRegistry.connectors_for(facts)`，仅返回与每个未解决事实匹配的连接器。
- Produces按 `published_at` 从新到旧的同层 `NEWS_EVENT` 文档序列。

- [ ] **Step 1: 写失败测试，证明不匹配类别/地域的连接器不会被调用，新闻在同层按发布时间排序。**

```python
def test_registry_excludes_entity_connector_for_market_quote() -> None:
    assert registry.connectors_for((market_quote_fact(),)) == ()

def test_registry_keeps_global_connector_for_any_jurisdiction() -> None:
    assert registry.connectors_for((news_fact(jurisdiction="BR"),)) == (global_news,)

def test_news_documents_are_newest_first_within_same_quality() -> None:
    assert [item.as_of for item in documents] == ["2026-07-22T10:00:00Z", "2026-07-22T09:00:00Z"]
```

- [ ] **Step 2: 运行失败测试。**

Run: `backend\.venv\Scripts\python.exe -m pytest backend/tests/test_jinyiwei_public_sources.py -q`

Expected: FAIL，因为现有注册表无类别/地域匹配，也没有新闻排序。

- [ ] **Step 3: 实现匹配与固定顺序。**

`PublicApiRegistry.connectors_for` 必须逐个事实匹配类别，并只选择连接器明确覆盖的地域或声明全地域的连接器。`PublicApiSource.fetch` 按注册表顺序请求，但仅向连接器传递它匹配的事实；对新闻文档按 `as_of` 降序稳定排序。连接器注册时拒绝空许可证说明、空类别集合、非法地域码和声称 `PRIMARY` 的公共 API。

- [ ] **Step 4: 保留现有 Wikidata 连接器并给出严格元数据。**

把 `wikidata_entity_search` 明确限定为 `ENTITY_REFERENCE`、全地域、`SECONDARY`；不允许它为行情、监管、新闻或统计事实产生文档。其余类别只在完成来源审查后加入代码拥有的连接器；所有测试使用本地假客户端与 fixture，不访问网络。

- [ ] **Step 5: 运行来源与网络安全回归。**

Run: `backend\.venv\Scripts\python.exe -m pytest backend/tests/test_jinyiwei_public_sources.py backend/tests/test_jinyiwei_network.py -q`

Expected: PASS。

### Task 4: 在协调器中保留时效、覆盖与不可用限制

**Files:**
- Modify: `backend/app/jinyiwei/coordinator.py`
- Modify: `backend/app/jinyiwei/models.py`
- Test: `backend/tests/test_jinyiwei_coordinator.py`

**Interfaces:**
- Consumes类别过滤后的 `SourceResult` 与请求 `FreshnessRequirement`。
- Produces `EvidencePack.do_not_infer`，包含未覆盖、已过期、冲突与来源不可用的事实键。
- Produces来源尝试，其 `facts_attempted` 仅包含该来源实际匹配的事实。

- [ ] **Step 1: 写失败测试，覆盖过期报价、同质量新闻排序、来源类别不匹配和冲突。**

```python
def test_expired_market_quote_is_unresolved_and_not_inferable() -> None:
    pack = coordinator.investigate(request_with_max_age(300), department="户部", matter_type="MEMORIAL", extraction_budget=budget)
    assert pack.status is EvidencePackStatus.PARTIAL
    assert pack.unresolved_facts == ("quote",)
    assert "quote" in pack.do_not_infer
```

- [ ] **Step 2: 运行失败测试。**

Run: `backend\.venv\Scripts\python.exe -m pytest backend/tests/test_jinyiwei_coordinator.py -q`

Expected: FAIL，因为当前协调器不区分类别覆盖和过期事实的限制文案。

- [ ] **Step 3: 实现事实级覆盖判定。**

在协调器收集文档后，先丢弃不属于请求类别或超出 `max_age_seconds` 的项目；再按既有抽取、质量、独立性与冲突规则形成证据包。为每个未解决事实写入稳定、脱敏的 `do_not_infer` 条目，例如 `fact_unavailable:quote`、`fact_stale:quote` 或 `fact_conflicted:quote`。不得将失败来源的原始异常、URL 参数或正文写入错误字段。

- [ ] **Step 4: 运行协调器、存储和协议回归。**

Run: `backend\.venv\Scripts\python.exe -m pytest backend/tests/test_jinyiwei_coordinator.py backend/tests/test_jinyiwei_storage.py backend/tests/test_agent_evidence_protocol.py -q`

Expected: PASS。

### Task 5: 扩展只读调查契约与前端呈现

**Files:**
- Modify: `backend/app/jinyiwei/read_models.py`
- Modify: `backend/app/api/jinyiwei.py`
- Modify: `frontend/src/lib/backendClient.ts`
- Modify: `frontend/src/lib/backendClient.test.ts`
- Test: `backend/tests/test_jinyiwei_api.py`

**Interfaces:**
- Produces只读调查详情中的 `fact_category`、`subject`、`jurisdiction`、`published_at`、`coverage` 与 `license_note`。
- Consumes后端严格 JSON 契约；浏览器只调用既有同源 GET BFF，不获得上游来源 URL 以外的调查控制权。

- [ ] **Step 1: 写后端与前端失败测试。**

```python
def test_investigation_detail_exposes_fact_category_and_limitations(client) -> None:
    body = client.get("/api/v1/jinyiwei/investigations/inv-1").json()
    assert body["request"]["required_facts"][0]["category"] == "NEWS_EVENT"
    assert body["do_not_infer"] == ["fact_stale:quote"]
```

```ts
test("锦衣卫客户端拒绝缺少事实类别的调查详情", async () => {
  mockFetch({ request: { required_facts: [{ key: "quote" }] } });
  await expect(getJinyiweiInvestigation("inv-1")).resolves.toMatchObject({ ok: false });
});
```

- [ ] **Step 2: 运行失败测试。**

Run: `backend\.venv\Scripts\python.exe -m pytest backend/tests/test_jinyiwei_api.py -q; Push-Location frontend; npm test -- --runInBand src/lib/backendClient.test.ts; Pop-Location`

Expected: FAIL，因为只读契约尚未包含新字段。

- [ ] **Step 3: 逐层映射新增字段。**

后端 read model 与 API 只序列化冻结契约允许的字段；前端解析器把类别、主体、地域、时间和限制作为必填或可空字段严格验证。页面只展示已记录的调查事实与限制，不增加“重新调查”“编辑来源”或浏览器直连后端能力。

- [ ] **Step 4: 运行 API、前端定向与前端全量验证。**

Run: `backend\.venv\Scripts\python.exe -m pytest backend/tests/test_jinyiwei_api.py -q; Push-Location frontend; npm test; npm run lint; npm run typecheck; Pop-Location`

Expected: PASS。

### Task 6: 来源接入审查与离线验收门槛

**Files:**
- Modify: `docs/decisions/0018-central-jinyiwei-evidence-service.md`
- Modify: `ARCHITECTURE.md`
- Modify: `backend/AGENTS.md`
- Test: `backend/tests/test_jinyiwei_public_sources.py`

**Interfaces:**
- Produces每个新增来源的代码注册项，包含免费公开访问依据、地域覆盖、事实类别、质量、许可证说明、固定 origin/path/参数和确定性解析器。
- Produces来源接入拒绝测试：无许可证说明、需凭据、类别越界、非 HTTPS、任意 URL 或未通过固定解析器的来源均不可注册。

- [ ] **Step 1: 写失败测试，拒绝不可免费公开使用或声明不完整的连接器。**

```python
def test_connector_rejects_missing_license_note() -> None:
    with pytest.raises(ValueError, match="license_note"):
        PublicApiConnector(..., license_note="")

def test_connector_rejects_empty_fact_categories() -> None:
    with pytest.raises(ValueError, match="categories"):
        PublicApiConnector(..., categories=frozenset())
```

- [ ] **Step 2: 运行失败测试。**

Run: `backend\.venv\Scripts\python.exe -m pytest backend/tests/test_jinyiwei_public_sources.py -q`

Expected: FAIL，直至注册契约拥有许可证与类别门槛。

- [ ] **Step 3: 在文档中登记来源审查表和运行限制。**

每个接入来源记录：发布者、免费公开访问依据、地域/市场覆盖、事实类别、时效语义、质量上限、再分发限制、固定 HTTPS origin、允许参数、解析器、失败关闭行为。未通过该表审查的来源不得加入 `build_default_public_api_registry()`。

- [ ] **Step 4: 运行完整离线验证与 harness。**

Run: `backend\.venv\Scripts\python.exe -m ruff check .; backend\.venv\Scripts\python.exe -m pytest -q; Push-Location frontend; npm test; npm run lint; npm run typecheck; npm run build; Pop-Location; node scripts/check_harness.mjs; node scripts/check_harness.mjs --self-test; node .agents/hooks/check-harness.mjs --self-test; git diff --check`

Expected: 所有命令 PASS；不设置 `JINYIWEI_EXTERNAL_NETWORK_ENABLED`，不运行真实下旨，也不把 fixture 冒充真实外网证据。

## 计划自检

- 规格覆盖：任务 1 覆盖事实类别；任务 2 覆盖强制缺数；任务 3 覆盖按来源类别/地域路由与新闻新鲜度；任务 4 覆盖时效、冲突与降级；任务 5 覆盖审计可见性；任务 6 覆盖免费公开来源审查与全量验证。
- 约束一致性：全流程保持司级唯一调查入口、固定来源注册、外网失败关闭、冻结证据包和原司级形成意见。
- 未包含：具体外部提供者的上线注册。它们必须逐一通过任务 6 的免费公开访问、许可与安全审查后，才可以作为该任务的后续小变更加入；不能以未审查的通用网页搜索替代。
