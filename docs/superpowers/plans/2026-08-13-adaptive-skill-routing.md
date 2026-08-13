# Adaptive Skill Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace fixed task-to-skill brand mappings with bounded clarification and automatic progressive routing across direct execution, Matt Skills, and Superpowers while preserving repository quality and safety gates.

**Architecture:** Keep the root `AGENTS.md` as the compact mandatory entry point, put the full routing contract in `docs/codex-engineering-workflow.md`, and make `.agents/skills/codex-engineering-workflow/SKILL.md` execute the same contract. Add a pure harness validator with self-tests so the repository fails closed when routing explanations, escalation, optional-skill fallback, or authorization boundaries disappear.

**Tech Stack:** Markdown governance, Codex project skills, Node.js ESM harness, PowerShell verification

## Global Constraints

- Read and obey `docs/decisions/0028-decree-evidence-flow-governance-baseline.md` before every implementation task.
- Do not modify ADR 0028; its canonical SHA-256 must remain `3ac5d0c3510c62dbdf9b4b785d8175a259b1ce46b0c56c29abbbc7bb2e39a31e`.
- Clarification asks only questions that can materially change objective, scope, acceptance, risk, or authorization, and stops as soon as routing is safe.
- Codex automatically chooses and explains direct execution, Matt Skills, or Superpowers.
- Quality outcomes are brand-independent: defects need root-cause evidence, behavior changes need test protection where feasible, and completion needs fresh verification.
- Routing may escalate `direct execution → Matt Skills → Superpowers`; it must not silently downgrade quality gates.
- Missing Matt Skills do not trigger installation; use equivalent native steps or escalate.
- Commit, push, merge, deploy, delete, payment, production write, secret access, and private-data access require separate explicit authorization.
- Keep root `AGENTS.md` at or below the existing 80-line harness limit.
- The final unchanged implementation must pass the complete acceptance workflow for 10 consecutive rounds; any failure or material code, configuration, or acceptance-flow change resets counting to round 1.

---

### Task 1: Add a canonical, mutation-tested adaptive-routing policy validator

**Files:**
- Modify: `scripts/check_harness.mjs:97-110`
- Modify: `scripts/check_harness.mjs:413-430`
- Modify: `scripts/check_harness.mjs:1278-1790`
- Create: `docs/failures/2026-08-13-adaptive-routing-validator-false-green.md`
- Reference: `docs/superpowers/specs/2026-08-13-adaptive-skill-routing-design.md`

**Interfaces:**
- Consumes: UTF-8 text for the root instructions, workflow guide, project skill, OpenAI skill prompt, and this plan's Task 2 templates.
- Produces: `adaptiveRoutingPolicyErrors(input): string[]`, a pure validator whose authority boundary is an exact normalized whole-file SHA-256 allowlist for all four entry points and this approved plan. Markdown sentinels and plan structure parsing remain diagnostic defense in depth, and the three Task 2 templates must stay synchronized with their formal blocks.

- [ ] **Step 1: Write mutation-first self-tests for the complete routing contract**

Read the current real four entry points and plan into the self-test fixture; production validation remains pure. Cover empty-input fail-closed behavior and, independently for root, guide, and skill, conflicting text appended after the end sentinel, conflicting text prepended on the same line before the start sentinel, plan-template deletion or rewrite, and trailing two-space drift. Also cover prompt prefix and suffix conflicts. Preserve the existing sentinel deletion/duplication/reversal and body-edit diagnostics. Move each plan template alone to the Task 2 tail, detach all three together, and swap templates across steps. Retain the fence/comment structure cases as diagnostic regression coverage, but add the root-cause cases: two Task 2 and four Step 1-4 HTML-comment token splices, plus plan BOM, trailing-space, and arbitrary-comment mutations. Prove LF, CRLF, and bare CR are equivalent, while every other plan byte drift fails.

Each semantic mutation must retain unrelated marker words so a document-wide bag-of-substrings implementation demonstrably fails RED.

- [ ] **Step 2: Run the self-test and verify the new contract is not implemented**

Run:

```powershell
node scripts/check_harness.mjs --self-test
```

Expected: FAIL with exactly twelve new cases: six Markdown outside-sentinel conflicts, two prompt conflicts, three plan-template drifts, and one trailing-space drift. Record these names as the false-green evidence.

- [ ] **Step 3: Implement the minimal structure-aware pure validator**

Add the exported function immediately after `codexWorkflowPolicyErrors`. Normalize only CRLF or bare CR to LF; do not trim the file, body, trailing horizontal whitespace, or BOM. Store clearly named expected whole-file SHA-256 constants for root, guide, skill, prompt, and this approved plan. Make plan hash equality authoritative and aggregate its mismatch into all three Markdown entry errors, preserving exactly four errors for fully empty input. Existing fence/comment parsing, step binding, sentinel checks, and full-plan template uniqueness may remain as diagnostics, but none can compensate for a plan hash mismatch. A plan change is intentional only when the approved plan text, expected hash, real-file self-test fixture, and evidence are updated together.

- [ ] **Step 4: Run the focused self-test**

Run:

```powershell
node scripts/check_harness.mjs --self-test
```

Expected: PASS and `agentic-check self-test` reports all whole-entry, prompt, sentinel, plan-sync, and whitespace mutation cases passing.

- [ ] **Step 5: Review Task 1 independently**

Run:

```powershell
git diff --check
git diff -- scripts/check_harness.mjs docs/failures/2026-08-13-adaptive-routing-validator-false-green.md
```

Expected: no whitespace errors; the diff contains only the pure validator and its two self-tests.

- [ ] **Step 6: Commit Task 1 only if separately authorized**

After printing and checking the absolute workspace path, branch, HEAD, and `git status`, run only with explicit commit authorization:

```powershell
git add scripts/check_harness.mjs docs/failures/2026-08-13-adaptive-routing-validator-false-green.md
git commit -m "test: define adaptive skill routing contract"
```

Expected: one commit containing only the validator and self-tests. Without authorization, skip the commit and continue with the working-tree changes intact.

---

### Task 2: Persist the approved routing behavior in repository governance

**Files:**
- Modify: `AGENTS.md:7-23`
- Modify: `docs/codex-engineering-workflow.md:17-36`
- Modify: `.agents/skills/codex-engineering-workflow/SKILL.md:24-41`
- Modify: `.agents/skills/codex-engineering-workflow/agents/openai.yaml:2-4`
- Create: `docs/decisions/0043-adaptive-skill-routing.md`
- Reference: `docs/decisions/0016-codex-engineering-workflow-profile.md`
- Reference: `docs/superpowers/specs/2026-08-13-adaptive-skill-routing-design.md`

**Interfaces:**
- Consumes: The approved lifecycle, task-profile dimensions, routing table, explanation contract, escalation triggers, and authorization boundaries.
- Produces: One aligned policy across the mandatory root entry point, detailed guide, executable project skill, agent prompt, and architectural decision record.

- [ ] **Step 1: Replace the fixed root mapping without increasing the root file beyond 80 lines**

Target: `AGENTS.md`

Replace the `确定性映射` list in `AGENTS.md` with this compact contract:

```markdown
<!-- adaptive-routing-contract:start -->
- 先盘问：优先检查现有证据，只询问会实质改变目标、范围、验收、风险或授权的问题；信息足够即停止，关键歧义无法消除则标记 `Blocked`。
- Codex 自动选择并说明理由：直接执行仅用于明确、局部、可逆、低风险、不改变业务行为且容易验证的工作；局部行为修改在足够时使用 Matt Skills；跨模块、未知根因、高风险或验证链较长时使用 Superpowers。
- 允许按证据 `直接执行 → Matt Skills → Superpowers` 升级；连续验证失败时必须说明证据并升级到 Superpowers；已有明确授权的高风险事项使用 Superpowers，缺少授权或未解决歧义时进入 `Blocked`。
- 质量门禁包括根因、测试和新鲜验证，不因所选 Skill 降低；范围实质变化时重新盘问。
- Matt Skills 缺失时不自动安装；使用等价 Codex 原生步骤，无法满足门禁时升级到 Superpowers。
- worktree 操作继续使用 `using-git-worktrees`；本仓库实质工程任务继续使用 `codex-engineering-workflow` 统一路由。
<!-- adaptive-routing-contract:end -->
```

Run:

```powershell
$lines = (Get-Content AGENTS.md).Count
if ($lines -gt 80) { throw "AGENTS.md has $lines lines; limit is 80" }
```

Expected: exit 0, line count at most 80, and the template exactly preserves the final direct/Matt/Superpowers routing, authority-dependent blocking, repeated-failure escalation, fallback, and quality-gate relationships.

- [ ] **Step 2: Replace the guide's fixed scenario matrix with the full lifecycle and routing contract**

Target: `docs/codex-engineering-workflow.md`

Keep the heading `## 场景矩阵` for compatibility, but replace its body and add adjacent subsections with the following content:

```markdown
## 场景矩阵

<!-- adaptive-routing-contract:start -->
所有实质任务先进入盘问与退出条件，再由 Codex 自动分流。`using-superpowers` 是元级 preflight，不等于已经启用完整 Superpowers 工作流。

| 路线 | 典型条件 | 执行要求 |
| --- | --- | --- |
| 直接执行 | 目标明确、局部、可逆、低风险、不改变业务行为且容易验证 | 执行最小相关检查并报告证据 |
| Matt Skills | 局部功能或缺陷，存在受控不确定性，需要针对性澄清、实现或审查 | 只加载直接有用的 Matt Skills，同时满足仓库质量门禁 |
| Superpowers | 跨模块、架构或契约变化、未知根因、难回滚、高风险或验证链较长 | 使用适用的规划、调试、TDD、审查和完成验证流程 |

## 盘问与退出条件

Codex 先检查代码、文档、命令与当前证据，不要求用户复述可发现事实。只询问会实质改变目标、范围、验收、风险或授权的问题；信息足够即停止。关键歧义无法消除时标记 `Blocked`，不猜测业务决定。

## 自动分流

任务画像由需求明确度、影响范围、可逆性、失败后果、根因或实现路径确定性、验证难度组成。Codex 自动选择最小够用路线，并在实现前说明 `Task profile`、`Selected route`、`Reason`、`Quality gates` 与 `Escalation`。

质量门禁与 Skill 品牌解耦：Bug 必须有可复现证据和根因，行为修改在可行时必须有测试保护，完成声明必须有最终改动后的新鲜验证。

## 升级与阻塞

执行可按 `直接执行 → Matt Skills → Superpowers` 升级。范围扩大、根因不明、风险上升或连续验证失败时必须说明证据并升级到 Superpowers；范围实质变化时重新盘问。安全、权限、支付、隐私、数据迁移、生产配置、不可逆操作和架构边界变化是硬升级事项：已有明确授权的高风险事项进入 Superpowers；缺少授权或未解决歧义时进入 `Blocked`。

Matt Skills 缺失时不自动安装；优先使用等价 Codex 原生步骤，仍无法满足质量门禁时升级。升级复用仍有效的证据与工作，不机械重复已完成步骤。
<!-- adaptive-routing-contract:end -->
```

- [ ] **Step 3: Make the project skill execute the same routing contract**

Target: `.agents/skills/codex-engineering-workflow/SKILL.md`

Replace `.agents/skills/codex-engineering-workflow/SKILL.md` section `## 选择最小流程` with:

````markdown
<!-- adaptive-routing-contract:start -->
## 先盘问并自动分流

先检查仓库事实，只询问会改变目标、范围、验收、风险或授权的问题。信息足够立即停止盘问；关键歧义无法消除时返回 `Blocked`。

按需求明确度、影响范围、可逆性、失败后果、路径确定性和验证难度自动选择：

| 路线 | 条件 |
| --- | --- |
| 直接执行 | 明确、局部、可逆、低风险、不改变业务行为且容易验证 |
| Matt Skills | 局部行为修改且风险可控，但需要针对性澄清、实现或审查 |
| Superpowers | 跨模块、架构/契约变化、未知根因、难回滚、高风险或验证链较长 |

开始实现前输出：

```text
Task profile: summarize the current clarity, scope, reversibility, impact, path certainty, and verification difficulty
Selected route: state exactly one of direct execution, Matt Skills, or Superpowers
Reason: explain why the route is the smallest one sufficient for current evidence
Quality gates: list the applicable root-cause, test, fresh-verification, safety, and authorization outcomes
Escalation: list the observable evidence that will trigger a heavier route
```

允许按 `直接执行 → Matt Skills → Superpowers` 升级，不得静默降低 Quality gates。范围实质变化时重新盘问；连续验证失败时必须说明证据并升级到 Superpowers。已有明确授权的高风险事项使用 Superpowers；缺少授权或未解决业务歧义时进入 `Blocked`。Matt Skills 缺失时不自动安装，改用等价 Codex 原生步骤，无法满足门禁时升级到 Superpowers。
<!-- adaptive-routing-contract:end -->
````

Retain the existing priority, Codex-only, external authorization, and fresh-evidence sections after this replacement.

- [ ] **Step 4: Update the skill's default prompt**

Set `.agents/skills/codex-engineering-workflow/agents/openai.yaml` to:

```yaml
interface:
  display_name: "Codex 工程工作流"
  short_description: "先盘问，再自动选择直接执行、Matt Skills 或 Superpowers，并保留质量与安全门禁"
  default_prompt: "Use $codex-engineering-workflow to clarify first, choose direct execution, Matt Skills, or Superpowers, explain the smallest sufficient route, and escalate when evidence raises scope, uncertainty, or risk while preserving fresh verification."
```

- [ ] **Step 5: Record the governance decision**

Create `docs/decisions/0043-adaptive-skill-routing.md` with exactly these sections and decision content:

```markdown
# ADR 0043: Adaptive Skill Routing

## Status

Accepted — 2026-08-13

## Context

Fixed task-to-skill mappings preserve discipline but can impose a full workflow on small, clear, reversible tasks. The repository needs to preserve root-cause, test, verification, safety, and authorization outcomes while allowing a strong model to select a smaller execution tool when evidence supports it.

## Decision

Every substantive Codex engineering task first performs bounded clarification, then Codex automatically selects and explains direct execution, Matt Skills, or Superpowers from the current task profile. Routing begins with the smallest sufficient workflow and may escalate as scope, uncertainty, verification cost, or risk increases. Quality gates are independent of skill brand. Missing optional skills are not installed automatically and do not become CI dependencies.

Repository rules, product contracts, explicit authorization boundaries, and ADR 0028 remain higher priority than any selected third-party skill.

## Consequences

Small tasks avoid unnecessary workflow overhead, while complex and high-risk tasks still receive full discipline. Routing decisions become observable and testable. The trade-off is that repository policy must define escalation and outcome gates precisely enough to prevent a model from treating “lighter” as permission to skip evidence.

## Verification

- `node scripts/check_harness.mjs`
- `node scripts/check_harness.mjs --self-test`
- `node .agents/hooks/check-harness.mjs --self-test`
- `node .agents/skills/product-flow/scripts/run-claude-delivery.mjs --self-test`
- `git diff --check`
```

- [ ] **Step 6: Run targeted governance checks**

Run:

```powershell
rg -n "先盘问|自动分流|直接执行 → Matt Skills → Superpowers|质量门禁|不自动安装" AGENTS.md docs/codex-engineering-workflow.md .agents/skills/codex-engineering-workflow/SKILL.md
rg -n "clarify first|direct execution|Matt Skills|Superpowers|explain|escalate" .agents/skills/codex-engineering-workflow/agents/openai.yaml
$lines = (Get-Content AGENTS.md).Count
if ($lines -gt 80) { throw "AGENTS.md has $lines lines; limit is 80" }
```

Expected: all routing markers appear and the root instruction file remains at most 80 lines.

- [ ] **Step 7: Review Task 2 independently**

Run:

```powershell
git diff --check
git diff -- AGENTS.md docs/codex-engineering-workflow.md .agents/skills/codex-engineering-workflow/SKILL.md .agents/skills/codex-engineering-workflow/agents/openai.yaml docs/decisions/0043-adaptive-skill-routing.md
```

Expected: only the approved routing policy changes appear; Codex-only, external authorization, and fresh-verification rules remain present.

- [ ] **Step 8: Commit Task 2 only if separately authorized**

After the required absolute-path, branch, HEAD, and status check, run only with explicit commit authorization:

```powershell
git add AGENTS.md docs/codex-engineering-workflow.md .agents/skills/codex-engineering-workflow/SKILL.md .agents/skills/codex-engineering-workflow/agents/openai.yaml docs/decisions/0043-adaptive-skill-routing.md
git commit -m "docs: adopt adaptive skill routing"
```

Expected: one governance commit. Without authorization, skip the commit.

---

### Task 3: Wire repository validation to the sealed adaptive-routing contract

**Files:**
- Modify: `scripts/check_harness.mjs:8-70`
- Modify: `scripts/check_harness.mjs:888-915`
- Modify: `scripts/check_harness.mjs:1030-1055`
- Modify: `scripts/check_harness.mjs:1121-1135`
- Test: `scripts/check_harness.mjs:1278-1790`
- Reference: `docs/superpowers/specs/2026-08-13-adaptive-skill-routing-design.md`
- Reference: `docs/superpowers/plans/2026-08-13-adaptive-skill-routing.md`
- Create: `docs/failures/2026-08-13-adaptive-routing-validator-false-green.md`

**Interfaces:**
- Consumes: The four repository entry-point files from Task 2 and the pure `adaptiveRoutingPolicyErrors` function from Task 1.
- Produces: Normal harness failures when any of the five normalized whole-file hashes drifts. Markdown sentinel and plan structure/template checks remain additional diagnostics and cannot weaken the authoritative plan hash seal.

- [ ] **Step 1: Make the approved records required harness files**

Add these entries to `REQUIRED_FILES` next to the existing Codex workflow files:

```js
  "docs/decisions/0043-adaptive-skill-routing.md",
  "docs/superpowers/specs/2026-08-13-adaptive-skill-routing-design.md",
  "docs/superpowers/plans/2026-08-13-adaptive-skill-routing.md",
  "docs/failures/2026-08-13-adaptive-routing-validator-false-green.md",
```

- [ ] **Step 2: Wire the pure validator into repository validation**

After `codexWorkflowPolicyErrors(...)` is called in `validateHarness`, read all four entry points once and add:

```js
  const codexWorkflowGuidePath = join(root, "docs", "codex-engineering-workflow.md");
  const codexWorkflowSkillPath = join(root, ".agents", "skills", "codex-engineering-workflow", "SKILL.md");
  const codexWorkflowPromptPath = join(root, ".agents", "skills", "codex-engineering-workflow", "agents", "openai.yaml");
  const adaptiveRoutingPlanPath = join(root, "docs", "superpowers", "plans", "2026-08-13-adaptive-skill-routing.md");
  const agentsPath = join(root, "AGENTS.md");
  errors.push(...adaptiveRoutingPolicyErrors({
    agents: existsSync(agentsPath) ? readFileSync(agentsPath, "utf8") : "",
    guide: existsSync(codexWorkflowGuidePath) ? readFileSync(codexWorkflowGuidePath, "utf8") : "",
    skill: existsSync(codexWorkflowSkillPath) ? readFileSync(codexWorkflowSkillPath, "utf8") : "",
    prompt: existsSync(codexWorkflowPromptPath) ? readFileSync(codexWorkflowPromptPath, "utf8") : "",
    plan: existsSync(adaptiveRoutingPlanPath) ? readFileSync(adaptiveRoutingPlanPath, "utf8") : "",
  }));
```

Reuse these path bindings in the existing validation blocks instead of redeclaring them. If `agentsPath`, `codexWorkflowGuidePath`, or `codexWorkflowSkillPath` already exists in the same function scope, move its existing declaration upward rather than creating a duplicate binding.

- [ ] **Step 3: Retain coarse content guards alongside the structured validator**

Add the following values to the existing `requireText` arrays:

```js
// AGENTS.md
"先盘问",
"Codex 自动选择并说明理由",
"直接执行 → Matt Skills → Superpowers",
"质量门禁",

// docs/codex-engineering-workflow.md
"盘问与退出条件",
"自动分流",
"升级与阻塞",
"不自动安装",

// .agents/skills/codex-engineering-workflow/SKILL.md
"Selected route",
"Quality gates",
"Escalation",
"Blocked",
```

These coarse guards, Markdown sentinel diagnostics, and plan parser are defense in depth only; they do not replace normalized whole-file hash equality for the four entries and approved plan. Keep the existing checks for `gstack-claude`, `run-claude-delivery.mjs`, Codex delivery roles, separate explicit authorization, CI independence, and verification skills.

- [ ] **Step 4: Run mutation self-tests and repository validation**

Run:

```powershell
node scripts/check_harness.mjs --self-test
node scripts/check_harness.mjs
node .agents/hooks/check-harness.mjs --self-test
```

Expected: all three commands pass; the mutation suite rejects outside-sentinel additions, prompt prefix/suffix conflicts, plan-template drift, trailing whitespace, sentinel deletion/duplication/reversal, and body edits. The normal harness reports the required-file count including the design, plan, ADR, and named false-green failure record; deleting that failure record must fail normal validation.

- [ ] **Step 5: Prove the validator fails closed without modifying repository files**

Run this import-only probe:

```powershell
node --input-type=module -e "import('./scripts/check_harness.mjs').then(m => { const e=m.adaptiveRoutingPolicyErrors({agents:'',guide:'',skill:'',prompt:'',plan:''}); if(e.length!==4) process.exit(1); console.log(e.join('\n')); })"
```

Expected: exit 0 and four missing-contract messages, one for each entry point. The imported module's normal main path may also print its standard harness result; no files are changed.

- [ ] **Step 6: Review Task 3 independently**

Run:

```powershell
git diff --check
git diff -- scripts/check_harness.mjs docs/failures/2026-08-13-adaptive-routing-validator-false-green.md
```

Expected: the validator is wired once, existing safety assertions remain, and no unrelated harness policy changes appear.

- [ ] **Step 7: Commit Task 3 only if separately authorized**

After the required Git target check, run only with explicit commit authorization:

```powershell
git add scripts/check_harness.mjs docs/failures/2026-08-13-adaptive-routing-validator-false-green.md
git commit -m "test: enforce adaptive skill routing"
```

Expected: one harness commit. Without authorization, skip the commit.

---

### Task 4: Run the complete ten-round final acceptance gate

**Files:**
- Verify: `AGENTS.md`
- Verify: `docs/codex-engineering-workflow.md`
- Verify: `.agents/skills/codex-engineering-workflow/SKILL.md`
- Verify: `.agents/skills/codex-engineering-workflow/agents/openai.yaml`
- Verify: `scripts/check_harness.mjs`
- Verify: `docs/decisions/0043-adaptive-skill-routing.md`
- Verify: `docs/superpowers/specs/2026-08-13-adaptive-skill-routing-design.md`
- Verify: `docs/superpowers/plans/2026-08-13-adaptive-skill-routing.md`
- Verify: `docs/failures/2026-08-13-adaptive-routing-validator-false-green.md`
- Verify unchanged: `docs/decisions/0028-decree-evidence-flow-governance-baseline.md`

**Interfaces:**
- Consumes: The final unchanged working-tree version from Tasks 1-3.
- Produces: Ten consecutive recorded rounds of complete acceptance evidence for the same version.

- [ ] **Step 1: Perform the completion preflight**

Run:

```powershell
git status --short
git diff --check
if (-not (Test-Path 'docs/failures/2026-08-13-adaptive-routing-validator-false-green.md' -PathType Leaf)) { throw 'Required adaptive-routing failure record is missing' }
$actual = node --input-type=module -e "import { createHash } from 'node:crypto'; import { readFileSync } from 'node:fs'; const text = readFileSync('docs/decisions/0028-decree-evidence-flow-governance-baseline.md', 'utf8').replace(/\r\n?/gu, '\n'); process.stdout.write(createHash('sha256').update(text).digest('hex'));"
if ($actual -ne '3ac5d0c3510c62dbdf9b4b785d8175a259b1ce46b0c56c29abbbc7bb2e39a31e') { throw "ADR 0028 hash changed: $actual" }
```

Expected: only approved files are modified/untracked, diff check passes, and ADR 0028 hash matches.

- [ ] **Step 2: Execute and record 10 consecutive complete rounds**

For each round `1` through `10`, without editing any file between rounds, run this entire sequence and record each command as PASS or FAIL in the task transcript:

```powershell
node scripts/check_harness.mjs
node scripts/check_harness.mjs --self-test
node .agents/hooks/check-harness.mjs --self-test
node .agents/skills/product-flow/scripts/run-claude-delivery.mjs --self-test
if (-not (Test-Path 'docs/failures/2026-08-13-adaptive-routing-validator-false-green.md' -PathType Leaf)) { throw 'Required adaptive-routing failure record is missing' }
$lines = (Get-Content AGENTS.md).Count
if ($lines -gt 80) { throw "AGENTS.md has $lines lines; limit is 80" }
$actual = node --input-type=module -e "import { createHash } from 'node:crypto'; import { readFileSync } from 'node:fs'; const text = readFileSync('docs/decisions/0028-decree-evidence-flow-governance-baseline.md', 'utf8').replace(/\r\n?/gu, '\n'); process.stdout.write(createHash('sha256').update(text).digest('hex'));"
if ($actual -ne '3ac5d0c3510c62dbdf9b4b785d8175a259b1ce46b0c56c29abbbc7bb2e39a31e') { throw "ADR 0028 hash changed: $actual" }
git diff --check
```

Expected for every round: all commands exit 0. If any command fails, fix the cause and restart at round 1. If code, configuration, or this acceptance sequence changes materially, restart at round 1.

- [ ] **Step 3: Review the complete final diff and working-tree scope**

Run:

```powershell
git diff -- AGENTS.md docs/codex-engineering-workflow.md .agents/skills/codex-engineering-workflow/SKILL.md .agents/skills/codex-engineering-workflow/agents/openai.yaml scripts/check_harness.mjs docs/decisions/0043-adaptive-skill-routing.md docs/superpowers/specs/2026-08-13-adaptive-skill-routing-design.md docs/superpowers/plans/2026-08-13-adaptive-skill-routing.md docs/failures/2026-08-13-adaptive-routing-validator-false-green.md
git status --short
```

Expected: the diff matches the approved design; no unrelated user changes are included; ADR 0028 is absent from the diff.

- [ ] **Step 4: Run a final manual routing review**

Check these examples against the final text without editing files:

```text
Explanation or tiny documentation correction → direct execution
Local reversible feature or defect → Matt Skills when sufficient
Unknown root cause, cross-module, architecture, or contract change → Superpowers
Security, production write, or irreversible action without authority → Blocked
Missing Matt Skills → native equivalent or escalation, never silent installation
Scope expansion or repeated verification failure → explained escalation
```

Expected: all six outcomes are directly supported by root instructions, the guide, and the executable skill.

- [ ] **Step 5: Create a final commit only if separately authorized**

If earlier per-task commits were skipped and the user now explicitly authorizes a commit, first print and verify the absolute workspace path, current branch, HEAD, and status, then run:

```powershell
git add AGENTS.md docs/codex-engineering-workflow.md .agents/skills/codex-engineering-workflow/SKILL.md .agents/skills/codex-engineering-workflow/agents/openai.yaml scripts/check_harness.mjs docs/decisions/0043-adaptive-skill-routing.md docs/superpowers/specs/2026-08-13-adaptive-skill-routing-design.md docs/superpowers/plans/2026-08-13-adaptive-skill-routing.md docs/failures/2026-08-13-adaptive-routing-validator-false-green.md
git commit -m "feat: adopt adaptive skill routing"
```

Expected: one commit containing only the approved governance, skill, harness, design, plan, failure record, and ADR files. Without explicit authorization, leave all changes uncommitted and report that status. Every fingerprint and ten-round result recorded before the final plan hash and required failure-record scope was established is invalid and must not be reused.
