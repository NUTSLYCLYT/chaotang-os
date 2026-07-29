# EXT-A9-E1 Jinyiwei P1 Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:subagent-driven-development` (recommended) or
> `superpowers:executing-plans` to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the approved P1 ownership, source-authority, persistence and
frontend-honesty gaps without changing the API shape, database schema, product
pages, P2 controls, or W09 state.

**Architecture:** `fill-gap` reuses the existing tenant + user ownership helper
and rejects legacy NULL-tenant tasks. Jinyiwei source authority becomes a
mandatory internal argument with no default; caller assertions return pending
results but never write the tenant-shared evidence pool, while fixed server
adapters explicitly opt into their existing vet and persistence behavior.
The existing frontend read model projects `CALLER_FINDINGS` as caller-asserted
and pending, never as live.

**Tech Stack:** Python 3, FastAPI, SQLAlchemy, pytest, TypeScript, React,
Node test, Playwright, root/backend/frontend Harness.

## Global Constraints

- Integration target remains local `feature-chaotang-ext`.
- Implementation runs in an isolated worktree created from one immutable
  40-character plan commit, not from a moving ref.
- At the clean EXT base, v1 and v2 integrity checks must pass, W08 must return
  `GO / APPROVED_WORK_PACKAGE`, and W09 must remain
  `STOP / BLOCKED_DEPENDENCY`.
- Allowed runtime/test files are exactly those in
  `authority_scope/p1-runtime-scope-amendment.md`.
- Do not modify `backend/src/jinyiwei_vet.py` or
  `backend/src/jinyiwei_evidence_store.py`.
- Caller assertions do not persist, so they cannot downgrade an existing
  `jinyiwei_verified` row with the same claim.
- `source_authority` is a mandatory keyword with no default. Runtime validation
  rejects any value outside `server_adapter` and `caller_asserted` before search,
  archive or persistence. Existing defaults for `search_fn` and `archive` remain.
- Runtime and focused tests form one atomic commit. Packet evidence is a
  later docs-only commit.
- Only the frontend source-trust read model, its two existing consumers and
  focused unit/browser tests may change; no page, Agent, BFF or state machine.
- No P2, dependency, schema, migration, W09, push, deployment, or listener 3050.
- Default tests never make live Tavily or SEC requests.
- Local execution is not production evidence.
- P1 prevents new caller-derived shared rows. It does not migrate, reclassify or
  prove the absence of historical caller-derived rows in production.

## File Responsibility Map

| File | Responsibility |
| --- | --- |
| `backend/web/routers/jinyiwei.py` | Canonical task ownership, explicit source authority, caller no-persist boundary |
| `backend/src/jinyiwei_agent.py` | Mandatory authority contract and caller pending projection |
| `backend/src/real_department_engines.py` | Explicit server-adapter authority for Tavily department execution |
| `backend/tests/test_jinyiwei_endpoint.py` | Authorization, persistence, downgrade and API behavior |
| `backend/tests/test_jinyiwei_agent.py` | Agent trust semantics and explicit server defaults |
| `backend/tests/test_real_department_engines.py` | Department adapter compatibility |
| `backend/tests/test_swarm_execution_loop_api.py` | Fake signature compatibility |
| `backend/tests/test_chaotang_assemble.py` | L3 assembly fake signature compatibility |
| `backend/tests/conftest.py` | No-network fake signature compatibility |
| `frontend/src/features/intel/lib/jinyiwei-brief-contract.ts` | Closed source-label projection and user-facing trust copy |
| `frontend/src/features/intel/lib/jinyiwei-brief-contract.nodetest.ts` | Pure contract RED/GREEN for LIVE, caller and fallback labels |
| `frontend/src/features/intel/components/JinyiweiBriefScroll.tsx` | Consume the canonical trust projection in the scroll footer |
| `frontend/src/features/intel/components/JinyiweiVerdictRail.tsx` | Consume the canonical trust projection in the verdict gate |
| `frontend/e2e/jinyiwei-source-trust.spec.ts` | Browser proof that caller findings render pending, not live |
| This Packet | Exact base/candidate/tree, loop evidence, independent review and acceptance |

## Bounded Loop Protocol

| Loop | Body | Success exit | Failure exit |
| --- | --- | --- | --- |
| Authority | Authorize once on clean EXT base; while isolated work runs, verify exact base/ref continuity and file ownership; re-authorize only after a separately approved integration | Base W08 GO/W09 STOP, EXT ref remains BASE, no writer conflict | Immediate `BLOCKED` |
| TDD | One behavioral RED, root-cause confirmation, minimal GREEN | Named test and adjacent tests pass | Three post-implementation failures with the same fingerprint |
| Verification | Narrow tests, combined tests, backend doctor, root doctor, diff check | Every selected command has expected exit/result | New unexplained failure or out-of-scope path |
| Review | Independent read-only security/code review on exact runtime candidate | HIGH 0 / MEDIUM 0 | Initial review plus one remediation review exhausted |
| Acceptance | Fresh commands on exact candidate/tree | Codex `PASS` | Stale identity, missing evidence or unverified claim |

The expected first RED is evidence, not a loop failure. Each unexpected
post-implementation failure records command, assertion/error fingerprint and
attempt number. Review has at most two total passes. No loop runs indefinitely or
invokes live network by default.

## Exact Identity Protocol

- `BASE_COMMIT` / `BASE_TREE`: the committed plan Packet on local EXT. The
  isolated worktree is created from this literal 40-character commit.
- `RUNTIME_CANDIDATE_COMMIT` / `RUNTIME_CANDIDATE_TREE`: the single atomic
  runtime/test commit. This remains `HEAD` throughout verification and both
  possible independent review passes.
- `FINAL_PACKET_COMMIT` / `FINAL_PACKET_TREE`: created only after review GO by
  adding Packet evidence to the reviewed runtime candidate.
- Independent review is fixed to
  `BASE_COMMIT...RUNTIME_CANDIDATE_COMMIT`.
- Final acceptance and any controlled integration are fixed to
  `FINAL_PACKET_COMMIT`.
- `git diff RUNTIME_CANDIDATE_COMMIT...FINAL_PACKET_COMMIT --name-only` must
  contain only this Packet. Runtime files cannot change after review GO.
- v2 scoped authorization is evaluated on the clean EXT base. Once the isolated
  branch advances, authority continuity is proven by exact SHA/ref/diff checks;
  the candidate is not expected to receive v2 GO while
  `refs/heads/feature-chaotang-ext` remains at BASE. Fresh v2 GO is mandatory
  only after a later, separately approved local integration.

---

### Task 1: Pin exact execution identity and isolate the worktree

**Files:**

- Read: `AGENTS.md`, `backend/AGENTS.md`, this Packet
- Worktree: `.worktrees/ext-a9-e1-p1-remediation`

**Interfaces:**

- Consumes: committed active plan on local EXT.
- Produces: immutable `BASE_COMMIT`, `BASE_TREE` and isolated implementation
  branch.

- [ ] **Step 1: Check clean mainline and authority**

Run:

```bash
cd /home/ubuntu/Projects/chaotang-os/.worktrees/feature-chaotang-ext
git status --short --branch
git rev-parse HEAD
node scripts/execution-authority.mjs --check
node scripts/execution-authority-v2.mjs --check
node scripts/execution-authority-v2.mjs --authorize --work-package R0-W08
node scripts/execution-authority-v2.mjs --authorize --work-package R0-W09
```

Expected: the plan Packet has already been committed so the worktree is clean;
both integrity checks exit 0 but do not authorize product work; W08 exits 0/GO
and W09 exits 2/STOP. W09's expected non-zero result is a passing negative gate.

- [ ] **Step 2: Resolve immutable base and create the worktree**

Capture identity in the EXT worktree, then use that shell variable from the
repository root:

```bash
cd /home/ubuntu/Projects/chaotang-os/.worktrees/feature-chaotang-ext
BASE_COMMIT="$(git rev-parse HEAD)"
BASE_TREE="$(git show -s --format=%T "$BASE_COMMIT")"
test "$(git rev-parse refs/heads/feature-chaotang-ext)" = "$BASE_COMMIT"
printf 'BASE_COMMIT=%s\nBASE_TREE=%s\n' "$BASE_COMMIT" "$BASE_TREE"
cd /home/ubuntu/Projects/chaotang-os
git worktree add \
  .worktrees/ext-a9-e1-p1-remediation \
  -b task/ext-a9-e1-p1-remediation-20260730 \
  "$BASE_COMMIT"
```

Immediately print and record both values, then use the captured variable during
worktree creation; do not resolve a moving branch ref. The clean-status gate
proves `HEAD` is the committed plan Packet. All later diff and review commands
use this captured SHA.

- [ ] **Step 3: Run focused baseline in the isolated worktree**

```bash
cd /home/ubuntu/Projects/chaotang-os/.worktrees/ext-a9-e1-p1-remediation
node scripts/execution-authority.mjs --check
node scripts/execution-authority-v2.mjs --check
node scripts/execution-authority-v2.mjs --authorize --work-package R0-W08
python3 -m pytest -q \
  backend/tests/test_jinyiwei_agent.py \
  backend/tests/test_jinyiwei_endpoint.py
```

Expected: integrity checks pass, W08 still GO because isolated `HEAD` and EXT ref
both equal BASE, and the baseline is green. After the branch advances, do not
misinterpret the expected pinned-head STOP as revoked scope; use the exact
continuity gates defined above. No commit.

---

### Task 2: Prove and close `fill-gap` ownership

**Files:**

- Modify: `backend/tests/test_jinyiwei_endpoint.py`
- Modify: `backend/web/routers/jinyiwei.py`

**Interfaces:**

- Consumes:
  `get_owned_decision_task(db, task_id, requester_id, requester_tenant_id)` and
  fail-closed `CurrentUser.tenant_id`.
- Produces: tenant + user ownership and NULL-tenant fail-closed behavior.

- [ ] **Step 1: Make test tasks tenant-explicit**

Use:

```python
def _seed_awaiting_evidence_task(
    db,
    task_id: str,
    user_id: str = "1",
    tenant_id: int | None = 1,
) -> None:
    from src.db.models import DecisionTask

    db.add(
        DecisionTask(
            id=task_id,
            tenant_id=tenant_id,
            user_id=user_id,
            raw_question="是否应该追加两百万投资？",
            status="awaiting_evidence",
            source_label="LIVE",
        )
    )
    db.commit()
```

Set `tenant_id=1` on the direct non-terminal fixture too.

- [ ] **Step 2: Add deterministic RED tests**

Add:

```python
def test_fill_gap_rejects_same_user_cross_tenant_task(
    isolated_session_local,
    monkeypatch,
):
    monkeypatch.setattr(jinyiwei_router, "tavily_search", lambda *_a, **_k: [])
    db = isolated_session_local()
    _seed_awaiting_evidence_task(
        db,
        "task_other_tenant_same_user",
        user_id="1",
        tenant_id=2,
    )
    db.close()

    response = client.post(
        "/api/intel/evidence/fill-gap",
        json={"task_id": "task_other_tenant_same_user", "gap": "客户资质"},
    )
    assert response.json()["success"] is False
    assert "无权" in response.json()["error"]


def test_fill_gap_rejects_legacy_task_without_tenant(
    isolated_session_local,
    monkeypatch,
):
    monkeypatch.setattr(jinyiwei_router, "tavily_search", lambda *_a, **_k: [])
    db = isolated_session_local()
    _seed_awaiting_evidence_task(
        db,
        "task_legacy_null_tenant",
        user_id="1",
        tenant_id=None,
    )
    db.close()

    response = client.post(
        "/api/intel/evidence/fill-gap",
        json={"task_id": "task_legacy_null_tenant", "gap": "客户资质"},
    )
    assert response.json()["success"] is False
    assert "无权" in response.json()["error"]
```

Add `test_fill_gap_rejects_request_without_resolved_tenant`. Override
`get_current_user` with the same authenticated user id but `tenant_id=None`,
restore the dependency override in `finally`, and install local counters around
the isolated `SessionLocal` factory and a raising Tavily fake. Assert the
response is the tenant fail-closed error, database session opens remain zero,
Tavily calls remain zero, and the isolated database has no new evidence row.

- [ ] **Step 3: Prove RED for the real authorization gap**

```bash
cd /home/ubuntu/Projects/chaotang-os/.worktrees/ext-a9-e1-p1-remediation
python3 -m pytest -q \
  backend/tests/test_jinyiwei_endpoint.py::test_fill_gap_rejects_same_user_cross_tenant_task \
  backend/tests/test_jinyiwei_endpoint.py::test_fill_gap_rejects_legacy_task_without_tenant \
  backend/tests/test_jinyiwei_endpoint.py::test_fill_gap_rejects_request_without_resolved_tenant
```

Expected: all three fail because the current route checks only `user_id` and
uses a defaulting tenant resolver; no network request occurs.

- [ ] **Step 4: Reuse canonical ownership**

Replace the local `DecisionTask` query/user comparison with:

```python
from src.decision_task_access import get_owned_decision_task
requester_id = str(
    user.user_id or user.username or user.tenant_slug or "anonymous"
)
if user.tenant_id is None:
    return fail("当前会话缺少有效租户身份")

db = SessionLocal()
try:
    task, access_error = get_owned_decision_task(
        db,
        task_id=task_id,
        requester_id=requester_id,
        requester_tenant_id=user.tenant_id,
    )
    if access_error:
        return fail(access_error)
    if task.status != "awaiting_evidence":
        return fail(
            f"任务当前状态是 {task.status}，不是 awaiting_evidence，"
            "不能填补证据缺口"
        )
finally:
    db.close()
```

Update the route docstring in the same file so it no longer claims
`DecisionTask` lacks `tenant_id`; document the canonical tenant + user helper and
NULL-tenant fail-closed behavior. This is not a second ownership implementation.

- [ ] **Step 5: Prove GREEN and adjacent behavior**

```bash
python3 -m pytest -q \
  backend/tests/test_jinyiwei_endpoint.py::test_fill_gap_rejects_same_user_cross_tenant_task \
  backend/tests/test_jinyiwei_endpoint.py::test_fill_gap_rejects_legacy_task_without_tenant \
  backend/tests/test_jinyiwei_endpoint.py::test_fill_gap_rejects_request_without_resolved_tenant \
  backend/tests/test_jinyiwei_endpoint.py::test_fill_gap_rejects_task_owned_by_another_user \
  backend/tests/test_jinyiwei_endpoint.py::test_fill_gap_rejects_task_not_awaiting_evidence \
  backend/tests/test_jinyiwei_endpoint.py::test_fill_gap_success_persists_to_shared_pool
```

Expected: 6 passed. Do not commit yet.

---

### Task 3: Prove and close caller trust/persistence

**Files:**

- Modify: `backend/src/jinyiwei_agent.py`
- Modify: `backend/web/routers/jinyiwei.py`
- Modify: `backend/src/real_department_engines.py`
- Modify focused tests/fakes listed in the scope amendment

**Interfaces:**

- Produces:
  `SourceAuthority = Literal["server_adapter", "caller_asserted"]`.
- Produces:
  `gather_intel(query, *, source_authority, search_fn=None, archive=True)` with
  no `source_authority` default.
- Invariant: all caller assertions, with or without sources, return pending and
  never persist.

- [ ] **Step 1: Prove the mandatory-keyword contract RED**

Add `test_gather_intel_requires_explicit_source_authority` in
`test_jinyiwei_agent.py`. It calls the current function without the keyword and
expects `TypeError`. Run only this test.

Expected RED: `DID NOT RAISE TypeError`, because current production silently
accepts an omitted authority. This is the only RED whose desired behavior is a
signature error.

- [ ] **Step 2: Make the keyword mandatory and restore explicit callers**

Add:

```python
from typing import Callable, Literal

SourceAuthority = Literal["server_adapter", "caller_asserted"]

def gather_intel(
    query: str,
    *,
    source_authority: SourceAuthority,
    search_fn: Callable[[str], list] | None = None,
    archive: bool = True,
) -> dict:
```

At this step only, preserve existing grading behavior. Make every production
caller explicit:

- `/api/intel/brief`: `caller_asserted` for non-empty caller findings and
  `server_adapter` for Tavily;
- `/api/intel/evidence/fill-gap`: `server_adapter`;
- `real_department_engines.adapt_jinyiwei`: `server_adapter`.

Update all direct agent tests and the fakes in `conftest.py`,
`test_swarm_execution_loop_api.py`, `test_real_department_engines.py`, and
`test_chaotang_assemble.py` to require/accept the keyword. Do not derive the
authority from HTTP, environment variables or a finding. Run the existing
focused suite; the contract RED is now GREEN and compatibility is restored.

- [ ] **Step 3: Prove invalid authority RED before validation code**

Add `test_unknown_source_authority_fails_before_search_or_archive`. Pass a
runtime string such as `"server_adaptor"` (using a typing cast only in the test),
use a search fake that increments a counter, and expect `ValueError`. Assert the
counter stays zero and no archive result is produced.

Run only this test. Expected RED: no `ValueError` and/or search counter becomes
one. A `TypeError` is not accepted because Step 2 already established the
mandatory keyword.

- [ ] **Step 4: Implement closed-world runtime validation**

Before search, archive or finding conversion:

```python
if source_authority not in {"server_adapter", "caller_asserted"}:
    raise ValueError(f"unsupported source authority: {source_authority}")
```

Make `_finding_to_item(..., *, source_authority)` mandatory and apply the same
closed-world guard there as defense in depth. Pass the authority from
`gather_intel`. Re-run the invalid-authority test and the agent suite GREEN.
A `Literal` annotation alone is not runtime validation.

- [ ] **Step 5: Prove caller trust and no-persist RED**

Add these named endpoint tests:

- `test_caller_findings_cannot_self_assert_or_persist_primary_source`;
- `test_caller_findings_without_sources_remain_pending_and_unpersisted`;
- `test_caller_findings_cannot_downgrade_existing_verified_evidence`.

The first two assert direct response `impact="待核"`,
`primary_source is False`, caller-asserted reason, and an empty shared-pool
query even with `include_pending=True`. The downgrade test first creates a
server-adapter verified row through monkeypatched Tavily, submits a caller row
with the same claim, and asserts the original `jinyiwei_verified/LIVE_SEARCH`
row remains unchanged.

Run exactly:

```bash
python3 -m pytest -q \
  backend/tests/test_jinyiwei_endpoint.py::test_caller_findings_cannot_self_assert_or_persist_primary_source \
  backend/tests/test_jinyiwei_endpoint.py::test_caller_findings_without_sources_remain_pending_and_unpersisted \
  backend/tests/test_jinyiwei_endpoint.py::test_caller_findings_cannot_downgrade_existing_verified_evidence
```

Expected RED: behavioral assertion failures from verified/persisted caller data,
never `TypeError`.

- [ ] **Step 6: Implement caller pending projection and persistence fence**

In `_finding_to_item`, after deterministic vetting, force every
`caller_asserted` item, with or without sources, to:

```python
{
    **v,
    "grade": "调用方声明",
    "primary": False,
    "decision": "待核",
    "reason": "调用方声明未经服务端或人工核验，必须待核后入库",
}
```

In `/api/intel/brief`, call `_persist_brief_items` only when:

```python
source_authority == "server_adapter" and doc.get("items")
```

Caller items stay in the direct response but never enter the tenant-shared pool.
Convert the existing pool-persistence and tenant-isolation write tests to
monkeypatched Tavily server-adapter paths. Preserve the long-claim live-search
test. Do not modify evidence-store semantics or schema.

- [ ] **Step 7: Prove all backend GREEN and no downgrade**

```bash
python3 -m pytest -q \
  backend/tests/test_jinyiwei_agent.py \
  backend/tests/test_jinyiwei_endpoint.py \
  backend/tests/test_jinyiwei_evidence_store.py \
  backend/tests/test_real_department_engines.py \
  backend/tests/test_swarm_execution_loop_api.py \
  backend/tests/test_chaotang_assemble.py
```

Expected: all selected tests pass without live network.

- [ ] **Step 8: Keep the backend changes uncommitted**

Run `git diff --check` and confirm only approved backend/test paths changed.
Frontend behavior must join the same atomic runtime/test commit after its own
RED/GREEN cycle.

---

### Task 4: Make frontend source trust closed-world and honest

**Files:**

- Modify: `frontend/src/features/intel/lib/jinyiwei-brief-contract.ts`
- Create: `frontend/src/features/intel/lib/jinyiwei-brief-contract.nodetest.ts`
- Modify: `frontend/src/features/intel/components/JinyiweiBriefScroll.tsx`
- Modify: `frontend/src/features/intel/components/JinyiweiVerdictRail.tsx`
- Create: `frontend/e2e/jinyiwei-source-trust.spec.ts`

**Interfaces:**

- Consumes the existing `sourceLabel` contract.
- Produces one canonical projection with `live`, `pending` and user-facing copy.
- `LIVE_SEARCH` is live; `CALLER_FINDINGS` is pending/caller-asserted;
  `FALLBACK` and unknown/missing values are not live.

- [ ] **Step 1: Add pure-contract and browser RED tests**

Create focused Node tests that assert:

1. `LIVE_SEARCH` returns live copy;
2. `CALLER_FINDINGS` is not live and includes “调用方声明” and “待核”;
3. `FALLBACK`, missing and unknown source labels fail closed as fallback;
4. `isLiveBrief` is true only for `LIVE_SEARCH`.

Run:

```bash
(
  cd /home/ubuntu/Projects/chaotang-os/.worktrees/ext-a9-e1-p1-remediation/frontend
  node --test --experimental-strip-types \
    src/features/intel/lib/jinyiwei-brief-contract.nodetest.ts
)
```

Expected RED: current `isLiveBrief` treats `CALLER_FINDINGS` as live and the
canonical trust projection does not exist.

Also create the focused Playwright test. It intercepts the existing brief API
with a deterministic `CALLER_FINDINGS` response, visits
`/zhuanshu/jinyiwei`, submits a query, and expects pending caller-source copy.
It must:

1. call the existing `seedSession(page)` before navigation;
2. intercept the auxiliary signals API with a deterministic empty response;
3. wait for the page title before submitting;
4. count and assert exactly one brief API request;
5. prove RED from the caller-trust copy, not from auth redirect, page load or an
   unrelated request.

Run it before implementation:

```bash
(
  cd /home/ubuntu/Projects/chaotang-os/.worktrees/ext-a9-e1-p1-remediation/frontend
  pnpm exec playwright test \
    e2e/jinyiwei-source-trust.spec.ts --project=chromium
)
```

Expected RED: current components render caller findings as a valid real source.
The harness may start dev port 3002; it must not bind or operate 3050.

- [ ] **Step 2: Implement the minimum canonical projection**

Add a small typed helper such as `resolveBriefSourceTrust(brief)` in the existing
contract module. It returns a closed-world `{ live, pending, text }` projection.
Make `isLiveBrief` delegate to this helper. Do not add a state machine.

- [ ] **Step 3: Use one projection in both existing consumers**

`JinyiweiBriefScroll` displays the projection text in its footer.
`JinyiweiVerdictRail` uses `live` for the gate, `pending` for the unknown/yellow
tone, and the same text. No component may synthesize a second source-trust rule.

- [ ] **Step 4: Prove unit GREEN and type compatibility**

```bash
(
  cd /home/ubuntu/Projects/chaotang-os/.worktrees/ext-a9-e1-p1-remediation/frontend
  node --test --experimental-strip-types \
    src/features/intel/lib/jinyiwei-brief-contract.nodetest.ts \
    src/features/intel/hooks/use-jinyiwei-brief.nodetest.ts
  pnpm exec tsc --noEmit
)
```

- [ ] **Step 5: Prove browser GREEN**

The focused Playwright test now asserts both:

- “调用方声明，待核” is visible;
- “真实来源标签有效” and “有真实来源标签” are absent.

Run only the focused spec:

```bash
(
  cd /home/ubuntu/Projects/chaotang-os/.worktrees/ext-a9-e1-p1-remediation/frontend
  pnpm exec playwright test \
    e2e/jinyiwei-source-trust.spec.ts --project=chromium
)
```

- [ ] **Step 6: Create one atomic runtime/test commit**

```bash
git diff --check
git diff --name-status
git add \
  backend/src/jinyiwei_agent.py \
  backend/src/real_department_engines.py \
  backend/web/routers/jinyiwei.py \
  backend/tests/conftest.py \
  backend/tests/test_jinyiwei_agent.py \
  backend/tests/test_jinyiwei_endpoint.py \
  backend/tests/test_real_department_engines.py \
  backend/tests/test_swarm_execution_loop_api.py \
  backend/tests/test_chaotang_assemble.py \
  frontend/src/features/intel/lib/jinyiwei-brief-contract.ts \
  frontend/src/features/intel/lib/jinyiwei-brief-contract.nodetest.ts \
  frontend/src/features/intel/components/JinyiweiBriefScroll.tsx \
  frontend/src/features/intel/components/JinyiweiVerdictRail.tsx \
  frontend/e2e/jinyiwei-source-trust.spec.ts
git commit -m "fix: close jinyiwei p1 trust boundaries"
```

Only files actually changed are staged. The commit must contain no Packet, P2,
database or generated file.

---

### Task 5: Verify and independently review the exact runtime candidate

**Files:**

- Read only during verification/review. Packet evidence is written only after GO.

**Interfaces:**

- Consumes: immutable base SHA and one runtime/test commit.
- Produces: runtime candidate commit/tree, review session identity, report
  digest and bounded remediation decision.

- [ ] **Step 1: Run combined behavior verification**

```bash
python3 -m pytest -q \
  backend/tests/test_sec_edgar.py \
  backend/tests/test_jinyiwei_search.py \
  backend/tests/test_jinyiwei_agent.py \
  backend/tests/test_jinyiwei_vet.py \
  backend/tests/test_jinyiwei_evidence_store.py \
  backend/tests/test_jinyiwei_endpoint.py \
  backend/tests/test_real_department_engines.py \
  backend/tests/test_swarm_execution_loop_api.py \
  backend/tests/test_chaotang_assemble.py
(
  cd frontend
  node --test --experimental-strip-types \
    src/features/intel/lib/jinyiwei-brief-contract.nodetest.ts \
    src/features/intel/hooks/use-jinyiwei-brief.nodetest.ts
  pnpm exec tsc --noEmit
  pnpm exec playwright test \
    e2e/jinyiwei-source-trust.spec.ts --project=chromium
)
```

- [ ] **Step 2: Run Harness and exact-diff gates**

```bash
cd /home/ubuntu/Projects/chaotang-os/.worktrees/ext-a9-e1-p1-remediation
(cd backend && python scripts/harness_doctor.py)
(cd frontend && pnpm harness:doctor)
node scripts/harness-doctor.mjs
git diff "$BASE_COMMIT"...HEAD --check
git diff "$BASE_COMMIT"...HEAD --name-status
test "$(git rev-parse refs/heads/feature-chaotang-ext)" = "$BASE_COMMIT"
```

Expected: doctors have zero errors, changed paths are within the amendment, and
the integration ref has not moved while the isolated candidate is reviewed.
Do not run scoped `--authorize` here: candidate HEAD intentionally differs from
the still-quiescent EXT ref, so pinned-head rejection would be expected.

- [ ] **Step 3: Pin runtime candidate identity**

Capture:

```bash
RUNTIME_CANDIDATE_COMMIT="$(git rev-parse HEAD)"
RUNTIME_CANDIDATE_TREE="$(
  git show -s --format=%T "$RUNTIME_CANDIDATE_COMMIT"
)"
```

Do not edit or commit Packet evidence yet. Keep this exact runtime candidate as
`HEAD` while all independent review passes run. Prepare the evidence text
outside the governed worktree until review GO.

- [ ] **Step 4: Run independent read-only review**

Spawn a fresh Codex review session with no write scope. It reviews only the
pinned base/runtime candidate/tree and changed paths.

For every pass, preserve:

- candidate commit and tree;
- reviewer session identity;
- report SHA-256;
- verbatim verdict and findings.

Pass 1 is later registered as `codex_review/pass-1.md` even if it fails. If one
remediation occurs, pass 2 uses the amended runtime candidate identity and is
registered as `codex_review/pass-2.md`. Never overwrite or omit the failed
first review.

Required checks:

1. tenant + user ownership and NULL-tenant fail-closed;
2. mandatory source authority at every production caller;
3. caller no-persist and no verified-row downgrade;
4. frontend caller-source honesty and closed-world projection;
5. no P2/database/out-of-scope frontend change;
6. offline test determinism.

Exit requires HIGH 0 / MEDIUM 0.

- [ ] **Step 5: Apply bounded remediation**

If review has HIGH/MEDIUM:

1. record the finding and fingerprint;
2. add a behavior RED;
3. apply an in-scope minimal fix;
4. amend the single runtime/test commit;
5. regenerate runtime candidate commit/tree;
6. run one fresh independent pass.

Maximum: one remediation and two total review passes. Any HIGH/MEDIUM remaining
after pass 2 sets `BLOCKED`; do not continue looping.

- [ ] **Step 6: Register review evidence after GO**

Only after a review returns HIGH 0 / MEDIUM 0:

1. write exact base/runtime commit and tree, commands, counts, review text,
   session identity and digest for every attempted pass into this Packet;
2. commit those Packet-only files;
3. capture `FINAL_PACKET_COMMIT` / `FINAL_PACKET_TREE`;
4. prove `RUNTIME_CANDIDATE_COMMIT...FINAL_PACKET_COMMIT` contains only this
   Packet.

---

### Task 6: Codex acceptance and morning checkpoint

**Files:**

- Packet evidence and asset ledger only after implementation/review PASS

- [ ] **Step 1: Run fresh acceptance**

On `FINAL_PACKET_COMMIT`, run the non-authorizing v1/v2 integrity checks,
combined backend/frontend tests, three doctors, focused browser proof, diff
checks and review digest verification. Confirm runtime paths are byte-identical
to the reviewed runtime candidate and
`refs/heads/feature-chaotang-ext == BASE_COMMIT`.

```bash
node scripts/execution-authority.mjs --check
node scripts/execution-authority-v2.mjs --check
```

Do not require scoped v2 GO on the isolated candidate: its `HEAD` intentionally
differs from the quiescent integration ref. The result at this stage is
`PRE_INTEGRATION_PASS`, not integrated EXT acceptance.

- [ ] **Step 2: Record non-goals and rollback**

Confirm one runtime/test commit is independently revertable; no existing DB row
was migrated or reclassified; no push, deployment, migration, W09 activation or
3050 operation occurred.

- [ ] **Step 3: Decide local EXT integration**

Present `FINAL_PACKET_COMMIT` / `FINAL_PACKET_TREE` for controlled local
fast-forward only when Codex acceptance is `PRE_INTEGRATION_PASS`.
`CONDITIONAL PASS`, `FAIL` and `BLOCKED` do not permit an integration request.

If and only if the project owner later approves that exact local integration,
fast-forward EXT and run fresh integrated-HEAD acceptance:

```bash
node scripts/execution-authority.mjs --check
node scripts/execution-authority-v2.mjs --check
node scripts/execution-authority-v2.mjs --authorize --work-package R0-W08
node scripts/execution-authority-v2.mjs --authorize --work-package R0-W09
```

Expected after integration: both checks exit 0/non-authorizing, W08 GO, W09
STOP. Fresh tests/review-digest checks on the integrated exact HEAD then promote
`PRE_INTEGRATION_PASS` to final `PASS`. This plan does not itself authorize or
perform that integration.

- [ ] **Step 4: Continue only with safe downstream work**

After P1 acceptance:

- update the EXT asset matrix disposition;
- retain P2 as a separate unimplemented Packet;
- run the W08 closeout preflight and report the real non-developer user evidence
  blocker;
- start the next asset family as read-only audit/design only.

## Morning Handoff

The handoff contains:

- exact base/candidate commit and tree;
- loop attempts and failure fingerprints;
- RED and GREEN evidence;
- final test counts and all three doctor results;
- independent reviewer session, findings and report digest;
- changed files and rollback;
- P2 and W08 user-acceptance blockers;
- explicit no push/deploy/migration/3050 statement;
- final `PRE_INTEGRATION_PASS`, `PASS`, `CONDITIONAL PASS`, `FAIL`, or `BLOCKED`.
