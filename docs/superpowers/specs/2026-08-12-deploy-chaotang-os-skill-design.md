# Deploy chaotang-os Skill Design

## Goal

Create a project-level `deploy-chaotang-os` reference and operations skill that
helps Codex locate and correctly apply this repository's current deployment
artifacts. It covers audit, acceptance, release preparation, production
authorization, backup, deployment, verification, and bounded rollback without
duplicating commands that can drift. It does not itself grant production access
or any external write authority.

## Scope

The skill lives under `.agents/skills/deploy-chaotang-os/` so it is discovered
with the repository. Its primary artifact is a concise `SKILL.md`. Detailed
commands remain in the repository's existing deployment files, scripts, and
ADRs; the skill references those sources instead of copying commands that can
drift.

The skill supports these user intents:

- audit whether the repository and current production deployment are ready;
- prepare a reproducible frontend/backend release from one approved commit;
- deploy that release after explicit production authorization;
- verify the live release and report exact provenance;
- roll back within the authority and recovery material already approved.

The skill is a repository navigation and application guide, not a claim that
general Codex deployment safety is deficient. It does not silently create
missing deployment tooling. If a required
build, bundle, manifest, backup, restore, or version-fingerprint mechanism is
absent, it reports a blocker before production mutation.

## Sources of Truth

The skill must read current repository instructions before acting. At minimum:

- `AGENTS.md` and any applicable nested `AGENTS.md` files;
- `docs/decisions/0028-decree-evidence-flow-governance-baseline.md`;
- `docs/decisions/0041-single-host-container-deployment.md`;
- `deploy/compose.yaml`, `deploy/Caddyfile`, and environment examples;
- the deployment and final-acceptance scripts that actually exist at runtime.

Repository instructions and the current user's authorization override the
skill. The skill never substitutes an old plan or a historical command for a
missing current implementation.

## Release Identity

One release identity binds all deployable artifacts:

- absolute repository path;
- source branch and full Git commit SHA;
- clean working-tree evidence and remote synchronization state;
- frontend image digest;
- backend image digest;
- Caddy image digest and deployment-configuration checksums;
- release-manifest checksum;
- backup identifier and previous recoverable release identifier.

The frontend and backend are unified only when their immutable image digests
appear in the same verified manifest produced from the same source commit.
Service health or UI compatibility alone is not evidence of release unity.

## Workflow

### 1. Preflight and audit

Read the sources of truth, inspect the actual repository and deployment
artifacts, and state assumptions. Before Git writes, print and verify the
absolute workspace path, branch, HEAD, and `git status`. Reject a dirty,
detached, unexpected, or unsynchronized source unless the user explicitly
chooses a documented alternative that does not weaken provenance.

Audit the target host, domain, current release, available disk space, required
runtime versions, image references, persistent mounts, secret-file location,
backup destination, and rollback material using read-only checks. Never print
secret values.

### 2. Acceptance gate

Run only commands that exist in the current repository. The deployment checks,
frontend verification, backend verification, integration verification, and
harness checks must pass for one unchanged candidate. The final acceptance
procedure must then pass ten consecutive complete rounds as required by
`AGENTS.md`; any failure or material change resets the count to round one.

Do not reinterpret a partial suite, cached output, or old log as acceptance.

### 3. Release preparation

Build frontend and backend images from the same verified commit. Require pinned
base images and immutable output references. Generate or verify one release
manifest containing all release-identity fields, artifact checksums,
provenance, and the commands used to produce them. Verify an offline bundle
before it is considered deployable.

If the repository lacks a required builder, verifier, manifest generator, or
version fingerprint, stop and report the missing capability. Adding that
capability is a separate implementation task.

### 4. Production authorization gate

Before the first external write, show the user:

- target host and public domain;
- current and candidate release identities;
- exact mutation classes to be performed;
- backup and restore evidence;
- rollback target and rollback limitations;
- whether database migration, DNS, firewall, secret, paid API, or external
  network changes are required.

Request explicit authorization for the listed actions. Deployment permission
does not authorize unrelated host changes, production-data mutation, restore,
DNS or firewall changes, secret rotation, paid APIs, or enabling external
network access. Request separate authorization when any of those are required.

### 5. Backup and recoverability gate

Before switching containers, verify a fresh SQLite-safe backup, required
artifact backups, the previous immutable images and configuration, checksums,
and a viable restore procedure. Refuse overwrite of an existing backup target.
For a schema-changing release, require the separately authorized cold-backup
and restore path defined by current repository policy.

### 6. Deployment

Transfer and verify the approved release bundle, load only declared images,
materialize the approved image references, and apply the current Compose
configuration. Keep secrets in the host-managed environment file and out of
commands, logs, manifests, and images. Preserve the single-backend-writer and
network boundaries defined by current architecture.

Stop on the first failed mutation. Do not improvise stronger permissions,
broader deletion, or data recovery.

### 7. Live verification

Use fresh evidence to verify container health, Caddy routing, `/`, `/health`,
and the smallest safe set of authenticated or read-only critical paths. Match
the running frontend and backend image digests to the approved manifest and
confirm the live release fingerprint. A 200 response without matching release
identity is insufficient.

Record each command, exit status, PASS or FAIL result, timestamp, and relevant
non-secret evidence.

### 8. Failure and rollback

Classify failure before acting:

- before the production switch: stop without changing the live release;
- after a switch with no data incompatibility: restore the previous immutable
  release when that rollback was included in the authorization;
- after a schema or data incompatibility: stop and request explicit restore
  authorization before any production-data write;
- uncertain state: freeze further mutation and report observed state.

After rollback, run the same live health and release-identity checks against
the restored release. Never label a rollback successful based only on a
container restart.

### 9. Deployment report

Lead with the actual outcome. Report source commit, manifest checksum, running
image digests, backup identifier, previous release, verification results,
rollback status, skipped checks, and remaining risks. Distinguish repository
readiness, release preparation, production deployment, and live verification;
do not collapse them into a single “done” claim.

## Skill Structure

The initial implementation contains:

- `.agents/skills/deploy-chaotang-os/SKILL.md` for triggers, gates, workflow,
  quick reference, common mistakes, and the reporting contract;
- `.agents/skills/deploy-chaotang-os/agents/openai.yaml` for discoverable UI
  metadata generated from the final skill.

No bundled deployment script is added initially. The skill orchestrates only
current repository commands. A reusable script is justified later only when a
failing test demonstrates that prose cannot enforce a deterministic operation.

## Error Handling and Safety

The skill is fail-closed. Missing commands, missing manifests, mutable image
tags, source divergence, dirty state, secret exposure, failed acceptance,
unverified backups, release-identity mismatch, or incomplete authority blocks
the next mutating phase. Read-only diagnosis may continue to produce a useful
report.

The skill never treats its own invocation as permission to commit, push,
upload, deploy, restart, migrate, restore, delete, change infrastructure, or
write production data.

## Skill Validation

Treat this as a project reference skill. Validate retrieval, application, and
gaps rather than trying to manufacture a general-agent safety failure:

1. Ask fresh-context agents to find the authoritative files and commands for
   audit, release preparation, production deployment, live version checks, and
   rollback using the skill.
2. Verify each answer cites current repository artifacts, distinguishes
   implemented commands from plans, and applies the correct phase and authority
   boundary.
3. Test missing-information cases: absent release builder, unavailable release
   manifest, no live version fingerprint, and restore requiring production-data
   authorization. The skill must identify the exact gap rather than reconstruct
   an implementation from prose.
4. Validate frontmatter and `agents/openai.yaml` with the skill-creator tooling.
5. Run repository harness checks and inspect the final diff.

Representative scenarios include an audit-only request, a request to locate the
current release commands, an authorized normal deployment walkthrough,
mismatched frontend/backend manifests, a missing release builder, an acceptance
failure, a post-switch health failure, and a rollback requiring production-data
restoration.

## Acceptance Criteria

- The skill triggers for deploy, release,上线, rollback, production cutover,
  and verification requests specific to chaotang-os.
- It functions as a current repository reference and operations guide rather
  than claiming to repair a demonstrated general-agent safety defect.
- It locates commands in implemented repository files and clearly labels
  missing deployment capabilities.
- It binds frontend and backend to one manifest and source commit.
- It separates read-only audit, release preparation, external deployment, and
  production-data authority.
- It refuses to invent missing commands or infer success from health alone.
- It enforces ten consecutive complete acceptance rounds for the unchanged
  final candidate.
- It requires fresh backup and rollback evidence before production switching.
- It verifies live image identity after deployment or rollback.
- It produces an evidence-based final report without exposing secrets.
- It leaves ADR 0028 unchanged and preserves the governed business flow.
