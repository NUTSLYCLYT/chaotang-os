import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  AUTHORITY_ID,
  ProductAuthorityError,
  approvalPathForTask,
  authorizeProductWork,
  canonicalDigest,
  inspectApprovalCommit,
  parseJsonStrict,
  runVerificationMatrix,
  validateApprovalManifest,
  verifyProductCandidate,
} from "./product-authority.mjs";

const REPOSITORY_ROOT = fileURLToPath(new URL("../", import.meta.url));
const AUTHORITY_PATH = path.join(REPOSITORY_ROOT, "scripts", "product-authority.mjs");
const APPROVAL_SCHEMA_PATH = path.join(
  REPOSITORY_ROOT,
  ".harness",
  "contracts",
  "product-approval.schema.json",
);
const TASK_ID = "H1-HUBU-RICH-MEMORIAL-20260816";

function git(cwd, args, encoding = "utf8") {
  return execFileSync("/usr/bin/git", ["--no-replace-objects", ...args], {
    cwd,
    encoding,
    env: { PATH: "/usr/bin:/bin", GIT_CONFIG_NOSYSTEM: "1", GIT_TERMINAL_PROMPT: "0" },
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

async function initializeRepository(t, { productFile = false } = {}) {
  const root = await mkdtemp(path.join(tmpdir(), "chaotang-m0-authority-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  git(root, ["init", "-b", "ext-dev"]);
  git(root, ["config", "user.name", "M0 Test"]);
  git(root, ["config", "user.email", "m0@example.invalid"]);
  git(root, ["remote", "add", "origin", "git@gitee.com:msxn/chaotang-os.git"]);
  await writeFile(path.join(root, "README.md"), "base\n", "utf8");
  if (productFile) {
    await mkdir(path.join(root, "src"), { recursive: true });
    await writeFile(path.join(root, "src", "feature.txt"), "base feature\n", "utf8");
  }
  git(root, ["add", "README.md", ...(productFile ? ["src/feature.txt"] : [])]);
  git(root, ["commit", "-m", "base"]);
  return {
    root,
    baseCommit: git(root, ["rev-parse", "HEAD"]),
    baseTree: git(root, ["rev-parse", "HEAD^{tree}"]),
  };
}

function approvalManifest({ baseCommit, baseTree, verification = null } = {}) {
  return {
    schemaVersion: "product-authority.m0.approval.v1",
    authorityId: AUTHORITY_ID,
    taskId: TASK_ID,
    repository: {
      identity: "gitee.com/msxn/chaotang-os",
      targetBranch: "ext-dev",
    },
    request: {
      baseCommit,
      baseTree,
      approvalPath: approvalPathForTask(TASK_ID),
      approvalCommitPaths: [approvalPathForTask(TASK_ID)],
      productPaths: ["src/feature.txt"],
    },
    nonGoals: ["NO_AUTHORITY_HARNESS_OR_MANIFEST_CHANGE", "NO_PRODUCTION_EXTERNAL_SIDE_EFFECTS"],
    verification: verification ?? [{
      id: "node-smoke",
      tool: "node",
      args: ["-e", "process.exit(0)"],
      cwd: ".",
      timeoutMs: 5_000,
    }],
    state: "APPROVED_FOR_ONE_CHILD",
  };
}

async function commitApproval(repository, manifest) {
  const approvalPath = approvalPathForTask(manifest.taskId);
  await mkdir(path.join(repository.root, path.dirname(approvalPath)), { recursive: true });
  await writeFile(path.join(repository.root, approvalPath), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  git(repository.root, ["add", "--", approvalPath]);
  git(repository.root, ["commit", "-m", "approve product task"]);
  return git(repository.root, ["rev-parse", "HEAD"]);
}

async function commitCandidate(repository, content = "implemented\n") {
  await mkdir(path.join(repository.root, "src"), { recursive: true });
  await writeFile(path.join(repository.root, "src", "feature.txt"), content, "utf8");
  git(repository.root, ["add", "src/feature.txt"]);
  git(repository.root, ["commit", "-m", "implement product task"]);
  return git(repository.root, ["rev-parse", "HEAD"]);
}

async function attachLocalRemote(t, repository) {
  const bare = await mkdtemp(path.join(tmpdir(), "chaotang-m0-remote-"));
  t.after(() => rm(bare, { recursive: true, force: true }));
  git(bare, ["init", "--bare"]);
  git(repository.root, [
    "config",
    `url.file://${bare}.insteadOf`,
    "git@gitee.com:msxn/chaotang-os.git",
  ]);
  return bare;
}

async function publishApproval(t, repository, manifest) {
  const bare = await attachLocalRemote(t, repository);
  const approvalCommit = await commitApproval(repository, manifest);
  git(repository.root, ["push", "origin", "HEAD:refs/heads/ext-dev"]);
  return { approvalCommit, bare };
}

test("strict parser and canonical digest reject ambiguous JSON", () => {
  assert.deepEqual(parseJsonStrict('{"state":"APPROVED_FOR_ONE_CHILD"}'), {
    state: "APPROVED_FOR_ONE_CHILD",
  });
  assert.throws(
    () => parseJsonStrict('{"state":"STOP","state":"APPROVED_FOR_ONE_CHILD"}'),
    /DUPLICATE_JSON_KEY/,
  );
  assert.equal(canonicalDigest({ b: 2, a: 1 }), canonicalDigest({ a: 1, b: 2 }));
});

test("approval manifest is closed, ordered and cannot authorize governance paths or shell tools", () => {
  const manifest = approvalManifest({ baseCommit: "a".repeat(40), baseTree: "b".repeat(40) });
  assert.deepEqual(validateApprovalManifest(manifest), manifest);

  const unknown = structuredClone(manifest);
  unknown.ready = true;
  assert.throws(() => validateApprovalManifest(unknown), /APPROVAL_SCHEMA_INVALID/);

  const wrongState = structuredClone(manifest);
  wrongState.state = "READY";
  assert.throws(() => validateApprovalManifest(wrongState), /APPROVAL_STATE_INVALID/);

  const expanded = structuredClone(manifest);
  expanded.request.productPaths = [".harness/manifest/project-harness.json"];
  assert.throws(() => validateApprovalManifest(expanded), /PRODUCT_PATH_PROTECTED/);

  const authorityContract = structuredClone(manifest);
  authorityContract.request.productPaths = ["docs/contracts/execution-authority-ext-grant.schema.json"];
  assert.throws(() => validateApprovalManifest(authorityContract), /PRODUCT_PATH_PROTECTED/);

  for (const unsafePath of ["src/line\nbreak.ts", "src/tab\tname.ts", "src/carriage\rreturn.ts"]) {
    const controlCharacterPath = structuredClone(manifest);
    controlCharacterPath.request.productPaths = [unsafePath];
    assert.throws(
      () => validateApprovalManifest(controlCharacterPath),
      /PRODUCT_PATH_SCOPE_INVALID/,
      JSON.stringify(unsafePath),
    );
  }

  const rootGovernancePaths = [
    ".superpowers/legacy-plan.md",
    "CLAUDE.md",
    "backend/AGENTS.md",
    "backend/CLAUDE.md",
    "docs/decisions/0044-six-ministry-evidence-spine.md",
    "docs/product/tasks/2026-08-15-ext-root-harness-bootstrap-g1.md",
    "docs/product/tasks/2026-08-15-ext-root-harness-convergence.md",
    "docs/product/tasks/2026-08-15-ext-successor-execution-authority.md",
    "docs/product/tasks/2026-08-16-ext-dev-proportional-governance-reset.md",
    "docs/product/tasks/2026-08-16-ext-root-observation-kernel-g1-corrective.md",
    "docs/product/tasks/2026-08-16-ext-root-observation-kernel-g1.md",
    "docs/product/tasks/2026-08-16-m0-solo-owner-product-authority.md",
    "docs/superpowers/plans/2026-08-15-ext-root-harness-bootstrap-g1.md",
    "docs/superpowers/plans/2026-08-15-ext-root-harness-convergence.md",
    "docs/superpowers/plans/2026-08-15-ext-successor-execution-authority.md",
    "docs/superpowers/plans/2026-08-16-ext-dev-proportional-governance-reset.md",
    "docs/superpowers/plans/2026-08-16-ext-root-observation-kernel-g1-corrective.md",
    "docs/superpowers/plans/2026-08-16-ext-root-observation-kernel-g1.md",
    "docs/superpowers/plans/2026-08-16-m0-solo-owner-product-authority.md",
    "frontend/AGENTS.md",
    "frontend/CLAUDE.md",
  ];
  for (const protectedPath of rootGovernancePaths) {
    const rootGovernance = structuredClone(manifest);
    rootGovernance.request.productPaths = [protectedPath];
    assert.throws(
      () => validateApprovalManifest(rootGovernance),
      /PRODUCT_PATH_PROTECTED/,
      protectedPath,
    );
  }

  const shell = structuredClone(manifest);
  shell.verification[0].tool = "bash";
  assert.throws(() => validateApprovalManifest(shell), /VERIFICATION_MATRIX_INVALID/);
});

test("approval JSON schema is closed and pins the M0 identities and command tools", async () => {
  const schema = parseJsonStrict(await readFile(APPROVAL_SCHEMA_PATH, "utf8"));
  assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.equal(schema.$id, "https://chaotang-os.local/contracts/product-authority.m0.approval.v1.schema.json");
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.properties.schemaVersion.const, "product-authority.m0.approval.v1");
  assert.equal(schema.properties.authorityId.const, AUTHORITY_ID);
  assert.equal(schema.properties.state.const, "APPROVED_FOR_ONE_CHILD");
  for (const name of ["repository", "request", "verification"]) {
    const definition = schema.$defs[name];
    assert.equal(definition.type, "object");
    assert.equal(definition.additionalProperties, false);
    assert.deepEqual([...definition.required].sort(), Object.keys(definition.properties).sort());
  }
  assert.deepEqual(schema.$defs.verification.properties.tool.enum, ["node", "npm", "python3"]);
});

test("approval commit is a clean exact single child of the bound base", async (t) => {
  const repository = await initializeRepository(t);
  const manifest = approvalManifest(repository);
  const approvalCommit = await commitApproval(repository, manifest);
  const inspected = inspectApprovalCommit({ cwd: repository.root, taskId: TASK_ID, commit: approvalCommit });
  assert.equal(inspected.commit, approvalCommit);
  assert.equal(inspected.parent, repository.baseCommit);
  assert.equal(inspected.manifestDigest, canonicalDigest(manifest));

  const expandedRepository = await initializeRepository(t);
  const expandedManifest = approvalManifest(expandedRepository);
  await mkdir(path.join(expandedRepository.root, ".harness", "approvals"), { recursive: true });
  await writeFile(path.join(expandedRepository.root, "extra.txt"), "scope expansion\n", "utf8");
  await writeFile(
    path.join(expandedRepository.root, approvalPathForTask(TASK_ID)),
    `${JSON.stringify(expandedManifest, null, 2)}\n`,
    "utf8",
  );
  git(expandedRepository.root, ["add", ".harness", "extra.txt"]);
  git(expandedRepository.root, ["commit", "-m", "expanded approval"]);
  assert.throws(
    () => inspectApprovalCommit({ cwd: expandedRepository.root, taskId: TASK_ID }),
    /APPROVAL_COMMIT_SCOPE_INVALID/,
  );
});

test("work authorization requires the exact approval commit to remain the remote head", async (t) => {
  const repository = await initializeRepository(t);
  const manifest = approvalManifest(repository);
  const { approvalCommit, bare } = await publishApproval(t, repository, manifest);
  const authorized = await authorizeProductWork({
    cwd: repository.root,
    taskId: TASK_ID,
  });
  assert.equal(authorized.decision, "GO");
  assert.equal(authorized.canExecuteProductWork, true);
  assert.equal(authorized.approvalDigest, canonicalDigest(manifest));

  git(bare, ["update-ref", "refs/heads/ext-dev", repository.baseCommit]);
  await assert.rejects(
    authorizeProductWork({
      cwd: repository.root,
      taskId: TASK_ID,
    }),
    /REMOTE_HEAD_MOVED/,
  );

  git(bare, ["update-ref", "refs/heads/ext-dev", approvalCommit]);
  await writeFile(path.join(repository.root, "dirty.txt"), "dirty\n", "utf8");
  await assert.rejects(
    authorizeProductWork({
      cwd: repository.root,
      taskId: TASK_ID,
    }),
    /WORKTREE_DIRTY/,
  );
});

test("authority callers cannot replace the remote-head verifier", async (t) => {
  const repository = await initializeRepository(t);
  const manifest = approvalManifest(repository);
  const approvalCommit = await commitApproval(repository, manifest);
  await attachLocalRemote(t, repository);
  git(repository.root, ["push", "origin", `${repository.baseCommit}:refs/heads/ext-dev`]);

  await assert.rejects(
    authorizeProductWork({
      cwd: repository.root,
      taskId: TASK_ID,
      remoteHeadResolver: async () => approvalCommit,
    }),
    /REMOTE_HEAD_MOVED/,
  );
});

test("candidate verification accepts only the exact single child and emits deterministic evidence", async (t) => {
  const repository = await initializeRepository(t);
  const manifest = approvalManifest(repository);
  const { approvalCommit } = await publishApproval(t, repository, manifest);
  const candidateCommit = await commitCandidate(repository);
  const verified = await verifyProductCandidate({
    cwd: repository.root,
    taskId: TASK_ID,
  });
  assert.equal(verified.decision, "PASS");
  assert.equal(verified.canExecuteProductWork, false);
  assert.equal(verified.canAcceptProductCandidate, true);
  assert.equal(verified.candidateCommit, candidateCommit);
  assert.match(verified.evidenceDigest, /^sha256:[0-9a-f]{64}$/);

  assert.equal(approvalCommit, git(repository.root, ["rev-parse", "HEAD^"]));

  const remoteMovingRepository = await initializeRepository(t);
  const remoteMovingBare = await attachLocalRemote(t, remoteMovingRepository);
  const remoteMovingManifest = approvalManifest({
    ...remoteMovingRepository,
    verification: [{
      id: "moves-remote-head",
      tool: "node",
      args: [
        "-e",
        `require('node:child_process').execFileSync('/usr/bin/git',[` +
          `'--git-dir',${JSON.stringify(remoteMovingBare)},'update-ref','refs/heads/ext-dev',` +
          `${JSON.stringify(remoteMovingRepository.baseCommit)}])`,
      ],
      cwd: ".",
      timeoutMs: 5_000,
    }],
  });
  await commitApproval(remoteMovingRepository, remoteMovingManifest);
  git(remoteMovingRepository.root, ["push", "origin", "HEAD:refs/heads/ext-dev"]);
  await commitCandidate(remoteMovingRepository);
  await assert.rejects(
    verifyProductCandidate({
      cwd: remoteMovingRepository.root,
      taskId: TASK_ID,
    }),
    /REMOTE_HEAD_MOVED/,
  );

  const expandedRepository = await initializeRepository(t);
  const expandedManifest = approvalManifest(expandedRepository);
  await publishApproval(t, expandedRepository, expandedManifest);
  await mkdir(path.join(expandedRepository.root, "src"), { recursive: true });
  await writeFile(path.join(expandedRepository.root, "src", "feature.txt"), "ok\n", "utf8");
  await writeFile(path.join(expandedRepository.root, "src", "extra.txt"), "not approved\n", "utf8");
  git(expandedRepository.root, ["add", "src"]);
  git(expandedRepository.root, ["commit", "-m", "expanded product"]);
  await assert.rejects(
    verifyProductCandidate({
      cwd: expandedRepository.root,
      taskId: TASK_ID,
    }),
    /PRODUCT_COMMIT_SCOPE_INVALID/,
  );
});

test("verification commands run without a shell and fail closed on errors or repository writes", async (t) => {
  const failedRepository = await initializeRepository(t);
  const failedManifest = approvalManifest({
    ...failedRepository,
    verification: [{
      id: "fails",
      tool: "node",
      args: ["-e", "process.exit(7)"],
      cwd: ".",
      timeoutMs: 5_000,
    }],
  });
  await publishApproval(t, failedRepository, failedManifest);
  await commitCandidate(failedRepository);
  await assert.rejects(
    verifyProductCandidate({
      cwd: failedRepository.root,
      taskId: TASK_ID,
    }),
    /VERIFICATION_FAILED/,
  );

  const writingRepository = await initializeRepository(t);
  const writingManifest = approvalManifest({
    ...writingRepository,
    verification: [{
      id: "writes",
      tool: "node",
      args: ["-e", "require('node:fs').writeFileSync('unexpected.txt','x')"],
      cwd: ".",
      timeoutMs: 5_000,
    }],
  });
  await publishApproval(t, writingRepository, writingManifest);
  await commitCandidate(writingRepository);
  await assert.rejects(
    verifyProductCandidate({
      cwd: writingRepository.root,
      taskId: TASK_ID,
    }),
    /WORKTREE_DIRTY_AFTER_VERIFICATION/,
  );

  const movingRepository = await initializeRepository(t);
  const movingManifest = approvalManifest({
    ...movingRepository,
    verification: [{
      id: "moves-head",
      tool: "node",
      args: [
        "-e",
        "require('node:child_process').execFileSync('/usr/bin/git',['reset','--hard','HEAD^'])",
      ],
      cwd: ".",
      timeoutMs: 5_000,
    }],
  });
  await publishApproval(t, movingRepository, movingManifest);
  await commitCandidate(movingRepository);
  await assert.rejects(
    verifyProductCandidate({
      cwd: movingRepository.root,
      taskId: TASK_ID,
    }),
    /PRODUCT_CANDIDATE_MOVED_DURING_VERIFICATION/,
  );

  const restoringRepository = await initializeRepository(t);
  const restoringManifest = approvalManifest({
    ...restoringRepository,
    verification: [
      {
        id: "moves-head-away",
        tool: "node",
        args: [
          "-e",
          "require('node:child_process').execFileSync('/usr/bin/git',['reset','--hard','HEAD^'])",
        ],
        cwd: ".",
        timeoutMs: 5_000,
      },
      {
        id: "restores-head",
        tool: "node",
        args: [
          "-e",
          "require('node:child_process').execFileSync('/usr/bin/git',['reset','--hard','HEAD@{1}'])",
        ],
        cwd: ".",
        timeoutMs: 5_000,
      },
    ],
  });
  await publishApproval(t, restoringRepository, restoringManifest);
  await commitCandidate(restoringRepository);
  await assert.rejects(
    verifyProductCandidate({
      cwd: restoringRepository.root,
      taskId: TASK_ID,
    }),
    /PRODUCT_CANDIDATE_MOVED_DURING_VERIFICATION/,
  );
});

test("candidate rejects deletion, mode drift and merge commits", async (t) => {
  const deletionRepository = await initializeRepository(t, { productFile: true });
  const deletionManifest = approvalManifest(deletionRepository);
  await publishApproval(t, deletionRepository, deletionManifest);
  git(deletionRepository.root, ["rm", "src/feature.txt"]);
  git(deletionRepository.root, ["commit", "-m", "delete product file"]);
  await assert.rejects(
    verifyProductCandidate({
      cwd: deletionRepository.root,
      taskId: TASK_ID,
    }),
    /UNSUPPORTED_GIT_CHANGE/,
  );

  const modeRepository = await initializeRepository(t, { productFile: true });
  const modeManifest = approvalManifest(modeRepository);
  await publishApproval(t, modeRepository, modeManifest);
  await chmod(path.join(modeRepository.root, "src", "feature.txt"), 0o755);
  git(modeRepository.root, ["add", "src/feature.txt"]);
  git(modeRepository.root, ["commit", "-m", "change product mode"]);
  await assert.rejects(
    verifyProductCandidate({
      cwd: modeRepository.root,
      taskId: TASK_ID,
    }),
    /UNSUPPORTED_GIT_ENTRY_MODE/,
  );

  const mergeRepository = await initializeRepository(t);
  const mergeManifest = approvalManifest(mergeRepository);
  const { approvalCommit: mergeApproval } = await publishApproval(t, mergeRepository, mergeManifest);
  git(mergeRepository.root, ["switch", "-c", "side"]);
  await writeFile(path.join(mergeRepository.root, "side.txt"), "side\n", "utf8");
  git(mergeRepository.root, ["add", "side.txt"]);
  git(mergeRepository.root, ["commit", "-m", "side"]);
  git(mergeRepository.root, ["switch", "-c", "candidate", mergeApproval]);
  await commitCandidate(mergeRepository);
  git(mergeRepository.root, ["merge", "--no-ff", "side", "-m", "merge side"]);
  await assert.rejects(
    verifyProductCandidate({
      cwd: mergeRepository.root,
      taskId: TASK_ID,
    }),
    /PRODUCT_CANDIDATE_PARENT_INVALID/,
  );
});

test("verification cwd cannot escape the repository through a symbolic link", async (t) => {
  const repository = await mkdtemp(path.join(tmpdir(), "chaotang-m0-cwd-"));
  const outside = await mkdtemp(path.join(tmpdir(), "chaotang-m0-outside-"));
  t.after(() => rm(repository, { recursive: true, force: true }));
  t.after(() => rm(outside, { recursive: true, force: true }));
  await symlink(outside, path.join(repository, "linked"));

  assert.throws(() => runVerificationMatrix({
    cwd: repository,
    verification: [{
      id: "linked-cwd",
      tool: "node",
      args: ["-e", "process.exit(0)"],
      cwd: "linked",
      timeoutMs: 5_000,
    }],
  }), /VERIFICATION_CWD_INVALID/);
});

test("CLI is closed and the landed M0 implementation remains non-authorizing", async (t) => {
  const cleanRepository = await initializeRepository(t);
  const invoke = (args) => spawnSync(process.execPath, [AUTHORITY_PATH, ...args], {
    cwd: cleanRepository.root,
    encoding: "utf8",
    env: { PATH: "/usr/bin:/bin", GIT_TERMINAL_PROMPT: "0" },
  });
  const status = invoke(["--status"]);
  assert.equal(status.status, 0, status.stderr);
  assert.deepEqual(JSON.parse(status.stdout), {
    schemaVersion: "product-authority.m0.result.v1",
    authorityId: AUTHORITY_ID,
    command: "status",
    taskId: null,
    decision: "STOP",
    canExecuteProductWork: false,
    canAcceptProductCandidate: false,
    approvalDigest: null,
    candidateCommit: null,
    candidateTree: null,
    evidenceDigest: null,
    reason: "APPROVAL_NOT_SELECTED",
  });

  const invalid = invoke(["--force"]);
  assert.equal(invalid.status, 64, invalid.stderr);
  assert.equal(JSON.parse(invalid.stdout).reason, "USAGE_INVALID");

  const absent = invoke(["--authorize", "--task", "MISSING-TASK"]);
  assert.equal(absent.status, 2, absent.stderr);
  assert.equal(JSON.parse(absent.stdout).reason, "APPROVAL_NOT_FOUND");
  assert.doesNotMatch(`${status.stdout}${invalid.stdout}${absent.stdout}`, /\/etc\/|\/run\/|PRIVATE KEY|token/i);

  await assert.rejects(
    Promise.reject(new ProductAuthorityError("EXPECTED")),
    /EXPECTED/,
  );
  await assert.doesNotReject(readFile(AUTHORITY_PATH, "utf8"));
});

test("CLI authorizes and verifies the full flow against a local immutable remote", async (t) => {
  const repository = await initializeRepository(t);
  await attachLocalRemote(t, repository);
  const manifest = approvalManifest(repository);
  const approvalCommit = await commitApproval(repository, manifest);
  git(repository.root, ["push", "origin", "HEAD:refs/heads/ext-dev"]);

  const invoke = (args) => spawnSync(process.execPath, [AUTHORITY_PATH, ...args], {
    cwd: repository.root,
    encoding: "utf8",
    env: { PATH: "/usr/bin:/bin", GIT_TERMINAL_PROMPT: "0" },
    timeout: 15_000,
  });
  const authorized = invoke(["--authorize", "--task", TASK_ID]);
  assert.equal(authorized.status, 0, authorized.stderr);
  assert.equal(JSON.parse(authorized.stdout).decision, "GO");
  assert.equal(JSON.parse(authorized.stdout).canExecuteProductWork, true);

  const candidateCommit = await commitCandidate(repository);
  const verified = invoke(["--verify-candidate", "--task", TASK_ID]);
  assert.equal(verified.status, 0, verified.stderr);
  const result = JSON.parse(verified.stdout);
  assert.equal(result.decision, "PASS");
  assert.equal(result.canExecuteProductWork, false);
  assert.equal(result.canAcceptProductCandidate, true);
  assert.equal(result.approvalDigest, canonicalDigest(manifest));
  assert.equal(result.candidateCommit, candidateCommit);
  assert.equal(approvalCommit, git(repository.root, ["rev-parse", "HEAD^"]));
});

test("verification commands disable optional Next telemetry in the fixed environment", async (t) => {
  const repository = await initializeRepository(t);
  const manifest = approvalManifest({
    ...repository,
    verification: [{
      id: "requires-next-telemetry-disabled",
      tool: "node",
      args: ["-e", "if (process.env.NEXT_TELEMETRY_DISABLED !== '1') process.exit(73)"],
      cwd: ".",
      timeoutMs: 5_000,
    }],
  });
  await publishApproval(t, repository, manifest);
  await commitCandidate(repository);

  const verified = await verifyProductCandidate({
    cwd: repository.root,
    taskId: TASK_ID,
  });
  assert.equal(verified.decision, "PASS");
});
