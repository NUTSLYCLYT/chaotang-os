---
name: deploy-chaotang-os
description: Use when a chaotang-os request concerns deployment audit, release preparation, deploy, release, 上线, production cutover, live version verification, rollback, or checking whether frontend and backend are one version.
---

# Deploy chaotang-os

## Purpose

Locate and apply the repository's current deployment sources. Keep executable truth in implemented files; never reconstruct a missing command from a plan.

## Read first

Read current `AGENTS.md` files, `docs/decisions/0028-decree-evidence-flow-governance-baseline.md`, `docs/decisions/0041-single-host-container-deployment.md`, `deploy/compose.yaml`, `deploy/Caddyfile`, environment examples, `scripts/check_deployment.mjs`, and the acceptance, build, and release scripts that actually exist. Read nested `AGENTS.md` when changing frontend or backend files.

## Select the operation

| Request | Use current sources | Required outcome |
| --- | --- | --- |
| Audit readiness | Git state, deployment checker, current tests | `AUDIT_ONLY` or `BLOCKED` |
| Prepare release | Implemented build, bundle, and verification scripts | One verified release manifest |
| Deploy | Manifest, Compose, host runbook, explicit authorization | `DEPLOYED_VERIFIED` or frozen failure |
| Verify unity | Running immutable identifiers plus manifest | Matching frontend image digest and backend image digest |
| Roll back | Previous manifest, backup and restore runbook, explicit authority | `ROLLED_BACK_VERIFIED` or frozen failure |

## Release identity

One release manifest binds the full Git commit, clean synchronized source evidence, frontend image digest, backend image digest, proxy digest, configuration checksums, manifest checksum, backup identity, and previous recoverable release. HTTP health alone or a compatible UI never proves unity.

## Procedure

1. Audit read-only facts and state assumptions. Before Git writes, print the absolute workspace, branch, HEAD, and status.
2. Run only current implemented checks. One unchanged candidate must pass the complete procedure ten consecutive times; reset after any failure or material change.
3. Prepare frontend and backend from the same commit with immutable outputs. If a builder, bundle verifier, release manifest, backup, restore, or live fingerprint tool is absent, report the exact missing capability and stop before mutation.
4. Before external writes, show the target, current and candidate identity, exact mutations, backup, rollback, and special authority needs. Obtain explicit authorization for each mutation class.
5. Verify fresh recoverable backup evidence and the previous immutable release before switching.
6. Apply only the approved bundle and current Compose configuration. Keep secrets out of commands and logs; preserve one backend writer and network boundaries. Stop on the first failed mutation.
7. Match running image identities to the approved manifest and verify health and critical safe paths.
8. Roll back only within existing authority. Production-data restore, schema changes, DNS, firewall, secrets, paid APIs, and external network changes require separate authorization.

## Report

Lead with `AUDIT_ONLY`, `PREPARED_NOT_DEPLOYED`, `DEPLOYED_VERIFIED`, `ROLLED_BACK_VERIFIED`, `BLOCKED`, or `FAILED_FROZEN`. Report the source commit, manifest checksum, running image digests, backup and previous release identities, commands with PASS or FAIL and timestamps, authority used, skipped checks, and remaining risks.

## Common mistakes

- Copying commands from a design or plan when implementation is absent.
- Treating health alone as version identity.
- Mixing frontend and backend artifacts from different manifests.
- Treating deploy authority as production-data restore or infrastructure authority.
- Reporting a restart as a verified rollback.
