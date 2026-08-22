# RC1 single-host deployment contract

This directory describes the repository-side deployment contract for the first
release candidate. It does not authorize building on an unapproved host,
loading images, starting production services, writing production data, or
changing the firewall, SSH, DNS, certificates, or secrets.

## Fixed boundary

- Caddy is the only host entry point and publishes exactly
  `127.0.0.1:8080:8080`.
- Caddy serves plain HTTP on container port `8080`; automatic HTTPS, domains,
  ports 80/443, and public ingress are intentionally absent.
- Frontend port `3000` and backend port `8000` are exposed only to Compose
  networks. Neither application service publishes a host port.
- The application and edge networks are internally isolated; only the backend
  may join the separately authorized outbound bridge.
- Exactly one backend container runs exactly one Uvicorn worker. SQLite does
  not support a second application writer under this contract.
- The Compose project name is fixed to `chaotang-os`.
- Every service runs as a fixed non-root UID/GID, drops all capabilities, uses
  `no-new-privileges`, has a read-only root filesystem, and defines a health
  check. Only explicit data mounts and bounded tmpfs paths are writable.

Operators reach the service through a separately managed SSH tunnel:

```text
local browser -> http://127.0.0.1:8080
              -> SSH tunnel
              -> server 127.0.0.1:8080
              -> Caddy -> frontend -> backend
```

## Immutable inputs

`images.env.example` is a byte-for-byte projection of the approved RC1 base
image policy. It is not an independent trust root. `BACKEND_IMAGE`,
`FRONTEND_IMAGE`, and `CADDY_IMAGE` must be digest-only OCI references. Every
service uses `pull_policy: never`; a missing exact reference stops instead of
contacting a registry.

The closed release manifest binds source commit/tree, both dependency locks,
deployment files, image digests, OCI archives, SBOMs, provenance, tool
versions, and every bundled file's size and SHA-256. Missing, extra, unknown,
or placeholder evidence fails closed.

## Host paths and secrets

The backend alone receives writable business storage at
`/srv/chaotang-os/data`. Report artifacts live under its backed-up
`report_artifacts/` registry. `/srv/chaotang-os/accounting` is read-only.
Runtime secrets remain outside the repository in
`/etc/chaotang-os/production.env`, root-owned and mode `0600`.

## Separately authorized COLD procedure

There is one supported entry point. Operators must not manually stop the
backend, construct a writer-stop session, run the backup module directly, or
split the sequence across shells. The P15 runner owns the rollout lock, Docker
event stream, writer stop, content capture, manifest seal, read-only verify,
restore rehearsal, writer restart, and retention proof.

The runner is the trusted root orchestration boundary because it exclusively
owns the private Docker socket and filesystem isolation setup. A compromised
root account is outside the application threat model. The runner and every
transitively imported local module must nevertheless be root-owned,
non-writable, regular single-link files whose bytes equal the selected
candidate Git objects. Candidate tests and all application containers remain
separately confined to their fixed non-root identities.

Prepare one root-owned, mode `0444`, duplicate-key-free canonical JSON file
with schema `chaotang.p15-operator-inputs.v1`. Its exact fields are:

```text
schemaVersion
candidateCommit
candidateTree
releaseExpectationPath
releaseExpectationDigest
verifierPath
verifierDigest
bundlePath
bundleDigest
immutableSnapshotPath
immutableSnapshotDigest
dockerEndpoint
sourceRoot
backupRoot
rehearsalRoot
rolloutLockPath
backupPythonPath
backupToolDigest
operatorRef
maintenanceWindowStart
maintenanceWindowEnd
inputsDigest
```

All paths are absolute canonical paths from the separate change authority.
The source, bundle, immutable snapshot, backup, rehearsal, and rollout-lock
roots must not overlap. Backup and rehearsal targets and the lock file must not
exist. `inputsDigest` is `sha256:` plus the SHA-256 of canonical JSON after
removing only `inputsDigest`. The maintenance timestamps are canonical UTC and
must contain the complete run.

Run only:

```text
env -i \
  PATH=/usr/bin:/bin \
  HOME=/nonexistent \
  LC_ALL=C.UTF-8 \
  PYTHONNOUSERSITE=1 \
  /usr/bin/node \
  /opt/chaotang-os/release-tools/run_rc1_release_acceptance.mjs \
  --operator-inputs \
  /etc/chaotang-os/p15-operator-inputs.json
```

The runner first re-hashes the expectation, verifier, installed backup tool,
bundle, and immutable snapshot. It refuses a forged or stale input before
opening Docker or stopping a writer. It then discovers exactly one running
backend bound to the approved source root. A runner-generated event session
must observe the exact writer `die` event and remain open through database and
artifact capture plus pre-manifest content verification. Only then may it
close the event stream and allow the backup tool to seal its manifest.

Standalone backup verification and restore rehearsal occur afterward while
the same rollout lock, Docker endpoint identity, writer identity, source-root
identity, and candidate inputs remain fixed. After success, the same writer is
restarted and the synthetic retention digest must match its pre-stop value.
The printed canonical result is evidence, not permission to deploy a candidate
or restore production data.

Any failure is a STOP. Do not repair the bundle, reuse a partial backup, forge
a session, start a second writer, or perform an in-place restore. Candidate
image import/start and any production restore require their own later release
authority.

## Static verification

Repository verification does not require a Docker daemon:

```text
TMPDIR=/tmp node --test scripts/check_deployment.test.mjs
node scripts/check_deployment.mjs
```

Real image builds, scans, container smoke checks, bundle verification, and
synthetic backup/rehearsal run only after the exact candidate and a disposable
non-default Docker endpoint receive separate authorization. A successful
repository check is not deployment approval.
