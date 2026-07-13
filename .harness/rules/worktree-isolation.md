# Worktree isolation

- Worker tasks use `.worktrees/<task-id>` and branch `agent/<task-id>`.
- Allocation requires an active Task-owned write lease and an exclusive declared `port:3100..3199` resource lock.
- Ports 3002/3050, shared `.next`, shared Playwright output and shared test-results are forbidden.
- Every worker receives `NEXT_DIST_DIR=.next-agent-<task>`, `dev/artifacts/<task-id>/`, and task-specific Playwright/test result paths.
- Retire validates the exact resource-lock nonce and fencing epoch. Recovery never broad-kills processes: a live registered holder, matching PID instance, process cwd, socket listener or ambiguous evidence causes fail-closed.
- Runtime registry truth lives under git-common-dir; the tracked JSON file is an empty schema/bootstrap example, not mutable runtime state.
