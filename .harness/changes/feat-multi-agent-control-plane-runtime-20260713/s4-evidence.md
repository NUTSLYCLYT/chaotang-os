# S4 worktree manager evidence

Status: `IMPLEMENTED_LOCAL` (not a production rollout claim).

## NO-GO remediation

- Registry initializes only on `ENOENT`; truncated JSON, schema drift, digest mismatch, unsafe permissions, unknown fields, or key mismatch stop closed.
- Registry writes use an owner-only lock, canonical SHA-256 digest, temporary file, file `fsync`, atomic rename, and directory `fsync`.
- A Task freezes canonical `.worktrees/<task_id>` and a full `metadata.approved_base_sha`. Creation uses that exact commit and verifies shared Git/control-plane identity.
- Normal retirement requires supervisor handoff token plus actor/reason/evidence. The worktree must disappear from the filesystem and `git worktree list` before its port is released.
- Crash recovery verifies removal before break-glass/reclaim. Removal failure or a listening port leaves the registry blocked and port retained.
- Registry lifecycle and blocked transitions emit control-plane audit events.
- Test-only database and registry overrides require both `NODE_ENV=test` and `CHAOTANG_CONTROL_PLANE_TEST_ADAPTER=1`.

## Linked-worktree hook fix

`frontend/scripts/install-git-hooks.mjs` resolves hooks through:

```bash
git rev-parse --path-format=absolute --git-path hooks
```

It therefore supports linked worktrees and `core.hooksPath`. It preserves the `chaotang-hook-dispatcher-v1` dispatcher and installs the frontend guard as executable `pre-commit.d/chaotang-frontend`; it does not treat linked-worktree `.git` files as directories.

TDD evidence:

- RED: linked worktree failed `ENOTDIR .../.git/hooks`; custom hooksPath installed nowhere.
- GREEN: `node --test frontend/scripts/install-git-hooks.nodetest.mjs` -> `2 passed`.
- All three real Manager-created worktrees subsequently completed standard `pnpm install --offline --frozen-lockfile`, including prepare, with status 0.

## Automated verification

```bash
node --test --test-concurrency=1 \
  frontend/scripts/install-git-hooks.nodetest.mjs \
  scripts/worktree-manager.nodetest.mjs \
  scripts/worktree-manager-negative.nodetest.mjs
```

Coverage includes:

- three isolated worktrees/ports/dist/artifact paths and normal handoff retirement;
- missing write lease and forbidden production/dev ports;
- live holder versus crashed holder recovery;
- registry truncation, schema, digest, and permissions;
- wrong approved base and frozen worktree path;
- wrong handoff token;
- Git removal failure retaining an active port;
- listening port blocking crash reclaim.

Root verification: `node scripts/harness-doctor.mjs` -> `0 errors, 0 warnings`.

## Manager-owned real production builds

Reproducible command:

```bash
node scripts/worktree-manager-real-build.mjs
```

The script used the Manager API to create three real Tasks in the current repository. Each Task held an active write lease and its 3111/3112/3113 resource lock from worktree creation through standard install and build. All used approved candidate commit `b57b29662058ecb8855020f28b1cc7df409577f5`, containing the linked-worktree hook fix without moving the current branch.

Both phases use `Promise.all` over real child processes. The three installs overlapped from `03:32:34.144Z` through `03:32:35.620Z`. The three production builds overlapped from `03:32:35.625Z` through `03:33:16.167Z`; the runner hard-fails unless `max(started_at) < min(completed_at)` for all three intervals.

| Task | Port | Next dist | Install | Build | BUILD_ID SHA-256 |
| --- | ---: | --- | ---: | ---: | --- |
| `task-s4-manager-real-1` | 3111 | `.next-agent-s4-manager-real-1` | 0 | 0 | `fd5d991e605bcc33d2f72113ddff27ece7104614c5a0458dd8d0a26fc3ca802a` |
| `task-s4-manager-real-2` | 3112 | `.next-agent-s4-manager-real-2` | 0 | 0 | `cd68d903d868b0ae4ae7c124051ee41cef94e9430b78776c05e3a375d968caf4` |
| `task-s4-manager-real-3` | 3113 | `.next-agent-s4-manager-real-3` | 0 | 0 | `3f644e7c7581e382b01601edaecf2750c44c995af892ca19120a06e1dbba3086` |

The captured registry contains three `active` entries with Task/owner/commit/port/fencing/holder commitments, followed by three `retired` entries after supervisor handoff retirement. Raw nonce and handoff tokens are excluded; only SHA-256 commitments are persisted. Full machine evidence and six install/build logs are under `artifacts/s4-real-manager/`.

## Isolation and cleanup

- Primary checkout status commitment before and after: `800d1c56ca01d3cc98ef749bfc36729162251b803c423fdc516fe30ab6184ebd`.
- Real control-plane DB SHA-256 during the run, before and after: `c5332c5474f62ac71b9b5bc8c8208c48cca259dd7d488f7de81949fc37232f23`.
- Real worktree registry before and after: `ENOENT`.
- Temporary DB and temporary registry were protected by the explicit test adapter.
- Manager normal retirement removed all three worktrees and released their locks. No crash recovery was misreported as normal retirement.
- Temporary `agent/task-s4-manager-real-*` branches were removed after registry retirement.
- The earlier three manually created detached evidence worktrees were checked for process cwd holders and removed individually with `git worktree remove --force`; no broad process kill or broad filesystem deletion was used.
- Final `git worktree list` contains only the pre-existing primary and release worktrees.
- Artifact scan found no raw `nonce`, raw `handoff_token`, UUID credential, API key, secret, password, or bearer token pattern.
