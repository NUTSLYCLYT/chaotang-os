# Chancellor Conservative Direct Draft Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the Chancellor draft flow so one vague user idea becomes an understandable, expert-grade, conservatively completed `DRAFT_READY` edict whenever no genuine material, authority, conflict, or safety blocker exists.

**Architecture:** Keep the independent draft Agent and the existing decree execution graph separate. Strengthen the repository Skill and the draft system prompt, validate readiness invariants at the backend trust boundary, and render the expert draft plus visible Chancellor-supplied boundaries in the existing central scroll. The existing version/fingerprint authority gate remains the only bridge to decree execution.

**Tech Stack:** Markdown Skill, Python 3.14, FastAPI, Pydantic v2, LangGraph, pytest, Next.js 16, React, TypeScript, Node test runner.

## Global Constraints

- 【拟旨】 must never create a Mission, notify departments, enter execution, or call the decree graph.
- 【下旨】 remains the only execution authorization and remains gated by the current `DRAFT_READY` version and fingerprint.
- Chancellor-supplied content must be visible as “丞相建议” or “暂定边界”; it must never be represented as a confirmed user fact.
- Safe defaults must be conservative, reversible, minimum-scope, and must not enlarge financial, legal, account, communication, publication, trading, or other real-world authority.
- A genuine material, authority, conflict, or safety blocker must use `CLARIFYING`, `NEEDS_INPUT`, `PARTIAL`, or `ISSUE_BLOCKED`; it must not be hidden to force `DRAFT_READY`.
- Any user edit invalidates the previous version and fingerprint.
- Do not modify or bypass `docs/decisions/0028-decree-evidence-flow-governance-baseline.md`.
- Preserve unrelated user changes in the dirty worktree.
- Do not commit, push, merge, or deploy without separate explicit user authorization at execution time.

---

### Task 1: Make “conservative completion, direct draft” a governed Skill contract

**Files:**
- Modify: `.agents/skills/chancellor-draft-edict/SKILL.md`
- Modify: `.agents/skills/chancellor-draft-edict/agents/openai.yaml`
- Modify: `backend/app/agents/chancellor_draft/skill_loader.py`
- Test: `backend/tests/test_chancellor_draft_skill_loader.py`

**Interfaces:**
- Consumes: fixed repository Skill path resolved by `load_chancellor_draft_skill(path: Path | None = None)`.
- Produces: validated Skill instructions containing the immutable anchors `保守补全、直接成旨` and `不得为了多问一句而维持 CLARIFYING`.

- [ ] **Step 1: Add failing Skill loader contract tests**

Add tests that require the upgraded runtime Skill and reject a downgraded copy:

```python
def test_repository_skill_requires_conservative_direct_draft_contract() -> None:
    skill = load_chancellor_draft_skill()

    assert "保守补全、直接成旨" in skill.instructions
    assert "不得为了多问一句而维持 `CLARIFYING`" in skill.instructions
    assert "丞相建议" in skill.instructions
    assert "暂定边界" in skill.instructions


def test_loader_rejects_skill_without_direct_draft_anchor(tmp_path: Path) -> None:
    source = load_chancellor_draft_skill().source_path.read_text(encoding="utf-8")
    downgraded = source.replace("保守补全、直接成旨", "案例驱动拟旨")
    path = tmp_path / "SKILL.md"
    path.write_text(downgraded, encoding="utf-8")

    with pytest.raises(ChancellorDraftSkillError):
        load_chancellor_draft_skill(path)
```

- [ ] **Step 2: Run the tests and verify RED**

Run:

```powershell
cd D:\workspace\chaotang-os-harness-only\backend
.\.venv\Scripts\python.exe -m pytest tests/test_chancellor_draft_skill_loader.py -q
```

Expected: FAIL because the current Skill and `_REQUIRED_ANCHORS` do not contain the new direct-draft contract.

- [ ] **Step 3: Rewrite the Skill’s primary flow**

Replace the default “case then wait” flow with these exact behavioral rules:

```markdown
## 保守补全、直接成旨

用户点击【拟旨】后，丞相优先一次完成：

1. 理解用户真正想解决的问题；
2. 生成一份贴合当前意图、普通用户一遍看懂的大神级拟旨草案；
3. 自动补齐目标、范围、排除项、输入、输出、最小部门集合、流程、完成标准、风险控制、失效条件、权限与禁止事项；
4. 将非用户原话分别标为“丞相建议”或“暂定边界”；
5. 没有真实阻断时直接返回 `DRAFT_READY`，让用户查看完整草案后点击【下旨】。

不得为了多问一句而维持 `CLARIFYING`。可以采用保守、可撤销、最小范围默认值的内容，应直接补入草案并明确展示。
```

Retain and strengthen the hard blockers:

```markdown
以下内容不得猜测：会改变任务本质的选择；资金金额或最大损失；法律承诺；账号访问；付款、签署、发布、交易或对外联络权限；不可替代的必要材料；冲突要求；违法、危险或越权要求。
```

Update the stock example so the first reply contains a complete draft and ends with:

```markdown
当前状态：`DRAFT_READY`
丞相补充：闲置资金、不借贷、不使用高杠杆、不自动交易，均为可修改的暂定边界。
【下旨】：可用
```

- [ ] **Step 4: Strengthen fail-closed Skill anchors**

Set `_REQUIRED_ANCHORS` to include:

```python
_REQUIRED_ANCHORS = (
    "保守补全、直接成旨",
    "不得为了多问一句而维持 `CLARIFYING`",
    "只有 `DRAFT_READY` 能启用【下旨】",
)
```

- [ ] **Step 5: Refresh Skill UI metadata**

Update `.agents/skills/chancellor-draft-edict/agents/openai.yaml` to:

```yaml
interface:
  display_name: "丞相·直接拟旨"
  short_description: "把模糊想法保守补全为可直接确认下旨的专业草案"
  default_prompt: "使用 $chancellor-draft-edict 将我的想法补全成易懂、完整、可确认下旨的拟旨草案。"
```

- [ ] **Step 6: Validate GREEN**

Run:

```powershell
cd D:\workspace\chaotang-os-harness-only
backend\.venv\Scripts\python.exe C:\Users\Administrator\.codex\skills\.system\skill-creator\scripts\quick_validate.py .agents\skills\chancellor-draft-edict
cd backend
.\.venv\Scripts\python.exe -m pytest tests/test_chancellor_draft_skill_loader.py -q
```

Expected: Skill validation succeeds and all loader tests pass.

---

### Task 2: Enforce direct readiness and conservative boundaries in the draft Agent

**Files:**
- Modify: `backend/app/agents/chancellor_draft/graph.py`
- Modify: `backend/app/agents/chancellor_draft/models.py`
- Test: `backend/tests/test_chancellor_draft_graph.py`
- Test: `backend/tests/test_chancellor_drafts_api.py`

**Interfaces:**
- Consumes: validated Skill instructions and `ChancellorDraftGraphState` with `messages` and `version`.
- Produces: `ChancellorDraftResponse`; only a complete, internally consistent, gap-free response may carry `status="DRAFT_READY"`.

- [ ] **Step 1: Add failing graph prompt assertions**

Extend `test_graph_loads_skill_and_calls_model_once`:

```python
system_prompt = calls[0][0]["content"]
assert "优先生成完整的大神级拟旨草案" in system_prompt
assert "没有真实阻断时返回 DRAFT_READY" in system_prompt
assert "丞相建议" in system_prompt
assert "暂定边界" in system_prompt
```

- [ ] **Step 2: Add failing readiness-invariant tests**

First extract the ready payload already assembled in
`test_ready_graph_response_contains_server_canonical_decree_text` into this
helper, and make that existing test call the helper:

```python
def _valid_ready_payload() -> dict[str, object]:
    payload = json.loads(_valid_model_response())
    payload["status"] = "DRAFT_READY"
    payload["draft"] = {
        "objective": "核查合同风险",
        "scope": ["付款条款"],
        "exclusions": [],
        "input_materials": ["合同正文"],
        "material_gaps": [],
        "key_questions": ["付款条件是否明确"],
        "departments": [
            {
                "department": "户部",
                "role": "主审",
                "reason": "涉及付款",
                "responsibility": "审查结算风险",
                "expected_output": "付款风险清单",
            }
        ],
        "execution_steps": ["审查付款条款"],
        "deliverables": ["风险清单"],
        "completion_criteria": ["逐项给出依据"],
        "permissions_and_limits": ["不自动签约"],
        "current_status": "DRAFT_READY",
    }
    return payload
```

Then add model/graph cases proving malformed readiness fails closed:

```python
@pytest.mark.parametrize(
    ("mutation", "expected_fragment"),
    [
        (lambda payload: payload.update(draft=None), "draft"),
        (
            lambda payload: payload["draft"].update(material_gaps=["缺少合同正文"]),
            "material_gaps",
        ),
        (
            lambda payload: payload["draft"].update(current_status="CLARIFYING"),
            "current_status",
        ),
    ],
)
def test_draft_ready_rejects_inconsistent_draft(mutation, expected_fragment) -> None:
    payload = _valid_ready_payload()
    mutation(payload)

    with pytest.raises(ChancellorDraftGraphInvocationError) as exc_info:
        build_chancellor_draft_graph(
            chat_model=lambda _messages: json.dumps(payload, ensure_ascii=False)
        ).invoke(
            {
                "messages": [{"role": "user", "content": "我要炒股赚钱"}],
                "version": 1,
            }
        )

    assert isinstance(exc_info.value.__cause__, ValidationError)
    assert expected_fragment in str(exc_info.value.__cause__)
```

Retain `test_ready_response_registers_one_time_issue_authority` unchanged as
the API proof that only the returned ready draft registers one-time authority.
The targeted command in Step 6 must continue to run this test.

- [ ] **Step 3: Run targeted tests and verify RED**

Run:

```powershell
cd D:\workspace\chaotang-os-harness-only\backend
.\.venv\Scripts\python.exe -m pytest tests/test_chancellor_draft_graph.py tests/test_chancellor_drafts_api.py -q
```

Expected: prompt assertions and readiness consistency cases fail.

- [ ] **Step 4: Strengthen the system prompt**

Add these rules to `_system_prompt` before the JSON schema:

```python
"优先生成完整的大神级拟旨草案，而不是只给案例后等待确认。"
"可以用保守、可撤销、最小范围默认值补齐的内容，应标为丞相建议或暂定边界。"
"没有真实的材料、权限、冲突或安全阻断时返回 DRAFT_READY。"
"不得为了多问一句而返回 CLARIFYING，也不得隐藏真实阻断来强行启用下旨。"
```

Keep the existing ban on `ISSUED`, `EXECUTING`, and `RETURNED`.

- [ ] **Step 5: Add Pydantic readiness invariants**

Add a response-level validator:

```python
from pydantic import BaseModel, ConfigDict, Field, model_validator


class ChancellorDraftResponse(BaseModel):
    # existing fields remain unchanged

    @model_validator(mode="after")
    def _ready_state_is_internally_consistent(self) -> "ChancellorDraftResponse":
        if self.status is DraftStatus.DRAFT_READY:
            if self.draft is None:
                raise ValueError("DRAFT_READY requires draft")
            if self.draft.current_status is not DraftStatus.DRAFT_READY:
                raise ValueError("DRAFT_READY requires matching draft current_status")
            if self.draft.material_gaps:
                raise ValueError("DRAFT_READY requires empty material_gaps")
        elif (
            self.draft is not None
            and self.draft.current_status is DraftStatus.DRAFT_READY
        ):
            raise ValueError("non-ready response cannot contain a DRAFT_READY draft")
        return self
```

Do not infer or normalize missing values in Python; the Agent must produce the visible complete draft.

- [ ] **Step 6: Run targeted tests and verify GREEN**

Run:

```powershell
cd D:\workspace\chaotang-os-harness-only\backend
.\.venv\Scripts\python.exe -m pytest tests/test_chancellor_draft_graph.py tests/test_chancellor_drafts_api.py tests/test_chancellor_draft_authority.py tests/test_decree_draft_gate.py -q
```

Expected: all targeted draft and authority tests pass.

---

### Task 3: Present the expert draft and visible assumptions as a direct decision

**Files:**
- Modify: `frontend/src/features/study-visual/DevStudyWorkspace.tsx`
- Test: `frontend/src/features/study-visual/DevStudyWorkspace.test.ts`
- Test: `frontend/src/app/study/chancellorDraft.test.ts`

**Interfaces:**
- Consumes: unchanged `ChancellorDraftResult` and `canIssueChancellorDraft`.
- Produces: central scroll copy that distinguishes user intent, expert draft, Chancellor reasoning, temporary boundaries, and the sole decree action.

- [ ] **Step 1: Add failing presentation assertions**

Add a source-level regression test:

```typescript
test("ready draft is presented as an expert edict with visible temporary boundaries", async () => {
  const source = await readFile(new URL("./DevStudyWorkspace.tsx", import.meta.url), "utf8");

  assert.match(source, /大神级拟旨草案/);
  assert.match(source, /丞相为什么这样补全/);
  assert.match(source, /丞相建议与暂定边界/);
  assert.match(source, /草案完整，可以直接下旨/);
  assert.doesNotMatch(source, /请按案例修改/);
});
```

Retain the existing tests that the composer contains only 【拟旨】 and the completed central scroll owns the sole 【下旨】 button.

- [ ] **Step 2: Run focused frontend tests and verify RED**

Run:

```powershell
cd D:\workspace\chaotang-os-harness-only\frontend
node --test src/features/study-visual/DevStudyWorkspace.test.ts src/app/study/chancellorDraft.test.ts
```

Expected: FAIL because the current scroll still uses “专业人士通常会这样提问” and “如何修改”.

- [ ] **Step 3: Update only the draft scroll labels and guidance**

Use the existing response fields without changing the BFF contract:

```tsx
<h3>大神级拟旨草案</h3>
<p>{props.draftResult.expert_example}</p>

<h3>丞相为什么这样补全</h3>
<p>{props.draftResult.recommendation_reason}</p>

{props.draftResult.assumptions.length > 0 && (
  <>
    <h3>丞相建议与暂定边界</h3>
    <ul>
      {props.draftResult.assumptions.map((item) => <li key={item}>{item}</li>)}
    </ul>
  </>
)}
```

For the status guidance:

```tsx
<p>
  <strong>下旨：</strong>
  {props.canSubmit
    ? "草案完整，可以直接下旨"
    : props.draftResult.revision_prompt}
</p>
```

Do not add a confirmation checkbox, secondary confirmation button, inline Mission creation, or a new edit form.

- [ ] **Step 4: Validate GREEN**

Run:

```powershell
cd D:\workspace\chaotang-os-harness-only\frontend
node --test src/features/study-visual/DevStudyWorkspace.test.ts src/app/study/chancellorDraft.test.ts
```

Expected: all focused frontend tests pass.

---

### Task 4: Update task evidence and run end-to-end verification

**Files:**
- Modify: `docs/product/tasks/2026-07-29-chancellor-draft-edict-flow.md`
- Modify: `docs/superpowers/plans/2026-07-29-chancellor-draft-edict-flow.md`
- Verify: `.agents/skills/chancellor-draft-edict/**`
- Verify: `backend/**`
- Verify: `frontend/**`

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces: fresh evidence that the Skill loads, vague intent can produce a valid direct draft, the execution gate remains closed before 【下旨】, and all repository checks remain green except any explicitly identified unrelated pre-existing blocker.

- [ ] **Step 1: Record the approved product behavior**

Add acceptance evidence to the existing product task:

```markdown
- [x] 用户于 2026-07-29 选择并确认“保守补全、直接成旨”：首轮拟旨优先生成大神级完整草案，安全默认值作为丞相建议或暂定边界完整展示，无真实阻断时直接进入 `DRAFT_READY`。
- [x] 自动补全不得扩大现实权限；高风险授权、必要材料、冲突或安全问题继续阻断。
```

Append this exact section to
`docs/superpowers/plans/2026-07-29-chancellor-draft-edict-flow.md`:

```markdown
### Approved upgrade: conservative direct draft

- Design source: `docs/superpowers/specs/2026-07-29-chancellor-draft-edict-flow-design.md`
- Execution plan: `docs/superpowers/plans/2026-07-29-chancellor-conservative-direct-draft.md`
- Runtime evidence: record only after Skill, backend, frontend, real-model, authority-boundary, Harness, and diff checks have actually run.
```

Do not mark runtime verification complete until the commands below finish.

- [ ] **Step 2: Run Skill validation**

Run:

```powershell
cd D:\workspace\chaotang-os-harness-only
backend\.venv\Scripts\python.exe C:\Users\Administrator\.codex\skills\.system\skill-creator\scripts\quick_validate.py .agents\skills\chancellor-draft-edict
```

Expected: the Skill package is valid.

- [ ] **Step 3: Run full backend verification**

Run:

```powershell
cd D:\workspace\chaotang-os-harness-only\backend
.\.venv\Scripts\python.exe -m pytest -q
.\.venv\Scripts\python.exe -m ruff check app tests
```

Expected: all backend tests pass with only documented dependency warnings; Ruff reports `All checks passed!`.

- [ ] **Step 4: Run full frontend verification**

Run:

```powershell
cd D:\workspace\chaotang-os-harness-only\frontend
npm test
npm run lint
npm run typecheck
npm run build
```

Expected: all frontend tests, lint, typecheck, and production build pass.

- [ ] **Step 5: Verify one real vague-intent draft**

Resolve the worktree-local backend command line before restarting:

```powershell
$backendRoot = (Resolve-Path 'D:\workspace\chaotang-os-harness-only\backend').Path
$targets = Get-CimInstance Win32_Process | Where-Object {
  $_.Name -eq 'python.exe' -and
  $_.CommandLine -like '*D:\workspace\chaotang-os-harness-only\backend\.venv\Scripts\python.exe*' -and
  $_.CommandLine -like '*uvicorn app.main:app*'
}
$targets | Select-Object ProcessId, CommandLine
```

Stop only those verified process IDs, then launch
`D:\workspace\chaotang-os-harness-only\backend\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000`
with working directory `D:\workspace\chaotang-os-harness-only\backend` and a
hidden window. After `/health` returns `status: ok`, invoke the real draft
graph with:

```python
result = build_chancellor_draft_graph().invoke(
    {
        "messages": [{"role": "user", "content": "我要炒股赚钱"}],
        "version": 1,
    }
)["response"]
```

Assert and report:

```python
assert result["status"] == "DRAFT_READY"
assert result["draft"]["material_gaps"] == []
assert result["draft"]["current_status"] == "DRAFT_READY"
assert result["assumptions"]
assert result["decree_text"]
```

If the model identifies a genuine blocker and returns a non-ready state, inspect the visible blocker against the approved policy rather than coercing the state. Repeat only after correcting a prompt or contract defect; do not fake a passing response.

- [ ] **Step 6: Verify the authority boundary**

Before clicking 【下旨】, confirm no Mission/decree endpoint was called and no `REPLY` was archived. Then use the existing authenticated UI to verify:

1. 【拟旨】 produces the complete central-scroll draft.
2. Visible temporary boundaries are understandable and editable.
3. A complete `DRAFT_READY` draft enables the sole bottom 【下旨】 button.
4. Editing the source text invalidates that button until a new version is drafted.
5. Clicking 【下旨】 once invokes the existing decree path with the current version and fingerprint.

- [ ] **Step 7: Run Harness and diff checks**

Run:

```powershell
cd D:\workspace\chaotang-os-harness-only
node scripts/check_harness.mjs
node scripts/check_harness.mjs --self-test
node .agents/hooks/check-harness.mjs --self-test
git diff --check
```

Expected: checks pass. If the main Harness reports an unrelated pre-existing dirty-task violation, report the exact file and do not modify it outside this plan’s allowed scope.

- [ ] **Step 8: Stop before any Git publication**

Show the exact changed-file list and verification evidence. Do not stage, commit, push, merge, open a PR, or deploy unless the user gives a new explicit authorization for that action.
