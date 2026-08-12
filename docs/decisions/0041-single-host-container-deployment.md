# Single-host container deployment

## ADR 0041

## Status

Accepted — 2026-08-11

## Context

The first production deployment needs a reproducible path for one Ubuntu 22.04
host without assuming a domain, a public container registry, or public HTTP.
The application uses a Next.js frontend and FastAPI backend, with SQLite and
report attachments requiring persistent storage. Deployment artifacts must be
verifiable, traceable to an approved source revision, and recoverable without
placing secrets in Git, images, bundles, command arguments, or logs.

ADR 0028 remains authoritative and unchanged. This deployment decision does
not alter the decree, evidence, or archive flow, and it grants no production
access or deployment authority.

## Decision

The initial deployment uses Docker Compose on one host with one Caddy
container, one frontend container, and one backend container running one
Uvicorn worker. Caddy is the only host ingress and binds
`127.0.0.1:8080`; operators reach it through an SSH tunnel. Frontend port 3000
and backend port 8000 stay on the internal Compose network and are not
published. Public-IP HTTP and TLS are not enabled in this phase.

Images use immutable references. Because no private registry is available,
trusted build infrastructure produces a checksum-verified offline bundle with
the images, Compose and Caddy configuration, release manifest, provenance, and
SBOM. The host verifies the bundle before loading it and retains the current
and previous recoverable releases.

Containers run as fixed non-root users with read-only root filesystems and only
the minimum required writable mounts. Runtime secrets remain outside the
repository in `/etc/chaotang-os/production.env`, managed as mode `0600` data.
The backend alone may write application data and artifacts; accounting source
data is mounted read-only.

SQLite supports only the single backend replica in this design. Scaling the
backend horizontally or introducing concurrent application writers requires a
new persistence decision. Backups use SQLite-safe APIs for routine snapshots
and a stopped-writer cold backup before releases or schema changes. A release
requires a verified backup, the previous image bundle and configuration, and a
restore rehearsal. Rollback restores the prior immutable release and, when a
schema is incompatible, its matching pre-release data backup.

Repository implementation is separate from production authorization. Each of
the following remains gated by explicit approval: installing or upgrading host
software; creating host users, directories, systemd units, or production
configuration; uploading or loading bundles; starting containers; changing
firewall, SSH, DNS, certificate, or domain settings; opening public ports or
traffic; writing, migrating, restoring, overwriting, deleting, or importing
production data; injecting secrets; and enabling real external network or paid
API access.

## Alternatives considered

- **Host-native processes:** rejected for the initial release because they make
  dependency isolation, immutable delivery, provenance, and rollback less
  consistent across the frontend, backend, and proxy.
- **Public-IP HTTP:** rejected because the first acceptance path has no domain
  or TLS and does not authorize public ingress. Loopback ingress plus an SSH
  tunnel preserves the closed-by-default boundary.
- **Registry delivery:** deferred because no approved private registry exists.
  An offline, checksum-verified bundle provides traceable delivery without
  making images public or introducing registry credentials.

## Consequences

The deployment is intentionally simple and recoverable, but it depends on one
host and one backend replica. Host failure causes downtime, and SQLite limits
horizontal scale. Operators must retain verified release bundles and backups,
perform restore rehearsals, and treat rollback involving data as a separately
authorized production write. A future domain, TLS endpoint, public ingress,
registry, multi-host topology, or multi-writer database requires a new decision
and production authorization.

## Verification

- `node --test scripts/check_deployment.test.mjs`
- `node scripts/check_deployment.mjs`
- `git diff --check -- docs/decisions/0041-single-host-container-deployment.md scripts/check_deployment.mjs scripts/check_deployment.test.mjs`
