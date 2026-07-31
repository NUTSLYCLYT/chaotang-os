# 拟旨执行正文长度闭环修复 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 `DRAFT_READY` 始终以用户看到的、1–2000 字自然语言 `expert_example` 作为实际 `decree_text`，不再把完整结构化草案 JSON 送入下旨接口。

**Architecture:** 完整 `draft` 继续承担审阅和审计职责；后端在模型响应边界规范化 `expert_example`，把同一文本写入 `decree_text`，并用包含完整草案与规范化执行正文的载荷计算指纹。前端只对真正提交的 `decree_text` 执行 1–2000 字门禁，BFF 再做一次无副作用校验。

**Tech Stack:** Python 3.11、Pydantic、LangGraph、pytest、TypeScript、Next.js、Node test runner。

## Global Constraints

- 不修改 `backend/app/api/decrees.py` 的 2000 字全局限制。
- 不修改或绕过 `docs/decisions/0028-decree-evidence-flow-governance-baseline.md`。
- 不修改会计司报表生成、史馆归档、军机处路由或旧授权迁移行为。
- 不得静默截断执行正文；无效模型输出必须纠正重试，连续无效则失败关闭。
- `DRAFT_READY` 必须满足 `decree_text == expert_example.strip()` 且规范化长度为 1–2000。
- 完整结构化 `draft` 保留在响应和指纹中，但不得作为 `decree_text`。
- 保留工作区内已有用户改动；本任务不执行 commit、push、PR 或部署。

---

### Task 1: 后端生成、模型与授权正文闭环

**Files:**
- Modify: `backend/app/agents/chancellor_draft/models.py`
- Modify: `backend/app/agents/chancellor_draft/graph.py`
- Test: `backend/tests/test_chancellor_draft_graph.py`
- Test: `backend/tests/test_chancellor_drafts_api.py`

**Interfaces:**
- Consumes: 模型 JSON 字段 `expert_example` 与完整 `draft`。
- Produces: `ChancellorDraftResponse`，其中 ready 状态的 `expert_example` 和 `decree_text` 是同一规范化自然语言正文，`fingerprint` 同时绑定完整草案与正文。

- [ ] **Step 1: 写出复现真实财务场景和边界的失败测试**

在 `backend/tests/test_chancellor_draft_graph.py` 中把原先断言 JSON 正文的测试改成自然语言契约，并增加：

```python
def test_ready_financial_draft_uses_visible_natural_language_as_decree_text() -> None:
    payload = _valid_ready_payload()
    payload["expert_example"] = "  请户部会计司生成2024年至2025年管理层综合财务报表并交付 Excel，不修改原始数据。  "
    draft = payload["draft"]
    assert isinstance(draft, dict)
    draft["scope"] = [f"财务数据范围 {index}: " + "明细" * 80 for index in range(30)]
    assert len(json.dumps(draft, ensure_ascii=False, indent=2)) > 2000

    response = build_chancellor_draft_graph(
        chat_model=lambda _messages: json.dumps(payload, ensure_ascii=False)
    ).invoke({
        "messages": [{"role": "user", "content": "请生成2024年至2025年财务报表"}],
        "version": 2,
    })["response"]

    assert response["decree_text"] == payload["expert_example"].strip()
    assert response["expert_example"] == payload["expert_example"].strip()
    assert len(response["decree_text"]) <= 2000
    assert not response["decree_text"].startswith("{")
    with pytest.raises(json.JSONDecodeError):
        json.loads(response["decree_text"])
```

再增加首次返回 2001 字、第二次返回合规文本时成功，以及连续两次返回空白或 2001 字时抛出 `ChancellorDraftGraphInvocationError` 的测试；提示词测试须断言 `expert_example` 是可直接下旨的自然语言正文、不得放结构化 JSON、规范化后最多 2000 字。

在 `backend/tests/test_chancellor_drafts_api.py` 中令 ready fixture 的 `expert_example` 与 `decree_text` 使用同一自然语言，并断言授权登记收到该精确正文。

- [ ] **Step 2: 运行测试，确认因旧 JSON 序列化和宽松模型失败**

Run:

```powershell
backend\.venv\Scripts\python.exe -m pytest backend/tests/test_chancellor_draft_graph.py backend/tests/test_chancellor_drafts_api.py -q
```

Expected: 财务长草案测试显示 `decree_text` 仍是 JSON；超长或空白正文测试未被新契约拒绝。

- [ ] **Step 3: 实现最小后端修复**

在 `ChancellorDraftResponse` 中把 `expert_example` 收紧，并在 after validator 固化 ready/non-ready 契约。图层必须先 `strip()` 再进入 Pydantic 校验，避免合法的 2000 字正文因外围空白被误拒：

```python
expert_example: str = Field(min_length=1, max_length=2000)
decree_text: str | None = Field(default=None, max_length=2000)

normalized_example = self.expert_example.strip()
if not 1 <= len(normalized_example) <= 2000:
    raise ValueError("expert_example must contain 1 to 2000 non-whitespace characters")
if self.status is DraftStatus.DRAFT_READY:
    if self.decree_text != normalized_example:
        raise ValueError("DRAFT_READY decree_text must equal normalized expert_example")
elif self.decree_text is not None:
    raise ValueError("non-ready response cannot contain decree_text")
```

在 `graph.py` 中先复制并规范化模型载荷，不改模型传入对象；ready 状态使用规范化文本作为 `decree_text`，非 ready 使用 `None`。指纹 canonical 必须显式包含服务器生成的 `decree_text`：

```python
normalized_payload = {
    **payload,
    "expert_example": payload["expert_example"].strip(),
}
decree_text = (
    normalized_payload["expert_example"]
    if normalized_payload.get("status") == "DRAFT_READY"
    else None
)
canonical = json.dumps(
    {"version": version, **normalized_payload, "decree_text": decree_text},
    ensure_ascii=False,
    sort_keys=True,
    separators=(",", ":"),
)
```

把 `_system_prompt` 和 `_structure_correction` 的固定规则同步为：`expert_example` 是用户确认并直接执行的自然语言旨意正文，不能是结构化草案 JSON，去空白后 1–2000 字。禁止回显无效输入内容。

- [ ] **Step 4: 运行后端定向测试和静态检查**

Run:

```powershell
backend\.venv\Scripts\python.exe -m pytest backend/tests/test_chancellor_draft_graph.py backend/tests/test_chancellor_drafts_api.py backend/tests/test_chancellor_draft_authority.py backend/tests/test_decree_draft_gate.py backend/tests/test_decrees_api.py -q
backend\.venv\Scripts\python.exe -m ruff check backend/app/agents/chancellor_draft backend/app/api/chancellor_drafts.py backend/app/api/decrees.py backend/tests/test_chancellor_draft_graph.py backend/tests/test_chancellor_drafts_api.py
```

Expected: 全部 PASS；既有 2001 字正式下旨请求仍返回验证错误，授权仍按 owner/version/fingerprint/decree_text 精确匹配。

### Task 2: 前端以实际执行正文决定能否下旨

**Files:**
- Modify: `frontend/src/app/study/chancellorDraft.ts`
- Modify: `frontend/src/app/study/chancellorDraft.test.ts`
- Modify: `frontend/src/app/study/StudyClient.tsx`
- Modify: `frontend/src/app/study/StudyClient.test.ts`
- Modify: `frontend/src/app/api/decrees/chancellor/route.ts`
- Test: `frontend/src/app/api/decrees/chancellor/route.test.ts`

**Interfaces:**
- Consumes: 后端返回的 `ChancellorDraftResult.decree_text`。
- Produces: 只有实际提交正文规范化长度为 1–2000 时可点击下旨；BFF 对越界载荷在调用后端前返回 400。

- [ ] **Step 1: 写前端失败测试**

在 `chancellorDraft.test.ts` 用表驱动测试覆盖：

```typescript
for (const [text, expected] of [
  [" ", false],
  ["旨", true],
  ["旨".repeat(2000), true],
  [` ${"旨".repeat(2000)} `, true],
  ["旨".repeat(2001), false],
] as const) {
  assert.equal(canIssueChancellorDraft({
    ...base,
    status: "DRAFT_READY",
    draft: completeDraft,
    decree_text: text,
  }), expected);
}
```

再构造超过 2000 字的 `completeDraft` 与简洁自然语言 `decree_text`，断言可以下旨，证明门禁不依赖结构化草案长度。

在 `StudyClient.test.ts` 锁定下旨资格不再由用户原始输入 `canSubmit` 代替实际 `draftResult.decree_text`，但提交载荷继续来自 `draftResult.decree_text`。

在 BFF route 测试中断言空白和 2001 字正文返回 400 且 backend submit 未调用，2000 字正文原样透传。

- [ ] **Step 2: 运行前端定向测试确认失败**

Run from `frontend`:

```powershell
node --test src/app/study/chancellorDraft.test.ts src/app/study/StudyClient.test.ts src/app/api/decrees/chancellor/route.test.ts
```

Expected: 2001 字仍被 `canIssueChancellorDraft` 接受，组合资格或 BFF 边界测试失败。

- [ ] **Step 3: 实现前端最小门禁**

在 `chancellorDraft.ts` 导出统一边界并校验规范化长度：

```typescript
export const MAX_DECREE_TEXT_LENGTH = 2000;

const normalizedLength = draft.decree_text.trim().length;
return normalizedLength >= 1 && normalizedLength <= MAX_DECREE_TEXT_LENGTH;
```

在 `StudyClient.tsx` 中让下旨按钮资格依赖“当前不在提交中”和 `canIssueChancellorDraft(draftResult)`；原始输入的 `canSubmit` 只管理拟旨输入，不再替代执行正文门禁。提交仍使用 `draftResult?.decree_text ?? ""`，不得改成原始输入或结构化草案。

在 BFF route 中复用相同的 1–2000 规则，在调用 backend client 前拒绝无效 `decreeText`，不改写合法正文，以保持 authority 精确匹配。

- [ ] **Step 4: 运行前端定向测试**

Run from `frontend`:

```powershell
node --test src/app/study/chancellorDraft.test.ts src/app/study/StudyClient.test.ts src/app/api/decrees/chancellor/route.test.ts
```

Expected: 全部 PASS，空白/2001 字被拒绝，2000 字和财务长草案场景通过。

### Task 3: 故障记忆与全量验证

**Files:**
- Create: `docs/failures/2026-07-30-draft-decree-text-json-overflow.md`

**Interfaces:**
- Consumes: Tasks 1–2 的实现和测试证据。
- Produces: 可复用的根因、预防、检测与证据记录；完整验证结果。

- [ ] **Step 1: 写故障记录**

文件必须包含以下二级标题，并写入具体事实：

```markdown
## Summary
## Root Cause
## Prevention
## Detection
## Evidence
```

`Root Cause` 记录“完整结构化 draft 被 pretty JSON 序列化成 decree_text，UI 展示 expert_example 却提交另一字段”；`Prevention` 记录 ready 模型等值契约、指纹绑定和前端纵深门禁；`Detection` 指向真实财务长草案、2000/2001 边界、authority 精确匹配和 harness；`Evidence` 链接设计、计划、代码和 ADR 0028。

- [ ] **Step 2: 运行后端全量验证**

Run:

```powershell
backend\.venv\Scripts\python.exe -m pytest backend/tests -q
backend\.venv\Scripts\python.exe -m ruff check backend
```

Expected: 全部 PASS，无 lint 错误。

- [ ] **Step 3: 运行前端全量验证**

Run from `frontend`:

```powershell
npm test
npm run typecheck
npm run lint
npm run build
```

Expected: 全部退出码 0。

- [ ] **Step 4: 运行项目治理与格式验证**

Run from repository root:

```powershell
node scripts/check_harness.mjs
node scripts/check_harness.mjs --self-test
node .agents/hooks/check-harness.mjs --self-test
node .agents/skills/product-flow/scripts/run-claude-delivery.mjs --self-test
git diff --check
```

Expected: 全部退出码 0；ADR 0028 完整性校验通过；无 whitespace error。

- [ ] **Step 5: 自审最终差异**

核对 `git diff --stat` 与 `git diff`，确认没有修改全局下旨上限、ADR 0028、会计司报告契约、史馆、军机处或无关用户改动；确认没有执行 Git 写操作。
