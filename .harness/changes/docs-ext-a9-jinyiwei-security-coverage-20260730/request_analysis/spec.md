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
| Tenant identity | `src.tenant.resolve_current_tenant_id` | evidence read/write and ownership checks | Cross-tenant negative tests |
| DecisionTask ownership | `src.decision_task_access.get_owned_decision_task` | `fill-gap` | Reuse existing SSOT; do not add a second ownership rule |
| Source trust | server-owned adapter type + normalized provenance | `jinyiwei_vet` and evidence store | Caller cannot self-assert server-verified tier |
| Evidence state | `JinyiweiEvidence.decision/trust/source_label` | shared evidence API and departments | `拒` never returned; `待核` opt-in only |
| SEC verification | successful fixed-host companyfacts response | finance review flow | Existing `test_sec_edgar.py` |

## 范围

### This design Packet

- Pin exact current EXT and historical source identity.
- Record existing controls and confirmed or test-pending gaps.
- Define remediation architecture, TDD order and verification commands.
- Update no runtime behavior.

### Future remediation candidate

- `backend/web/routers/jinyiwei.py`
- `backend/src/jinyiwei_vet.py`
- a narrowly scoped source-provenance helper if required;
- `backend/src/direct_rate_limit.py` only if a new `intel` mode is selected;
- focused tests under `backend/tests/`.

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
   source tier is not authoritative. They enter as `CALLER_ASSERTED / 待核`
   unless a separate human approval record promotes them.
3. `jinyiwei_vet` receives normalized server provenance instead of trusting a
   raw caller `tier` field.
4. Tenant-shared `jinyiwei_verified` rows require either server-verifiable
   provenance or a durable human approval reference.

Rejected alternatives:

- Disable caller findings entirely: safer but destroys useful offline intake.
- Keep current self-asserted tier: preserves compatibility but lets authenticated
  callers manufacture tenant-shared verified evidence.
- Store caller assertions as verified but user-private: reduces blast radius yet
  still misstates trust; not selected.

## 风险与回滚边界

- Tightening caller trust can change existing `CALLER_FINDINGS` results from green
  to pending. The API shape should remain compatible; only trust semantics change.
- Reusing `get_owned_decision_task` is preferred over another inline ownership
  implementation.
- In-process rate limiting is a local guard, not a distributed production quota.
  The Packet must not claim production-grade global enforcement.
- Runtime remediation must be one revertable commit and cannot include database
  migration. Existing rows are not silently reclassified in this scope.

## 计划确认记录

- 批准人：项目业主
- 批准日期：2026-07-30
- 批准范围：方案 A，先建立 `EXT-A9-E1` 锦衣卫安全覆盖审计 Packet。
- 明确未批准：产品代码修复、W09 激活、push、部署、数据库迁移、3050 操作。

## 验收标准

1. Historical candidate has no unabsorbed commit inventory.
2. Existing controls and every candidate gap have exact code/test evidence.
3. P1 findings have named failing tests before runtime implementation.
4. No caller-controlled field can create server-verified shared evidence.
5. `fill-gap` uses the existing tenant + user ownership SSOT.
6. Network work is bounded by typed input, timeout and rate policy.
7. Focused tests, backend doctor and root doctor pass on the exact candidate.
8. Independent security review has HIGH 0 / MEDIUM 0 before integration.

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
- `test_caller_findings_cannot_self_assert_primary_source`
- `test_intel_brief_rejects_oversized_payload`
- `test_intel_search_rate_limit_blocks_before_fetch`
- `test_intel_endpoint_does_not_expose_internal_exception`

Live Tavily or SEC requests are optional smoke evidence and require separate
credential/network approval. They do not replace deterministic tests.
