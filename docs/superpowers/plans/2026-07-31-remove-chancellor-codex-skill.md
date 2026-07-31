# Remove Chancellor Codex Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the discoverable `chancellor-draft-edict` Codex Skill while preserving the backend Chancellor drafting behavior.

**Architecture:** Store the governed drafting instructions as a backend-owned Markdown resource beside the drafting agent. Replace the Skill-aware loader with a resource loader that validates content anchors and fails closed, then remove the `.agents/skills/chancellor-draft-edict/` directory.

**Tech Stack:** Python 3.11+, pathlib, hashlib, pytest.

## Global Constraints

- Preserve ADR 0028 and the existing draft/decree authority boundary.
- Do not modify historical ADR, task, plan, or failure records that describe the former Skill.
- Do not commit or push without separate user authorization.
- Preserve unrelated working-tree changes.

---

### Task 1: Replace Skill loading with backend resource loading

**Files:**
- Create: `backend/app/agents/chancellor_draft/instructions.md`
- Create: `backend/app/agents/chancellor_draft/instructions_loader.py`
- Delete: `backend/app/agents/chancellor_draft/skill_loader.py`
- Modify: `backend/app/agents/chancellor_draft/__init__.py`
- Modify: `backend/app/agents/chancellor_draft/graph.py`
- Modify: `backend/tests/test_chancellor_draft_skill_loader.py`

**Interfaces:**
- Produces: `load_chancellor_draft_instructions(path: Path | None = None) -> ChancellorDraftInstructions`
- Preserves: validated `instructions`, `sha256`, and `source_path` values consumed by the graph.

- [ ] Change the focused tests to require a backend resource path, governed anchors, UTF-8/size validation, and no Skill frontmatter identity.
- [ ] Run the focused tests and verify they fail because the resource loader does not exist.
- [ ] Add the backend instruction resource and minimal fail-closed loader.
- [ ] Update graph/package imports and run the focused tests to PASS.

### Task 2: Remove Codex Skill discovery files

**Files:**
- Delete: `.agents/skills/chancellor-draft-edict/SKILL.md`
- Delete: `.agents/skills/chancellor-draft-edict/agents/openai.yaml`

- [ ] Delete the two Skill discovery files.
- [ ] Verify no live code references `.agents/skills/chancellor-draft-edict` or `load_chancellor_draft_skill`.
- [ ] Run backend Ruff, focused tests, harness checks, and `git diff --check`.
