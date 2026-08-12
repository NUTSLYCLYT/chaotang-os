# Single-Host Container Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reproducible, offline-deliverable Docker Compose deployment base for chaotang-os that is reachable only through an SSH tunnel and preserves the existing Next.js BFF to FastAPI boundary.

**Architecture:** Build separate non-root frontend and backend images, place Caddy in front of them on a private Compose network, and bind only `127.0.0.1:8080` on the host. Produce checksum-verified offline image bundles, persistent SQLite/artifact mounts, safe backup/restore tooling, a systemd unit template, and fail-closed static/runtime verification.

**Tech Stack:** Docker BuildKit, Docker Compose v2, Caddy, Node.js 24, Next.js standalone, Python 3.12, FastAPI/Uvicorn, SQLite backup API, Node `node:test`, PowerShell acceptance runner.

## Global Constraints

- Do not modify `docs/decisions/0028-decree-evidence-flow-governance-baseline.md`.
- Do not change the browser -> Next.js BFF -> FastAPI business flow.
- Run exactly one backend container and one Uvicorn worker.
- Publish only `127.0.0.1:8080`; never publish 3000 or 8000.
- Do not configure a domain, TLS, DNS, firewall, SSH policy, or public cutover.
- Do not include secrets, real data, runtime databases, or private environment files in Git or images.
- Keep `JINYIWEI_EXTERNAL_NETWORK_ENABLED` disabled by default.
- Pin all base images by semantic version and digest; reject `latest` and unqualified image references.
- Use offline `docker save` bundles with SHA-256 verification because no private registry exists.
- Do not install software or write files on the production server without a later, separate approval.
- Do not commit, push, deploy, upload, migrate, restore, overwrite, or delete production data in this task.
- Preserve all pre-existing uncommitted user changes and stage nothing.
- The final unchanged version and acceptance procedure must pass ten consecutive complete rounds.

## File Map

- Create `docs/decisions/0041-single-host-container-deployment.md`: deployment choice, constraints, and consequences; references but never rewrites ADR 0028.
- Modify `frontend/next.config.ts`: enable standalone production output.
- Create `frontend/Dockerfile`: reproducible multi-stage Next.js image.
- Create `frontend/.dockerignore`: exclude local/runtime/private content.
- Create `backend/Dockerfile`: reproducible non-root FastAPI image with one worker.
- Create `backend/.dockerignore`: exclude venv, tests, runtime data, and secrets.
- Create `backend/app/operations/sqlite_backup.py`: reusable SQLite online backup and integrity verification.
- Create `backend/tests/test_sqlite_backup.py`: backup success, overwrite refusal, and corruption failure tests.
- Create `deploy/compose.yaml`: private three-service topology, mounts, health checks, limits, and loopback-only ingress.
- Create `deploy/Caddyfile`: loopback HTTP reverse proxy and safe headers without HSTS.
- Create `deploy/systemd/chaotang-os.service`: Compose lifecycle template.
- Create `deploy/production.env.example`: non-secret production variable contract.
- Create `deploy/images.env.example`: immutable local image-reference contract.
- Create `deploy/README.md`: build, transfer, load, tunnel, backup, rollback, and authorization gates.
- Create `scripts/check_deployment.mjs`: fail-closed source/config contract checker.
- Create `scripts/check_deployment.test.mjs`: checker self-tests against temporary fixtures.
- Create `scripts/build_offline_release.mjs`: metadata, image save, SHA-256, and release manifest generation.
- Create `scripts/build_offline_release.test.mjs`: deterministic manifest and failure-path tests using injected command execution.
- Create `scripts/verify_offline_release.mjs`: verify every declared artifact before load.
- Create `scripts/verify_offline_release.test.mjs`: valid, missing, altered, and undeclared artifact tests.
- Modify `scripts/final_acceptance_commands.json`: add deployment checks without real network, secrets, or production writes.
- Modify `AGENTS.md`, `frontend/AGENTS.md`, `backend/AGENTS.md`, `ARCHITECTURE.md`, and `.github/workflows/harness.yml`: register exact commands and CI parity.

---

### Task 1: Record the deployment decision and create a failing deployment contract

**Files:**
- Create: `docs/decisions/0041-single-host-container-deployment.md`
- Create: `scripts/check_deployment.mjs`
- Create: `scripts/check_deployment.test.mjs`

**Interfaces:**
- Consumes: the approved design in `docs/superpowers/specs/2026-08-11-single-host-container-deployment-design.md`.
- Produces: `checkDeployment(root: string): string[]`, returning an empty array only when all deployment invariants hold.

- [ ] **Step 1: Write failing checker self-tests**

Create fixture-based `node:test` cases that import `checkDeployment` and require failures for a public bind, a published backend port, `latest`, a missing read-only root filesystem, and a secret-like literal:

```js
test("rejects public ingress and published application ports", async () => {
  const root = await fixture({
    "deploy/compose.yaml": `services:\n  caddy:\n    ports: [\"0.0.0.0:8080:8080\"]\n  backend:\n    ports: [\"8000:8000\"]\n`,
  });
  const errors = await checkDeployment(root);
  assert.ok(errors.some((value) => value.includes("127.0.0.1:8080")));
  assert.ok(errors.some((value) => value.includes("8000 must not be published")));
});

test("rejects floating images and secret literals", async () => {
  const root = await fixture({
    "deploy/compose.yaml": `services:\n  caddy:\n    image: caddy:latest\n`,
    "deploy/production.env.example": "DEEPSEEK_API_KEY=real-value\n",
  });
  const errors = await checkDeployment(root);
  assert.ok(errors.some((value) => value.includes("floating image")));
  assert.ok(errors.some((value) => value.includes("must stay empty")));
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test scripts/check_deployment.test.mjs`

Expected: FAIL because `scripts/check_deployment.mjs` does not exist.

- [ ] **Step 3: Implement the minimal checker API**

Implement UTF-8 reads and explicit source assertions. The exported function must return messages rather than exit; the CLI wrapper prints each message and exits 1 when non-empty:

```js
export async function checkDeployment(root = process.cwd()) {
  const errors = [];
  const compose = await readRequired(root, "deploy/compose.yaml", errors);
  const envExample = await readRequired(root, "deploy/production.env.example", errors);
  if (!compose.includes('"127.0.0.1:8080:8080"')) errors.push("Caddy must bind 127.0.0.1:8080");
  if (/ports:[\s\S]*?(3000|8000):\1/.test(compose)) errors.push("3000/8000 must not be published");
  if (/image:\s*\S*:latest\b/.test(compose)) errors.push("floating image tag is forbidden");
  if (!/read_only:\s*true/.test(compose)) errors.push("services must use read_only: true");
  for (const name of ["DEEPSEEK_API_KEY", "WESTOCK_MCP_CREDENTIAL"]) {
    const match = envExample.match(new RegExp(`^${name}=(.*)$`, "m"));
    if (match?.[1]) errors.push(`${name} must stay empty in examples`);
  }
  return errors;
}
```

Keep checks deliberately conservative; later tasks extend the same API rather than creating another checker.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `node --test scripts/check_deployment.test.mjs`

Expected: PASS.

- [ ] **Step 5: Write ADR 0041**

Record status `Accepted`, context, decision, alternatives (host-native processes, public-IP HTTP, registry delivery), single-replica SQLite limitation, offline bundle choice, loopback ingress, backup/rollback consequences, and the separate production-authorization gates. State explicitly that ADR 0028 remains authoritative and unchanged.

- [ ] **Step 6: Check only intentional files**

Run: `git diff --check -- docs/decisions/0041-single-host-container-deployment.md scripts/check_deployment.mjs scripts/check_deployment.test.mjs`

Expected: PASS. Do not stage or commit.

### Task 2: Make the frontend image standalone, non-root, and reproducible

**Files:**
- Modify: `frontend/next.config.ts`
- Create: `frontend/Dockerfile`
- Create: `frontend/.dockerignore`
- Modify: `scripts/check_deployment.mjs`
- Modify: `scripts/check_deployment.test.mjs`

**Interfaces:**
- Consumes: `NEXT_PUBLIC_*` prohibition and `BACKEND_BASE_URL` server-only contract.
- Produces: image `chaotang-os-frontend:<release-id>` running `node server.js` as UID/GID 10001 on port 3000.

- [ ] **Step 1: Add failing source-contract tests**

Require `output: "standalone"`, `USER 10001:10001`, digest-qualified `ARG NODE_IMAGE`, `npm ci`, and the absence of `.env*` and `.next` from build context.

```js
assert.match(nextConfig, /output:\s*["']standalone["']/);
assert.match(dockerfile, /^ARG NODE_IMAGE$/m);
assert.match(dockerfile, /^FROM \$\{NODE_IMAGE\} AS dependencies$/m);
assert.match(dockerfile, /npm ci/);
assert.match(dockerfile, /USER 10001:10001/);
assert.match(dockerignore, /^\.env\*$/m);
```

- [ ] **Step 2: Verify RED**

Run: `node --test scripts/check_deployment.test.mjs`

Expected: FAIL because standalone config and frontend container files are missing.

- [ ] **Step 3: Enable standalone output**

Add exactly `output: "standalone"` to the existing `nextConfig`; retain `allowedDevOrigins` unchanged.

- [ ] **Step 4: Create the frontend Dockerfile**

Use dependency, builder, and runner stages. Copy `package.json` and `package-lock.json` before `npm ci`; build with `NEXT_TELEMETRY_DISABLED=1`; copy `.next/standalone`, `.next/static`, and `public`; create UID/GID 10001; set `HOSTNAME=0.0.0.0`, `PORT=3000`, `USER 10001:10001`, and `CMD ["node", "server.js"]`. Declare `ARG NODE_IMAGE` without a default immediately before `FROM ${NODE_IMAGE} AS dependencies`; the build script must reject any value that is not a reviewed Node 24 semantic-version reference with a `sha256:` digest.

- [ ] **Step 5: Create `.dockerignore`**

Exclude `.env*`, `.next`, `node_modules`, coverage, logs, editor metadata, and tests; explicitly keep `package.json`, `package-lock.json`, `public`, `src`, and `next.config.ts` available.

- [ ] **Step 6: Verify GREEN and existing frontend behavior**

Run from `frontend/`:

```text
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

Expected: all PASS and `.next/standalone/server.js` exists.

Run: `node --test scripts/check_deployment.test.mjs`

Expected: PASS.

### Task 3: Build the backend image and safe SQLite backup primitive

**Files:**
- Create: `backend/Dockerfile`
- Create: `backend/.dockerignore`
- Create: `backend/app/operations/__init__.py`
- Create: `backend/app/operations/sqlite_backup.py`
- Create: `backend/tests/test_sqlite_backup.py`
- Modify: `scripts/check_deployment.mjs`
- Modify: `scripts/check_deployment.test.mjs`

**Interfaces:**
- Produces: `backup_sqlite(source: Path, destination: Path) -> BackupResult` and `verify_sqlite(path: Path) -> None`.
- Produces: image `chaotang-os-backend:<release-id>` running one Uvicorn worker as UID/GID 10002.

- [ ] **Step 1: Write failing backup tests**

Cover a real SQLite source, destination refusal, and corrupt destination:

```python
def test_backup_sqlite_creates_integrity_checked_copy(tmp_path: Path) -> None:
    source = tmp_path / "source.sqlite3"
    with sqlite3.connect(source) as connection:
        connection.execute("create table items(value text not null)")
        connection.execute("insert into items values ('kept')")
    result = backup_sqlite(source, tmp_path / "backup.sqlite3")
    assert result.destination.exists()
    assert result.sha256 == hashlib.sha256(result.destination.read_bytes()).hexdigest()

def test_backup_sqlite_refuses_existing_destination(tmp_path: Path) -> None:
    source = create_database(tmp_path / "source.sqlite3")
    destination = tmp_path / "backup.sqlite3"
    destination.write_bytes(b"preserve")
    with pytest.raises(FileExistsError):
        backup_sqlite(source, destination)
    assert destination.read_bytes() == b"preserve"
```

- [ ] **Step 2: Verify RED**

Run from `backend/`: `.venv\Scripts\python.exe -m pytest tests/test_sqlite_backup.py -v`

Expected: FAIL because `app.operations.sqlite_backup` does not exist.

- [ ] **Step 3: Implement safe backup**

Use `sqlite3.Connection.backup`, write to a newly created temporary sibling, run `PRAGMA quick_check`, fsync, atomically rename to a non-existing destination, calculate SHA-256, and delete only the known temporary sibling after a failed operation. Never overwrite a destination and never glob/delete a directory.

```python
@dataclass(frozen=True)
class BackupResult:
    source: Path
    destination: Path
    sha256: str

def verify_sqlite(path: Path) -> None:
    with sqlite3.connect(f"file:{path.as_posix()}?mode=ro", uri=True) as connection:
        result = connection.execute("PRAGMA quick_check").fetchone()
    if result != ("ok",):
        raise RuntimeError(f"sqlite quick_check failed: {result!r}")
```

- [ ] **Step 4: Verify backup GREEN**

Run: `.venv\Scripts\python.exe -m pytest tests/test_sqlite_backup.py -v`

Expected: PASS.

- [ ] **Step 5: Create backend Dockerfile and ignore file**

Declare `ARG PYTHON_IMAGE` without a default and use `FROM ${PYTHON_IMAGE}`; the build script must require a reviewed Python 3.12 slim semantic-version reference with a `sha256:` digest. Build a wheel in a builder stage; install only the wheel and production dependencies into the runner; copy `config/`; create UID/GID 10002; create `/app/data` and `/app/artifacts`; use `USER 10002:10002`; expose 8000; and run exactly:

```dockerfile
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1", "--no-access-log"]
```

Exclude `.env*`, `.venv`, `data/*`, tests, caches, coverage, and local logs in `.dockerignore`.

- [ ] **Step 6: Extend and run container source checks**

Require digest pinning, `USER 10002:10002`, one worker, no copied `.env`, and no runtime database in build context.

Run: `node --test scripts/check_deployment.test.mjs`

Expected: PASS.

Run from `backend/`: `.venv\Scripts\python.exe -m ruff check app tests`

Expected: PASS.

### Task 4: Define the loopback-only Compose, Caddy, environment, and systemd contracts

**Files:**
- Create: `deploy/compose.yaml`
- Create: `deploy/Caddyfile`
- Create: `deploy/production.env.example`
- Create: `deploy/images.env.example`
- Create: `deploy/systemd/chaotang-os.service`
- Modify: `scripts/check_deployment.mjs`
- Modify: `scripts/check_deployment.test.mjs`

**Interfaces:**
- Consumes: immutable `FRONTEND_IMAGE`, `BACKEND_IMAGE`, and `CADDY_IMAGE` values from `images.env`.
- Produces: three services on `edge` and `app` internal networks with only Caddy on the host loopback.

- [ ] **Step 1: Add failing full-topology tests**

Assert exact loopback mapping, no app `ports`, `internal: true` for the backend network, `read_only: true`, dropped capabilities, `no-new-privileges`, health checks, bounded JSON logs, persistent bind mounts, `BACKEND_BASE_URL`, disabled Jinyiwei network, and Caddy absence of HSTS/TLS directives.

- [ ] **Step 2: Verify RED**

Run: `node --test scripts/check_deployment.test.mjs`

Expected: FAIL because deploy files do not exist.

- [ ] **Step 3: Create `deploy/compose.yaml`**

Define:

```yaml
services:
  backend:
    image: ${BACKEND_IMAGE:?set BACKEND_IMAGE}
    read_only: true
    user: "10002:10002"
    env_file: [${PRODUCTION_ENV_FILE:-/etc/chaotang-os/production.env}]
    environment:
      CHAOTANG_DECREE_JOB_WORKER_ENABLED: "true"
      JINYIWEI_EXTERNAL_NETWORK_ENABLED: "false"
    volumes:
      - /srv/chaotang-os/data:/app/data
      - /srv/chaotang-os/artifacts:/app/artifacts
      - /srv/chaotang-os/accounting:/app/accounting:ro
    expose: ["8000"]
  frontend:
    image: ${FRONTEND_IMAGE:?set FRONTEND_IMAGE}
    read_only: true
    user: "10001:10001"
    environment:
      BACKEND_BASE_URL: http://backend:8000
    expose: ["3000"]
  caddy:
    image: ${CADDY_IMAGE:?set CADDY_IMAGE}
    read_only: true
    ports: ["127.0.0.1:8080:8080"]
```

Complete each service with health checks, `cap_drop: [ALL]`, `security_opt: [no-new-privileges:true]`, tmpfs paths, resource limits, `restart: unless-stopped`, and JSON log rotation (`10m`, three files). Caddy receives only the edge network; frontend receives edge and app; backend receives only app. Mark app `internal: true`.

- [ ] **Step 4: Create Caddy and environment contracts**

Caddy listens on `:8080`, disables automatic HTTPS, proxies to `frontend:3000`, sets `X-Content-Type-Options`, `Referrer-Policy`, and a conservative `Content-Security-Policy`, and does not set HSTS. Keep both credential values empty in `production.env.example`. `images.env.example` documents only digest-qualified image forms.

- [ ] **Step 5: Create systemd template**

Use `Type=oneshot`, `RemainAfterExit=yes`, `Requires=docker.service`, `After=docker.service network-online.target`, `WorkingDirectory=/opt/chaotang-os/current`, `EnvironmentFile=/opt/chaotang-os/current/images.env`, `ExecStart=/usr/bin/docker compose --env-file ... -f ... up -d --wait`, `ExecStop=/usr/bin/docker compose ... down`, bounded start/stop timeouts, and no embedded credentials.

- [ ] **Step 6: Verify topology GREEN**

Run: `node --test scripts/check_deployment.test.mjs`

Expected: PASS.

When Docker Compose v2 is locally available, run: `docker compose --env-file deploy/images.env.example -f deploy/compose.yaml config --quiet`

Expected: PASS after substituting test-only digest-qualified image references; do not pull or start images.

### Task 5: Implement deterministic offline bundle creation and verification

**Files:**
- Create: `scripts/build_offline_release.mjs`
- Create: `scripts/build_offline_release.test.mjs`
- Create: `scripts/verify_offline_release.mjs`
- Create: `scripts/verify_offline_release.test.mjs`

**Interfaces:**
- Produces: `buildOfflineRelease(options) -> Promise<ReleaseManifest>`.
- Produces: `verifyOfflineRelease(directory) -> Promise<ReleaseManifest>`; throws before any load on missing, altered, or undeclared artifacts.

- [ ] **Step 1: Write failing deterministic release tests**

Inject command execution so tests never call real Docker. Require sorted artifacts, SHA-256 values, Git HEAD, lockfile hashes, image IDs, base-image references, commands with exit codes, and refusal when the worktree is dirty unless `--allow-dirty` is explicitly passed for local testing.

- [ ] **Step 2: Verify RED**

Run: `node --test scripts/build_offline_release.test.mjs scripts/verify_offline_release.test.mjs`

Expected: FAIL because both modules are missing.

- [ ] **Step 3: Implement release builder**

Validate an explicit absolute output directory outside the repository, ensure it exists and is empty, run repository verification, build images with explicit digest-qualified base-image arguments, inspect final image IDs, invoke `docker save`, gzip archives, generate SPDX JSON SBOMs using an explicitly detected local scanner, and write a canonical JSON manifest plus `SHA256SUMS`. If an SBOM scanner is unavailable, fail before building rather than silently omit SBOMs.

The builder must redact environment values, capture only allowlisted command text, and never accept credentials as CLI arguments.

- [ ] **Step 4: Implement verifier**

Read canonical JSON, reject paths containing separators or traversal, require an exact set of declared files, stream-hash each artifact, compare in constant time, and return the manifest only after all checks pass. The verifier never runs `docker load`; loading remains a separately authorized operator step.

- [ ] **Step 5: Verify GREEN**

Run: `node --test scripts/build_offline_release.test.mjs scripts/verify_offline_release.test.mjs`

Expected: PASS for valid fixtures and PASS for tests proving altered/missing/extra artifacts are rejected.

### Task 6: Document operations and synchronize repository/CI commands

**Files:**
- Create: `deploy/README.md`
- Modify: `AGENTS.md`
- Modify: `frontend/AGENTS.md`
- Modify: `backend/AGENTS.md`
- Modify: `ARCHITECTURE.md`
- Modify: `.github/workflows/harness.yml`
- Modify: `scripts/final_acceptance_commands.json`

**Interfaces:**
- Produces: one authoritative command set shared by humans, agents, and CI.

- [ ] **Step 1: Add documentation assertions to deployment checker tests**

Require every documented command to match a real script and require the production gates to name server installation, upload, `docker load`, service start, secrets, firewall/SSH/DNS/TLS, migrations, restoration, and public cutover as separately authorized actions.

- [ ] **Step 2: Verify RED**

Run: `node --test scripts/check_deployment.test.mjs`

Expected: FAIL because docs and CI registration are absent.

- [ ] **Step 3: Write `deploy/README.md`**

Document prerequisites, reviewed base-image digest inputs, clean-tree build, offline archive layout, checksum verification, a non-executing load checklist, required host directories/ownership, SSH tunnel use, health checks, SQLite online backup, pre-release cold backup, restore rehearsal, rollback, log inspection, and every production authorization gate. Use synthetic paths and empty credential examples only.

- [ ] **Step 4: Synchronize architecture and AGENTS files**

Add exact commands:

```text
node scripts/check_deployment.mjs
node --test scripts/check_deployment.test.mjs
node --test scripts/build_offline_release.test.mjs scripts/verify_offline_release.test.mjs
```

Document standalone build and one-worker constraints in the relevant scoped AGENTS files. State in `ARCHITECTURE.md` that deployment architecture is now determined by ADR 0041 while business authority remains ADR 0028.

- [ ] **Step 5: Add CI parity**

Add a `deployment` job using Node 24 and Python 3.12 that runs checker self-tests, release/verifier unit tests, the deployment checker, frontend build verification, backend backup tests, and `docker compose config --quiet` with synthetic digest-qualified image references. It must not pull images, access secrets, call external business APIs, or start production services.

- [ ] **Step 6: Register final acceptance commands**

Add the deployment checks to `scripts/final_acceptance_commands.json` so the existing runner executes them in each acceptance round. Do not add any production-server command.

- [ ] **Step 7: Verify GREEN**

Run the three deployment command groups above, then:

```text
node scripts/check_harness.mjs
node scripts/check_harness.mjs --self-test
node .agents/hooks/check-harness.mjs --self-test
git diff --check
```

Expected: all PASS.

### Task 7: Run complete local acceptance and produce the production gate report

**Files:**
- Modify only if evidence reveals a defect in an intentional Task 1-6 file.
- Create no runtime data inside the repository.

**Interfaces:**
- Produces: fresh PASS/FAIL evidence and a server-preparation C/I/M gate report; does not deploy.

- [ ] **Step 1: Run focused suites once**

Run backend Ruff and pytest, frontend lint/typecheck/test/build, integration self-tests, deployment self-tests, Compose config validation, harness checks, and `git diff --check`. Expected: all PASS with no real external network or model calls.

- [ ] **Step 2: Inspect built images locally when Docker is available**

Build using reviewed digest-qualified bases, then verify configured user IDs, one backend worker, no secret-like environment values, no exposed host ports, read-only roots, health checks, and image history free of credentials. If Docker is unavailable, report runtime image verification as FAIL—not skipped PASS.

- [ ] **Step 3: Exercise synthetic persistence and recovery**

Use temporary synthetic SQLite databases and artifacts outside the repository. Start the local stack only, verify `/readyz`, restart it, confirm persistence, create an online backup, perform an isolated restore, and confirm integrity. Never use production data or credentials.

- [ ] **Step 4: Exercise synthetic rollback**

Build two harmless local release IDs, switch to the second, preserve evidence, restore the first image/config/data snapshot, and repeat health checks. No production server is involved.

- [ ] **Step 5: Run the unchanged final acceptance ten consecutive times**

Run: `powershell -ExecutionPolicy Bypass -File scripts/run_final_acceptance.ps1 -Rounds 10`

Expected: rounds 1 through 10 PASS. Any failure or substantive code/config/procedure change resets the count to round 1.

- [ ] **Step 6: Produce the handoff report**

Report each command, package/image version, digest, exit code, and evidence path. Mark:

- C (confirmed): repository configuration and local synthetic validation facts.
- I (inferred): expected production behavior not yet exercised on the target host.
- M (missing): separately gated server installation, directory/user creation, image upload/load, secret provisioning, systemd enablement, backup destination, domain/TLS, firewall, migrations, deployment, and cutover.

The server-preparation verdict remains FAIL until every required M item is separately authorized and freshly verified. Do not stage, commit, push, upload, or deploy.

## Plan Self-Review

- Spec coverage: topology, non-root containers, immutable image inputs, offline delivery, secret boundaries, SQLite safety, systemd, logging, health checks, backup, restore, rollback, ten-round acceptance, and separate production authorization are assigned to Tasks 1-7.
- Placeholder scan: no deferred implementation markers are present; exact APIs, paths, commands, and expected results are defined.
- Interface consistency: deployment checks use `checkDeployment`; release creation uses `buildOfflineRelease`; release verification uses `verifyOfflineRelease`; SQLite backup uses `backup_sqlite` and `verify_sqlite` throughout.
- Scope: the plan creates only the repository deployment base and local synthetic validation. Production preparation and deployment remain outside this plan.
