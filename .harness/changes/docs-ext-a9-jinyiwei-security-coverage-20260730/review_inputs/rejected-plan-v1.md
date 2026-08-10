# REJECTED V1: EXT-A9-E1 Jinyiwei P1 Remediation Implementation Plan

> Rejected by adversarial plan review on 2026-07-30. Do not execute this file.
> The active plan is `../implementation_plan.md`.

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:subagent-driven-development` (recommended) or
> `superpowers:executing-plans` to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the two approved P1 trust-boundary gaps without changing the API
shape, database schema, product pages, or W09 state.

**Architecture:** Reuse the existing `get_owned_decision_task` tenant + user
ownership source of truth for `fill-gap`. Add an internal, server-controlled
`source_authority` input to the Jinyiwei agent so caller-provided findings
remain useful but cannot promote themselves to server-verified shared evidence.

**Tech Stack:** Python 3, FastAPI, SQLAlchemy, pytest, root/backend Harness.

## Global Constraints

- Integration target remains local `feature-chaotang-ext`.
- Execute implementation in an isolated worktree created from the exact
  integrated plan commit.
- `R0-W08` must return `GO / APPROVED_WORK_PACKAGE` before every behavior-change
  phase; `R0-W09` remains `STOP / BLOCKED_DEPENDENCY`.
- Allowed runtime files:
  `backend/web/routers/jinyiwei.py`,
  `backend/src/jinyiwei_agent.py`,
  `backend/src/real_department_engines.py`,
  `backend/tests/test_jinyiwei_endpoint.py`,
  `backend/tests/test_jinyiwei_agent.py`, and
  `backend/tests/test_real_department_engines.py`,
  `backend/tests/test_swarm_execution_loop_api.py`, and
  `backend/tests/conftest.py` only if its mock signature requires compatibility.
- Do not modify `backend/src/jinyiwei_vet.py`: the trust boundary belongs at the
  caller/server provenance input, not in the generic deterministic vet rules.
- No P2 input schema, rate-limit, Tavily corroboration, or generic-error work.
- No new page, Agent, BFF, task/status system, evidence store, dependency, or
  database migration.
- No push, deployment, database migration, or listener 3050 operation.
- Default tests must not make live Tavily or SEC requests.
- A historical branch, screenshot, or local server response is not production
  evidence.

## File Responsibility Map

| File | Responsibility in this plan |
| --- | --- |
| `backend/web/routers/jinyiwei.py` | Apply canonical DecisionTask ownership and choose internal source authority |
| `backend/src/jinyiwei_agent.py` | Convert caller assertions into pending evidence without weakening server-adapter vet behavior |
| `backend/src/real_department_engines.py` | Explicitly identify Tavily-backed department execution as server adapter input |
| `backend/tests/test_jinyiwei_endpoint.py` | Prove cross-tenant rejection and caller-assertion API/persistence behavior |
| `backend/tests/test_jinyiwei_agent.py` | Prove source-authority behavior at the agent boundary |
| `backend/tests/test_real_department_engines.py` | Preserve trusted department adapter behavior |
| `backend/tests/test_swarm_execution_loop_api.py` | Keep the Jinyiwei fake compatible with mandatory source authority |
| `backend/tests/conftest.py` | Keep the no-network mock compatible with mandatory source authority |
| This Packet | Record exact commands, review evidence, disposition, and remaining P2 work |

## Bounded Loop Protocol

The overnight task uses event-driven loops, not an unbounded retry process.

| Loop | Trigger | Body | Success exit | Failure exit |
| --- | --- | --- | --- | --- |
| Authority | Before each task and integration | Check clean scope, W08 GO, W09 STOP | Exact scope remains authorized | Any STOP, scope conflict, writer conflict |
| TDD | One invariant at a time | RED test, root-cause check, minimal GREEN, refactor | Named test and adjacent suite pass | Three post-implementation failures with the same fingerprint |
| Verification | After each commit and final candidate | Narrow pytest, combined pytest, backend doctor, root doctor, diff check | All selected commands exit as expected | New unexplained failure or dirty out-of-scope file |
| Review | After final implementation candidate | Independent read-only security then code review | HIGH 0 / MEDIUM 0 | Any unresolved HIGH/MEDIUM; max two remediation rounds |
| Acceptance | Exact candidate only | Re-run authority, tests, doctors, inspect diff/tree | Codex `PASS` for local integration | Evidence mismatch, stale HEAD, or unverified claim |

Verification runs after every independently testable task and at least every
15 minutes during active changes. It does not repeatedly run expensive or live
network checks. The expected initial RED does not count as a loop failure.

---

### Task 1: Establish isolated execution baseline

**Files:**

- Read: `AGENTS.md`
- Read: `backend/AGENTS.md`
- Read: this Packet and implementation plan
- Create worktree: `.worktrees/ext-a9-e1-p1-remediation`

**Interfaces:**

- Consumes: exact plan commit on `feature-chaotang-ext`.
- Produces: isolated branch `task/ext-a9-e1-p1-remediation-20260730` with clean
  status and pinned baseline evidence.

- [ ] **Step 1: Verify the integration target and authority**

Run:

```bash
git status --short --branch
git rev-parse HEAD
node scripts/execution-authority-v2.mjs --authorize --work-package R0-W08
test "$(node scripts/execution-authority-v2.mjs \
  --authorize --work-package R0-W09 2>/dev/null; true)" != ""
```

Expected:

- mainline worktree is clean;
- W08 returns `GO / APPROVED_WORK_PACKAGE`;
- a separately captured W09 command exits non-zero with
  `STOP / BLOCKED_DEPENDENCY`; that expected non-zero is recorded as a passing
  negative gate, not treated as an execution failure.

- [ ] **Step 2: Create an isolated worktree from the exact plan commit**

Resolve the exact 40-character base once, record its tree in the execution
evidence, and use the immutable SHA rather than the moving branch ref:

```bash
BASE_COMMIT="$(git rev-parse feature-chaotang-ext)"
BASE_TREE="$(git show -s --format=%T "$BASE_COMMIT")"
git worktree add \
  .worktrees/ext-a9-e1-p1-remediation \
  -b task/ext-a9-e1-p1-remediation-20260730 \
  "$BASE_COMMIT"
```

Expected: the new branch and worktree point to the exact committed plan SHA;
`BASE_COMMIT` and `BASE_TREE` are copied into Packet CI evidence before review.

- [ ] **Step 3: Re-run authority and baseline tests inside the worktree**

Run:

```bash
node scripts/execution-authority-v2.mjs --authorize --work-package R0-W08
python3 -m pytest -q \
  backend/tests/test_jinyiwei_agent.py \
  backend/tests/test_jinyiwei_endpoint.py
```

Expected: W08 GO and the unchanged focused baseline passes.

No commit is created by this task.

---

### Task 2: Reject same-user cross-tenant `fill-gap`

**Files:**

- Modify: `backend/tests/test_jinyiwei_endpoint.py`
- Modify: `backend/web/routers/jinyiwei.py`

**Interfaces:**

- Consumes:
  `get_owned_decision_task(db, task_id, requester_id, requester_tenant_id)` and
  `resolve_current_tenant_id()`.
- Produces: `fill-gap` access only when both task tenant and task user match the
  authenticated requester.

- [ ] **Step 1: Make the task fixture tenant-explicit**

Change the focused fixture signature and model construction to:

```python
def _seed_awaiting_evidence_task(
    db,
    task_id: str,
    user_id: str = "1",
    tenant_id: int = 1,
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

Also add `tenant_id=1` to the direct `DecisionTask` construction in
`test_fill_gap_rejects_task_not_awaiting_evidence`.

- [ ] **Step 2: Write the failing cross-tenant test**

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
        json={
            "task_id": "task_other_tenant_same_user",
            "gap": "客户资质是否齐全",
        },
    )

    assert response.json()["success"] is False
    assert "无权" in response.json()["error"]
```

- [ ] **Step 3: Run the new test and verify RED**

Run:

```bash
python3 -m pytest -q \
  backend/tests/test_jinyiwei_endpoint.py::test_fill_gap_rejects_same_user_cross_tenant_task
```

Expected: FAIL because the current route checks only `task.user_id`.

If it fails for fixture/auth setup instead, fix only the test until it reaches
the intended authorization failure.

- [ ] **Step 4: Write the legacy NULL-tenant fail-closed test**

Add:

```python
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
        json={
            "task_id": "task_legacy_null_tenant",
            "gap": "客户资质是否齐全",
        },
    )

    assert response.json()["success"] is False
    assert "无权" in response.json()["error"]
```

Run both new tests and confirm they fail because the route checks only user
ownership. NULL tenant is deliberately rejected; this Packet does not infer or
migrate legacy ownership.

- [ ] **Step 5: Replace inline ownership with the canonical helper**

In `intel_evidence_fill_gap`, import and use:

```python
from src.decision_task_access import get_owned_decision_task
from src.tenant import resolve_current_tenant_id

requester_id = str(
    user.user_id or user.username or user.tenant_slug or "anonymous"
)
requester_tenant_id = resolve_current_tenant_id()

db = SessionLocal()
try:
    task, access_error = get_owned_decision_task(
        db,
        task_id=task_id,
        requester_id=requester_id,
        requester_tenant_id=requester_tenant_id,
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

Remove the local `DecisionTask` query and user-only comparison. Do not create a
second helper or change the canonical helper.

- [ ] **Step 6: Verify GREEN and adjacent ownership behavior**

Run:

```bash
python3 -m pytest -q \
  backend/tests/test_jinyiwei_endpoint.py::test_fill_gap_rejects_same_user_cross_tenant_task \
  backend/tests/test_jinyiwei_endpoint.py::test_fill_gap_rejects_legacy_task_without_tenant \
  backend/tests/test_jinyiwei_endpoint.py::test_fill_gap_rejects_task_owned_by_another_user \
  backend/tests/test_jinyiwei_endpoint.py::test_fill_gap_rejects_task_not_awaiting_evidence \
  backend/tests/test_jinyiwei_endpoint.py::test_fill_gap_success_persists_to_shared_pool
```

Expected: 5 passed.

- [ ] **Step 7: Preserve the atomic runtime boundary**

Run:

```bash
git diff --check
git status --short
```

Expected: only the approved ownership files are modified. Do not commit yet;
Tasks 2 and 3 form one atomic runtime/test commit.

---

### Task 3: Prevent caller findings from self-asserting verified trust

**Files:**

- Modify: `backend/src/jinyiwei_agent.py`
- Modify: `backend/web/routers/jinyiwei.py`
- Modify: `backend/tests/test_jinyiwei_agent.py`
- Modify: `backend/tests/test_jinyiwei_endpoint.py`
- Modify: `backend/tests/conftest.py`

**Interfaces:**

- Consumes: existing deterministic `vet_intel(claim, sources)` output.
- Produces:
  `gather_intel(..., source_authority: Literal["server_adapter",
  "caller_asserted"] = "server_adapter")`.
- Invariant: `caller_asserted` evidence with sources can be retained as pending
  but cannot return `primary_source=True`, `impact="入库"`, or persist
  `jinyiwei_verified`.

- [ ] **Step 1: Write the agent-level failing test**

Add:

```python
def test_caller_assertion_cannot_self_promote_to_verified():
    doc = ja.gather_intel(
        "供应商资质",
        search_fn=lambda _q: [
            {
                "claim": "供应商资质齐全",
                "sources": [{"tier": "一手"}],
            }
        ],
        archive=False,
        source_authority="caller_asserted",
    )

    item = doc["items"][0]
    assert item["impact"] == "待核"
    assert item["level"] == "yellow"
    assert item["primary_source"] is False
    assert "调用方声明" in item["vet_reason"]
```

- [ ] **Step 2: Run the agent test and verify RED**

Run:

```bash
python3 -m pytest -q \
  backend/tests/test_jinyiwei_agent.py::test_caller_assertion_cannot_self_promote_to_verified
```

Expected: FAIL because `gather_intel` does not accept `source_authority`.

- [ ] **Step 3: Add the internal source-authority contract**

In `backend/src/jinyiwei_agent.py`:

```python
from typing import Callable, Literal

SourceAuthority = Literal["server_adapter", "caller_asserted"]
```

Change `_finding_to_item` to:

```python
def _finding_to_item(
    claim: str,
    sources,
    *,
    source_authority: SourceAuthority = "server_adapter",
) -> dict:
    v = vet_intel(claim, sources)
    if source_authority == "caller_asserted" and v.get("decision") == "入库":
        v = {
            **v,
            "grade": "调用方声明",
            "primary": False,
            "decision": "待核",
            "reason": "调用方声明未经服务端或人工核验，必须待核后入库",
        }
```

Keep the existing item assembly after this guard.

Change `gather_intel` to accept:

```python
def gather_intel(
    query: str,
    *,
    search_fn: Callable[[str], list] | None = None,
    archive: bool = True,
    source_authority: SourceAuthority = "server_adapter",
) -> dict:
```

Pass `source_authority=source_authority` to every `_finding_to_item` call.

Do not expose `source_authority` in any request body.

- [ ] **Step 4: Verify the agent test turns GREEN without changing defaults**

Run:

```bash
python3 -m pytest -q backend/tests/test_jinyiwei_agent.py
```

Expected: all agent tests pass, including existing server-adapter behavior.

- [ ] **Step 5: Write the endpoint/persistence failing test**

Add:

```python
def test_caller_findings_cannot_self_assert_primary_source(
    isolated_session_local,
):
    response = client.post(
        "/api/intel/brief",
        json={
            "query": "调用方自报来源",
            "findings": [
                {
                    "claim": "该供应商资质齐全",
                    "sources": [{"tier": "一手"}],
                }
            ],
        },
    )

    item = response.json()["data"]["items"][0]
    assert item["impact"] == "待核"
    assert item["primary_source"] is False

    shared_default = client.get(
        "/api/intel/evidence",
        params={"query": "调用方自报来源"},
    )
    assert shared_default.json()["data"]["items"] == []

    shared_pending = client.get(
        "/api/intel/evidence",
        params={
            "query": "调用方自报来源",
            "include_pending": True,
        },
    )
    pending_item = shared_pending.json()["data"]["items"][0]
    assert pending_item["trust"] == "jinyiwei_pending"
```

- [ ] **Step 6: Run the endpoint test and verify RED**

Run:

```bash
python3 -m pytest -q \
  backend/tests/test_jinyiwei_endpoint.py::test_caller_findings_cannot_self_assert_primary_source
```

Expected: FAIL because the route still uses the default server authority.

- [ ] **Step 7: Wire caller authority at the route boundary**

In `intel_brief`, establish an internal flag before selecting the source:

```python
caller_supplied_findings = bool(findings)
```

Call the agent with:

```python
doc = ja.gather_intel(
    query,
    search_fn=search_fn,
    archive=True,
    source_authority=(
        "caller_asserted"
        if caller_supplied_findings
        else "server_adapter"
    ),
)
```

The `fill-gap` route and department adapters keep the default
`server_adapter`. Do not accept `source_authority` from the HTTP body.

- [ ] **Step 8: Update compatibility expectations and no-network mock**

In the existing `test_brief_endpoint_grades_findings`, change the first caller
item expectations from green/primary to yellow/pending/non-primary while keeping
the rejected no-source item red.

Change the autouse mock in `backend/tests/conftest.py` to:

```python
monkeypatch.setattr(
    ja,
    "gather_intel",
    lambda query,
    *,
    search_fn=None,
    archive=True,
    source_authority="server_adapter": _empty(),
)
```

Only the signature changes; the fixture remains an honest no-network empty
result.

- [ ] **Step 9: Verify GREEN across caller, server and persistence paths**

Run:

```bash
python3 -m pytest -q \
  backend/tests/test_jinyiwei_agent.py \
  backend/tests/test_jinyiwei_endpoint.py \
  backend/tests/test_jinyiwei_evidence_store.py \
  backend/tests/test_real_department_engines.py \
  backend/tests/test_swarm_execution_loop_api.py
```

Expected: all selected tests pass with no real network request.

- [ ] **Step 10: Commit the source-authority closure**

Run:

```bash
git add \
  backend/src/jinyiwei_agent.py \
  backend/web/routers/jinyiwei.py \
  backend/tests/test_jinyiwei_agent.py \
  backend/tests/test_jinyiwei_endpoint.py \
  backend/tests/conftest.py
git commit -m "fix: keep caller intelligence pending verification"
```

---

### Task 4: Verification loop and independent review candidate

**Files:**

- Modify: this Packet's `ci_result/ci_summary.md`
- Add: review evidence under this Packet only after an actual independent review

**Interfaces:**

- Consumes: exact two-commit implementation candidate.
- Produces: reproducible local acceptance evidence; does not produce deployment
  or production evidence.

- [ ] **Step 1: Run the narrow combined behavior suite**

Run:

```bash
python3 -m pytest -q \
  backend/tests/test_sec_edgar.py \
  backend/tests/test_jinyiwei_search.py \
  backend/tests/test_jinyiwei_agent.py \
  backend/tests/test_jinyiwei_vet.py \
  backend/tests/test_jinyiwei_evidence_store.py \
  backend/tests/test_jinyiwei_endpoint.py \
  backend/tests/test_real_department_engines.py \
  backend/tests/test_swarm_execution_loop_api.py
```

Expected: all selected tests pass.

- [ ] **Step 2: Run owning Harness checks**

Run:

```bash
cd backend
python scripts/harness_doctor.py
cd ..
node scripts/harness-doctor.mjs
```

Expected: both doctors report zero errors.

- [ ] **Step 3: Run exact-scope and integrity checks**

Run:

```bash
git status --short --branch
git diff feature-chaotang-ext...HEAD --name-status
git diff feature-chaotang-ext...HEAD --check
git log --oneline feature-chaotang-ext..HEAD
```

Expected:

- only the approved runtime/tests and Packet evidence files changed;
- no whitespace error;
- no merge commit or large historical commit set.

- [ ] **Step 4: Perform independent read-only security review**

Review these invariants against the exact candidate:

1. Same user ID across tenants cannot operate another tenant's task.
2. Caller input cannot choose `source_authority`.
3. Caller tier cannot create `jinyiwei_verified`.
4. Server-adapter defaults and offline no-network tests remain compatible.
5. No P2, schema, database or frontend scope entered the diff.

Exit: HIGH 0 and MEDIUM 0. Review does not edit implementation.

- [ ] **Step 5: Remediate only in-scope findings**

For each approved finding:

1. add or tighten a failing test;
2. prove RED;
3. apply the smallest fix;
4. prove GREEN;
5. repeat Steps 1-3.

Stop after two review-remediation rounds or after the third failure of the same
acceptance condition. Record unresolved issues as `BLOCKED`.

- [ ] **Step 6: Update Packet evidence and commit**

Record exact commit/tree, commands, exit codes, test counts, review result,
unverified production areas and rollback. Then:

```bash
git add \
  .harness/changes/docs-ext-a9-jinyiwei-security-coverage-20260730
git commit -m "docs: record jinyiwei p1 remediation evidence"
```

---

### Task 5: Codex acceptance and local EXT integration decision

**Files:**

- Read-only acceptance of the exact candidate.
- Optional docs-only update to the EXT asset decision matrix after PASS.

**Interfaces:**

- Consumes: exact candidate commit/tree and independent review.
- Produces: `PASS`, `CONDITIONAL PASS`, or `FAIL`; no production claim.

- [ ] **Step 1: Re-run fresh acceptance on the exact candidate**

Run authority, the combined behavior suite, both doctors, and diff checks from
Task 4 again after the final evidence commit.

- [ ] **Step 2: Confirm rollback and non-goals**

Confirm:

- each behavior closure is independently revertable;
- no database row migration or reclassification occurred;
- W09 remains inactive;
- no push, deployment, migration or 3050 operation occurred.

- [ ] **Step 3: Decide integration**

Only when acceptance is `PASS`, present the exact candidate commit/tree for
controlled local fast-forward into `feature-chaotang-ext`. Do not integrate on
`CONDITIONAL PASS` or `FAIL`.

## Overnight Checkpoint

The morning handoff must contain:

- exact baseline and candidate commit/tree;
- completed loop/task table;
- RED and GREEN commands with results;
- final test counts and doctor results;
- independent review findings and remediation rounds;
- files changed;
- remaining P2 findings;
- W08 user-acceptance blocker;
- explicit statement that no push, deployment, database migration or 3050
  operation occurred;
- one final status: `PASS`, `CONDITIONAL PASS`, or `FAIL`.
