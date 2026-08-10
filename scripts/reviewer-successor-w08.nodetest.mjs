import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { link, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import test from 'node:test';

import {
  REVIEWER_SUCCESSOR_W08_PRODUCT_BASE,
  REVIEWER_SUCCESSOR_W08_PRODUCT_DIFF_SHA256,
  REVIEWER_SUCCESSOR_W08_PRODUCT_H,
  REVIEWER_SUCCESSOR_W08_PRODUCT_TREE,
  REVIEWER_SUCCESSOR_W08_ROOT,
  effectiveReviewerSuccessorW08,
  parseReviewerSuccessorW08Evidence,
  validateReviewerSuccessorW08,
  verifyReviewerSuccessorW08,
  verifyReviewerSuccessorW08GitEnvironment,
} from './lib/reviewer-successor-w08.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const execFileAsync = promisify(execFile);

function sha256(source) {
  return createHash('sha256').update(source).digest('hex');
}

async function writeRepositoryFile(repository, path, source) {
  await mkdir(join(repository, dirname(path)), { recursive: true });
  await writeFile(join(repository, path), source);
}

function evidenceDocument(value) {
  return [
    '<!-- reviewer-successor-w08-evidence:start -->',
    '```json',
    JSON.stringify(value, null, 2),
    '```',
    '<!-- reviewer-successor-w08-evidence:end -->',
    '',
  ].join('\n');
}

function validOverlay() {
  return {
    schemaVersion: 'reviewer-successor.w08.v1',
    status: 'APPROVED',
    scope: ['R0-W08'],
    fromReviewer: 'Claude Code',
    toReviewer: 'Codex Independent QA',
    executionOwner: 'Codex',
    reviewPassesRequired: 2,
    sessionIsolation: 'FRESH_NO_FORK_CONTEXT',
    writeAccess: 'DENIED',
    candidateMutation: 'FORBIDDEN',
    expiresAfter: 'R0-W08_MERGED_AND_VERIFIED',
    productBaseH: REVIEWER_SUCCESSOR_W08_PRODUCT_BASE,
    productCandidateH: REVIEWER_SUCCESSOR_W08_PRODUCT_H,
    productTree: REVIEWER_SUCCESSOR_W08_PRODUCT_TREE,
    productReviewPackagePath: `${REVIEWER_SUCCESSOR_W08_ROOT}/review_inputs/product-candidate.diff`,
    productReviewPackageSha256: REVIEWER_SUCCESSOR_W08_PRODUCT_DIFF_SHA256,
    governanceBaseH: REVIEWER_SUCCESSOR_W08_PRODUCT_H,
    governanceCandidateH: '1'.repeat(40),
    governanceTree: '2'.repeat(40),
    governanceReviewPackagePath: `${REVIEWER_SUCCESSOR_W08_ROOT}/review_inputs/reviewer-successor.diff`,
    governanceReviewPackageSha256: '3'.repeat(64),
    ownerApprovalPath: `${REVIEWER_SUCCESSOR_W08_ROOT}/owner_approval/reviewer-successor-approval.md`,
    ownerApprovalSha256: '4'.repeat(64),
    reviews: [
      {
        identity: '/root/w08_successor_qa_pass1',
        path: `${REVIEWER_SUCCESSOR_W08_ROOT}/codex_review/pass-1.md`,
        sha256: '5'.repeat(64),
        verdict: 'GO',
        high: 0,
        medium: 0,
        writeAccess: 'DENIED',
      },
      {
        identity: '/root/w08_successor_qa_pass2',
        path: `${REVIEWER_SUCCESSOR_W08_ROOT}/codex_review/exact-h-final.md`,
        sha256: '6'.repeat(64),
        verdict: 'GO',
        high: 0,
        medium: 0,
        writeAccess: 'DENIED',
      },
    ],
    approvedBy: 'lyt',
  };
}

test('valid W08 reviewer successor selects Codex Independent QA only for active W08', () => {
  const governance = { reviewerSuccessorW08: validOverlay() };
  assert.deepEqual(validateReviewerSuccessorW08(governance.reviewerSuccessorW08), []);
  assert.equal(
    effectiveReviewerSuccessorW08(governance, 'R0-W08', [
      { id: 'R0-W08', status: 'ACTIVE' },
    ]),
    'Codex Independent QA',
  );
  assert.equal(
    effectiveReviewerSuccessorW08(governance, 'R0-W08', [
      { id: 'R0-W08', status: 'MERGED_AND_VERIFIED' },
    ]),
    null,
  );
  assert.equal(
    effectiveReviewerSuccessorW08(governance, 'R0-W09', [
      { id: 'R0-W09', status: 'ACTIVE' },
    ]),
    null,
  );
});

for (const [name, mutate, message] of [
  ['scope expansion', (overlay) => { overlay.scope = ['R0-W08', 'R0-W09']; }, 'scope'],
  ['owner self-review', (overlay) => { overlay.toReviewer = 'Codex'; }, 'execution owner'],
  ['single pass', (overlay) => { overlay.reviews.pop(); }, 'exactly two'],
  ['shared identity', (overlay) => { overlay.reviews[1].identity = overlay.reviews[0].identity; }, 'identities'],
  ['write access', (overlay) => { overlay.reviews[0].writeAccess = 'ALLOWED'; }, 'deny writes'],
  ['candidate mutation', (overlay) => { overlay.candidateMutation = 'ALLOWED'; }, 'candidateMutation'],
  ['product H drift', (overlay) => { overlay.productCandidateH = '7'.repeat(40); }, 'productCandidateH'],
  ['product tree drift', (overlay) => { overlay.productTree = '8'.repeat(40); }, 'productTree'],
  ['product diff digest drift', (overlay) => { overlay.productReviewPackageSha256 = '9'.repeat(64); }, 'productReviewPackageSha256'],
  ['shared activation approval path', (overlay) => { overlay.ownerApprovalPath = `${REVIEWER_SUCCESSOR_W08_ROOT}/owner_approval/exact-h-approval.md`; }, 'canonical'],
  ['unsafe evidence path', (overlay) => { overlay.ownerApprovalPath = '../approval.md'; }, 'ownerApprovalPath'],
]) {
  test(`W08 reviewer successor fails closed for ${name}`, () => {
    const overlay = validOverlay();
    mutate(overlay);
    const errors = validateReviewerSuccessorW08(overlay);
    assert.ok(errors.some((error) => error.includes(message)), errors.join('\n'));
  });
}

test('review evidence requires one marked block', () => {
  assert.throws(
    () => parseReviewerSuccessorW08Evidence('{}'),
    /require exactly one marked JSON evidence block/u,
  );
});

test('review evidence rejects duplicate JSON keys', () => {
  assert.throws(
    () => parseReviewerSuccessorW08Evidence([
      '<!-- reviewer-successor-w08-evidence:start -->',
      '```json',
      '{"verdict":"GO","verdict":"NO_GO"}',
      '```',
      '<!-- reviewer-successor-w08-evidence:end -->',
    ].join('\n')),
    /duplicate object key/u,
  );
});

test('exact verifier binds committed evidence, hardened Git diff, and protected authority files', async () => {
  const temporaryParent = await mkdtemp(join(tmpdir(), 'w08-reviewer-successor-'));
  const repository = join(temporaryParent, 'repo');
  try {
    await execFileAsync('git', ['clone', '-q', '--no-hardlinks', root, repository]);
    await execFileAsync('git', ['config', 'user.name', 'W08 Test'], { cwd: repository });
    await execFileAsync('git', ['config', 'user.email', 'w08@example.invalid'], { cwd: repository });
    await execFileAsync(
      'git',
      ['checkout', '-q', '--detach', REVIEWER_SUCCESSOR_W08_PRODUCT_H],
      { cwd: repository },
    );
    for (const path of [
      '.harness/changes/docs-r0-w08-codex-reviewer-successor-20260810/ci_result/governance-candidate.md',
      '.harness/changes/docs-r0-w08-codex-reviewer-successor-20260810/request_analysis/spec.md',
      '.harness/changes/docs-r0-w08-codex-reviewer-successor-20260810/request_analysis/tasks.md',
      '.harness/changes/docs-r0-w08-codex-reviewer-successor-20260810/summary.md',
      'scripts/execution-authority-v2.nodetest.mjs',
      'scripts/lib/amendment-governance.mjs',
      'scripts/lib/execution-authority-v2.mjs',
      'scripts/lib/reviewer-successor-w08.mjs',
      'scripts/reviewer-successor-w08.nodetest.mjs',
    ]) {
      await writeRepositoryFile(repository, path, await readFile(join(root, path)));
    }
    await execFileAsync('git', ['add', '.'], { cwd: repository });
    await execFileAsync('git', ['commit', '-qm', 'reviewed W08 successor candidate'], {
      cwd: repository,
    });
    const governanceCandidateH = (
      await execFileAsync('git', ['rev-parse', 'HEAD^{commit}'], { cwd: repository })
    ).stdout.trim();
    const governanceTree = (
      await execFileAsync('git', ['rev-parse', 'HEAD^{tree}'], { cwd: repository })
    ).stdout.trim();
    const gitDiff = async (base, candidate) => (
      await execFileAsync(
        '/usr/bin/git',
        [
          '--no-replace-objects',
          '-c',
          'core.attributesFile=/dev/null',
          '-c',
          'core.commitGraph=false',
          'diff',
          '--no-ext-diff',
          '--no-textconv',
          '--binary',
          `${base}..${candidate}`,
        ],
        {
          cwd: repository,
          encoding: 'buffer',
          env: {
            ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_'))),
            GIT_CONFIG_NOSYSTEM: '1',
            GIT_CONFIG_GLOBAL: '/dev/null',
            GIT_ATTR_NOSYSTEM: '1',
            GIT_ATTR_SOURCE: candidate,
            GIT_OPTIONAL_LOCKS: '0',
            LC_ALL: 'C',
          },
        },
      )
    ).stdout;
    const productPackage = await gitDiff(
      REVIEWER_SUCCESSOR_W08_PRODUCT_BASE,
      REVIEWER_SUCCESSOR_W08_PRODUCT_H,
    );
    const governancePackage = await gitDiff(
      REVIEWER_SUCCESSOR_W08_PRODUCT_H,
      governanceCandidateH,
    );
    const overlay = validOverlay();
    overlay.governanceCandidateH = governanceCandidateH;
    overlay.governanceTree = governanceTree;
    overlay.governanceReviewPackageSha256 = sha256(governancePackage);
    const reviewSources = overlay.reviews.map((review, index) => evidenceDocument({
      schemaVersion: 'reviewer-successor.w08.evidence.v1',
      kind: 'independent-review',
      reviewer: 'Codex Independent QA',
      identity: review.identity,
      pass: index + 1,
      scope: ['R0-W08'],
      productBaseH: overlay.productBaseH,
      productCandidateH: overlay.productCandidateH,
      productTree: overlay.productTree,
      productReviewPackagePath: overlay.productReviewPackagePath,
      productReviewPackageSha256: overlay.productReviewPackageSha256,
      governanceBaseH: overlay.governanceBaseH,
      governanceCandidateH: overlay.governanceCandidateH,
      governanceTree: overlay.governanceTree,
      governanceReviewPackagePath: overlay.governanceReviewPackagePath,
      governanceReviewPackageSha256: overlay.governanceReviewPackageSha256,
      verdict: 'GO',
      high: 0,
      medium: 0,
      writeAccess: 'DENIED',
      candidateMutation: 'FORBIDDEN',
    }));
    for (let index = 0; index < overlay.reviews.length; index += 1) {
      overlay.reviews[index].sha256 = sha256(reviewSources[index]);
    }
    const ownerSource = evidenceDocument({
      schemaVersion: 'reviewer-successor.w08.evidence.v1',
      kind: 'owner-approval',
      decision: 'APPROVED',
      approver: 'lyt',
      scope: ['R0-W08'],
      productBaseH: overlay.productBaseH,
      productCandidateH: overlay.productCandidateH,
      productTree: overlay.productTree,
      productReviewPackagePath: overlay.productReviewPackagePath,
      productReviewPackageSha256: overlay.productReviewPackageSha256,
      governanceBaseH: overlay.governanceBaseH,
      governanceCandidateH: overlay.governanceCandidateH,
      governanceTree: overlay.governanceTree,
      governanceReviewPackagePath: overlay.governanceReviewPackagePath,
      governanceReviewPackageSha256: overlay.governanceReviewPackageSha256,
      reviews: overlay.reviews.map(({ identity, path, sha256: digest }) => ({
        identity,
        path,
        sha256: digest,
      })),
    });
    overlay.ownerApprovalSha256 = sha256(ownerSource);
    await writeRepositoryFile(repository, overlay.productReviewPackagePath, productPackage);
    await writeRepositoryFile(repository, overlay.governanceReviewPackagePath, governancePackage);
    await writeRepositoryFile(repository, overlay.ownerApprovalPath, ownerSource);
    for (let index = 0; index < overlay.reviews.length; index += 1) {
      await writeRepositoryFile(repository, overlay.reviews[index].path, reviewSources[index]);
    }
    const activationCarrierPaths = [
      '.harness/manifest/execution-authority.v2.json',
      '.harness/manifest/project-harness.json',
      `${REVIEWER_SUCCESSOR_W08_ROOT}/activation_intent/r0-w08-activation-intent.json`,
      `${REVIEWER_SUCCESSOR_W08_ROOT}/codex_review/exact-h-final.md`,
      `${REVIEWER_SUCCESSOR_W08_ROOT}/codex_review/pass-1.md`,
      `${REVIEWER_SUCCESSOR_W08_ROOT}/owner_approval/exact-h-approval.md`,
      overlay.ownerApprovalPath,
      overlay.productReviewPackagePath,
      overlay.governanceReviewPackagePath,
    ];
    await writeRepositoryFile(
      repository,
      '.harness/manifest/project-harness.json',
      '{"activationCarrierFixture":true}\n',
    );
    await writeRepositoryFile(
      repository,
      '.harness/manifest/execution-authority.v2.json',
      '{"activationCarrierFixture":true}\n',
    );
    await writeRepositoryFile(
      repository,
      `${REVIEWER_SUCCESSOR_W08_ROOT}/activation_intent/r0-w08-activation-intent.json`,
      '{"activationCarrierFixture":true}\n',
    );
    await writeRepositoryFile(
      repository,
      `${REVIEWER_SUCCESSOR_W08_ROOT}/owner_approval/exact-h-approval.md`,
      'activation owner fixture\n',
    );
    await execFileAsync('git', ['add', '.'], { cwd: repository });
    await execFileAsync('git', ['commit', '-qm', 'pin W08 successor evidence'], {
      cwd: repository,
    });
    const activationCarrierH = (
      await execFileAsync('git', ['rev-parse', 'HEAD^{commit}'], { cwd: repository })
    ).stdout.trim();

    assert.deepEqual(await verifyReviewerSuccessorW08(repository, overlay), []);

    await execFileAsync('git', ['checkout', '-q', '--detach', governanceCandidateH], {
      cwd: repository,
    });
    await execFileAsync('git', ['checkout', activationCarrierH, '--', ...activationCarrierPaths], {
      cwd: repository,
    });
    await writeRepositoryFile(repository, 'backend/unreviewed-runtime.js', 'export const bypass = true;\n');
    await execFileAsync('git', ['add', '.'], { cwd: repository });
    await execFileAsync('git', ['commit', '-qm', 'smuggle unreviewed runtime'], { cwd: repository });
    assert.ok(
      (await verifyReviewerSuccessorW08(repository, overlay)).some((error) =>
        error.includes('activation carrier changed paths must be exactly canonical'),
      ),
    );

    await execFileAsync('git', ['checkout', '-q', '--detach', activationCarrierH], {
      cwd: repository,
    });
    await execFileAsync('git', ['commit', '--allow-empty', '-qm', 'extra empty carrier'], {
      cwd: repository,
    });
    assert.ok(
      (await verifyReviewerSuccessorW08(repository, overlay)).some((error) =>
        error.includes('activation carrier must contain exactly one commit'),
      ),
    );

    await execFileAsync('git', ['checkout', '-q', '-b', 'carrier-merge-side', governanceCandidateH], {
      cwd: repository,
    });
    await execFileAsync('git', ['commit', '--allow-empty', '-qm', 'merge side'], {
      cwd: repository,
    });
    const mergeSideH = (
      await execFileAsync('git', ['rev-parse', 'HEAD^{commit}'], { cwd: repository })
    ).stdout.trim();
    await execFileAsync('git', ['checkout', '-q', '--detach', activationCarrierH], {
      cwd: repository,
    });
    await execFileAsync('git', ['merge', '-q', '--no-ff', mergeSideH, '-m', 'merge carrier'], {
      cwd: repository,
    });
    assert.ok(
      (await verifyReviewerSuccessorW08(repository, overlay)).some((error) =>
        error.includes('activation carrier must be a direct single-parent child'),
      ),
    );
    await execFileAsync('git', ['checkout', '-q', '--detach', activationCarrierH], {
      cwd: repository,
    });

    const cliPath = join(repository, 'scripts/execution-authority-v2.mjs');
    const cliSource = await readFile(cliPath);
    await writeFile(cliPath, 'process.stdout.write("unconditional GO")\n');
    assert.ok(
      (await verifyReviewerSuccessorW08(repository, overlay)).some((error) =>
        error.includes('protected path drift: scripts/execution-authority-v2.mjs'),
      ),
    );
    await writeFile(cliPath, cliSource);

    await execFileAsync('git', ['config', '--local', 'diff.external', '/bin/true'], {
      cwd: repository,
    });
    assert.ok(
      (await verifyReviewerSuccessorW08(repository, overlay)).some((error) =>
        error.includes('repository-local Git config affects authority diff'),
      ),
    );
    await execFileAsync('git', ['config', '--local', '--unset', 'diff.external'], {
      cwd: repository,
    });

    const graftPath = join(repository, '.git/info/grafts');
    await writeFile(graftPath, `${REVIEWER_SUCCESSOR_W08_PRODUCT_H}\n`);
    assert.ok(
      (await verifyReviewerSuccessorW08GitEnvironment(repository)).some((error) =>
        error.includes('Git grafts can forge authority ancestry'),
      ),
    );
    await rm(graftPath);
    const shallowPath = join(repository, '.git/shallow');
    await writeFile(shallowPath, `${REVIEWER_SUCCESSOR_W08_PRODUCT_H}\n`);
    assert.ok(
      (await verifyReviewerSuccessorW08GitEnvironment(repository)).some((error) =>
        error.includes('shallow Git history is forbidden'),
      ),
    );
    await rm(shallowPath);

    const reviewPath = join(repository, overlay.reviews[0].path);
    const reviewSource = await readFile(reviewPath);
    await writeFile(reviewPath, `${reviewSource.toString('utf8')}drift\n`);
    assert.ok(
      (await verifyReviewerSuccessorW08(repository, overlay)).some((error) =>
        error.includes(`evidence working tree drift: ${overlay.reviews[0].path}`),
      ),
    );
    await rm(reviewPath);
    await symlink('/etc/hosts', reviewPath);
    assert.ok(
      (await verifyReviewerSuccessorW08(repository, overlay)).some((error) =>
        error.includes(`evidence unreadable: ${overlay.reviews[0].path}`),
      ),
    );
    await rm(reviewPath);
    const externalReviewPath = join(temporaryParent, 'external-review.md');
    await writeFile(externalReviewPath, reviewSource);
    await link(externalReviewPath, reviewPath);
    assert.ok(
      (await verifyReviewerSuccessorW08(repository, overlay)).some((error) =>
        error.includes(`evidence unreadable: ${overlay.reviews[0].path}`),
      ),
    );
  } finally {
    await rm(temporaryParent, { recursive: true, force: true });
  }
});
