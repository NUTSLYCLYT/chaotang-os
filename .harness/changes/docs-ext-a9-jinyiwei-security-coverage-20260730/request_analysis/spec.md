# 规格说明：docs-ext-a9-jinyiwei-security-coverage-20260730

## 背景

EXT-A9 的目标是把历史资产价值全部归属、验证和取舍，而不是合并所有历史。
第一批决策矩阵把锦衣卫真实采证列为 `ABSORB_AFTER_SECURITY_REVIEW`。只读审计
确认该分支已经是当前 EXT 的祖先，真实采证能力不是待合并库存；剩余工作是验证
当前实现的安全边界，并把证实的缺口拆成最小 TDD remediation。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | 锦衣卫候选分支已全部进入 EXT，候选侧独有提交数为 0 | `git rev-list --left-right --count feature-chaotang-ext...task/pkt-a1-jinyiwei-real-fetch` 返回 `365 0` | Codex / 2026-07-30 | 否 |
| 已确认事实 | 固定外联目标为 Tavily API 与 SEC 官方域名，用户输入不决定服务端请求 URL | `backend/src/jinyiwei_search.py`、`backend/src/sec_edgar.py` | Codex 源码审计 | 否 |
| 已确认事实 | 外部凭据来自环境变量；请求有 8 秒超时；网络失败返回空证据或 `verified=False` | 同上与对应测试 | Codex 源码 + pytest | 否 |
| 已确认事实 | 共享证据查询按 tenant 隔离，数据库以 `(tenant_id, claim_key)` 唯一约束去重 | `backend/src/jinyiwei_evidence_store.py`、模型与测试 | Codex 源码 + pytest | 否 |
| 已确认事实 | `fill-gap` 查询 `DecisionTask` 后只比较 `user_id`；模型已有 `tenant_id`，仓内已有 tenant + user helper | `backend/web/routers/jinyiwei.py`、`backend/src/db/models.py`、`backend/src/decision_task_access.py` | Codex 源码审计 | 是，P1 候选 |
| 已确认事实 | 调用方可提交无 name 的 `{"tier":"一手"}`，当前测试要求其变为 green 并持久化为 verified | `backend/src/jinyiwei_vet.py`、`backend/tests/test_jinyiwei_endpoint.py` | Codex 源码 + 既有测试 | 是，P1 候选 |
| 已确认事实 | 锦衣卫联网端点没有使用仓内已有 rate limiter，body 也没有 typed schema 或长度/数量上限 | `backend/web/routers/jinyiwei.py`、`backend/src/direct_rate_limit.py` | Codex 源码审计 | 是，P2 候选 |
| 待测试证明 | 同一 user identity 在两个 tenant 下可通过 task ID 调用 `fill-gap` | 需要新增 cross-tenant negative test | 未来 TDD RED | 是 |
| 待设计确认 | 调用方自带证据应保留为待核、仅用户私有，还是允许经人工签字提升为 tenant 共享证据 | 本规格“信任来源设计” | 用户 + Security reviewer | 是 |

## 数据流与调用链

```text
Authenticated user
  -> POST /api/intel/brief
     -> caller findings OR fixed Tavily adapter
     -> jinyiwei_vet deterministic grading
     -> tenant-scoped JinyiweiEvidence upsert
  -> GET /api/intel/evidence
     -> tenant-scoped shared evidence read

Authenticated user
  -> POST /api/intel/evidence/fill-gap
     -> DecisionTask lookup
     -> task ownership + terminal-state gate
     -> fixed Tavily adapter
     -> deterministic grading
     -> tenant-scoped shared evidence upsert

Shangshufang finance flow
  -> fixed SEC EDGAR adapter
  -> source URLs + verified flag + extracted official facts
  -> finance evidence and honest source label
```

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| Authentication identity | `web.deps.get_current_user` | all `/api/intel/*` routes | Existing dependency tests |
| Evidence tenant identity | `src.tenant.resolve_current_tenant_id` | tenant-scoped evidence read/write | Existing isolation tests |
| DecisionTask ownership | `src.decision_task_access.get_owned_decision_task` | `fill-gap` | Reuse existing SSOT; do not add a second ownership rule |
| Request tenant identity | fail-closed `CurrentUser.tenant_id` | `fill-gap` ownership helper | Reject `None`; never authorize through default-tenant fallback |
| Source trust | server-owned adapter type + normalized provenance | `jinyiwei_vet` and evidence store | Caller cannot self-assert server-verified tier |
| Evidence state | `JinyiweiEvidence.decision/trust/source_label` | shared evidence API and departments | `拒` never returned; `待核` opt-in only |
| SEC verification | successful fixed-host companyfacts response | finance review flow | Existing `test_sec_edgar.py` |

## 范围

### This design Packet

- Pin exact current EXT and historical source identity.
- Record existing controls and confirmed or test-pending gaps.
- Define remediation architecture, TDD order and verification commands.
- Update no runtime behavior.

### Approved P1 remediation scope

- `backend/web/routers/jinyiwei.py`
- `backend/src/jinyiwei_agent.py`
- `backend/src/real_department_engines.py`
- `backend/tests/test_jinyiwei_endpoint.py`
- `backend/tests/test_jinyiwei_agent.py`
- `backend/tests/test_real_department_engines.py`
- `backend/tests/test_swarm_execution_loop_api.py`
- `backend/tests/test_chaotang_assemble.py`
- `backend/tests/conftest.py`
- `frontend/src/features/intel/lib/jinyiwei-brief-contract.ts`
- `frontend/src/features/intel/lib/jinyiwei-brief-contract.nodetest.ts`
- `frontend/src/features/intel/components/JinyiweiBriefScroll.tsx`
- `frontend/src/features/intel/components/JinyiweiVerdictRail.tsx`
- `frontend/e2e/jinyiwei-source-trust.spec.ts`

Any future file outside this list requires a scope amendment before modification.

## 非目标

- No whole-branch merge or historical cherry-pick.
- No new page, Agent, BFF, task state machine or second evidence store.
- No W09 activation.
- No production deployment, database migration or listener 3050 operation.
- No live-network acceptance in default pytest.
- No claim that a URL count proves independent corroboration.

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| Caller supplies `tier="一手"` without server provenance | Must not become server-verified tenant-shared evidence | TDD negative test |
| Same user ID exists in another tenant | Cannot operate the other tenant's DecisionTask | TDD cross-tenant test |
| Empty, oversized or structurally invalid findings | Reject deterministically before network/storage work | typed request tests |
| Search budget exceeded | Return bounded rate-limit response; do not call Tavily | rate-limit test |
| Tavily returns multiple URLs without claim-level excerpts | Keep pending unless corroboration contract is satisfied | provenance/vet tests |
| Tavily or SEC unavailable | Honest empty/FALLBACK or `verified=False`; no fabricated evidence | existing tests |
| Returned source URL uses an unsafe scheme | Do not treat as verified provenance or render as trusted link | normalization test |
| Internal exception occurs | Return generic error; preserve details only in server log | endpoint error test |

## 信任来源设计

Recommended design:

1. Only server-owned adapters may issue a server provenance type such as
   `TAVILY_SEARCH` or `SEC_EDGAR`.
2. Caller-provided findings remain useful for offline evidence intake, but their
   source tier is not authoritative. They return as `CALLER_ASSERTED / 待核`
   and are not written to the tenant-shared evidence pool.
3. `jinyiwei_agent.gather_intel` requires an explicit internal
   `source_authority`; there is no default. Every production call site must
   choose `server_adapter` or `caller_asserted`.
4. Tenant-shared `jinyiwei_verified` rows require server-adapter provenance.
   Durable human promotion is a separate future design and is not inferred here.

Rejected alternatives:

- Disable caller findings entirely: safer but destroys useful offline intake.
- Keep current self-asserted tier: preserves compatibility but lets authenticated
  callers manufacture tenant-shared verified evidence.
- Store caller assertions as verified but user-private: reduces blast radius yet
  still misstates trust; not selected.

## 风险与回滚边界

- Tightening caller trust can change existing `CALLER_FINDINGS` results from green
  to pending and stops their shared-pool persistence. The response shape remains
  compatible; trust and persistence semantics change deliberately.
- Reusing `get_owned_decision_task` is preferred over another inline ownership
  implementation.
- In-process rate limiting is a local guard, not a distributed production quota.
  The Packet must not claim production-grade global enforcement.
- Runtime remediation must be one revertable runtime/test commit and cannot
  include database migration. Existing rows are not silently reclassified.
- Existing `DecisionTask.tenant_id IS NULL` rows fail closed at `fill-gap`; this
  scope does not infer ownership or migrate legacy rows.
- Existing persisted rows whose historical source label is `CALLER_FINDINGS` are
  not cleaned by P1. P1 prevents new caller-derived shared rows; local repository
  evidence cannot prove the state of an uninspected production database.

## 计划确认记录

- 批准人：项目业主
- 批准日期：2026-07-30
- 批准范围：方案 A；审阅规格后要求“从 P1 开始一直往后”的 Harness 长时任务，
  次日验收。精确 P1 文件范围见 scope amendment。
- 明确未批准：P2 实现、W09 激活、push、部署、数据库迁移、3050 操作。

## P1 Blocking Acceptance

1. Historical candidate has no unabsorbed commit inventory.
2. Existing controls and every candidate gap have exact code/test evidence.
3. P1 findings have named failing tests before runtime implementation.
4. No caller-controlled field can create server-verified shared evidence.
5. `fill-gap` uses the existing tenant + user ownership SSOT.
6. Missing authenticated tenant identity fails closed without default fallback.
7. Unknown internal source authority fails before search, archive or persistence.
8. Frontend displays `CALLER_FINDINGS` as caller-asserted/pending, never LIVE.
9. Focused backend/frontend tests, doctors and diff gates pass on exact identity.
10. Independent security review has HIGH 0 / MEDIUM 0 before integration.

## P2 Deferred Acceptance

The following are intentionally not P1 completion gates and remain unimplemented
until a separate scope approval:

1. Typed request bodies and body length/count limits.
2. Search rate limiting before external fetch.
3. Claim-level Tavily corroboration and safe URL normalization.
4. Generic client errors with internal-only diagnostic logging.

## 验证计划

Design Packet:

```bash
git rev-list --left-right --count \
  feature-chaotang-ext...task/pkt-a1-jinyiwei-real-fetch
python3 -m pytest -q \
  backend/tests/test_sec_edgar.py \
  backend/tests/test_jinyiwei_search.py \
  backend/tests/test_jinyiwei_agent.py \
  backend/tests/test_jinyiwei_vet.py \
  backend/tests/test_jinyiwei_evidence_store.py \
  backend/tests/test_jinyiwei_endpoint.py \
  backend/tests/test_real_department_engines.py
node scripts/harness-doctor.mjs
git diff --check
```

Future TDD RED must include:

- `test_fill_gap_rejects_same_user_cross_tenant_task`
- `test_fill_gap_rejects_request_without_resolved_tenant`
- `test_caller_findings_cannot_self_assert_or_persist_primary_source`
- `test_caller_findings_without_sources_remain_pending_and_unpersisted`
- `test_unknown_source_authority_fails_before_search_or_archive`
- frontend source-trust projection tests for `LIVE_SEARCH`, `CALLER_FINDINGS` and
  `FALLBACK`

Deferred P2 RED candidates:

- `test_intel_brief_rejects_oversized_payload`
- `test_intel_search_rate_limit_blocks_before_fetch`
- `test_intel_endpoint_does_not_expose_internal_exception`

Live Tavily or SEC requests are optional smoke evidence and require separate
credential/network approval. They do not replace deterministic tests.
