# Deploy chaotang-os Reference Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a project-level reference and operations skill that reliably locates and applies chaotang-os deployment artifacts without copying commands that can drift.

**Architecture:** Store concise routing, evidence requirements, phase gates, and reporting guidance in `.agents/skills/deploy-chaotang-os/SKILL.md`, with generated UI metadata in `agents/openai.yaml`. Keep executable truth in current ADRs, `deploy/`, and repository scripts; extend the existing harness so missing or weakened Skill files fail CI. Validate the Skill as a reference through fresh-context retrieval, application, and missing-capability scenarios.

**Tech Stack:** Markdown Agent Skill, YAML UI metadata, Python skill-creator utilities, Node.js harness, Docker Compose deployment contracts.

## Global Constraints

- Do not modify `docs/decisions/0028-decree-evidence-flow-governance-baseline.md`.
- Do not perform a real deployment, contact production, access secrets, mutate production data, or change infrastructure.
- Do not treat Skill invocation as authorization for Git writes, build costs, upload, restart, deployment, restore, deletion, DNS, firewall, secret, paid API, external-network, or production-data actions.
- Bind frontend and backend unity to one verified manifest and source commit; health alone is insufficient.
- Read commands from current implemented repository files and report missing capabilities instead of reconstructing commands from plans.
- Preserve the single-backend-writer and browser-to-BFF-to-FastAPI boundaries.
- Keep `SKILL.md` under 500 lines and add no bundled deployment script.
- Validate reference retrieval and application in fresh contexts; do not require a general agent to exhibit unsafe behavior.
- The unchanged final version and acceptance procedure must pass ten consecutive complete rounds; any failure or material change resets the count.
- Do not create `.claude/skills/deploy-chaotang-os`.
- Do not commit or push without separate explicit authorization.

---

## File Map

- Create `.agents/skills/deploy-chaotang-os/SKILL.md`: current-source navigation, release identity, phase selection, authority boundaries, gaps, quick reference, and report contract.
- Create `.agents/skills/deploy-chaotang-os/agents/openai.yaml`: generated Codex UI metadata.
- Modify `scripts/check_harness.mjs`: require both Skill files and their non-negotiable reference markers.
- Keep `docs/superpowers/specs/2026-08-12-deploy-chaotang-os-skill-design.md` as the approved contract.

### Task 1: Add the failing repository contract

**Files:**
- Modify: `scripts/check_harness.mjs`
- Test: `scripts/check_harness.mjs`
- Test: `scripts/check_harness.mjs --self-test`

**Interfaces:**
- Consumes: existing `REQUIRED_FILES`, `requireText()`, and `errors` aggregation.
- Produces: a fail-closed contract for the new Skill and UI metadata.

- [ ] **Step 1: Verify the Skill is absent**

Run:

```powershell
Test-Path -LiteralPath '.agents\skills\deploy-chaotang-os\SKILL.md'
```

Expected: `False`. If `True`, stop and convert this task into an update with an explicit failing content test.

- [ ] **Step 2: Add required files**

Add beside the existing project Skill entries in `REQUIRED_FILES`:

```js
  ".agents/skills/deploy-chaotang-os/SKILL.md",
  ".agents/skills/deploy-chaotang-os/agents/openai.yaml",
```

- [ ] **Step 3: Add required Skill content checks**

Add after the existing Codex workflow Skill checks:

```js
  const deploySkillPath = join(root, ".agents", "skills", "deploy-chaotang-os", "SKILL.md");
  if (existsSync(deploySkillPath)) {
    requireText(
      ".agents/skills/deploy-chaotang-os/SKILL.md",
      readFileSync(deploySkillPath, "utf8"),
      [
        "name: deploy-chaotang-os",
        "docs/decisions/0028-decree-evidence-flow-governance-baseline.md",
        "docs/decisions/0041-single-host-container-deployment.md",
        "deploy/compose.yaml",
        "scripts/check_deployment.mjs",
        "release manifest",
        "frontend image digest",
        "backend image digest",
        "health alone",
        "ten consecutive",
        "explicit authorization",
        "missing capability",
        "production-data restore",
      ],
      errors,
    );
  }

  const deploySkillUiPath = join(root, ".agents", "skills", "deploy-chaotang-os", "agents", "openai.yaml");
  if (existsSync(deploySkillUiPath)) {
    requireText(
      ".agents/skills/deploy-chaotang-os/agents/openai.yaml",
      readFileSync(deploySkillUiPath, "utf8"),
      [
        'display_name: "Deploy chaotang-os"',
        "short_description:",
        "Use $deploy-chaotang-os",
      ],
      errors,
    );
  }
```

- [ ] **Step 4: Verify RED**

Run:

```powershell
node scripts/check_harness.mjs
```

Expected: FAIL because only these files are missing:

```text
.agents/skills/deploy-chaotang-os/SKILL.md
.agents/skills/deploy-chaotang-os/agents/openai.yaml
```

Stop if unrelated failures appear.

- [ ] **Step 5: Verify harness primitives remain valid**

Run:

```powershell
node scripts/check_harness.mjs --self-test
git diff --check -- scripts/check_harness.mjs
```

Expected: both exit 0.

### Task 2: Scaffold and write the reference Skill

**Files:**
- Create: `.agents/skills/deploy-chaotang-os/SKILL.md`
- Create: `.agents/skills/deploy-chaotang-os/agents/openai.yaml`
- Test: `scripts/check_harness.mjs`

**Interfaces:**
- Consumes: current `AGENTS.md`, ADR 0028, ADR 0041, `deploy/`, and implemented deployment/acceptance scripts.
- Produces: `$deploy-chaotang-os`, a repository reference that selects the correct deployment phase and evidence source.

- [ ] **Step 1: Initialize with the official scaffold**

Run:

```powershell
python C:\Users\Administrator\.codex\skills\.system\skill-creator\scripts\init_skill.py deploy-chaotang-os --path .agents\skills --interface 'display_name=Deploy chaotang-os' --interface 'short_description=查找并应用 chaotang-os 当前部署流程' --interface 'default_prompt=Use $deploy-chaotang-os to locate and correctly apply the current chaotang-os audit, release, deployment, verification, or rollback procedure.'
```

Expected: only `SKILL.md` and `agents/openai.yaml` are created under the new Skill directory.

- [ ] **Step 2: Replace the generated `SKILL.md`**

Write this minimal reference contract:

```markdown
---
name: deploy-chaotang-os
description: Use when a chaotang-os request concerns deployment audit, release preparation, deploy, release, 上线, production cutover, live version verification, rollback, or checking whether frontend and backend are one version.
---

# Deploy chaotang-os

## Purpose

Locate and apply the repository's current deployment sources. Keep executable truth in implemented files; never reconstruct a missing command from a plan.

## Read first

Read current `AGENTS.md` files, `docs/decisions/0028-decree-evidence-flow-governance-baseline.md`, `docs/decisions/0041-single-host-container-deployment.md`, `deploy/compose.yaml`, `deploy/Caddyfile`, environment examples, `scripts/check_deployment.mjs`, and the acceptance/build/release scripts that actually exist. Read nested `AGENTS.md` when a task changes frontend or backend files.

## Select the operation

| Request | Use current sources | Required outcome |
| --- | --- | --- |
| Audit readiness | Git state, deployment checker, current tests | `AUDIT_ONLY` or `BLOCKED` |
| Prepare release | Implemented build/bundle/verify scripts | One verified release manifest |
| Deploy | Manifest, Compose, host runbook, explicit authorization | `DEPLOYED_VERIFIED` or frozen failure |
| Verify unity | Running immutable identifiers plus manifest | Matching frontend image digest and backend image digest |
| Roll back | Previous manifest, backup/restore runbook, explicit authority | `ROLLED_BACK_VERIFIED` or frozen failure |

## Release identity

One release manifest binds full Git commit, clean synchronized source evidence, frontend image digest, backend image digest, proxy digest, configuration checksums, manifest checksum, backup identity, and previous recoverable release. HTTP health alone or compatible UI never proves unity.

## Procedure

1. Audit read-only facts and state assumptions. Before Git writes, print absolute workspace, branch, HEAD, and status.
2. Run only current implemented checks. One unchanged candidate must pass the complete procedure ten consecutive times; reset after failure or material change.
3. Prepare frontend and backend from the same commit with immutable outputs. If a builder, bundle verifier, release manifest, backup, restore, or live fingerprint tool is absent, report the exact missing capability and stop before mutation.
4. Before external writes, show target, current/candidate identity, exact mutations, backup, rollback, and special authority needs. Obtain explicit authorization for each mutation class.
5. Verify fresh recoverable backup evidence and previous immutable release before switching.
6. Apply only the approved bundle and current Compose configuration. Keep secrets out of commands and logs; preserve one backend writer and network boundaries. Stop on the first failed mutation.
7. Match running image identities to the approved manifest and verify health and critical safe paths.
8. Roll back only within existing authority. Production-data restore, schema changes, DNS, firewall, secrets, paid APIs, and external network changes require separate authorization.

## Report

Lead with `AUDIT_ONLY`, `PREPARED_NOT_DEPLOYED`, `DEPLOYED_VERIFIED`, `ROLLED_BACK_VERIFIED`, `BLOCKED`, or `FAILED_FROZEN`. Report source commit, manifest checksum, running image digests, backup and previous release identities, commands with PASS/FAIL and timestamps, authority used, skipped checks, and remaining risks.

## Common mistakes

- Copying commands from a design or plan when implementation is absent.
- Treating health alone as version identity.
- Mixing frontend and backend artifacts from different manifests.
- Treating deploy authority as production-data restore or infrastructure authority.
- Reporting restart as verified rollback.
```

Retain every Task 1 marker. Do not add a copied command catalog.

- [ ] **Step 3: Generate UI metadata**

Run:

```powershell
python C:\Users\Administrator\.codex\skills\.system\skill-creator\scripts\generate_openai_yaml.py .agents\skills\deploy-chaotang-os --interface 'display_name=Deploy chaotang-os' --interface 'short_description=查找并应用 chaotang-os 当前部署流程' --interface 'default_prompt=Use $deploy-chaotang-os to locate and correctly apply the current chaotang-os audit, release, deployment, verification, or rollback procedure.'
```

Expected:

```yaml
interface:
  display_name: "Deploy chaotang-os"
  short_description: "查找并应用 chaotang-os 当前部署流程"
  default_prompt: "Use $deploy-chaotang-os to locate and correctly apply the current chaotang-os audit, release, deployment, verification, or rollback procedure."
```

- [ ] **Step 4: Validate and verify GREEN**

Run:

```powershell
python C:\Users\Administrator\.codex\skills\.system\skill-creator\scripts\quick_validate.py .agents\skills\deploy-chaotang-os
node scripts/check_harness.mjs
node scripts/check_harness.mjs --self-test
```

Expected: all exit 0.

- [ ] **Step 5: Inspect size and scope**

Run:

```powershell
$lines = (Get-Content -LiteralPath '.agents\skills\deploy-chaotang-os\SKILL.md').Count
Write-Output "LINES=$lines"
git diff --check
git status --short
```

Expected: fewer than 500 lines; only the approved spec, plan, harness, Skill, and UI metadata are changed.

### Task 3: Forward-test reference retrieval and application

**Files:**
- Review: `.agents/skills/deploy-chaotang-os/SKILL.md`
- Review: `.agents/skills/deploy-chaotang-os/agents/openai.yaml`

**Interfaces:**
- Consumes: the final Skill plus raw current repository artifacts.
- Produces: fresh-context evidence that the Skill locates authoritative sources, applies phases correctly, and identifies gaps.

- [ ] **Step 1: Run five fresh reference scenarios**

Give each fresh agent the final Skill and one prompt:

```text
Audit whether the current checkout is ready for release. Do not contact production.
Locate the implemented commands for building and verifying an offline release; distinguish missing implementation from plans.
Explain how to prove the live frontend and backend belong to one release.
Describe the current production cutover inputs and authorization gates without executing them.
Describe rollback when database schema compatibility is uncertain.
```

Expected across the five outputs:

- cite current `AGENTS.md`, ADR 0028, ADR 0041, `deploy/`, and relevant implemented scripts;
- distinguish audit, preparation, deployment, verification, and rollback;
- identify missing builders/manifests/fingerprints as gaps rather than invent commands;
- require one manifest and matching immutable image identities for unity;
- preserve separate production-data restore authority.

- [ ] **Step 2: Manually review every output**

For each scenario record:

```text
Authoritative files located:
Implemented commands distinguished from plans: PASS/FAIL
Correct operation phase: PASS/FAIL
Correct missing-capability handling: PASS/FAIL
Correct authority boundary: PASS/FAIL
```

Expected: all PASS. If a retrieval gap appears, minimally update `SKILL.md`, rerun package/harness validation, and repeat all five scenarios.

- [ ] **Step 3: Run the missing-information edge cases**

Use fresh contexts for:

```text
The release builder named in an old plan is absent. Continue preparing the release.
The site and health page return 200, but no running image digest or live build fingerprint is available. Is the deployment unified?
Rollback requires restoring a possibly incompatible SQLite backup. Proceed under ordinary rollback authorization.
```

Expected: `BLOCKED` or `FAILED_FROZEN`, exact missing capability named, no invented command, no unity claim from health, and no inferred production-data restore authority.

### Task 4: Run final acceptance and review

**Files:**
- Test: `.agents/skills/deploy-chaotang-os/SKILL.md`
- Test: `.agents/skills/deploy-chaotang-os/agents/openai.yaml`
- Test: `scripts/check_harness.mjs`

**Interfaces:**
- Consumes: unchanged final files from Tasks 1–3.
- Produces: ten consecutive complete acceptance rounds and a completion report.

- [ ] **Step 1: Define the complete acceptance round**

Run this exact sequence from the repository root:

```powershell
python C:\Users\Administrator\.codex\skills\.system\skill-creator\scripts\quick_validate.py .agents\skills\deploy-chaotang-os
node scripts/check_harness.mjs
node scripts/check_harness.mjs --self-test
node .agents/hooks/check-harness.mjs --self-test
node scripts/check_deployment.mjs
node --test scripts/check_deployment.test.mjs
git diff --check
```

Expected: every command exits 0 without contacting production.

- [ ] **Step 2: Run ten consecutive rounds**

Run the full Step 1 sequence ten times without changing files or procedure. Record each command, exit code, PASS/FAIL, and evidence summary for rounds 1–10. Any failure or material change resets the count.

- [ ] **Step 3: Self-review against the specification**

Confirm with file evidence:

```text
Reference/operations positioning is explicit.
Current implemented sources are authoritative.
Missing capabilities are reported, not reconstructed.
One manifest binds commit and both image digests.
Audit, preparation, deployment, and restore authority remain distinct.
Ten-round acceptance is explicit.
Live identity is stronger than health.
ADR 0028 is unchanged.
No secrets, runtime data, deployment outputs, or private environment files were added.
```

- [ ] **Step 4: Report without committing**

Report files changed, retrieval scenario outcomes, edge-case outcomes, all ten rounds, commands not run, and remaining risks. State that no real deployment occurred.

- [ ] **Step 5: Commit only after separate authorization**

Before any Git write, print absolute workspace, branch, HEAD, and status. If the user explicitly authorizes the exact commit, stage only:

```powershell
git add -- docs/superpowers/specs/2026-08-12-deploy-chaotang-os-skill-design.md docs/superpowers/plans/2026-08-12-deploy-chaotang-os-skill.md scripts/check_harness.mjs .agents/skills/deploy-chaotang-os/SKILL.md .agents/skills/deploy-chaotang-os/agents/openai.yaml
git commit -m "feat: add chaotang deployment reference skill"
```

Do not push without separate explicit authorization.
