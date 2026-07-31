# Final Acceptance Ten-Round Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist a project-wide rule requiring an implementation plan's complete final acceptance workflow to pass at least 10 consecutive rounds before formal acceptance.

**Architecture:** Put the authoritative short rule in the root `AGENTS.md` that every task reads, and mirror the operational details in `docs/codex-engineering-workflow.md`. Keep the wording aligned and verify both governance integrity and the new rule through the same complete acceptance workflow for 10 consecutive rounds.

**Tech Stack:** Markdown governance documents, PowerShell, Node.js harness

## Global Constraints

- Each implementation plan must define one complete final acceptance workflow.
- Formal acceptance requires that entire workflow to pass at least 10 consecutive rounds against the same final code revision.
- Any failed round invalidates the sequence; after a fix or substantive code, configuration, or acceptance-flow change, counting restarts at round 1.
- Every round records the commands, PASS/FAIL result, and necessary evidence.
- Paid APIs, real network access, production writes, and other separately authorized actions remain unauthorized unless the current user explicitly permits them.
- Do not modify ADR 0028.
- Do not rewrite existing implementation plans retroactively.
- Do not commit, push, publish, or deploy without separate explicit authorization.

---

### Task 1: Persist the ten-round final acceptance rule

**Files:**
- Modify: `AGENTS.md`
- Modify: `docs/codex-engineering-workflow.md`
- Reference: `docs/superpowers/specs/2026-07-31-final-acceptance-ten-rounds-design.md`

**Interfaces:**
- Consumes: The approved definition of a complete final acceptance round and the repository's existing authorization boundary.
- Produces: A root-level mandatory memory and an aligned engineering workflow rule for future plan generation and acceptance.

- [ ] **Step 1: Add the root project memory**

Add this rule under `AGENTS.md` → `## 工作方式`:

```markdown
- 生成实施计划时，必须定义一套完整的最终验收流程。正式验收须针对同一最终代码版本
  连续完整执行该流程至少 10 轮，且每轮全部成功；任一轮失败，或代码、配置、验收流程
  发生实质变化后，必须从第 1 轮重新计数。每轮记录实际命令、PASS/FAIL 与必要证据。
  该规则不扩大权限；付费 API、真实外网、生产写入等仍须当前用户单独明确授权，未获
  授权时不得执行，也不得宣称正式通过。
```

- [ ] **Step 2: Mirror the operational rule**

Add an equivalent subsection to `docs/codex-engineering-workflow.md` after the existing evidence-loop guidance. Explicitly define one round as the complete workflow, not one command repeated 10 times.

- [ ] **Step 3: Check exact rule coverage**

Run:

```powershell
rg -n "完整的最终验收流程|至少 10 轮|从第 1 轮重新计数|不扩大权限" AGENTS.md docs/codex-engineering-workflow.md
```

Expected: Both files contain the ten-round gate, reset condition, and authorization boundary.

- [ ] **Step 4: Run the complete final acceptance workflow for 10 consecutive rounds**

For each round from 1 through 10, against the same working-tree content, run in this order:

```powershell
rg -q "完整的最终验收流程" AGENTS.md
rg -q "至少 10 轮" AGENTS.md
rg -q "至少 10 轮" docs/codex-engineering-workflow.md
rg -q "从第 1 轮重新计数" AGENTS.md docs/codex-engineering-workflow.md
rg -q "不扩大权限" AGENTS.md docs/codex-engineering-workflow.md
git diff --check
node scripts/check_harness.mjs
```

Expected for every round: all commands exit 0 and the harness reports `PASS`.

- [ ] **Step 5: Review the final diff**

Run:

```powershell
git diff -- AGENTS.md docs/codex-engineering-workflow.md docs/superpowers/specs/2026-07-31-final-acceptance-ten-rounds-design.md docs/superpowers/plans/2026-07-31-final-acceptance-ten-rounds.md
git status --short
```

Expected: Only the approved governance documents and their design/plan records appear; unrelated user changes, if any, remain untouched.
