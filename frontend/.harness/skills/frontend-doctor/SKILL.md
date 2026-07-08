---
name: frontend-doctor
description: Diagnose stuck frontend work by checking harness, ports, build, tests, and product boundaries.
---

# Frontend Doctor Skill

## Triage Order

1. `node scripts/harness-doctor.mjs`
2. Confirm ports and running processes.
3. Confirm package manager and dependencies.
4. Run the smallest failing command again.
5. Search for recent changes in the touched area.
6. Check whether the issue is frontend-owned or backend-owned.

## Output

Write a diagnosis with:

- Symptom.
- Reproduction command.
- Likely owner.
- Suggested next stage.
