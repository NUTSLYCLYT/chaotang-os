import assert from 'node:assert/strict';
import test from 'node:test';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';

import {
  REVIEWER_SUCCESSOR_W08_D4A_PRODUCT_BASE,
  REVIEWER_SUCCESSOR_W08_D4A_PRODUCT_H,
  REVIEWER_SUCCESSOR_W08_D4A_PRODUCT_TREE,
  effectiveReviewerSuccessorW08D4A,
  validateReviewerSuccessorW08D4A,
  verifyReviewerSuccessorW08D4ATopology,
} from './lib/reviewer-successor-w08-d4a.mjs';
import { validateAmendmentGovernanceRegistration } from './lib/amendment-governance.mjs';
import { loadExecutionAuthorityV2 } from './lib/execution-authority-v2.mjs';

const execFileAsync = promisify(execFile);
const root = dirname(dirname(new URL(import.meta.url).pathname));
const governancePaths = [
  '.harness/changes/docs-r0-w08-d4a-exact-h-activation-20260812/ci_result/governance-candidate.md',
  '.harness/changes/docs-r0-w08-d4a-exact-h-activation-20260812/request_analysis/spec.md',
  '.harness/changes/docs-r0-w08-d4a-exact-h-activation-20260812/request_analysis/tasks.md',
  '.harness/changes/docs-r0-w08-d4a-exact-h-activation-20260812/summary.md',
  'scripts/execution-authority-v2.nodetest.mjs', 'scripts/lib/amendment-governance.mjs',
  'scripts/lib/execution-authority-v2.mjs', 'scripts/lib/reviewer-successor-w08-d4a.mjs',
  'scripts/lib/reviewer-successor-w08.mjs', 'scripts/reviewer-successor-w08-d4a.nodetest.mjs',
  'scripts/reviewer-successor-w08.nodetest.mjs',
];
const activationPaths = [
  '.harness/manifest/execution-authority.v2.json', '.harness/manifest/project-harness.json',
  '.harness/changes/docs-r0-w08-d4a-exact-h-activation-20260812/activation_intent/r0-w08-d4a-activation-intent.json',
  '.harness/changes/docs-r0-w08-d4a-exact-h-activation-20260812/codex_review/pass-1.md',
  '.harness/changes/docs-r0-w08-d4a-exact-h-activation-20260812/codex_review/exact-h-final.md',
  '.harness/changes/docs-r0-w08-d4a-exact-h-activation-20260812/owner_approval/reviewer-successor-approval.md',
  '.harness/changes/docs-r0-w08-d4a-exact-h-activation-20260812/owner_approval/exact-h-approval.md',
  '.harness/changes/docs-r0-w08-d4a-exact-h-activation-20260812/review_inputs/product-candidate.diff',
  '.harness/changes/docs-r0-w08-d4a-exact-h-activation-20260812/review_inputs/reviewer-successor.diff',
];

const sha256 = (source) => createHash('sha256').update(source).digest('hex');
const executionDocument = (value, extra = '') => `# Evidence\n\n${extra}<!-- execution-authority-v2-evidence:start -->\n\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\`\n<!-- execution-authority-v2-evidence:end -->\n`;
const d4aDocument = (value) => `<!-- reviewer-successor-w08-d4a-evidence:start -->\n\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\`\n<!-- reviewer-successor-w08-d4a-evidence:end -->\n`;

function validOverlay() {
  return {
    schemaVersion: 'reviewer-successor.w08-d4a.v1', status: 'APPROVED',
    continuationId: 'R0-W08-D4A-DOCX-PROVENANCE-01', scope: ['R0-W08'],
    fromReviewer: 'Claude Code', toReviewer: 'Codex Independent QA', executionOwner: 'Codex',
    reviewPassesRequired: 2, sessionIsolation: 'FRESH_NO_FORK_CONTEXT', writeAccess: 'DENIED',
    candidateMutation: 'FORBIDDEN', expiresAfter: 'R0-W08_D4A_MERGED_AND_VERIFIED',
    priorPromotionH: REVIEWER_SUCCESSOR_W08_D4A_PRODUCT_BASE,
    priorPromotionTree: '559c0091bd60020b9c7faf936b687602970feab4',
    productBaseH: REVIEWER_SUCCESSOR_W08_D4A_PRODUCT_BASE,
    productCandidateH: REVIEWER_SUCCESSOR_W08_D4A_PRODUCT_H,
    productTree: REVIEWER_SUCCESSOR_W08_D4A_PRODUCT_TREE,
    productReviewPackagePath: '.harness/changes/docs-r0-w08-d4a-exact-h-activation-20260812/review_inputs/product-candidate.diff',
    productReviewPackageSha256: '9e5ff0c70dbafc96700ea2479fec886b21e9926263f6406e435adc92b9a9002d',
    governanceBaseH: REVIEWER_SUCCESSOR_W08_D4A_PRODUCT_H,
    governanceCandidateH: '1'.repeat(40), governanceTree: '2'.repeat(40),
    governanceReviewPackagePath: '.harness/changes/docs-r0-w08-d4a-exact-h-activation-20260812/review_inputs/reviewer-successor.diff',
    governanceReviewPackageSha256: '3'.repeat(64),
    ownerApprovalPath: '.harness/changes/docs-r0-w08-d4a-exact-h-activation-20260812/owner_approval/reviewer-successor-approval.md',
    ownerApprovalSha256: '4'.repeat(64),
    reviews: [1, 2].map((pass) => ({ identity: `/root/d4a_qa_pass${pass}`, path: `.harness/changes/docs-r0-w08-d4a-exact-h-activation-20260812/codex_review/${pass === 1 ? 'pass-1.md' : 'exact-h-final.md'}`, sha256: String(4 + pass).repeat(64), verdict: 'GO', high: 0, medium: 0, writeAccess: 'DENIED' })),
    approvedBy: 'lyt',
  };
}

test('D4A continuation validates and is effective only for active W08', () => {
  const overlay = validOverlay();
  assert.deepEqual(validateReviewerSuccessorW08D4A(overlay), []);
  assert.equal(effectiveReviewerSuccessorW08D4A({ reviewerSuccessorW08D4A: overlay }, 'R0-W08', [{ id: 'R0-W08', status: 'ACTIVE' }]), 'Codex Independent QA');
  assert.equal(effectiveReviewerSuccessorW08D4A({ reviewerSuccessorW08D4A: overlay }, 'R0-W08', [{ id: 'R0-W08', status: 'MERGED_AND_VERIFIED' }]), null);
});

test('D4A continuation fails closed on prior chain, product identity, paths, or review mutation', () => {
  for (const mutate of [
    (o) => { o.priorPromotionH = '9'.repeat(40); },
    (o) => { o.productCandidateH = '9'.repeat(40); },
    (o) => { o.productReviewPackagePath = '../escape'; },
    (o) => { o.reviews[0].writeAccess = 'ALLOWED'; },
  ]) {
    const overlay = validOverlay(); mutate(overlay);
    assert.notEqual(validateReviewerSuccessorW08D4A(overlay).length, 0);
  }
});

test('D4A topology Git reads disable replace refs, attributes, and commit graph', async () => {
  const source = await readFile(join(root, 'scripts/lib/reviewer-successor-w08-d4a.mjs'), 'utf8');
  assert.match(source, /--no-replace-objects/u);
  assert.match(source, /core\.attributesFile=\/dev\/null/u);
  assert.match(source, /core\.commitGraph=false/u);
});

test('amendment governance independently registers D4A without replacing the prior W08 overlay', async () => {
  const harness = JSON.parse(await readFile('.harness/manifest/project-harness.json', 'utf8'));
  const governance = structuredClone(harness.amendmentGovernance);
  const prior = governance.reviewerSuccessorW08;
  governance.reviewerSuccessorW08D4A = validOverlay();
  assert.deepEqual(validateAmendmentGovernanceRegistration(governance), []);
  assert.deepEqual(governance.reviewerSuccessorW08, prior);
});

async function withFinalD4ARepository(assertRepository) {
  const parent = await mkdtemp(join(tmpdir(), 'w08-d4a-topology-'));
  const repository = join(parent, 'repo');
  try {
    await execFileAsync('git', ['clone', '-q', '--no-hardlinks', root, repository]);
    await execFileAsync('git', ['config', 'user.name', 'D4A Test'], { cwd: repository });
    await execFileAsync('git', ['config', 'user.email', 'd4a@example.invalid'], { cwd: repository });
    await execFileAsync('git', ['checkout', '-q', '--detach', REVIEWER_SUCCESSOR_W08_D4A_PRODUCT_H], { cwd: repository });
    for (const path of governancePaths) {
      await mkdir(dirname(join(repository, path)), { recursive: true });
      await copyFile(join(root, path), join(repository, path));
    }
    await execFileAsync('git', ['add', '--', ...governancePaths], { cwd: repository });
    await execFileAsync('git', ['commit', '-q', '-m', 'G'], { cwd: repository });
    const governanceH = (await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: repository })).stdout.trim();
    const governanceTree = (await execFileAsync('git', ['rev-parse', 'HEAD^{tree}'], { cwd: repository })).stdout.trim();
    const overlay = validOverlay(); overlay.governanceCandidateH = governanceH; overlay.governanceTree = governanceTree;
    const productDiff = (await execFileAsync('git', ['diff', '--no-ext-diff', '--no-textconv', '--binary', `${overlay.productBaseH}..${overlay.productCandidateH}`], { cwd: repository, encoding: 'buffer', maxBuffer: 10 * 1024 * 1024 })).stdout;
    const governanceDiff = (await execFileAsync('git', ['diff', '--no-ext-diff', '--no-textconv', '--binary', `${overlay.governanceBaseH}..${overlay.governanceCandidateH}`], { cwd: repository, encoding: 'buffer', maxBuffer: 10 * 1024 * 1024 })).stdout;
    overlay.productReviewPackageSha256 = sha256(productDiff);
    overlay.governanceReviewPackageSha256 = sha256(governanceDiff);
    const reviewValues = [1, 2].map((pass) => ({
      schemaVersion: 'reviewer-successor.w08-d4a.evidence.v1', kind: 'independent-review',
      reviewer: overlay.toReviewer, identity: overlay.reviews[pass - 1].identity, pass,
      continuationId: overlay.continuationId, priorPromotionH: overlay.priorPromotionH,
      priorPromotionTree: overlay.priorPromotionTree, productBaseH: overlay.productBaseH,
      productCandidateH: overlay.productCandidateH, productTree: overlay.productTree,
      productReviewPackagePath: overlay.productReviewPackagePath,
      productReviewPackageSha256: overlay.productReviewPackageSha256,
      governanceBaseH: overlay.governanceBaseH, governanceCandidateH: overlay.governanceCandidateH,
      governanceTree: overlay.governanceTree, governanceReviewPackagePath: overlay.governanceReviewPackagePath,
      governanceReviewPackageSha256: overlay.governanceReviewPackageSha256, scope: ['R0-W08'],
      verdict: 'GO', high: 0, medium: 0, writeAccess: 'DENIED', candidateMutation: 'FORBIDDEN',
    }));
    const d4aReviewSources = reviewValues.map(d4aDocument);
    overlay.reviews.forEach((review, index) => { review.sha256 = sha256(d4aReviewSources[index]); });
    const d4aOwnerValue = {
      schemaVersion: 'reviewer-successor.w08-d4a.evidence.v1', kind: 'owner-approval',
      decision: 'APPROVED', approver: 'lyt', continuationId: overlay.continuationId,
      priorPromotionH: overlay.priorPromotionH, priorPromotionTree: overlay.priorPromotionTree,
      productBaseH: overlay.productBaseH, productCandidateH: overlay.productCandidateH,
      productTree: overlay.productTree, productReviewPackagePath: overlay.productReviewPackagePath,
      productReviewPackageSha256: overlay.productReviewPackageSha256,
      governanceBaseH: overlay.governanceBaseH, governanceCandidateH: overlay.governanceCandidateH,
      governanceTree: overlay.governanceTree, governanceReviewPackagePath: overlay.governanceReviewPackagePath,
      governanceReviewPackageSha256: overlay.governanceReviewPackageSha256, scope: ['R0-W08'],
      reviews: overlay.reviews.map(({ identity, path, sha256: digest }) => ({ identity, path, sha256: digest })),
    };
    const d4aOwnerSource = d4aDocument(d4aOwnerValue);
    overlay.ownerApprovalSha256 = sha256(d4aOwnerSource);

    const changeRoot = '.harness/changes/docs-r0-w08-d4a-exact-h-activation-20260812';
    const manifest = JSON.parse(await readFile(join(repository, '.harness/manifest/execution-authority.v2.json'), 'utf8'));
    manifest.effectiveBase = { ref: 'refs/heads/feature-chaotang-ext', sha: overlay.productCandidateH };
    manifest.approvalEvidence = {
      ownerApprovalPath: `${changeRoot}/owner_approval/exact-h-approval.md`, ownerApprovalSha256: '',
      reviewPath: `${changeRoot}/codex_review/exact-h-final.md`, reviewSha256: '', reviewVerdict: 'GO',
      approver: 'lyt', candidateH: overlay.productCandidateH, tree: overlay.productTree, approvedScope: ['R0-W08'],
    };
    const intentPath = `${changeRoot}/activation_intent/r0-w08-d4a-activation-intent.json`;
    const intent = {
      schemaVersion: 'execution-authority.v2.activation-intent.v1', kind: 'activation-intent',
      trackedManifestPath: '.harness/manifest/execution-authority.v2.json',
      reviewPackagePath: overlay.productReviewPackagePath, reviewPackageSha256: overlay.productReviewPackageSha256,
      effectiveBase: manifest.effectiveBase,
      approvalEvidence: { ownerApprovalPath: manifest.approvalEvidence.ownerApprovalPath, reviewPath: manifest.approvalEvidence.reviewPath, reviewVerdict: 'GO', approver: 'lyt', candidateH: overlay.productCandidateH, tree: overlay.productTree, approvedScope: ['R0-W08'] },
      activeWorkPackage: manifest.activeWorkPackage, workPackageLedger: manifest.workPackageLedger,
    };
    const intentSource = `${JSON.stringify(intent, null, 2)}\n`;
    const owner = {
      evidenceVersion: 'execution-authority-v2-evidence.v1', kind: 'owner-approval', decision: 'APPROVED', approver: 'lyt',
      workPackage: 'R0-W08', effectiveBase: manifest.effectiveBase, candidateH: overlay.productCandidateH,
      tree: overlay.productTree, approvedScope: ['R0-W08'], exclusions: ['NO_DEPLOYMENT','NO_REAL_CUSTOMER_DATA','NO_DB_MIGRATION','NO_LISTENER_3050_TAKEOVER','NO_R0_W09_ACTIVATION','NO_AUTOMATIC_MERGE','NO_PRODUCTION_CLAIM'],
      activationIntentPath: intentPath, activationIntentSha256: sha256(intentSource),
    };
    const ownerSource = executionDocument(owner);
    manifest.approvalEvidence.ownerApprovalSha256 = sha256(ownerSource);
    const review = {
      evidenceVersion: 'execution-authority-v2-evidence.v1', kind: 'independent-review', verdict: 'GO', reviewer: 'Codex Independent QA',
      workPackage: 'R0-W08', effectiveBase: manifest.effectiveBase, candidateH: overlay.productCandidateH,
      tree: overlay.productTree, approvedScope: ['R0-W08'], ownerApprovalPath: manifest.approvalEvidence.ownerApprovalPath,
      ownerApprovalSha256: manifest.approvalEvidence.ownerApprovalSha256, activationIntentPath: intentPath,
      activationIntentSha256: owner.activationIntentSha256, reviewPackagePath: overlay.productReviewPackagePath,
      diffSha256: overlay.productReviewPackageSha256,
      changedPaths: ['.harness/changes/feat-ext-d4a-docx-provenance-20260812/ci_result/ci_summary.md','.harness/changes/feat-ext-d4a-docx-provenance-20260812/request_analysis/spec.md','.harness/changes/feat-ext-d4a-docx-provenance-20260812/request_analysis/tasks.md','.harness/changes/feat-ext-d4a-docx-provenance-20260812/summary.md','backend/src/secure_ingest/document_text.py','backend/tests/test_secure_ingest_document_text.py','backend/web/routers/secure_ingest.py'],
      commands: ['node --test scripts/reviewer-successor-w08.nodetest.mjs scripts/r0-amendment-check.nodetest.mjs scripts/execution-authority-v2.nodetest.mjs scripts/professional-agent-matrix.nodetest.mjs','node scripts/professional-agent-matrix.mjs --check','node scripts/execution-authority.mjs --check','node scripts/execution-authority-v2.mjs --check','node scripts/execution-authority-v2.mjs --authorize --work-package R0-W08','node scripts/harness-doctor.mjs',"git diff --check -- . ':(exclude).harness/changes/docs-r0-w08-codex-reviewer-successor-20260810/review_inputs/product-candidate.diff' ':(exclude).harness/changes/docs-r0-w08-codex-reviewer-successor-20260810/review_inputs/reviewer-successor.diff'"],
      productionReady: false,
    };
    const finalReviewSource = executionDocument(review, d4aReviewSources[1]);
    overlay.reviews[1].sha256 = sha256(finalReviewSource);
    d4aOwnerValue.reviews[1].sha256 = overlay.reviews[1].sha256;
    const finalD4aOwnerSource = d4aDocument(d4aOwnerValue);
    overlay.ownerApprovalSha256 = sha256(finalD4aOwnerSource);
    manifest.approvalEvidence.reviewSha256 = sha256(finalReviewSource);
    for (const path of activationPaths) {
      await mkdir(dirname(join(repository, path)), { recursive: true });
      if (path === '.harness/manifest/project-harness.json') {
        const harness = JSON.parse(await readFile(join(repository, path), 'utf8'));
        harness.amendmentGovernance.reviewerSuccessorW08D4A = overlay;
        await writeFile(join(repository, path), `${JSON.stringify(harness, null, 2)}\n`);
      } else if (path === '.harness/manifest/execution-authority.v2.json') await writeFile(join(repository, path), `${JSON.stringify(manifest, null, 2)}\n`);
      else if (path === intentPath) await writeFile(join(repository, path), intentSource);
      else if (path === overlay.reviews[0].path) await writeFile(join(repository, path), d4aReviewSources[0]);
      else if (path === overlay.reviews[1].path) await writeFile(join(repository, path), finalReviewSource);
      else if (path === overlay.ownerApprovalPath) await writeFile(join(repository, path), finalD4aOwnerSource);
      else if (path === manifest.approvalEvidence.ownerApprovalPath) await writeFile(join(repository, path), ownerSource);
      else if (path === overlay.productReviewPackagePath) await writeFile(join(repository, path), productDiff);
      else if (path === overlay.governanceReviewPackagePath) await writeFile(join(repository, path), governanceDiff);
    }
    await execFileAsync('git', ['add', '--', ...activationPaths], { cwd: repository });
    await execFileAsync('git', ['commit', '-q', '-m', 'A'], { cwd: repository });
    const activationH = (await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: repository })).stdout.trim();
    const activationTree = (await execFileAsync('git', ['rev-parse', 'HEAD^{tree}'], { cwd: repository })).stdout.trim();
    const promotionH = (await execFileAsync('git', ['commit-tree', activationTree, '-p', REVIEWER_SUCCESSOR_W08_D4A_PRODUCT_BASE, '-p', activationH, '-m', 'M'], { cwd: repository })).stdout.trim();
    await execFileAsync('git', ['checkout', '-q', '--detach', promotionH], { cwd: repository });
    await execFileAsync('git', ['branch', '-f', 'feature-chaotang-ext', promotionH], { cwd: repository });
    await assertRepository({ repository, overlay, activationH });
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
}

test('D4A topology accepts only B to P to G to A with promotion parents [B,A] and exact 7/11/9 paths', async () => {
  await withFinalD4ARepository(async ({ repository, overlay, activationH }) => {
    assert.deepEqual(await verifyReviewerSuccessorW08D4ATopology(repository, overlay), []);
    await execFileAsync('git', ['checkout', '-q', '--detach', activationH], { cwd: repository });
    assert.ok((await verifyReviewerSuccessorW08D4ATopology(repository, overlay)).some((error) => error.includes('parents [B,A]')));
  });
});

test('loadExecutionAuthorityV2 on final M dispatches both W08 overlays through the D4A verifier', async () => {
  await withFinalD4ARepository(async ({ repository, overlay }) => {
    const loaded = await loadExecutionAuthorityV2(repository);
    assert.equal(
      loaded.amendmentGovernance.reviewerSuccessorW08D4A.governanceCandidateH,
      overlay.governanceCandidateH,
    );
    assert.deepEqual(loaded.errors, []);
    assert.ok(
      !loaded.errors.includes('reviewerSuccessorW08 git identity unverifiable: activation carrier must be a direct child or one transparent promotion merge'),
      loaded.errors.join('\n'),
    );
  });
});

test('loadExecutionAuthorityV2 on final M stops when the D4A chain is damaged', async () => {
  await withFinalD4ARepository(async ({ repository }) => {
    const harnessPath = join(repository, '.harness/manifest/project-harness.json');
    const harness = JSON.parse(await readFile(harnessPath, 'utf8'));
    harness.amendmentGovernance.reviewerSuccessorW08D4A.productCandidateH = '9'.repeat(40);
    await writeFile(harnessPath, `${JSON.stringify(harness, null, 2)}\n`);
    const loaded = await loadExecutionAuthorityV2(repository);
    assert.ok(
      loaded.errors.some((error) =>
        error.includes('working tree differs from pinned authority commit') ||
        error.includes('reviewerSuccessorW08D4A productCandidateH'),
      ),
      loaded.errors.join('\n'),
    );
  });
});
