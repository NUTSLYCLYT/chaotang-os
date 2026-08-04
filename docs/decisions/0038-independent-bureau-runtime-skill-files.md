# Independent files for bureau Runtime Skills

## Status

Accepted - 2026-08-04

## Context

The 39 bureau Agents already have distinct Runtime Skills and Tool Policies, but their professional methods and policies are concentrated in one large `professional.py`, while Skill IDs are split across six department modules. This preserves runtime identity but not source ownership, creates edit contention, and allows a bureau method and its Tool Policy to drift during maintenance.

## Decision

Each authoritative bureau will own exactly one Python Runtime Skill definition file. A frozen shared specification type will bind department, bureau, Agent ID, Skill ID, professional method, and Tool Policy in one `BureauRuntimeSkillSpec`. A central registry will explicitly import all 39 definitions and derive compatibility mappings.

Registration remains explicit. Dynamic discovery, directory scanning, name interpolation, generic policy fallback, and automatic completion are forbidden. Existing `professional.py` and six department ID modules become compatibility facades and contain no duplicated definition bodies.

This is a structural migration only. Existing Agent, Skill, and Policy identities, versions, method text, Tool authority, Evidence behavior, reports, upper-layer isolation, and LangGraph topology remain unchanged. These project Runtime Skills are Python runtime definitions, not Codex `SKILL.md` packages.

## Consequences

- Each bureau can be maintained and reviewed independently.
- Method and Tool Policy changes become one-file changes.
- The central registry and startup validation remain the sole authority for the complete 39-bureau set.
- The repository gains 39 small modules plus shared registry infrastructure.
- Migration requires exact snapshot tests to prevent silent textual, permission, ordering, or budget drift.
- Compatibility facades remain temporarily to avoid an unrelated public-import migration.

## Verification

```powershell
python -m pytest backend/tests/test_bureau_independent_skill_files.py backend/tests/test_bureau_runtime_skills.py backend/tests/test_bureau_tool_registry.py -q
python -m pytest backend/tests/test_bureau_tool_use_integration.py backend/tests/test_bureaus_agent.py backend/tests/test_ministry_runtime_skills.py backend/tests/test_junjichu_runtime_skill.py backend/tests/test_chancellor_graph.py -q
python -m ruff check backend/app backend/tests
node scripts/check_harness.mjs
```

The final unchanged version must also complete at least 10 consecutive full acceptance rounds under the repository acceptance rule.
