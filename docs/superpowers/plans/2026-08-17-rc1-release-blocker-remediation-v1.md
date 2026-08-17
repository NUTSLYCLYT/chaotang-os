# RC1 Release Blocker Remediation V1 Plan

## 1. Context brief

- Task：`RC1-RELEASE-BLOCKER-REMEDIATION-V1-20260817`
- Base：`c86317302c9fa07cb6f6b976d1631e3907aa7401`
- Base tree：`b4a3c7a3c5a708c60a79d48c6c0151a8a164d0ad`
- Target branch：`ext-dev`
- User outcome：把唯一主线 ext-dev 整理成一个 dependency-clean、loopback-only、可离线验真、可合成恢复演练的
  RC1 候选；既有历史验证只作基线线索，当前 exact candidate 必须重新验证；本计划不部署。
- Authority：当前只有三文件草案权；产品实现必须等待 approval commit landed、远端未漂移、M0 对本 task GO。
- Single writer：未来产品阶段仍由一个实现工作树顺序形成唯一 one-child candidate；并行只允许只读调研/审查。

## 2. Dependency graph

```text
A0 exact 3-file approval packet
  → A1 Owner confirms canonical manifest digest + toolchain-policy digest
  → A2 exact single-parent approval commit
  → A3 Owner confirms approval SHA/tree and authorizes ordinary FF push
  → A4 origin/ext-dev == approval commit; M0 authorize GO
  → R1 dependency locks and container identity
  → R2 loopback-only deployment contract
  → R3 SQLite backup / verify / rehearsal
  → R4 offline bundle builder / verifier / SBOM / provenance
  → R5 freeze exact candidate; Owner separately authorizes disposable validation host + exact build-time egress
  → R6 clean install/full regression + real container/bundle + synthetic backup/HTTP, then 10 rounds
  → R7 independent code/python/security/release-operations review
  → R8 final M0 bounded/no-Docker verify-candidate PASS (`canAcceptProductCandidate=true`)
  → R9 Owner confirms candidate SHA/tree before any FF push
```

R1–R4 may be researched independently, but code changes are integrated sequentially into one candidate because the M0 grant binds
one exact child and one exact 23-path set. No intermediate product commit is authority-bearing. M0 的八条产品验证命令不运行
Docker、不访问依赖 registry/scanner 或业务网络；authority 仅保留受信只读 `git ls-remote gitee ext-dev` 防止远端
漂移。clean dependency installation 与真实容器/scanner 验证在 Owner 对 exact candidate SHA/tree 单独授权后进行；
完成外部验证、10 轮与独立审查后才运行最终 M0 `--verify-candidate`，使机器的可接受结论与证据顺序一致。

## 3. A0 — approval packet gate

Inputs: current task, plan and approval manifest only.

Exit:

1. exact base commit/tree and three approval paths match disk;
2. 23 product paths and non-goals are sorted, closed and mechanically valid;
3. root Harness, authority regression, strict JSON/canonical digest and whitespace checks pass;
4. independent adversarial review has no Critical/Important;
5. Owner explicitly confirms manifest digest
   `sha256:3024888e48e42bf2993bffe28416542575d8f683b3ac2dd8d54ac9695578a55a` and toolchain-policy digest
   `sha256:75054d6dc6737ff20eab02ad0a6b67ff7b64250676e9ad5087187548d50fe268` before any commit.

Failure/rollback: do not commit. Correct only the three draft paths, recompute digest and repeat review. Any scope change invalidates the
prior digest.

## 4. R1 — dependencies and immutable image identity

### RED

- frontend audit reproduces current high production findings;
- backend Docker build demonstrates live range resolution, runtime pip presence and health `0.0.0` drift;
- tag-only or mismatched base image, lock/hash drift and missing OCI source labels are rejected by tests/checker.

### GREEN

1. Apply only the smallest compatible frontend patch upgrades that clear high/critical; keep the existing major versions.
2. Freeze a reviewed `requirements-runtime.lock` that covers every current `[project].dependencies` and
   `[build-system].requires` direct requirement and pins both runtime/build direct/transitive versions and hashes. The task proves
   exact-lock installation closure, not reproducible resolution from broad `pyproject.toml` ranges. The separately authorized builder
   installs build requirements with `--require-hashes`, runs `pip wheel --no-build-isolation --no-deps`, and the runtime contains only
   application/runtime necessities, never build tools.
3. Load the exact closed toolchain policy from the immutable approval parent with `/usr/bin/git --no-replace-objects show HEAD^:...`.
   Require exact linux/amd64 image refs for Node/Python/Caddy/Syft/Grype and exact Docker/Buildx/BuildKit identities; treat
   `deploy/base-images.env` only as a checked projection. Any mismatch requires reapproval, not a candidate-side update.
4. Add source commit/tree/created OCI labels; health reads installed distribution metadata.
5. Strip pip/setuptools/wheel from the runtime image after installation and prove app startup still works.

Exit: bounded product tests prove lock structure, project/build-system direct-requirement coverage, Dockerfile no-resolution commands
and health behavior without dependency network. The separately authorized validation host then proves clean exact-lock installation,
npm audit, dependency/base/final image scans and non-root read-only smoke. A missing or stale
scanner is `UNVERIFIED/STOP`, never an implicit waiver.

## 5. R2 — loopback-only deployment

### RED

Freeze fixtures for current public 80/443 and domain config and prove the corrected checker rejects them, plus application port publish,
floating image, privileged/root, writable rootfs, missing healthcheck and extra DB/worker replicas.

### GREEN

- Caddy serves plain HTTP only inside the host on `:8080`; Compose publishes only `127.0.0.1:8080:8080`.
- Preserve reverse proxy, caching, security headers and health dependency behavior without adding a new ingress mode.
- Replace the current contradictory deployment checks with ADR 0041 assertions; do not modify ADR or systemd.

Exit: parser-level tests and the real Compose config agree; host inspection sees no listener on public 80/443 and no direct app ports.

## 6. R3 — SQLite backup, verification and rehearsal

### RED

Use only the approval-frozen six-database registry plus `report_artifacts/` in temporary synthetic fixtures. Cover WAL writes, referenced
artifacts, target collision, source/target symlink and hardlink, path traversal, tampered DB/artifact, unknown/future schema,
missing/extra files and restore-to-nonempty target.

### GREEN

1. Define closed canonical backup manifest and deterministic ordering; reject any database/artifact root outside the frozen registry and
   enforce user-version ceilings 0/5/0/0/0/5 in registry order.
2. Take each live DB snapshot through SQLite backup API; run integrity checks and capture `user_version`.
3. Copy only manifest-bound referenced artifacts through safe descriptor-based reads into a new destination.
4. Implement read-only verify and restore rehearsal into a new empty root; re-open databases and re-check every digest/reference.
5. Document the separately authorized stopped-writer production cold-backup procedure, but do not execute or automate it here.

Exit: backup→verify→rehearse is byte/digest stable for a frozen fixture; all attack/error cases fail closed without modifying source.

## 7. R4 — offline release builder and verifier

### RED

Reject dirty/wrong-HEAD source, nonempty output, implicit env/secrets, floating images, missing archives/SBOM/provenance, duplicate
JSON keys, unknown fields, path traversal, absolute/symlink/hardlink/case-conflict entries, extra/missing files and any digest/size/source/
image mismatch. Prove verifier never calls image load or deployment commands.

### GREEN

1. Build final images from the exact candidate and fixed base digests; capture final digests and per-image platform.
2. Run only approval-pinned Syft `1.51.0` and Grype `0.117.0` linux/amd64 manifests; require CycloneDX JSON and BuildKit max-mode
   SLSA v1 provenance. Require NTP-synchronized host UTC and a Grype DB no older than 48 hours/no more than 300 seconds in the
   future; record DB schema/version/content digest. If any identity/time/evidence differs, STOP; never emit placeholder evidence.
3. Export OCI archives and canonical closed manifest into a new output root; include only public deployment configuration and evidence.
4. Make verifier perform read-only extraction/inspection and exact manifest reconciliation, failing before allocation/expansion above:
   4096 entries, 32 GiB total bundle bytes, 8 GiB per entry, compression ratio 200, JSON 16 MiB/depth 32, or path
   512 bytes/16 segments.
5. Bind release manifest to commit/tree, lock hashes, base/final images, Compose/Caddy, SBOM/provenance, tool versions and artifact bytes.

Exit: a clean bundle verifies independently; every mutation fixture fails. Repeated identical inputs yield the same canonical manifest
digest; any engine-dependent OCI bytes are accurately represented rather than falsely claimed deterministic.

## 8. R5 — exact candidate freeze and external-validation authorization

Freeze the exact single-child candidate SHA/tree and all locks/policy inputs. Owner separately authorizes only that identity, one
disposable validation host, one non-default isolated Docker endpoint and the closed egress contract. This is permission to collect
validation evidence, not candidate acceptance, push or deploy authority.

## 9. R6–R7 — real validation and independent review

- The disposable host allows only the HTTPS origins frozen in the approval policy. A candidate-external trusted firewall/egress proxy
  denies all other outbound traffic for both host processes and the Docker daemon; evidence records the rule digest, activation time,
  allow probes and at least one denied non-allowlisted-origin probe. Candidate-side path checks are secondary only.
- No preexisting/user credentials are allowed. Anonymous ephemeral registry bearer tokens may be acquired only for read-only pulls.
  The only metadata POST is npm audit to the frozen path, with a body generated solely from exact-lock package name/version pairs and
  capped at 4 MiB. Artifact publishing, remote mutation and business-data uploads are forbidden.
- In a clean checkout, run `npm ci`, frontend audit/lint/typecheck/test/build, empty-environment backend exact-lock install, full backend,
  `verify_integration.mjs`, and the synthetic accounting runner through real FastAPI/Next. Provider remains fake-wired and no business
  outcome is claimed.
- Run the tracked RC1 runner once, then with `--rounds 10 --evidence-dir <new-empty-dir>` against the isolated daemon. It performs real
  image build, SBOM/Grype/provenance, bundle build+verify, security smoke and synthetic backup→verify→rehearse, and writes closed
  per-round JSON plus a canonical summary digest outside the repository: command, exit, counts, image/bundle/backup digest,
  ports/processes/temp roots before/after. The runner must reject edited/imported PASS logs and any missing/nonconsecutive round. Any
  candidate/input change or failure resets the count.
- Independent reviewers cover Code/Standards, Python/backup safety, security/supply chain and release/operations truthfulness. Critical
  or Important finding blocks the candidate. A browser framework is neither added nor used as machine evidence; post-deployment human
  smoke remains a later production authorization and cannot be cited as this RC1 candidate's machine proof.

## 10. R8 — final M0 bounded candidate verification

After R6–R7 evidence and reviews are complete, run only the approval manifest's eight bounded product verification commands:

1. root Harness and product-authority regression;
2. backend focused, Ruff and full pytest;
3. deployment checker/tests;
4. mocked release builder/verifier/acceptance-runner tests that prove no daemon, dependency registry/scanner/business network,
   production path, load, push or deploy occurs.

M0 PASS proves the candidate's exact parent/path identity and this bounded regression matrix. The authority consumer may perform trusted
read-only `git ls-remote gitee ext-dev` before/after the matrix solely to reject remote drift; the eight product commands must not read
Docker state, inherit `DOCKER_HOST`, access registries/scanner DBs, run `npm ci/audit`, or be presented as clean-lock/container/release
evidence. Its `canAcceptProductCandidate=true` now agrees with the already completed external evidence, but no push or Owner acceptance
follows automatically.

## 11. R9 — Owner handoff

- M0 `--verify-candidate` must have proved exact parent, tree, all-and-only 23 product paths and the bounded eight-command matrix.
- Freeze exact candidate SHA/tree, lockfiles, base images, build/scanner/runtime versions, fixtures, external validation evidence and
  review results.
- Report candidate SHA/tree and evidence digest to Owner. No push follows automatically; a separate explicit ordinary FF authorization
  is required. Deployment remains a still-later separately authorized action.

## 12. Stop conditions

STOP immediately on: remote/base drift; M0 non-GO; candidate not a single child; path count not exactly 23; protected path change;
need for database migration, UI/business/Direct-or-LangGraph orchestration change or public ingress; dependency/scanner evidence unavailable; runtime
contains vulnerable installer; backup touches source/production or cannot prove consistency; bundle has missing/placeholder evidence;
verifier can load/deploy; an M0 product verification command touches Docker or dependency registry/scanner/business network (the
authority consumer's trusted read-only `git ls-remote gitee ext-dev` drift check is exempt); external validation lacks separate Owner
authorization, externally enforced deny-all egress including Docker daemon, rule digest/allow+deny probes, exact npm-audit request
contract, anonymous read-only registry auth, disposable host
or non-default daemon; synthetic HTTP runner does not use real processes/BFF; residual container/port/temp state; any 10-round failure;
or review finding unresolved.

## 13. Plan mutation protocol

Any material change to pathspec, release contents, ingress, backup/restore semantics, dependency policy, non-goals or verification matrix
invalidates this approval. Return to Draft, update only the three governance paths under explicit authorization, recompute the canonical
manifest digest and repeat Owner confirmation. Never amend the product candidate opportunistically.

## 14. Current handoff

Only A0 drafting is in progress. No product file has been changed, no approval commit exists, P0 contract triage remains paused, and no
push/merge/deployment/secret/data action is authorized.
