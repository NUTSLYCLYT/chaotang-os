import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import {
  chmod,
  link,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import test from 'node:test';
import { deflateSync } from 'node:zlib';

import * as executionAuthorityV2Module from './lib/execution-authority-v2.mjs';
import {
  verifyRepositoryLocalGitDiffEnvironment,
} from './lib/amendment-governance.mjs';
import {
  EXECUTION_AUTHORITY_V2_PATH,
  EXECUTION_AUTHORITY_V2_SCHEMA_PATH,
  EXPECTED_EXECUTION_AUTHORITY_V2_REGISTRATION,
  evaluateExecutionAuthorityV2Policy,
  executionAuthorityV2CommandResult,
  isCandidateInTrustedPromotionHistory,
  loadExecutionAuthorityV2,
  parseExecutionAuthorityV2Evidence,
  parseExecutionAuthorityV2ReviewPackage,
  parseJsonObjectWithUniqueKeys,
  readPinnedAuthorityFile,
  sha256Hex,
  validateExecutionAuthorityV2ActivationIntent,
  validateExecutionAuthorityV2Evidence,
  validateExecutionAuthorityV2,
  validateExecutionAuthorityV2Manifest,
  validateExecutionAuthorityV2Schema,
} from './lib/execution-authority-v2.mjs';
import { validateReviewerSuccessorW08D4A } from './lib/reviewer-successor-w08-d4a.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const cliPath = join(root, 'scripts/execution-authority-v2.mjs');
const execFileAsync = promisify(execFile);
const hardenedGitEnvironment = {
  ...Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')),
  ),
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_ATTR_NOSYSTEM: '1',
  GIT_OPTIONAL_LOCKS: '0',
  LC_ALL: 'C',
};
const W07_EVENT1_CHANGED_PATHS = Object.freeze([
  '.harness/changes/docs-r0-w07-exact-h-activation-b0df777a-20260727/ci_result/ci_summary.md',
  '.harness/changes/docs-r0-w07-exact-h-activation-b0df777a-20260727/evidence_inventory.md',
  '.harness/changes/docs-r0-w07-exact-h-activation-b0df777a-20260727/request_analysis/spec.md',
  '.harness/changes/docs-r0-w07-exact-h-activation-b0df777a-20260727/request_analysis/tasks.md',
  '.harness/changes/docs-r0-w07-exact-h-activation-b0df777a-20260727/summary.md',
  '.harness/wiki/execution-authority-v2.md',
  'docs/superpowers/plans/2026-07-27-r0-w07-exact-h-activation-b0df777a.md',
  'docs/superpowers/specs/2026-07-27-r0-w07-exact-h-activation-b0df777a-design.md',
  'scripts/execution-authority-v2.nodetest.mjs',
  'scripts/lib/amendment-governance.mjs',
  'scripts/lib/execution-authority-v2.mjs',
  'scripts/r0-amendment-check.nodetest.mjs',
]);
const W08_PROFESSIONAL_CHANGED_PATHS = Object.freeze([
  '.harness/changes/chore-professional-agent-k0-ext-convergence-20260810/ci_result/ci_summary.md',
  '.harness/changes/chore-professional-agent-k0-ext-convergence-20260810/codex_review/candidate-review.md',
  '.harness/changes/chore-professional-agent-k0-ext-convergence-20260810/request_analysis/spec.md',
  '.harness/changes/chore-professional-agent-k0-ext-convergence-20260810/request_analysis/tasks.md',
  '.harness/changes/chore-professional-agent-k0-ext-convergence-20260810/summary.md',
  '.harness/changes/fix-professional-agent-k0-root-registration-20260810/ci_result/ci_summary.md',
  '.harness/changes/fix-professional-agent-k0-root-registration-20260810/request_analysis/spec.md',
  '.harness/changes/fix-professional-agent-k0-root-registration-20260810/request_analysis/tasks.md',
  '.harness/changes/fix-professional-agent-k0-root-registration-20260810/summary.md',
  '.harness/contracts/professional-agent-asset-matrix.v1.schema.json',
  '.harness/manifest/professional-agent-asset-matrix.v1.json',
  '.harness/manifest/project-harness.json',
  '.harness/wiki/harness-inventory.md',
  '.harness/wiki/professional-agent-asset-matrix.md',
  '.harness/wiki/verification-matrix.md',
  'scripts/harness-doctor.mjs',
  'scripts/lib/professional-agent-matrix.mjs',
  'scripts/professional-agent-matrix.mjs',
  'scripts/professional-agent-matrix.nodetest.mjs',
  'scripts/professional_agent_matrix_schema_check.py',
]);

test('execution authority exposes the independent D4A continuation validator', () => {
  assert.ok(
    validateReviewerSuccessorW08D4A(null).some((error) =>
      error.includes('missing or unsupported fields'),
    ),
  );
});

test('active-packet Git identity verification receives D4A governance for profile selection', async () => {
  const source = await readFile(join(root, 'scripts/lib/execution-authority-v2.mjs'), 'utf8');
  assert.match(
    source,
    /verifyActivePacketGitIdentity\([\s\S]*?amendmentGovernance,[\s\S]*?\);/u,
  );
  assert.match(
    source,
    /const profile = activePacketProfile\(manifest, errors, amendmentGovernance\);/u,
  );
});
const liveAmendmentGovernance = JSON.parse(
  await readFile(join(root, '.harness/manifest/project-harness.json'), 'utf8'),
).amendmentGovernance;

function validManifest() {
  return {
    schemaVersion: 'execution-authority.v2',
    authorityId: 'r0-execution-authority-20260721-v2',
    amendment: {
      id: 'R0-TRUSTED-KERNEL-AMENDMENT-01',
      path: '.harness/changes/docs-r0-trusted-kernel-amendment-20260720/amendment.md',
      approvedSourceDigest:
        '2ba59cbe4d4032d8f372d1dd757e03edb78038b38de6d657380f357100a83e38',
    },
    effectiveBase: {
      ref: 'origin/feature-chaotang-ext',
      sha: '5e432ea45796738902fcd74948a34918e781bda7',
    },
    approvalEvidence: {
      ownerApprovalPath:
        '.harness/changes/docs-r0-w01-amendment-repin-20260721-20260721/owner_approval/exact-h-approval.md',
      ownerApprovalSha256:
        '7016c61934dd81f62b7fb69667214c77b16c78674a091529f149385cf790606b',
      reviewPath:
        '.harness/changes/docs-r0-w01-amendment-repin-20260721-20260721/claude_code_review/exact-h-final.md',
      reviewSha256: 'ecca3dcafef5fad5ce609acbfaeb75d18719e95690ff8ee9343e0906b24c606e',
      reviewVerdict: 'GO',
      approver: 'lyt',
      candidateH: '5e432ea45796738902fcd74948a34918e781bda7',
      tree: '50f0b0c852fccdd6a3119cbffd180ea65ed78df6',
      approvedScope: ['R0-W01'],
    },
    activeWorkPackage: 'R0-W01',
    workPackageLedger: [
      { id: 'R0-W00', status: 'MERGED_AND_VERIFIED' },
      { id: 'R0-W01', status: 'ACTIVE' },
    ],
    professionalReassignment: {
      requiredBefore: ['REAL_CUSTOMER_DATA', 'R0-W08', 'R0-W09'],
      rolesRequired: ['security', 'legal', 'release'],
      assignments: { security: 'lyt', legal: 'lyt', release: 'lyt' },
      defaultOwner: 'lyt',
    },
  };
}

function validGovernance() {
  return structuredClone(liveAmendmentGovernance);
}

function validReviewerReassignment() {
  return {
    schemaVersion: 'reviewer-reassignment.v1',
    status: 'APPROVED',
    scope: ['R0-W07'],
    fromReviewer: 'Claude Code',
    toReviewer: 'Codex Independent QA',
    executionOwner: 'Codex',
    reviewPassesRequired: 2,
    sessionIsolation: 'FRESH_NO_FORK_CONTEXT',
    writeAccess: 'DENIED',
    candidateMutation: 'FORBIDDEN',
    expiresAfter: 'R0-W07_MERGED_AND_VERIFIED',
    baseH: '55caf0d176cd6a1bbb833ffd1872ea3f1d8a46ca',
    candidateH: '1'.repeat(40),
    tree: '2'.repeat(40),
    writingSessionId: '70da5ef5-c29f-4570-83ec-f7ee19e9bef1',
    rejectedSessionIds: [
      '019f9c33-5ae7-7b00-9c0c-1b3b3be8452d',
      '019f9c33-5b1f-7360-a217-1c3d827045d5',
      '019f9c43-e603-76c3-b30b-d78789057441',
      '019f9c43-e632-75b1-99d9-0d9b162cd3e1',
      '019f9c4f-1fef-74c2-9767-a8a653569bbd',
      '019f9c4f-201b-7d91-a2b0-e49e08a5985a',
      '019f9c5b-0cbc-72f0-a114-1b26dc852bd5',
      '019f9c5b-0cf9-7a20-a741-ce4a279dce9b',
      '019f9c6d-d611-7400-b03f-3b2e474543a8',
      '019f9c6d-d648-7961-a3eb-7071cc51eec9',
      '019f9c7c-09d3-7d70-890a-9f77201076e3',
      '019f9c7c-0a04-7a20-b62f-cdd8779ad09d',
      '019f9c8a-e2d2-7d13-8a5a-781992a38021',
      '019f9c8a-e301-7430-a67f-270e119262b2',
      '019f9cd7-fbb2-76c2-adc5-a2dd003543c6',
      '019f9cd7-fbed-7e73-9774-80c8c23569ac',
      '019f9ce3-9a79-79d1-ab66-caf35bb82778',
      '019f9ce3-9ab1-7df1-aef9-14c1b939b7c3',
      '019f9cf4-7b7d-7840-85b4-953d47fa995d',
      '019f9cf4-7bb2-79a3-ba7e-277a0eec60c8',
      '019f9d05-77f5-79a3-8d0c-4a0e036ce563',
      '019f9d05-782d-78e3-98ca-b76baf67ba94',
      '019f9d3e-2f09-7fb0-81ad-4a0bb0a6ef3d',
      '019f9d3e-5bf0-7f71-b824-2747a3cc0bda',
      '019f9d4b-e4ac-7c92-a38c-492e4619f442',
      '019f9d4c-1bff-71c3-8967-d8f6550f1b33',
      '019f9d56-e07e-7d10-b75c-7e07bbf5c2eb',
      '019f9d57-0d8d-7142-b5b4-d0e2c8cb4fce',
      '019f9d5d-2fac-76b0-8043-e18374e699b7',
      '019f9d5d-63d2-7690-9c52-4f422cc6e738',
      '019f9d6c-55a8-73e3-99ba-027549989c1f',
      '019f9d6c-55e8-7f00-89f5-b63114a791ea',
      '019f9d77-931c-7103-888a-30d4bdac1bed',
      '019f9d77-934c-7e33-b86a-78eddb22a420',
      '019f9e54-18be-7961-acbb-d4b24a99f422',
      '019f9e54-42d5-7373-9fb3-c49a81a37275',
      '019f9e63-ae15-7342-b54d-eb1335b88ca1',
      '019f9e63-d995-7353-a9c7-b9ddf850de8a',
      '019f9e7f-7755-7043-9cc8-01febc98d973',
      '019f9e7f-ae1f-7aa2-81ac-a4b0265273b6',
    ],
    reviewPackagePath:
      '.harness/changes/docs-r0-reviewer-reassignment-20260726/review_inputs/candidate.diff',
    reviewPackageSha256: '3'.repeat(64),
    ownerApprovalPath:
      '.harness/changes/docs-r0-reviewer-reassignment-20260726/owner_approval/exact-h-approval.md',
    ownerApprovalSha256: '4'.repeat(64),
    reviews: [
      {
        sessionId: '22222222-2222-2222-2222-222222222222',
        path:
          '.harness/changes/docs-r0-reviewer-reassignment-20260726/codex_review/pass-1.md',
        sha256: '5'.repeat(64),
        verdict: 'GO',
        high: 0,
        medium: 0,
        writeAccess: 'DENIED',
      },
      {
        sessionId: '33333333-3333-3333-3333-333333333333',
        path:
          '.harness/changes/docs-r0-reviewer-reassignment-20260726/codex_review/pass-2.md',
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

function validReviewerSuccessorW08() {
  const changeRoot =
    '.harness/changes/docs-r0-w08-codex-reviewer-successor-20260810';
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
    productBaseH: '4c543209333fa14f3a296ff1ff917642153ffc30',
    productCandidateH: '24071c2f9a5cd19952ece17a8dc172a297a1dc09',
    productTree: '9d1bdc08dbbd4a6198907976508c956c86cfffff',
    productReviewPackagePath: `${changeRoot}/review_inputs/product-candidate.diff`,
    productReviewPackageSha256:
      '432082345d18230fcaff22e36602a5274b68b25562b3772736e6ad5685e05044',
    governanceBaseH: '24071c2f9a5cd19952ece17a8dc172a297a1dc09',
    governanceCandidateH: '1'.repeat(40),
    governanceTree: '2'.repeat(40),
    governanceReviewPackagePath: `${changeRoot}/review_inputs/reviewer-successor.diff`,
    governanceReviewPackageSha256: '3'.repeat(64),
    ownerApprovalPath: `${changeRoot}/owner_approval/reviewer-successor-approval.md`,
    ownerApprovalSha256: '4'.repeat(64),
    reviews: [
      {
        identity: '/root/w08_successor_qa_pass1',
        path: `${changeRoot}/codex_review/pass-1.md`,
        sha256: '5'.repeat(64),
        verdict: 'GO',
        high: 0,
        medium: 0,
        writeAccess: 'DENIED',
      },
      {
        identity: '/root/w08_successor_qa_pass2',
        path: `${changeRoot}/codex_review/exact-h-final.md`,
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

function d4aProductBinding() {
  return {
    productCandidateH: 'e25706c0c5d689354d2424f483446a1e243b58ec',
    productTree: '1bc77790d7327b364a6e972620de456aa913f699',
    productReviewPackagePath:
      '.harness/changes/docs-r0-w08-d4a-exact-h-activation-20260812/review_inputs/product-candidate.diff',
    productReviewPackageSha256:
      '9e5ff0c70dbafc96700ea2479fec886b21e9926263f6406e435adc92b9a9002d',
  };
}

function w06ActivationManifest() {
  const manifest = validManifest();
  return {
    ...manifest,
    effectiveBase: {
      ref: 'origin/feature-chaotang-ext',
      sha: '8feae838f09ad5202b21332d4280b989ab776bd7',
    },
    approvalEvidence: {
      ownerApprovalPath:
        '.harness/changes/fix-ext-g0-authority-recovery-20260725/owner_approval/exact-h-approval.md',
      ownerApprovalSha256: 'a'.repeat(64),
      reviewPath:
        '.harness/changes/fix-ext-g0-authority-recovery-20260725/claude_code_review/exact-h-final.md',
      reviewSha256: 'b'.repeat(64),
      reviewVerdict: 'GO',
      approver: 'lyt',
      candidateH: '8feae838f09ad5202b21332d4280b989ab776bd7',
      tree: '9d63f98041e5e13174dbba4c0b9d27eef1471bf9',
      approvedScope: ['R0-W06'],
    },
    activeWorkPackage: 'R0-W06',
    workPackageLedger: [
      { id: 'R0-W00', status: 'MERGED_AND_VERIFIED' },
      { id: 'R0-W01', status: 'MERGED_AND_VERIFIED' },
      { id: 'R0-W02', status: 'MERGED_AND_VERIFIED' },
      { id: 'R0-W03', status: 'MERGED_AND_VERIFIED' },
      { id: 'R0-W04', status: 'MERGED_AND_VERIFIED' },
      { id: 'R0-W05', status: 'MERGED_AND_VERIFIED' },
      { id: 'R0-W06', status: 'ACTIVE' },
    ],
  };
}

function evidenceDocument(value) {
  return [
    '# Evidence',
    '',
    '<!-- execution-authority-v2-evidence:start -->',
    '```json',
    JSON.stringify(value, null, 2),
    '```',
    '<!-- execution-authority-v2-evidence:end -->',
    '',
  ].join('\n');
}

function reviewerReassignmentEvidenceDocument(value) {
  return [
    '# Reviewer Reassignment Evidence',
    '',
    '<!-- reviewer-reassignment-evidence:start -->',
    '```json',
    JSON.stringify(value, null, 2),
    '```',
    '<!-- reviewer-reassignment-evidence:end -->',
    '',
  ].join('\n');
}

function w06EvidenceDocuments() {
  const manifest = w06ActivationManifest();
  const owner = {
    evidenceVersion: 'execution-authority-v2-evidence.v1',
    kind: 'owner-approval',
    decision: 'APPROVED',
    approver: 'lyt',
    workPackage: 'R0-W06',
    effectiveBase: manifest.effectiveBase,
    candidateH: manifest.approvalEvidence.candidateH,
    tree: manifest.approvalEvidence.tree,
    approvedScope: ['R0-W06'],
    exclusions: [
      'NO_DEPLOYMENT',
      'NO_REAL_CUSTOMER_DATA',
      'NO_DB_MIGRATION',
      'NO_LISTENER_3050_TAKEOVER',
      'NO_R0_W07_TO_R0_W09',
      'NO_AUTOMATIC_MERGE',
      'NO_PRODUCTION_CLAIM',
    ],
    activationIntentPath:
      '.harness/changes/fix-ext-g0-authority-recovery-20260725/activation_intent/r0-w06-activation-intent.json',
    activationIntentSha256: 'c'.repeat(64),
  };
  const activationIntent = {
    schemaVersion: 'execution-authority.v2.activation-intent.v1',
    kind: 'activation-intent',
    trackedManifestPath: '.harness/manifest/execution-authority.v2.json',
    reviewPackagePath:
      '.harness/changes/fix-ext-g0-authority-recovery-20260725/review_inputs/review-7df6e4e1..e8be2ca9.diff',
    reviewPackageSha256: 'd'.repeat(64),
    effectiveBase: manifest.effectiveBase,
    approvalEvidence: {
      ownerApprovalPath: manifest.approvalEvidence.ownerApprovalPath,
      reviewPath: manifest.approvalEvidence.reviewPath,
      reviewVerdict: manifest.approvalEvidence.reviewVerdict,
      approver: manifest.approvalEvidence.approver,
      candidateH: manifest.approvalEvidence.candidateH,
      tree: manifest.approvalEvidence.tree,
      approvedScope: manifest.approvalEvidence.approvedScope,
    },
    activeWorkPackage: manifest.activeWorkPackage,
    workPackageLedger: manifest.workPackageLedger,
  };
  const review = {
    evidenceVersion: 'execution-authority-v2-evidence.v1',
    kind: 'independent-review',
    verdict: 'GO',
    reviewer: 'Claude Code',
    workPackage: 'R0-W06',
    effectiveBase: manifest.effectiveBase,
    candidateH: manifest.approvalEvidence.candidateH,
    tree: manifest.approvalEvidence.tree,
    approvedScope: ['R0-W06'],
    ownerApprovalPath: manifest.approvalEvidence.ownerApprovalPath,
    ownerApprovalSha256: manifest.approvalEvidence.ownerApprovalSha256,
    activationIntentPath: owner.activationIntentPath,
    activationIntentSha256: owner.activationIntentSha256,
    reviewPackagePath: activationIntent.reviewPackagePath,
    diffSha256: 'd'.repeat(64),
    changedPaths: [
      '.harness/changes/fix-ext-g0-authority-recovery-20260725/claude_code_review/exact-h-final.md',
      '.harness/manifest/execution-authority.v2.json',
      'scripts/lib/execution-authority-v2.mjs',
      'scripts/execution-authority-v2.nodetest.mjs',
    ],
    commands: [
      'node --test scripts/execution-authority.nodetest.mjs',
      'node --test scripts/execution-authority-v2.nodetest.mjs',
      'node scripts/execution-authority.mjs --authorize',
      'node scripts/execution-authority-v2.mjs --authorize --work-package R0-W06',
      'node scripts/harness-doctor.mjs',
      'git diff --check',
    ],
    productionReady: false,
  };
  return { manifest, owner, activationIntent, review };
}

function w07EvidenceDocuments() {
  const fixture = w06EvidenceDocuments();
  const changeRoot =
    '.harness/changes/docs-r0-w07-exact-h-activation-b0df777a-20260727';
  const manifest = structuredClone(fixture.manifest);
  manifest.effectiveBase = {
    ref: 'refs/heads/feature-chaotang-ext',
    sha: '55caf0d176cd6a1bbb833ffd1872ea3f1d8a46ca',
  };
  manifest.approvalEvidence = {
    ownerApprovalPath: `${changeRoot}/owner_approval/exact-h-approval.md`,
    ownerApprovalSha256: 'a'.repeat(64),
    reviewPath: `${changeRoot}/codex_review/exact-h-final.md`,
    reviewSha256: 'b'.repeat(64),
    reviewVerdict: 'GO',
    approver: 'lyt',
    candidateH: manifest.effectiveBase.sha,
    tree: 'f692b9090be04722595bbedd8725578f5ed9a745',
    approvedScope: ['R0-W07'],
  };
  manifest.activeWorkPackage = 'R0-W07';
  manifest.workPackageLedger = [
    ...manifest.workPackageLedger.slice(0, -1),
    { id: 'R0-W06', status: 'MERGED_AND_VERIFIED' },
    { id: 'R0-W07', status: 'ACTIVE' },
  ];

  const owner = {
    ...structuredClone(fixture.owner),
    workPackage: 'R0-W07',
    effectiveBase: manifest.effectiveBase,
    candidateH: manifest.approvalEvidence.candidateH,
    tree: manifest.approvalEvidence.tree,
    approvedScope: ['R0-W07'],
    exclusions: [
      'NO_DEPLOYMENT',
      'NO_REAL_CUSTOMER_DATA',
      'NO_DB_MIGRATION',
      'NO_LISTENER_3050_TAKEOVER',
      'NO_R0_W08_TO_R0_W09',
      'NO_AUTOMATIC_MERGE',
      'NO_PRODUCTION_CLAIM',
    ],
    activationIntentPath: `${changeRoot}/activation_intent/r0-w07-activation-intent.json`,
  };
  const activationIntent = {
    ...structuredClone(fixture.activationIntent),
    reviewPackagePath: `${changeRoot}/review_inputs/activation-candidate.diff`,
    effectiveBase: manifest.effectiveBase,
    approvalEvidence: structuredClone(manifest.approvalEvidence),
    activeWorkPackage: 'R0-W07',
    workPackageLedger: manifest.workPackageLedger,
  };
  delete activationIntent.approvalEvidence.ownerApprovalSha256;
  delete activationIntent.approvalEvidence.reviewSha256;
  const review = {
    ...structuredClone(fixture.review),
    reviewer: 'Codex Independent QA',
    workPackage: 'R0-W07',
    effectiveBase: manifest.effectiveBase,
    candidateH: manifest.approvalEvidence.candidateH,
    tree: manifest.approvalEvidence.tree,
    approvedScope: ['R0-W07'],
    ownerApprovalPath: manifest.approvalEvidence.ownerApprovalPath,
    activationIntentPath: owner.activationIntentPath,
    reviewPackagePath: activationIntent.reviewPackagePath,
    changedPaths: [...W07_EVENT1_CHANGED_PATHS],
    commands: [
      'node --test scripts/execution-authority.nodetest.mjs scripts/r0-amendment-check.nodetest.mjs scripts/execution-authority-v2.nodetest.mjs',
      'node scripts/execution-authority.mjs --authorize',
      'node scripts/execution-authority-v2.mjs --check',
      'node scripts/execution-authority-v2.mjs --authorize --work-package R0-W07',
      'node scripts/harness-doctor.mjs',
      'git diff --check',
    ],
  };
  return { manifest, owner, activationIntent, review };
}

function w08EvidenceDocuments() {
  const fixture = w07EvidenceDocuments();
  const changeRoot =
    '.harness/changes/docs-r0-w08-codex-reviewer-successor-20260810';
  const manifest = structuredClone(fixture.manifest);
  manifest.effectiveBase = {
    ref: 'refs/heads/feature-chaotang-ext',
    sha: '24071c2f9a5cd19952ece17a8dc172a297a1dc09',
  };
  manifest.approvalEvidence = {
    ownerApprovalPath: `${changeRoot}/owner_approval/exact-h-approval.md`,
    ownerApprovalSha256: 'a'.repeat(64),
    reviewPath: `${changeRoot}/codex_review/exact-h-final.md`,
    reviewSha256: 'b'.repeat(64),
    reviewVerdict: 'GO',
    approver: 'lyt',
    candidateH: manifest.effectiveBase.sha,
    tree: '9d1bdc08dbbd4a6198907976508c956c86cfffff',
    approvedScope: ['R0-W08'],
  };
  manifest.activeWorkPackage = 'R0-W08';
  manifest.workPackageLedger = [
    ...manifest.workPackageLedger.slice(0, -1),
    { id: 'R0-W07', status: 'MERGED_AND_VERIFIED' },
    { id: 'R0-W08', status: 'ACTIVE' },
  ];
  manifest.professionalReassignment = {
    ...manifest.professionalReassignment,
    assignments: {
      security: 'r0-security-owner',
      legal: 'r0-legal-owner',
      release: 'r0-release-owner',
    },
  };

  const owner = {
    ...structuredClone(fixture.owner),
    workPackage: 'R0-W08',
    effectiveBase: manifest.effectiveBase,
    candidateH: manifest.approvalEvidence.candidateH,
    tree: manifest.approvalEvidence.tree,
    approvedScope: ['R0-W08'],
    exclusions: [
      'NO_DEPLOYMENT',
      'NO_REAL_CUSTOMER_DATA',
      'NO_DB_MIGRATION',
      'NO_LISTENER_3050_TAKEOVER',
      'NO_R0_W09_ACTIVATION',
      'NO_AUTOMATIC_MERGE',
      'NO_PRODUCTION_CLAIM',
    ],
    activationIntentPath: `${changeRoot}/activation_intent/r0-w08-activation-intent.json`,
  };
  const activationIntent = {
    ...structuredClone(fixture.activationIntent),
    reviewPackagePath: `${changeRoot}/review_inputs/product-candidate.diff`,
    effectiveBase: manifest.effectiveBase,
    approvalEvidence: structuredClone(manifest.approvalEvidence),
    activeWorkPackage: 'R0-W08',
    workPackageLedger: manifest.workPackageLedger,
  };
  delete activationIntent.approvalEvidence.ownerApprovalSha256;
  delete activationIntent.approvalEvidence.reviewSha256;
  const review = {
    ...structuredClone(fixture.review),
    reviewer: 'Codex Independent QA',
    workPackage: 'R0-W08',
    effectiveBase: manifest.effectiveBase,
    candidateH: manifest.approvalEvidence.candidateH,
    tree: manifest.approvalEvidence.tree,
    approvedScope: ['R0-W08'],
    ownerApprovalPath: manifest.approvalEvidence.ownerApprovalPath,
    activationIntentPath: owner.activationIntentPath,
    reviewPackagePath: activationIntent.reviewPackagePath,
    changedPaths: [...W08_PROFESSIONAL_CHANGED_PATHS],
    commands: [
      'node --test scripts/reviewer-successor-w08.nodetest.mjs scripts/r0-amendment-check.nodetest.mjs scripts/execution-authority-v2.nodetest.mjs scripts/professional-agent-matrix.nodetest.mjs',
      'node scripts/professional-agent-matrix.mjs --check',
      'node scripts/execution-authority.mjs --check',
      'node scripts/execution-authority-v2.mjs --check',
      'node scripts/execution-authority-v2.mjs --authorize --work-package R0-W08',
      'node scripts/harness-doctor.mjs',
      "git diff --check -- . ':(exclude).harness/changes/docs-r0-w08-codex-reviewer-successor-20260810/review_inputs/product-candidate.diff' ':(exclude).harness/changes/docs-r0-w08-codex-reviewer-successor-20260810/review_inputs/reviewer-successor.diff'",
    ],
  };
  return { manifest, owner, activationIntent, review };
}

function reviewPackageForPaths(paths) {
  return paths
    .map(
      (path) =>
        `diff --git a/${path} b/${path}\n--- a/${path}\n+++ b/${path}\n@@ -0,0 +1 @@\n+review\n`,
    )
    .join('');
}

async function writeRepositoryFile(temporaryRoot, path, source) {
  await mkdir(join(temporaryRoot, dirname(path)), { recursive: true });
  await writeFile(
    join(temporaryRoot, path),
    source,
    Buffer.isBuffer(source) ? undefined : 'utf8',
  );
}

async function createActiveAuthorityFixture({
  temporaryRoot: suppliedRoot,
  gitObjectFormat,
  mutateIntent,
  mutateOwner,
  mutateReview,
  writeIntent = true,
  activationIntentDigest,
  reviewPackageSource,
  reviewPackageDigest,
  writeReviewPackage = true,
} = {}) {
  const temporaryRoot =
    suppliedRoot ?? await mkdtemp(join(tmpdir(), 'chaotang-v2-active-'));
  await mkdir(temporaryRoot, { recursive: true });
  const fixture = w06EvidenceDocuments();
  const owner = structuredClone(fixture.owner);
  const review = structuredClone(fixture.review);
  const intent = structuredClone(fixture.activationIntent);
  const packageSource = reviewPackageSource ?? reviewPackageForPaths(review.changedPaths);
  intent.reviewPackageSha256 = sha256Hex(packageSource);
  review.diffSha256 = reviewPackageDigest ?? sha256Hex(packageSource);
  mutateIntent?.(intent);
  const intentSource = `${JSON.stringify(intent, null, 2)}\n`;
  owner.activationIntentSha256 = activationIntentDigest ?? sha256Hex(intentSource);
  mutateOwner?.(owner);
  const ownerSource = evidenceDocument(owner);
  review.ownerApprovalSha256 = sha256Hex(ownerSource);
  review.activationIntentPath = owner.activationIntentPath;
  review.activationIntentSha256 = owner.activationIntentSha256;
  mutateReview?.(review);
  const reviewSource = evidenceDocument(review);
  const manifest = structuredClone(fixture.manifest);
  manifest.approvalEvidence.ownerApprovalSha256 = sha256Hex(ownerSource);
  manifest.approvalEvidence.reviewSha256 = sha256Hex(reviewSource);

  await writeRepositoryFile(
    temporaryRoot,
    EXECUTION_AUTHORITY_V2_PATH,
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  await writeRepositoryFile(
    temporaryRoot,
    EXECUTION_AUTHORITY_V2_SCHEMA_PATH,
    await readFile(join(root, EXECUTION_AUTHORITY_V2_SCHEMA_PATH), 'utf8'),
  );
  await writeRepositoryFile(
    temporaryRoot,
    '.harness/manifest/project-harness.json',
    `${JSON.stringify({ amendmentGovernance: validGovernance() }, null, 2)}\n`,
  );
  await writeRepositoryFile(
    temporaryRoot,
    fixture.manifest.amendment.path,
    await readFile(join(root, fixture.manifest.amendment.path)),
  );
  for (const path of [
    liveAmendmentGovernance.approvalEvidence.ownerApprovalPath,
    liveAmendmentGovernance.approvalEvidence.reviewPath,
  ]) {
    await writeRepositoryFile(
      temporaryRoot,
      path,
      await readFile(join(root, path), 'utf8'),
    );
  }
  await writeRepositoryFile(temporaryRoot, manifest.approvalEvidence.ownerApprovalPath, ownerSource);
  await writeRepositoryFile(temporaryRoot, manifest.approvalEvidence.reviewPath, reviewSource);
  if (writeIntent) {
    await writeRepositoryFile(temporaryRoot, fixture.owner.activationIntentPath, intentSource);
  }
  if (writeReviewPackage) {
    await writeRepositoryFile(temporaryRoot, fixture.review.reviewPackagePath, packageSource);
  }
  await execFileAsync(
    'git',
    [
      'init',
      '-q',
      ...(gitObjectFormat === undefined
        ? []
        : [`--object-format=${gitObjectFormat}`]),
    ],
    { cwd: temporaryRoot },
  );
  await execFileAsync('git', ['config', 'user.name', 'R0 Test'], {
    cwd: temporaryRoot,
  });
  await execFileAsync('git', ['config', 'user.email', 'r0@example.invalid'], {
    cwd: temporaryRoot,
  });
  await execFileAsync('git', ['add', '.'], { cwd: temporaryRoot });
  await execFileAsync('git', ['commit', '-qm', 'active authority fixture'], {
    cwd: temporaryRoot,
  });
  return { temporaryRoot, manifest };
}

test('matching W06 machine-readable owner and independent review evidence permits the exact active package', () => {
  const { manifest, owner, review } = w06EvidenceDocuments();
  const parsedOwner = parseExecutionAuthorityV2Evidence(evidenceDocument(owner), 'owner approval');
  const parsedReview = parseExecutionAuthorityV2Evidence(evidenceDocument(review), 'independent review');
  assert.deepEqual(
    validateExecutionAuthorityV2Evidence(manifest, validGovernance(), parsedOwner, parsedReview),
    [],
  );
  const loaded = {
    manifest,
    amendmentGovernance: validGovernance(),
    errors: validateExecutionAuthorityV2Evidence(
      manifest,
      validGovernance(),
      parsedOwner,
      parsedReview,
    ),
  };
  const directResult = executionAuthorityV2CommandResult(
    loaded,
    '--authorize',
    [],
    { workPackage: 'R0-W06' },
  );
  assert.equal(directResult.exitCode, 0);
  assert.equal(
    directResult.output.reason,
    'POLICY_ELIGIBLE',
  );
  assert.equal(directResult.output.decision, 'ELIGIBLE');
});

test('matching W07 evidence uses Codex review and W07 packet identities', () => {
  const { manifest, owner, activationIntent, review } = w07EvidenceDocuments();
  const governance = validGovernance();
  governance.reviewerReassignment = validReviewerReassignment();
  assert.deepEqual(
    validateExecutionAuthorityV2Evidence(manifest, governance, owner, review),
    [],
  );
  assert.deepEqual(
    validateExecutionAuthorityV2ActivationIntent(manifest, activationIntent),
    [],
  );
});

test('transparent platform promotion preserves an approved first-parent candidate without trusting rewritten merges', async () => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), 'chaotang-v2-promotion-'));
  try {
    await execFileAsync('git', ['init', '-q'], { cwd: temporaryRoot });
    await execFileAsync('git', ['config', 'user.name', 'R0 Test'], {
      cwd: temporaryRoot,
    });
    await execFileAsync('git', ['config', 'user.email', 'r0@example.invalid'], {
      cwd: temporaryRoot,
    });
    await writeRepositoryFile(temporaryRoot, 'base.txt', 'base\n');
    await execFileAsync('git', ['add', '.'], { cwd: temporaryRoot });
    await execFileAsync('git', ['commit', '-qm', 'base'], { cwd: temporaryRoot });
    const baseH = (
      await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: temporaryRoot })
    ).stdout.trim();

    await execFileAsync('git', ['checkout', '-qb', 'promoted'], {
      cwd: temporaryRoot,
    });
    await writeRepositoryFile(temporaryRoot, 'candidate.txt', 'approved\n');
    await execFileAsync('git', ['add', '.'], { cwd: temporaryRoot });
    await execFileAsync('git', ['commit', '-qm', 'approved candidate'], {
      cwd: temporaryRoot,
    });
    const candidateH = (
      await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: temporaryRoot })
    ).stdout.trim();
    await execFileAsync(
      'git',
      ['commit', '--allow-empty', '-qm', 'promotion tip'],
      { cwd: temporaryRoot },
    );
    const promotedH = (
      await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: temporaryRoot })
    ).stdout.trim();

    await execFileAsync('git', ['checkout', '-q', '--detach', baseH], {
      cwd: temporaryRoot,
    });
    await execFileAsync(
      'git',
      ['merge', '-q', '--no-ff', promotedH, '-m', 'transparent promotion'],
      { cwd: temporaryRoot },
    );
    const transparentH = (
      await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: temporaryRoot })
    ).stdout.trim();
    assert.equal(
      await isCandidateInTrustedPromotionHistory(
        temporaryRoot,
        candidateH,
        transparentH,
      ),
      true,
    );

    await execFileAsync('git', ['checkout', '-q', '--detach', baseH], {
      cwd: temporaryRoot,
    });
    await execFileAsync(
      'git',
      [
        'merge',
        '-q',
        '--no-ff',
        '-s',
        'ours',
        promotedH,
        '-m',
        'rewritten promotion',
      ],
      { cwd: temporaryRoot },
    );
    const rewrittenH = (
      await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: temporaryRoot })
    ).stdout.trim();
    assert.equal(
      await isCandidateInTrustedPromotionHistory(
        temporaryRoot,
        candidateH,
        rewrittenH,
      ),
      false,
    );

    await execFileAsync('git', ['checkout', '-q', '--detach', baseH], {
      cwd: temporaryRoot,
    });
    await writeRepositoryFile(temporaryRoot, 'diverged.txt', 'diverged\n');
    await execFileAsync('git', ['add', '.'], { cwd: temporaryRoot });
    await execFileAsync('git', ['commit', '-qm', 'diverged predecessor'], {
      cwd: temporaryRoot,
    });
    await execFileAsync(
      'git',
      ['merge', '-q', '--no-ff', '--no-commit', promotedH],
      { cwd: temporaryRoot },
    );
    await execFileAsync('git', ['read-tree', '--reset', '-u', promotedH], {
      cwd: temporaryRoot,
    });
    await execFileAsync(
      'git',
      ['commit', '-qm', 'unrelated tree-identical merge'],
      { cwd: temporaryRoot },
    );
    const unrelatedH = (
      await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: temporaryRoot })
    ).stdout.trim();
    assert.equal(
      await isCandidateInTrustedPromotionHistory(
        temporaryRoot,
        candidateH,
        unrelatedH,
      ),
      false,
    );
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test('W07 Codex evidence authorizes end to end only after registration and activation commits', async () => {
  const temporaryParent = await mkdtemp(join(tmpdir(), 'chaotang-v2-w07-'));
  const temporaryRoot = join(temporaryParent, 'repo');
  try {
    await execFileAsync('git', ['clone', '-q', '--no-hardlinks', root, temporaryRoot]);
    await execFileAsync('git', ['config', 'user.name', 'R0 Test'], {
      cwd: temporaryRoot,
    });
    await execFileAsync('git', ['config', 'user.email', 'r0@example.invalid'], {
      cwd: temporaryRoot,
    });
    await execFileAsync(
      'git',
      [
        'checkout',
        '-q',
        '--detach',
        'b0df777a1fe94d98afdc62b4cdd02a2f8a091391',
      ],
      { cwd: temporaryRoot },
    );
    for (const path of W07_EVENT1_CHANGED_PATHS) {
      await writeRepositoryFile(
        temporaryRoot,
        path,
        await readFile(join(root, path)),
      );
    }
    await execFileAsync('git', ['add', ...W07_EVENT1_CHANGED_PATHS], {
      cwd: temporaryRoot,
    });
    await execFileAsync('git', ['commit', '-qm', 'reviewed authority candidate'], {
      cwd: temporaryRoot,
    });
    const candidateH = (
      await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: temporaryRoot })
    ).stdout.trim();
    const candidateTree = (
      await execFileAsync('git', ['rev-parse', 'HEAD^{tree}'], { cwd: temporaryRoot })
    ).stdout.trim();
    await writeRepositoryFile(
      temporaryRoot,
      'scripts/lib/reviewer-successor-w08.mjs',
      await readFile(join(root, 'scripts/lib/reviewer-successor-w08.mjs')),
    );
    await writeRepositoryFile(
      temporaryRoot,
      'scripts/lib/reviewer-successor-w08-d4a.mjs',
      await readFile(join(root, 'scripts/lib/reviewer-successor-w08-d4a.mjs')),
    );
    await execFileAsync(
      'git',
      ['branch', '-f', 'feature-chaotang-ext', candidateH],
      { cwd: temporaryRoot },
    );

    const overlay = validReviewerReassignment();
    overlay.candidateH = candidateH;
    overlay.tree = candidateTree;
    const { stdout: overlayPackageSource } = await execFileAsync(
      '/usr/bin/git',
      [
        '--no-replace-objects',
        '-c',
        'core.attributesFile=/dev/null',
        'diff',
        '--no-ext-diff',
        '--no-textconv',
        '--binary',
        `${overlay.baseH}..${overlay.candidateH}`,
      ],
      {
        cwd: temporaryRoot,
        encoding: 'buffer',
        env: {
          ...hardenedGitEnvironment,
          GIT_ATTR_SOURCE: overlay.candidateH,
        },
      },
    );
    overlay.reviewPackageSha256 = sha256Hex(overlayPackageSource);
    await writeRepositoryFile(
      temporaryRoot,
      overlay.reviewPackagePath,
      overlayPackageSource,
    );

    const reviewSources = overlay.reviews.map((review, index) =>
      reviewerReassignmentEvidenceDocument({
        schemaVersion: 'reviewer-reassignment-evidence.v1',
        kind: 'codex-independent-review',
        pass: index + 1,
        sessionId: review.sessionId,
        reviewer: 'Codex Independent QA',
        rejectedSessionIds: overlay.rejectedSessionIds,
        scope: overlay.scope,
        baseH: overlay.baseH,
        candidateH: overlay.candidateH,
        tree: overlay.tree,
        reviewPackagePath: overlay.reviewPackagePath,
        reviewPackageSha256: overlay.reviewPackageSha256,
        verdict: 'GO',
        high: 0,
        medium: 0,
        writeAccess: 'DENIED',
        writingSessionId: overlay.writingSessionId,
        candidateMutated: false,
      }),
    );
    for (let index = 0; index < overlay.reviews.length; index += 1) {
      overlay.reviews[index].sha256 = sha256Hex(reviewSources[index]);
      await writeRepositoryFile(
        temporaryRoot,
        overlay.reviews[index].path,
        reviewSources[index],
      );
    }
    const overlayOwnerSource = reviewerReassignmentEvidenceDocument({
      schemaVersion: 'reviewer-reassignment-evidence.v1',
      kind: 'owner-approval',
      decision: 'APPROVED',
      approver: 'lyt',
      scope: overlay.scope,
      baseH: overlay.baseH,
      candidateH: overlay.candidateH,
      tree: overlay.tree,
      reviewPackagePath: overlay.reviewPackagePath,
      reviewPackageSha256: overlay.reviewPackageSha256,
      rejectedSessionIds: overlay.rejectedSessionIds,
      writingSessionId: overlay.writingSessionId,
      reviews: overlay.reviews.map(({ path, sessionId, sha256 }) => ({
        path,
        sessionId,
        sha256,
      })),
    });
    overlay.ownerApprovalSha256 = sha256Hex(overlayOwnerSource);
    await writeRepositoryFile(
      temporaryRoot,
      overlay.ownerApprovalPath,
      overlayOwnerSource,
    );

    const governance = validGovernance();
    governance.reviewerReassignment = overlay;
    await writeRepositoryFile(
      temporaryRoot,
      '.harness/manifest/project-harness.json',
      `${JSON.stringify({ amendmentGovernance: governance }, null, 2)}\n`,
    );
    await execFileAsync('git', ['add', '.'], { cwd: temporaryRoot });
    await execFileAsync('git', ['commit', '-qm', 'register reviewer overlay'], {
      cwd: temporaryRoot,
    });

    const fixture = w07EvidenceDocuments();
    fixture.manifest.approvalEvidence.candidateH = candidateH;
    fixture.manifest.approvalEvidence.tree = candidateTree;
    fixture.manifest.effectiveBase.sha = candidateH;
    fixture.owner.candidateH = candidateH;
    fixture.owner.tree = candidateTree;
    fixture.owner.effectiveBase.sha = candidateH;
    fixture.review.candidateH = candidateH;
    fixture.review.tree = candidateTree;
    fixture.review.effectiveBase.sha = candidateH;
    fixture.activationIntent.approvalEvidence.candidateH = candidateH;
    fixture.activationIntent.approvalEvidence.tree = candidateTree;
    fixture.activationIntent.effectiveBase.sha = candidateH;
    const { stdout: exactPackageSource } = await execFileAsync(
      '/usr/bin/git',
      [
        '--no-replace-objects',
        '-c',
        'core.attributesFile=/dev/null',
        'diff',
        '--no-ext-diff',
        '--no-textconv',
        '--binary',
        `b0df777a1fe94d98afdc62b4cdd02a2f8a091391..${candidateH}`,
      ],
      {
        cwd: temporaryRoot,
        encoding: 'buffer',
        env: {
          ...hardenedGitEnvironment,
          GIT_ATTR_SOURCE: candidateH,
        },
      },
    );
    fixture.review.changedPaths =
      parseExecutionAuthorityV2ReviewPackage(exactPackageSource.toString('utf8'));

    async function writeActivation(packageSource) {
      fixture.activationIntent.reviewPackageSha256 = sha256Hex(packageSource);
      fixture.review.diffSha256 = sha256Hex(packageSource);
      const intentSource = `${JSON.stringify(fixture.activationIntent, null, 2)}\n`;
      fixture.owner.activationIntentSha256 = sha256Hex(intentSource);
      const ownerSource = evidenceDocument(fixture.owner);
      fixture.review.ownerApprovalSha256 = sha256Hex(ownerSource);
      fixture.review.activationIntentSha256 = fixture.owner.activationIntentSha256;
      const reviewSource = evidenceDocument(fixture.review);
      fixture.manifest.approvalEvidence.ownerApprovalSha256 = sha256Hex(ownerSource);
      fixture.manifest.approvalEvidence.reviewSha256 = sha256Hex(reviewSource);
      for (const [path, source] of [
        [fixture.manifest.approvalEvidence.ownerApprovalPath, ownerSource],
        [fixture.manifest.approvalEvidence.reviewPath, reviewSource],
        [fixture.owner.activationIntentPath, intentSource],
        [fixture.review.reviewPackagePath, packageSource],
        [EXECUTION_AUTHORITY_V2_PATH, `${JSON.stringify(fixture.manifest, null, 2)}\n`],
      ]) {
        await writeRepositoryFile(temporaryRoot, path, source);
      }
    }

    await writeActivation(reviewPackageForPaths(fixture.review.changedPaths));
    await execFileAsync('git', ['add', '.'], { cwd: temporaryRoot });
    await execFileAsync('git', ['commit', '-qm', 'activate W07'], {
      cwd: temporaryRoot,
    });

    let loaded = await loadExecutionAuthorityV2(temporaryRoot);
    assert.ok(
      loaded.errors.some((error) =>
        error.includes('review package bytes must equal exact git diff'),
      ),
      loaded.errors.join('\n'),
    );

    await execFileAsync('git', ['reset', '--hard', 'HEAD^'], { cwd: temporaryRoot });
    await writeActivation(exactPackageSource);
    await execFileAsync('git', ['add', '.'], { cwd: temporaryRoot });
    await execFileAsync('git', ['commit', '-qm', 'activate W07 with exact package'], {
      cwd: temporaryRoot,
    });
    loaded = await loadExecutionAuthorityV2(temporaryRoot);
    assert.ok(
      loaded.errors.some((error) =>
        error.includes('active-packet EXT ref must equal pinned HEAD'),
      ),
      loaded.errors.join('\n'),
    );
    const activationH = (
      await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: temporaryRoot })
    ).stdout.trim();
    await execFileAsync(
      'git',
      ['branch', '-f', 'feature-chaotang-ext', activationH],
      { cwd: temporaryRoot },
    );
    await execFileAsync('git', ['config', '--local', 'diff.noprefix', 'true'], {
      cwd: temporaryRoot,
    });
    loaded = await loadExecutionAuthorityV2(temporaryRoot);
    assert.ok(
      loaded.errors.some((error) =>
        error.includes(
          'reviewerReassignment: repository-local Git config affects authority diff',
        ),
      ),
      loaded.errors.join('\n'),
    );
    assert.ok(
      loaded.errors.some((error) =>
        error.includes(
          'active-packet: repository-local Git config affects authority diff',
        ),
      ),
      loaded.errors.join('\n'),
    );
    await execFileAsync('git', ['config', '--local', '--unset', 'diff.noprefix'], {
      cwd: temporaryRoot,
    });
    await execFileAsync(
      'git',
      ['config', '--local', 'extensions.worktreeConfig', 'true'],
      { cwd: temporaryRoot },
    );
    await execFileAsync(
      'git',
      ['config', '--worktree', 'diff.context', '0'],
      { cwd: temporaryRoot },
    );
    loaded = await loadExecutionAuthorityV2(temporaryRoot);
    assert.ok(
      loaded.errors.some((error) =>
        error.includes(
          'reviewerReassignment: repository-local Git config affects authority diff: extensions.worktreeconfig',
        ),
      ),
      loaded.errors.join('\n'),
    );
    assert.ok(
      loaded.errors.some((error) =>
        error.includes(
          'active-packet: repository-local Git config affects authority diff: extensions.worktreeconfig',
        ),
      ),
      loaded.errors.join('\n'),
    );
    await execFileAsync('git', ['config', '--worktree', '--unset', 'diff.context'], {
      cwd: temporaryRoot,
    });
    await execFileAsync(
      'git',
      ['config', '--local', '--unset', 'extensions.worktreeConfig'],
      { cwd: temporaryRoot },
    );
    const externalAttributesRoot = join(temporaryParent, 'xdg');
    await writeRepositoryFile(
      externalAttributesRoot,
      'git/attributes',
      '*.mjs -diff\n',
    );
    const previousXdgConfigHome = process.env.XDG_CONFIG_HOME;
    process.env.XDG_CONFIG_HOME = externalAttributesRoot;
    try {
      loaded = await loadExecutionAuthorityV2(temporaryRoot);
      assert.deepEqual(loaded.errors, []);
    } finally {
      if (previousXdgConfigHome === undefined) {
        delete process.env.XDG_CONFIG_HOME;
      } else {
        process.env.XDG_CONFIG_HOME = previousXdgConfigHome;
      }
    }
    await writeRepositoryFile(
      temporaryRoot,
      '.gitattributes',
      '*.mjs -diff\n',
    );
    loaded = await loadExecutionAuthorityV2(temporaryRoot);
    assert.deepEqual(loaded.errors, []);
    await rm(join(temporaryRoot, '.gitattributes'));
    await writeRepositoryFile(
      temporaryRoot,
      '.git/info/attributes',
      '*.mjs -diff\n',
    );
    loaded = await loadExecutionAuthorityV2(temporaryRoot);
    assert.ok(
      loaded.errors.some((error) =>
        error.includes(
          'reviewerReassignment: Git info attributes affect authority diff',
        ),
      ),
      loaded.errors.join('\n'),
    );
    assert.ok(
      loaded.errors.some((error) =>
        error.includes('active-packet: Git info attributes affect authority diff'),
      ),
      loaded.errors.join('\n'),
    );
    await rm(join(temporaryRoot, '.git/info/attributes'));
    loaded = await loadExecutionAuthorityV2(temporaryRoot);
    assert.deepEqual(loaded.errors, []);
    const alternateObjectsRoot = join(temporaryParent, 'alternate-objects');
    await mkdir(alternateObjectsRoot, { recursive: true });
    await writeRepositoryFile(
      temporaryRoot,
      '.git/objects/info/alternates',
      `${alternateObjectsRoot}\n`,
    );
    loaded = await loadExecutionAuthorityV2(temporaryRoot);
    assert.ok(
      loaded.errors.some((error) =>
        error.includes('reviewerReassignment: Git object alternates are forbidden'),
      ),
      loaded.errors.join('\n'),
    );
    assert.ok(
      loaded.errors.some((error) =>
        error.includes('active-packet: Git object alternates are forbidden'),
      ),
      loaded.errors.join('\n'),
    );
    await rm(join(temporaryRoot, '.git/objects/info/alternates'));
    await writeRepositoryFile(
      temporaryRoot,
      '.git/objects/pack/pack-untrusted.promisor',
      '',
    );
    loaded = await loadExecutionAuthorityV2(temporaryRoot);
    assert.ok(
      loaded.errors.some((error) =>
        error.includes('reviewerReassignment: Git promisor pack markers are forbidden'),
      ),
      loaded.errors.join('\n'),
    );
    assert.ok(
      loaded.errors.some((error) =>
        error.includes('active-packet: Git promisor pack markers are forbidden'),
      ),
      loaded.errors.join('\n'),
    );
    await rm(
      join(temporaryRoot, '.git/objects/pack/pack-untrusted.promisor'),
    );
    const { stdout: trustedBlobSource } = await execFileAsync(
      'git',
      ['rev-parse', `HEAD:scripts/lib/execution-authority-v2.mjs`],
      { cwd: temporaryRoot },
    );
    const trustedBlobH = trustedBlobSource.trim();
    const trustedBlobPath = join(
      temporaryRoot,
      '.git',
      'objects',
      trustedBlobH.slice(0, 2),
      trustedBlobH.slice(2),
    );
    let originalLooseObject = null;
    let originalLooseObjectMode = null;
    try {
      originalLooseObject = await readFile(trustedBlobPath);
      originalLooseObjectMode = (await stat(trustedBlobPath)).mode & 0o777;
    } catch (cause) {
      if (cause.code !== 'ENOENT') throw cause;
    }
    const forgedBlob = Buffer.from('forged authority bytes\n');
    await mkdir(dirname(trustedBlobPath), { recursive: true });
    if (originalLooseObject !== null) {
      await chmod(trustedBlobPath, 0o600);
    }
    await writeFile(
      trustedBlobPath,
      deflateSync(
        Buffer.concat([
          Buffer.from(`blob ${forgedBlob.length}\0`),
          forgedBlob,
        ]),
      ),
    );
    loaded = await loadExecutionAuthorityV2(temporaryRoot);
    assert.ok(
      loaded.errors.some((error) =>
        error.includes('active-packet Git object database integrity failure'),
      ),
      loaded.errors.join('\n'),
    );
    if (originalLooseObject === null) {
      await rm(trustedBlobPath);
    } else {
      await writeFile(trustedBlobPath, originalLooseObject);
      await chmod(trustedBlobPath, originalLooseObjectMode);
    }
    loaded = await loadExecutionAuthorityV2(temporaryRoot);
    assert.deepEqual(loaded.errors, []);
    const synchronousBypass = executionAuthorityV2CommandResult(
      loaded,
      '--authorize',
      [],
      { workPackage: 'R0-W07' },
    );
    assert.equal(
      synchronousBypass.output.reason,
      'POLICY_ELIGIBLE',
    );
    assert.equal(synchronousBypass.output.decision, 'ELIGIBLE');
    const { stdout: cliOutput } = await execFileAsync(
      process.execPath,
      [
        join(temporaryRoot, 'scripts/execution-authority-v2.mjs'),
        '--authorize',
        '--work-package',
        'R0-W07',
      ],
      { cwd: temporaryRoot },
    );
    const result = JSON.parse(cliOutput);
    assert.equal(result.decision, 'GO');
    assert.equal(result.reason, 'APPROVED_WORK_PACKAGE');

    const committedManifest = structuredClone(fixture.manifest);
    const workingManifest = structuredClone(fixture.manifest);
    workingManifest.activeWorkPackage = null;
    workingManifest.workPackageLedger =
      workingManifest.workPackageLedger.map((entry) =>
        entry.id === 'R0-W07'
          ? { ...entry, status: 'NOT_STARTED' }
          : entry
      );
    await writeRepositoryFile(
      temporaryRoot,
      EXECUTION_AUTHORITY_V2_PATH,
      `${JSON.stringify(workingManifest, null, 2)}\n`,
    );
    loaded = await loadExecutionAuthorityV2(temporaryRoot);
    assert.deepEqual(
      loaded.manifest,
      committedManifest,
      'authority facts must come from the pinned HEAD blob, not mutable working bytes',
    );
    assert.ok(
      loaded.errors.some((error) =>
        error.includes('working tree differs from pinned authority commit'),
      ),
      loaded.errors.join('\n'),
    );
    await writeRepositoryFile(
      temporaryRoot,
      overlay.reviews[0].path,
      'tampered mutable reviewer evidence\n',
    );
    loaded = await loadExecutionAuthorityV2(temporaryRoot);
    assert.ok(
      loaded.errors.some((error) =>
        error.includes('working tree differs from pinned authority commit'),
      ),
      loaded.errors.join('\n'),
    );
    assert.equal(
      loaded.errors.some((error) =>
        error.includes('reviewerReassignment.reviews[0].path: digest mismatch'),
      ),
      false,
      'reviewer evidence must be parsed from the pinned commit, not mutable working bytes',
    );
    await writeRepositoryFile(
      temporaryRoot,
      overlay.reviews[0].path,
      reviewSources[0],
    );
    await writeRepositoryFile(
      temporaryRoot,
      EXECUTION_AUTHORITY_V2_PATH,
      `${JSON.stringify(committedManifest, null, 2)}\n`,
    );

    await execFileAsync(
      'git',
      [
        'branch',
        '-f',
        'feature-chaotang-ext',
        '55caf0d176cd6a1bbb833ffd1872ea3f1d8a46ca',
      ],
      { cwd: temporaryRoot },
    );
    loaded = await loadExecutionAuthorityV2(temporaryRoot);
    assert.ok(
      loaded.errors.some((error) =>
        error.includes('active-packet EXT ref must equal pinned HEAD'),
      ),
      loaded.errors.join('\n'),
    );

    await execFileAsync(
      'git',
      [
        'checkout',
        '-q',
        '--detach',
        'b0df777a1fe94d98afdc62b4cdd02a2f8a091391',
      ],
      { cwd: temporaryRoot },
    );
    await execFileAsync(
      'git',
      ['merge', '-q', '--no-ff', '-s', 'ours', activationH, '-m', 'hide activation on second parent'],
      { cwd: temporaryRoot },
    );
    await execFileAsync('git', ['checkout', activationH, '--', '.'], {
      cwd: temporaryRoot,
    });
    await execFileAsync('git', ['commit', '-qam', 'replay active authority'], {
      cwd: temporaryRoot,
    });
    const replayH = (
      await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: temporaryRoot })
    ).stdout.trim();
    await execFileAsync(
      'git',
      ['branch', '-f', 'feature-chaotang-ext', replayH],
      { cwd: temporaryRoot },
    );
    loaded = await loadExecutionAuthorityV2(temporaryRoot);
    assert.ok(
      loaded.errors.some((error) =>
        error.includes(
          'active-packet candidateH must be a first-parent ancestor of pinned HEAD',
        ),
      ),
      loaded.errors.join('\n'),
    );
  } finally {
    await rm(temporaryParent, { recursive: true, force: true });
  }
});

test('W07 evidence cannot reuse the historical W06 activation packet', () => {
  const { manifest, owner, review } = w07EvidenceDocuments();
  const governance = validGovernance();
  governance.reviewerReassignment = validReviewerReassignment();
  owner.activationIntentPath =
    '.harness/changes/fix-ext-g0-authority-recovery-20260725/activation_intent/r0-w06-activation-intent.json';
  review.activationIntentPath = owner.activationIntentPath;
  const errors = validateExecutionAuthorityV2Evidence(
    manifest,
    governance,
    owner,
    review,
  );
  assert.ok(errors.some((error) => error.includes('active-packet profile')));
});

test('W07 evidence rejects the legacy W07 root and mixed-root identities', () => {
  const legacyRoot = '.harness/changes/docs-r0-w07-activation-20260726';
  const governance = validGovernance();
  governance.reviewerReassignment = validReviewerReassignment();

  const legacy = w07EvidenceDocuments();
  legacy.manifest.approvalEvidence.ownerApprovalPath =
    `${legacyRoot}/owner_approval/exact-h-approval.md`;
  legacy.manifest.approvalEvidence.reviewPath =
    `${legacyRoot}/codex_review/exact-h-final.md`;
  legacy.owner.activationIntentPath =
    `${legacyRoot}/activation_intent/r0-w07-activation-intent.json`;
  legacy.review.ownerApprovalPath =
    legacy.manifest.approvalEvidence.ownerApprovalPath;
  legacy.review.activationIntentPath = legacy.owner.activationIntentPath;
  legacy.review.reviewPackagePath =
    `${legacyRoot}/review_inputs/activation-candidate.diff`;
  assert.ok(
    validateExecutionAuthorityV2Evidence(
      legacy.manifest,
      governance,
      legacy.owner,
      legacy.review,
    ).some((error) => error.includes('active-packet profile')),
  );

  const mixed = w07EvidenceDocuments();
  mixed.owner.activationIntentPath =
    `${legacyRoot}/activation_intent/r0-w07-activation-intent.json`;
  mixed.review.activationIntentPath = mixed.owner.activationIntentPath;
  assert.ok(
    validateExecutionAuthorityV2Evidence(
      mixed.manifest,
      governance,
      mixed.owner,
      mixed.review,
    ).some((error) =>
      error.includes('owner activationIntentPath must match active-packet profile'),
    ),
  );
});

test('W07 profile accepts every path in the exact Event 1 candidate', () => {
  const fixture = w07EvidenceDocuments();
  const governance = validGovernance();
  governance.reviewerReassignment = validReviewerReassignment();
  fixture.review.changedPaths = [...W07_EVENT1_CHANGED_PATHS];
  assert.deepEqual(
    validateExecutionAuthorityV2Evidence(
      fixture.manifest,
      governance,
      fixture.owner,
      fixture.review,
    ),
    [],
  );
});

test('W07 profile rejects paths outside the exact Event 1 candidate', () => {
  const fixture = w07EvidenceDocuments();
  const governance = validGovernance();
  governance.reviewerReassignment = validReviewerReassignment();
  fixture.review.changedPaths.push(
    '.harness/changes/docs-r0-w07-exact-h-activation-b0df777a-20260727/owner_approval/exact-h-approval.md',
  );

  assert.ok(
    validateExecutionAuthorityV2Evidence(
      fixture.manifest,
      governance,
      fixture.owner,
      fixture.review,
    ).some((error) =>
      error.includes('review changedPaths must exactly match the Event 1 candidate'),
    ),
  );
});

test('W08 profile accepts the professional reassignment candidate path set', () => {
  const fixture = w08EvidenceDocuments();
  const governance = validGovernance();
  governance.reviewerSuccessorW08 = validReviewerSuccessorW08();
  assert.deepEqual(
    validateExecutionAuthorityV2Evidence(
      fixture.manifest,
      governance,
      fixture.owner,
      fixture.review,
    ),
    [],
  );
});

test('D4A execution evidence rejects candidate identity split from the reviewer successor product', () => {
  const fixture = w08EvidenceDocuments();
  const governance = validGovernance();
  governance.reviewerSuccessorW08D4A = d4aProductBinding();
  const errors = validateExecutionAuthorityV2Evidence(
    fixture.manifest,
    governance,
    fixture.owner,
    fixture.review,
  );
  assert.ok(errors.some((error) => error.includes('manifest candidateH')));
  assert.ok(errors.some((error) => error.includes('manifest tree')));
  assert.ok(errors.some((error) => error.includes('review diff')));
});

test('D4A activation intent binds the reviewer successor product package digest', () => {
  const fixture = w08EvidenceDocuments();
  const governance = validGovernance();
  governance.reviewerSuccessorW08D4A = d4aProductBinding();
  const errors = validateExecutionAuthorityV2ActivationIntent(
    fixture.manifest,
    fixture.activationIntent,
    governance,
  );
  assert.ok(errors.some((error) => error.includes('activation intent package')));
  assert.ok(errors.some((error) => error.includes('activation intent digest')));
});

test('active temporary root authorizes only after loading the exact independent review and activation intent', async () => {
  const { temporaryRoot } = await createActiveAuthorityFixture();
  try {
    const loaded = await loadExecutionAuthorityV2(temporaryRoot);
    assert.deepEqual(loaded.errors, []);
    assert.equal(
      evaluateExecutionAuthorityV2Policy(
        loaded.manifest,
        loaded.amendmentGovernance,
        { workPackage: 'R0-W06' },
      ).decision,
      'ELIGIBLE',
    );
    const directResult = executionAuthorityV2CommandResult(
      loaded,
      '--authorize',
      [],
      { workPackage: 'R0-W06' },
    );
    assert.equal(directResult.exitCode, 0);
    assert.equal(
      directResult.output.reason,
      'POLICY_ELIGIBLE',
    );
    assert.equal(directResult.output.decision, 'ELIGIBLE');
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test('active authority cannot fall back to mutable files outside a Git identity', async () => {
  const { temporaryRoot } = await createActiveAuthorityFixture();
  try {
    await rm(join(temporaryRoot, '.git'), { recursive: true, force: true });
    const loaded = await loadExecutionAuthorityV2(temporaryRoot);
    assert.ok(
      loaded.errors.some((error) =>
        error.includes('root must own an exact .git identity'),
      ),
      loaded.errors.join('\n'),
    );
    const result = executionAuthorityV2CommandResult(
      loaded,
      '--authorize',
      [],
      { workPackage: 'R0-W06' },
    );
    assert.equal(result.exitCode, 1);
    assert.equal(result.output.reason, 'INVALID_EXECUTION_AUTHORITY');
    assert.ok(
      result.output.errors.some((error) =>
        error.includes('root must own an exact .git identity'),
      ),
      result.output.errors.join('\n'),
    );
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test('copied CLI nested under a parent Git repository cannot replay mutable authority', async () => {
  const temporaryParent = await mkdtemp(join(tmpdir(), 'authority-parent-replay-'));
  const temporaryRoot = join(temporaryParent, 'copied-cli');
  try {
    await createActiveAuthorityFixture({ temporaryRoot });
    for (const path of [
      'scripts/execution-authority-v2.mjs',
      'scripts/lib/amendment-governance.mjs',
      'scripts/lib/execution-authority-v2.mjs',
      'scripts/lib/reviewer-successor-w08.mjs',
      'scripts/lib/reviewer-successor-w08-d4a.mjs',
    ]) {
      await writeRepositoryFile(
        temporaryRoot,
        path,
        await readFile(join(root, path)),
      );
    }
    await rm(join(temporaryRoot, '.git'), { recursive: true, force: true });
    await execFileAsync('git', ['init', '-q'], { cwd: temporaryParent });
    await execFileAsync('git', ['config', 'user.name', 'R0 Test'], {
      cwd: temporaryParent,
    });
    await execFileAsync('git', ['config', 'user.email', 'r0@example.invalid'], {
      cwd: temporaryParent,
    });
    await execFileAsync('git', ['add', '.'], { cwd: temporaryParent });
    await execFileAsync('git', ['commit', '-qm', 'unrelated parent repository'], {
      cwd: temporaryParent,
    });
    await assert.rejects(
      execFileAsync(
        process.execPath,
        [
          join(temporaryRoot, 'scripts/execution-authority-v2.mjs'),
          '--authorize',
          '--work-package',
          'R0-W06',
        ],
        { cwd: temporaryRoot },
      ),
      (error) => {
        const output = JSON.parse(error.stdout);
        assert.equal(output.decision, 'STOP');
        assert.equal(output.reason, 'INVALID_EXECUTION_AUTHORITY');
        return true;
      },
    );
  } finally {
    await rm(temporaryParent, { recursive: true, force: true });
  }
});

test('unsupported Git object identity cannot fall back to mutable authority files', async () => {
  const { temporaryRoot, manifest } = await createActiveAuthorityFixture({
    gitObjectFormat: 'sha256',
  });
  try {
    const activeManifestSource = `${JSON.stringify(manifest, null, 2)}\n`;
    const quiescentManifest = structuredClone(manifest);
    quiescentManifest.activeWorkPackage = null;
    quiescentManifest.workPackageLedger = quiescentManifest.workPackageLedger.map(
      (entry) =>
        entry.id === 'R0-W06'
          ? { ...entry, status: 'MERGED_AND_VERIFIED' }
          : entry,
    );
    await writeRepositoryFile(
      temporaryRoot,
      EXECUTION_AUTHORITY_V2_PATH,
      `${JSON.stringify(quiescentManifest, null, 2)}\n`,
    );
    await execFileAsync('git', ['add', EXECUTION_AUTHORITY_V2_PATH], {
      cwd: temporaryRoot,
    });
    await execFileAsync('git', ['commit', '-qm', 'close W06'], {
      cwd: temporaryRoot,
    });
    await writeRepositoryFile(
      temporaryRoot,
      EXECUTION_AUTHORITY_V2_PATH,
      activeManifestSource,
    );

    const loaded = await loadExecutionAuthorityV2(temporaryRoot);
    assert.equal(
      loaded.manifest,
      null,
      'unsupported Git identity must not parse mutable authority files',
    );
    assert.equal(loaded.schema, null);
    assert.equal(loaded.amendmentGovernance, null);
    const result = executionAuthorityV2CommandResult(
      loaded,
      '--authorize',
      [],
      { workPackage: 'R0-W06' },
    );
    assert.equal(result.exitCode, 1);
    assert.equal(result.output.reason, 'INVALID_EXECUTION_AUTHORITY');
    assert.ok(
      result.output.errors.some((error) =>
        error.includes('unsupported object identity'),
      ),
      result.output.errors.join('\n'),
    );
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test('authority Git executable cannot be substituted through inherited PATH', async () => {
  const { temporaryRoot } = await createActiveAuthorityFixture();
  const wrapperRoot = await mkdtemp(join(tmpdir(), 'authority-hostile-path-'));
  const invocationMarker = join(wrapperRoot, 'invoked');
  try {
    for (const path of [
      'scripts/execution-authority-v2.mjs',
      'scripts/lib/amendment-governance.mjs',
      'scripts/lib/execution-authority-v2.mjs',
      'scripts/lib/reviewer-successor-w08.mjs',
      'scripts/lib/reviewer-successor-w08-d4a.mjs',
    ]) {
      await writeRepositoryFile(
        temporaryRoot,
        path,
        await readFile(join(root, path)),
      );
    }
    const wrapperPath = join(wrapperRoot, 'git');
    await writeFile(
      wrapperPath,
      `#!/bin/sh\nprintf invoked >> ${invocationMarker}\nexec /usr/bin/git "$@"\n`,
      'utf8',
    );
    await chmod(wrapperPath, 0o755);

    const { stdout } = await execFileAsync(
      process.execPath,
      [
        join(temporaryRoot, 'scripts/execution-authority-v2.mjs'),
        '--authorize',
        '--work-package',
        'R0-W06',
      ],
      {
        cwd: temporaryRoot,
        env: {
          ...process.env,
          PATH: `${wrapperRoot}:${process.env.PATH}`,
        },
      },
    );
    assert.equal(JSON.parse(stdout).decision, 'GO');
    await assert.rejects(
      readFile(invocationMarker),
      (error) => error.code === 'ENOENT',
    );
  } finally {
    await rm(wrapperRoot, { recursive: true, force: true });
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test('authority Git commands disable the mutable commit-graph acceleration', async () => {
  for (const path of [
    'scripts/lib/amendment-governance.mjs',
    'scripts/lib/execution-authority-v2.mjs',
    'scripts/lib/reviewer-successor-w08.mjs',
  ]) {
    const source = await readFile(join(root, path), 'utf8');
    assert.match(source, /'core\.commitGraph=false'/u);
  }
});

test('authority rejects HTTP alternates, promisor configuration, and promisor pack markers', async () => {
  const temporaryParent = await mkdtemp(
    join(tmpdir(), 'chaotang-v2-git-metadata-'),
  );
  const temporaryRoot = join(temporaryParent, 'repo');
  try {
    await mkdir(temporaryRoot);
    await execFileAsync('git', ['init', '-q'], { cwd: temporaryRoot });
    await writeRepositoryFile(
      temporaryRoot,
      '.git/objects/info/http-alternates',
      'https://example.invalid/objects\n',
    );
    await writeRepositoryFile(
      temporaryRoot,
      '.git/objects/pack/pack-untrusted.promisor',
      '',
    );
    await execFileAsync(
      'git',
      ['config', '--local', 'remote.origin.promisor', 'true'],
      { cwd: temporaryRoot },
    );
    await execFileAsync(
      'git',
      ['config', '--local', 'remote.origin.partialCloneFilter', 'blob:none'],
      { cwd: temporaryRoot },
    );
    await execFileAsync(
      'git',
      ['config', '--local', 'fsck.missingEmail', 'ignore'],
      { cwd: temporaryRoot },
    );

    const errors = await verifyRepositoryLocalGitDiffEnvironment(
      temporaryRoot,
      'test-authority',
    );
    assert.ok(
      errors.some((error) =>
        error.includes('Git HTTP object alternates are forbidden'),
      ),
      errors.join('\n'),
    );
    assert.ok(
      errors.some((error) =>
        error.includes('Git promisor pack markers are forbidden'),
      ),
      errors.join('\n'),
    );
    assert.ok(
      errors.some((error) => error.includes('remote.origin.promisor')),
      errors.join('\n'),
    );
    assert.ok(
      errors.some((error) =>
        error.includes('remote.origin.partialclonefilter'),
      ),
      errors.join('\n'),
    );
    assert.ok(
      errors.some((error) => error.includes('fsck.missingemail')),
      errors.join('\n'),
    );

    const externalObjects = join(temporaryParent, 'external-objects');
    await rename(join(temporaryRoot, '.git/objects'), externalObjects);
    await symlink(externalObjects, join(temporaryRoot, '.git/objects'), 'dir');
    const symlinkErrors = await verifyRepositoryLocalGitDiffEnvironment(
      temporaryRoot,
      'test-authority',
    );
    assert.ok(
      symlinkErrors.some((error) =>
        error.includes('Git object database symbolic links are forbidden'),
      ),
      symlinkErrors.join('\n'),
    );
  } finally {
    await rm(temporaryParent, { recursive: true, force: true });
  }
});

test('active temporary root fails closed when canonical amendment bytes drift', async () => {
  const { temporaryRoot, manifest } = await createActiveAuthorityFixture();
  try {
    await writeRepositoryFile(
      temporaryRoot,
      manifest.amendment.path,
      'drifted canonical amendment\n',
    );
    await execFileAsync('git', ['add', '.'], { cwd: temporaryRoot });
    await execFileAsync('git', ['commit', '-qm', 'drift canonical amendment'], {
      cwd: temporaryRoot,
    });
    const loaded = await loadExecutionAuthorityV2(temporaryRoot);
    assert.ok(
      loaded.errors.some((error) =>
        error.includes('amendment approvedSourceDigest: digest mismatch'),
      ),
      loaded.errors.join('\n'),
    );
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test('inactive W07 reviewer reassignment cannot invalidate active W06 authority', async () => {
  const { temporaryRoot } = await createActiveAuthorityFixture();
  try {
    const governance = validGovernance();
    governance.reviewerReassignment = validReviewerReassignment();
    governance.reviewerReassignment.scope = ['R0-W08'];
    await writeRepositoryFile(
      temporaryRoot,
      '.harness/manifest/project-harness.json',
      `${JSON.stringify({ amendmentGovernance: governance }, null, 2)}\n`,
    );
    await execFileAsync('git', ['add', '.'], { cwd: temporaryRoot });
    await execFileAsync('git', ['commit', '-qm', 'inactive W07 overlay'], {
      cwd: temporaryRoot,
    });
    const loaded = await loadExecutionAuthorityV2(temporaryRoot);
    assert.deepEqual(loaded.errors, []);
    assert.equal(
      evaluateExecutionAuthorityV2Policy(
        loaded.manifest,
        loaded.amendmentGovernance,
        { workPackage: 'R0-W06' },
      ).decision,
      'ELIGIBLE',
    );
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

for (const {
  name,
  options,
  expectedError,
} of [
  {
    name: 'owner self-review',
    options: { mutateReview: (review) => { review.reviewer = 'lyt'; } },
    expectedError: 'reviewer must differ from manifest approvalEvidence.approver',
  },
  {
    name: 'nonexistent activation intent',
    options: {
      mutateOwner: (owner) => {
        owner.activationIntentPath = '.harness/changes/missing/activation-intent.json';
      },
      writeIntent: false,
    },
    expectedError: 'unavailable from pinned authority commit',
  },
  {
    name: 'fabricated activation intent digest',
    options: { activationIntentDigest: 'f'.repeat(64) },
    expectedError: 'activationIntentPath: digest mismatch',
  },
  {
    name: 'mismatched activation intent identity',
    options: {
      mutateIntent: (intent) => {
        intent.approvalEvidence.tree = '1'.repeat(40);
      },
    },
    expectedError: 'activation intent tree must match manifest approvalEvidence.tree',
  },
  {
    name: 'mismatched activation intent evidence path',
    options: {
      mutateIntent: (intent) => {
        intent.approvalEvidence.reviewPath = '.harness/changes/other/claude_code_review/exact-h-final.md';
      },
    },
    expectedError: 'activation intent reviewPath must match manifest approvalEvidence.reviewPath',
  },
  {
    name: 'unknown activation intent key',
    options: { mutateIntent: (intent) => { intent.unknown = true; } },
    expectedError: 'activation intent has missing or unsupported fields',
  },
  {
    name: 'arbitrary review metadata',
    options: {
      mutateReview: (review) => {
        review.changedPaths = ['README.md'];
        review.commands = ['false'];
      },
    },
    expectedError: 'review changedPaths must stay within the authority review allowlist',
  },
  {
    name: 'partial review changed paths',
    options: {
      mutateReview: (review) => {
        review.changedPaths = ['scripts/lib/execution-authority-v2.mjs'];
      },
    },
    expectedError: 'review changedPaths must exactly match the review package path set',
  },
  {
    name: 'extra review changed paths',
    options: {
      mutateReview: (review) => {
        review.changedPaths.push('scripts/execution-authority.nodetest.mjs');
      },
    },
    expectedError: 'review changedPaths must exactly match the review package path set',
  },
  {
    name: 'fabricated review package digest',
    options: { reviewPackageDigest: 'f'.repeat(64) },
    expectedError: 'reviewPackagePath: digest mismatch',
  },
  {
    name: 'missing review package',
    options: { writeReviewPackage: false },
    expectedError: 'active execution authority requires a readable review package',
  },
  {
    name: 'unsafe review package diff header',
    options: {
      reviewPackageSource:
        'diff --git a/../outside b/../outside\n--- a/../outside\n+++ b/../outside\n',
    },
    expectedError: 'review package: unsafe diff path',
  },
  {
    name: 'duplicate review package diff header',
    options: {
      reviewPackageSource: reviewPackageForPaths([
        'scripts/lib/execution-authority-v2.mjs',
        'scripts/lib/execution-authority-v2.mjs',
      ]),
    },
    expectedError: 'review package: duplicate diff path',
  },
  {
    name: 'false review verification command metadata',
    options: { mutateReview: (review) => { review.commands = ['false']; } },
    expectedError: 'review commands must exactly match the required authority verification commands',
  },
]) {
  test(`active temporary root fails closed for ${name}`, async () => {
    const { temporaryRoot } = await createActiveAuthorityFixture(options);
    try {
      const loaded = await loadExecutionAuthorityV2(temporaryRoot);
      assert.ok(loaded.errors.some((error) => error.includes(expectedError)), loaded.errors.join('\n'));
      const result = executionAuthorityV2CommandResult(loaded, '--authorize', [], {
        workPackage: 'R0-W06',
      });
      assert.equal(result.exitCode, 1);
      assert.equal(result.output.reason, 'INVALID_EXECUTION_AUTHORITY');
    } finally {
      await rm(temporaryRoot, { recursive: true, force: true });
    }
  });
}

for (const {
  name,
  mutate,
  expectedError,
} of [
  {
    name: 'old-package review reuse',
    mutate: ({ review }) => {
      review.workPackage = 'R0-W05';
      review.approvedScope = ['R0-W05'];
    },
    expectedError: 'review workPackage must match activeWorkPackage',
  },
  {
    name: 'negative owner decision',
    mutate: ({ owner }) => {
      owner.decision = 'DECLINED';
    },
    expectedError: 'owner decision must be APPROVED',
  },
  {
    name: 'candidate and tree mismatch',
    mutate: ({ review }) => {
      review.candidateH = '1'.repeat(40);
      review.tree = '2'.repeat(40);
    },
    expectedError: 'review candidateH must match manifest approvalEvidence.candidateH',
  },
  {
    name: 'owner digest mismatch',
    mutate: ({ review }) => {
      review.ownerApprovalSha256 = 'e'.repeat(64);
    },
    expectedError: 'review ownerApprovalSha256 must match manifest approvalEvidence.ownerApprovalSha256',
  },
  {
    name: 'owner self-review',
    mutate: ({ review }) => {
      review.reviewer = 'lyt';
    },
    expectedError: 'reviewer must match amendmentGovernance.independentReviewer',
  },
  {
    name: 'review verdict mismatch',
    mutate: ({ review }) => {
      review.verdict = 'NO_GO';
    },
    expectedError: 'review verdict must match manifest approvalEvidence.reviewVerdict',
  },
  {
    name: 'non-string review changed path',
    mutate: ({ review }) => {
      review.changedPaths = [42];
    },
    expectedError: 'review changedPaths must be a non-empty list of safe repository paths',
  },
]) {
  test(`${name} evidence fails closed and cannot produce GO`, () => {
    const fixture = w06EvidenceDocuments();
    mutate(fixture);
    const parsedOwner = parseExecutionAuthorityV2Evidence(
      evidenceDocument(fixture.owner),
      'owner approval',
    );
    const parsedReview = parseExecutionAuthorityV2Evidence(
      evidenceDocument(fixture.review),
      'independent review',
    );
    const errors = validateExecutionAuthorityV2Evidence(
      fixture.manifest,
      validGovernance(),
      parsedOwner,
      parsedReview,
    );
    assert.ok(errors.some((error) => error.includes(expectedError)), errors.join('\n'));
    const result = executionAuthorityV2CommandResult(
      { manifest: fixture.manifest, amendmentGovernance: validGovernance(), errors },
      '--authorize',
      [],
      { workPackage: 'R0-W06' },
    );
    assert.equal(result.exitCode, 1);
    assert.equal(result.output.reason, 'INVALID_EXECUTION_AUTHORITY');
  });
}

test('valid W01 manifest is policy-eligible for exactly the active work package', () => {
  assert.deepEqual(
    evaluateExecutionAuthorityV2Policy(validManifest(), validGovernance(), { workPackage: 'R0-W01' }),
    {
      schemaVersion: 'execution-authority.v2',
      decision: 'ELIGIBLE',
      activeWorkPackage: 'R0-W01',
      reason: 'POLICY_ELIGIBLE',
    },
  );
});

test('malformed approvedSourceDigest is a structural error', () => {
  const manifest = { ...validManifest(), amendment: { ...validManifest().amendment, approvedSourceDigest: 'not-hex' } };
  assert.equal(
    evaluateExecutionAuthorityV2Policy(manifest, validGovernance(), { workPackage: 'R0-W01' }).reason,
    'INVALID_EXECUTION_AUTHORITY',
  );
});

test('well-formed but mismatched approvedSourceDigest stops on digest drift', () => {
  const governance = { ...validGovernance(), approvedSourceDigest: 'a'.repeat(64) };
  assert.equal(
    evaluateExecutionAuthorityV2Policy(validManifest(), governance, { workPackage: 'R0-W01' }).reason,
    'AMENDMENT_DIGEST_DRIFT',
  );
});

test('effective base mismatch stops the resolver when it drifts from the approved candidate', () => {
  const manifest = {
    ...validManifest(),
    effectiveBase: { ref: 'origin/feature-chaotang-ext', sha: 'b'.repeat(40) },
  };
  assert.equal(
    evaluateExecutionAuthorityV2Policy(manifest, validGovernance(), { workPackage: 'R0-W01' }).reason,
    'EFFECTIVE_BASE_MISMATCH',
  );
});

test('schema and manifest permit only origin refs or the exact local EXT ref', async () => {
  const schema = JSON.parse(
    await readFile(join(root, EXECUTION_AUTHORITY_V2_SCHEMA_PATH), 'utf8'),
  );
  const pattern = new RegExp(schema.properties.effectiveBase.properties.ref.pattern);
  assert.equal(pattern.test('origin/feature-chaotang-ext'), true);
  assert.equal(pattern.test('refs/heads/feature-chaotang-ext'), true);
  assert.equal(pattern.test('refs/heads/other'), false);

  const manifest = w07EvidenceDocuments().manifest;
  assert.deepEqual(validateExecutionAuthorityV2Manifest(manifest), []);
  manifest.effectiveBase.ref = 'refs/heads/other';
  assert.ok(
    validateExecutionAuthorityV2Manifest(manifest).some((error) =>
      error.includes('effectiveBase.ref'),
    ),
  );
});

test('two ACTIVE ledger entries is rejected before resolution', () => {
  const manifest = {
    ...validManifest(),
    workPackageLedger: [
      { id: 'R0-W00', status: 'ACTIVE' },
      { id: 'R0-W01', status: 'ACTIVE' },
    ],
  };
  const errors = validateExecutionAuthorityV2Manifest(manifest);
  assert.ok(errors.some((message) => message.includes('two ACTIVE entries')));
  assert.equal(
    evaluateExecutionAuthorityV2Policy(manifest, validGovernance(), { workPackage: 'R0-W01' }).reason,
    'INVALID_EXECUTION_AUTHORITY',
  );
});

test('activeWorkPackage drifting from the ledger ACTIVE entry is a structural error', () => {
  const manifest = { ...validManifest(), activeWorkPackage: 'R0-W02' };
  assert.ok(
    validateExecutionAuthorityV2Manifest(manifest).some((message) =>
      message.includes('does not match the ledger ACTIVE entry'),
    ),
  );
});

for (const badId of ['P12', 'PKT-04', 'S3']) {
  test(`legacy work package id ${badId} is rejected by format`, () => {
    assert.equal(
      evaluateExecutionAuthorityV2Policy(validManifest(), validGovernance(), { workPackage: badId })
        .reason,
      'UNKNOWN_WORK_PACKAGE_FORMAT',
    );
  });
}

test('requesting a successor package before its predecessor merges is blocked', () => {
  assert.equal(
    evaluateExecutionAuthorityV2Policy(validManifest(), validGovernance(), { workPackage: 'R0-W02' })
      .reason,
    'BLOCKED_DEPENDENCY',
  );
});

test('W01 itself is blocked if W00 is not yet MERGED_AND_VERIFIED', () => {
  const manifest = {
    ...validManifest(),
    workPackageLedger: [
      { id: 'R0-W00', status: 'ACTIVE' },
      { id: 'R0-W01', status: 'NOT_STARTED' },
    ],
    activeWorkPackage: 'R0-W00',
    approvalEvidence: { ...validManifest().approvalEvidence, approvedScope: ['R0-W00'] },
  };
  assert.equal(
    evaluateExecutionAuthorityV2Policy(manifest, validGovernance(), { workPackage: 'R0-W01' }).reason,
    'BLOCKED_DEPENDENCY',
  );
});

test('professional reassignment gate fails closed while roles are default and opens after reassignment', () => {
  const manifest = {
    ...validManifest(),
    effectiveBase: {
      ref: 'refs/heads/feature-chaotang-ext',
      sha: '80940d237a39f176b458763fd70e2c33d4ccac07',
    },
    activeWorkPackage: 'R0-W08',
    workPackageLedger: [
      { id: 'R0-W00', status: 'MERGED_AND_VERIFIED' },
      { id: 'R0-W01', status: 'MERGED_AND_VERIFIED' },
      { id: 'R0-W02', status: 'MERGED_AND_VERIFIED' },
      { id: 'R0-W03', status: 'MERGED_AND_VERIFIED' },
      { id: 'R0-W04', status: 'MERGED_AND_VERIFIED' },
      { id: 'R0-W05', status: 'MERGED_AND_VERIFIED' },
      { id: 'R0-W06', status: 'MERGED_AND_VERIFIED' },
      { id: 'R0-W07', status: 'MERGED_AND_VERIFIED' },
      { id: 'R0-W08', status: 'ACTIVE' },
    ],
    approvalEvidence: {
      ...validManifest().approvalEvidence,
      ownerApprovalPath:
        '.harness/changes/docs-r0-w08-exact-h-activation-20260728-20260728/owner_approval/exact-h-approval.md',
      reviewPath:
        '.harness/changes/docs-r0-w08-exact-h-activation-20260728-20260728/codex_review/exact-h-final.md',
      candidateH: '80940d237a39f176b458763fd70e2c33d4ccac07',
      tree: '6477274dbb6e6d8a8472ccf17875102f356e5675',
      approvedScope: ['R0-W08'],
    },
  };
  assert.equal(
    evaluateExecutionAuthorityV2Policy(manifest, validGovernance(), { workPackage: 'R0-W08' }).reason,
    'PROFESSIONAL_REASSIGNMENT_REQUIRED',
  );
  assert.equal(
    evaluateExecutionAuthorityV2Policy(validManifest(), validGovernance(), {
      workPackage: 'R0-W01',
      realCustomerData: true,
    }).reason,
    'PROFESSIONAL_REASSIGNMENT_REQUIRED',
  );

  const reassignedManifest = {
    ...manifest,
    professionalReassignment: {
      ...manifest.professionalReassignment,
      assignments: {
        security: 'r0-security-owner',
        legal: 'r0-legal-owner',
        release: 'r0-release-owner',
      },
    },
  };
  assert.equal(
    evaluateExecutionAuthorityV2Policy(reassignedManifest, validGovernance(), {
      workPackage: 'R0-W08',
    }).reason,
    'POLICY_ELIGIBLE',
  );
});

test('review verdict other than GO stops the resolver', () => {
  const manifest = {
    ...validManifest(),
    approvalEvidence: { ...validManifest().approvalEvidence, reviewVerdict: 'STOP' },
  };
  const errors = validateExecutionAuthorityV2Manifest(manifest);
  assert.ok(errors.some((message) => message.includes('reviewVerdict must be GO')));
});

test('approvedScope with more than one work package is rejected structurally', () => {
  const manifest = {
    ...validManifest(),
    approvalEvidence: {
      ...validManifest().approvalEvidence,
      approvedScope: ['R0-W01', 'R0-W02'],
    },
  };
  assert.ok(
    validateExecutionAuthorityV2Manifest(manifest).some((message) =>
      message.includes('approvedScope must contain exactly one work package id'),
    ),
  );
});

test('unknown top-level field is rejected by the closed schema', () => {
  const manifest = { ...validManifest(), extraField: true };
  assert.ok(
    validateExecutionAuthorityV2Manifest(manifest)[0].includes('unsupported top-level fields'),
  );
});

test('rollback state (no active package) resolves to STOP with a guard present, not an exception', () => {
  const manifest = {
    ...validManifest(),
    activeWorkPackage: null,
    workPackageLedger: [
      { id: 'R0-W00', status: 'MERGED_AND_VERIFIED' },
      { id: 'R0-W01', status: 'ROLLED_BACK' },
    ],
  };
  assert.deepEqual(validateExecutionAuthorityV2Manifest(manifest), []);
  assert.equal(
    evaluateExecutionAuthorityV2Policy(manifest, validGovernance(), { workPackage: 'R0-W01' }).reason,
    'NO_ACTIVE_WORK_PACKAGE',
  );
});

test('a merged-and-verified packet can enter quiescent closeout without auto-activating its successor', () => {
  // "packet completed" must never imply "next packet approved" — closeout and next-packet
  // approval are two separate, separately-evidenced governance events (amendment §10).
  const manifest = {
    ...validManifest(),
    activeWorkPackage: null,
    workPackageLedger: [
      { id: 'R0-W00', status: 'MERGED_AND_VERIFIED' },
      { id: 'R0-W01', status: 'MERGED_AND_VERIFIED' },
    ],
  };
  assert.deepEqual(validateExecutionAuthorityV2Manifest(manifest), []);
  for (const workPackage of ['R0-W01', 'R0-W02']) {
    assert.equal(
      evaluateExecutionAuthorityV2Policy(manifest, validGovernance(), { workPackage }).reason,
      'NO_ACTIVE_WORK_PACKAGE',
    );
  }
});

test('missing manifest file produces loader errors, never a silently skipped guard', async () => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), 'chaotang-v2-missing-'));
  try {
    const loaded = await loadExecutionAuthorityV2(temporaryRoot);
    assert.equal(loaded.manifest, null);
    assert.ok(loaded.errors.length > 0);
    const result = executionAuthorityV2CommandResult(loaded, '--authorize', [], {
      workPackage: 'R0-W01',
    });
    assert.equal(result.exitCode, 1);
    assert.equal(result.output.reason, 'INVALID_EXECUTION_AUTHORITY');
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test('ancestor symlink is rejected before reading a v2 governed path', async () => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), 'chaotang-v2-symlink-'));
  try {
    const shadow = join(temporaryRoot, 'shadow');
    await mkdir(join(shadow, 'manifest'), { recursive: true });
    await writeFile(join(shadow, 'manifest', 'execution-authority.v2.json'), '{}\n', 'utf8');
    await symlink(shadow, join(temporaryRoot, '.harness'), 'dir');
    const errors = [];
    const source = await readPinnedAuthorityFile(
      temporaryRoot,
      '.harness/manifest/execution-authority.v2.json',
      errors,
    );
    assert.equal(source, null);
    assert.ok(errors.some((message) => message.includes('symbolic links are forbidden')));
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test('authority inputs are returned as raw bytes by default for digest verification', async () => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), 'chaotang-v2-raw-bytes-'));
  try {
    const path = '.harness/evidence/non-utf8.bin';
    await mkdir(join(temporaryRoot, '.harness/evidence'), { recursive: true });
    await writeFile(join(temporaryRoot, path), Buffer.from([0x80, 0x0a]));
    const errors = [];
    const source = await readPinnedAuthorityFile(temporaryRoot, path, errors);
    assert.deepEqual(errors, []);
    assert.ok(Buffer.isBuffer(source));
    assert.deepEqual(source, Buffer.from([0x80, 0x0a]));
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test('authority inputs reject multiply linked inodes', async () => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), 'chaotang-v2-hardlink-'));
  try {
    const path = '.harness/evidence/owner.md';
    const externalPath = join(temporaryRoot, 'external-owner.md');
    await mkdir(join(temporaryRoot, '.harness/evidence'), { recursive: true });
    await writeFile(externalPath, 'owner evidence\n');
    await link(externalPath, join(temporaryRoot, path));
    const errors = [];
    const source = await readPinnedAuthorityFile(temporaryRoot, path, errors);
    assert.equal(source, null);
    assert.ok(errors.some((error) => error.includes('hard links are forbidden')));
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test('authority readers bind an opened file descriptor to its in-repository target', async () => {
  for (const path of [
    'scripts/lib/amendment-governance.mjs',
    'scripts/lib/execution-authority-v2.mjs',
    'scripts/lib/reviewer-successor-w08.mjs',
  ]) {
    const source = await readFile(join(root, path), 'utf8');
    assert.match(source, /open\(current,/u);
    assert.match(source, /realpath\(`\/proc\/self\/fd\/\$\{handle\.fd\}`\)/u);
    assert.match(source, /stat\.nlink !== 1/u);
    assert.doesNotMatch(source, /return readFile\(current/u);
  }
});

test('W07 authorization boundary rejects HEAD and EXT ref movement', async () => {
  assert.equal(
    typeof executionAuthorityV2Module.captureExecutionAuthorityGitIdentity,
    'function',
  );
  assert.equal(
    typeof executionAuthorityV2Module.verifyExecutionAuthorityGitIdentityStable,
    'function',
  );
  const temporaryRoot = await mkdtemp(join(tmpdir(), 'authority-boundary-identity-'));
  try {
    await execFileAsync('git', ['init', '-q'], { cwd: temporaryRoot });
    await execFileAsync('git', ['config', 'user.name', 'R0 Test'], {
      cwd: temporaryRoot,
    });
    await execFileAsync('git', ['config', 'user.email', 'r0@example.invalid'], {
      cwd: temporaryRoot,
    });
    await writeFile(join(temporaryRoot, 'authority.txt'), 'initial\n');
    await execFileAsync('git', ['add', '.'], { cwd: temporaryRoot });
    await execFileAsync('git', ['commit', '-qm', 'initial authority'], {
      cwd: temporaryRoot,
    });
    await execFileAsync('git', ['branch', '-M', 'feature-chaotang-ext'], {
      cwd: temporaryRoot,
    });
    const manifest = {
      activeWorkPackage: 'R0-W07',
      effectiveBase: { ref: 'refs/heads/feature-chaotang-ext' },
    };
    const snapshot =
      await executionAuthorityV2Module.captureExecutionAuthorityGitIdentity(
        temporaryRoot,
        manifest,
      );

    await writeFile(join(temporaryRoot, 'authority.txt'), 'moved\n');
    await execFileAsync('git', ['add', '.'], { cwd: temporaryRoot });
    await execFileAsync('git', ['commit', '-qm', 'move authority identities'], {
      cwd: temporaryRoot,
    });
    const errors = [];
    await executionAuthorityV2Module.verifyExecutionAuthorityGitIdentityStable(
      temporaryRoot,
      snapshot,
      errors,
    );
    assert.ok(errors.includes('execution authority HEAD moved before authorization'));
    assert.ok(
      errors.includes(
        'execution authority effectiveBase ref moved before authorization',
      ),
    );
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test('Git identity stability is the loader final asynchronous verification', async () => {
  const source = await readFile(
    join(root, 'scripts/lib/execution-authority-v2.mjs'),
    'utf8',
  );
  const workingTreeCheck = source.lastIndexOf(
    'await verifyPinnedAuthorityWorkingTree(',
  );
  const identityCheck = source.lastIndexOf(
    'await verifyExecutionAuthorityGitIdentityStable(',
  );
  const identityCheckEnd = source.indexOf('\n  );', identityCheck) + 5;
  const loaderReturn = source.indexOf('\n  return {', identityCheck);

  assert.ok(workingTreeCheck >= 0);
  assert.ok(identityCheck > workingTreeCheck);
  assert.ok(identityCheckEnd > identityCheck);
  assert.ok(loaderReturn > identityCheck);
  assert.doesNotMatch(source.slice(identityCheckEnd, loaderReturn), /\bawait\b/gu);
});

test('public module has no caller-supplied resolver capable of returning GO', () => {
  assert.equal(
    typeof executionAuthorityV2Module.resolveExecutionAuthorityV2,
    'undefined',
  );
  assert.equal(
    typeof executionAuthorityV2Module.executeExecutionAuthorityV2Command,
    'undefined',
  );
  assert.equal(
    typeof executionAuthorityV2Module.executeCanonicalExecutionAuthorityV2Command,
    'undefined',
  );
});

test('v2 manifest source rejects duplicate JSON keys', () => {
  assert.throws(
    () =>
      parseJsonObjectWithUniqueKeys(
        '{"schemaVersion":"execution-authority.v2","schemaVersion":"execution-authority.v2"}',
      ),
    /duplicate object key/i,
  );
});

test('--check proves structural validity only and never evaluates workPackage', () => {
  const loaded = { manifest: validManifest(), amendmentGovernance: validGovernance(), errors: [] };
  const result = executionAuthorityV2CommandResult(loaded, '--check', []);
  assert.equal(result.exitCode, 0);
  assert.equal(result.output.decision, 'VALID_STRUCTURE');
});

test('--authorize without --work-package stops with a specific reason', () => {
  const loaded = { manifest: validManifest(), amendmentGovernance: validGovernance(), errors: [] };
  const result = executionAuthorityV2CommandResult(loaded, '--authorize', []);
  assert.equal(result.exitCode, 2);
  assert.equal(result.output.reason, 'WORK_PACKAGE_ARGUMENT_REQUIRED');
});

test('CLI rejects an unsupported flag with exit 64', async () => {
  await assert.rejects(
    execFileAsync(process.execPath, [cliPath, '--authorize', '--bogus-flag'], { cwd: root }),
    (error) => error.code === 64,
  );
});

async function assertRealRepositoryAuthorityPhase(loaded) {
  if (loaded.manifest.activeWorkPackage === null) {
    assert.deepEqual(loaded.errors, []);
    const activeEntries = loaded.manifest.workPackageLedger.filter(
      (entry) => entry.status === 'ACTIVE',
    );
    const mergedEntries = loaded.manifest.workPackageLedger.filter(
      (entry) => entry.status === 'MERGED_AND_VERIFIED',
    );
    assert.deepEqual(activeEntries, []);
    assert.deepEqual(mergedEntries.at(-1), {
      id: 'R0-W07',
      status: 'MERGED_AND_VERIFIED',
    });
    return 'QUIESCENT';
  }

  assert.ok(['R0-W07', 'R0-W08'].includes(loaded.manifest.activeWorkPackage));
  assert.deepEqual(loaded.manifest.workPackageLedger.at(-1), {
    id: loaded.manifest.activeWorkPackage,
    status: 'ACTIVE',
  });
  const [{ stdout: headSource }, { stdout: extSource }] = await Promise.all([
    execFileAsync('/usr/bin/git', ['--no-replace-objects', 'rev-parse', 'HEAD^{commit}'], {
      cwd: root,
      env: hardenedGitEnvironment,
    }),
    execFileAsync(
      '/usr/bin/git',
      [
        '--no-replace-objects',
        'rev-parse',
        'refs/heads/feature-chaotang-ext^{commit}',
      ],
      {
        cwd: root,
        env: hardenedGitEnvironment,
      },
    ),
  ]);
  if (headSource.trim() === extSource.trim()) {
    assert.deepEqual(loaded.errors, []);
    return `INTEGRATED_${loaded.manifest.activeWorkPackage}`;
  }
  if (
    loaded.manifest.activeWorkPackage === 'R0-W08' &&
    loaded.amendmentGovernance?.reviewerSuccessorW08 === undefined &&
    loaded.errors.includes('manifest ownerApprovalPath must match active-packet profile')
  ) {
    assert.deepEqual(loaded.errors, [
      'manifest ownerApprovalPath must match active-packet profile',
      'manifest reviewPath must match active-packet profile',
      'owner activationIntentPath must match active-packet profile',
      'review reviewPackagePath must match active-packet profile',
      'review changedPaths must exactly match the Event 1 candidate',
      'review commands must exactly match the required authority verification commands',
      'active-packet EXT ref must equal pinned HEAD',
      'active-packet git identity is unverifiable: 1',
      'activation intent reviewPackagePath must match active-packet profile',
    ]);
    return 'PENDING_W08_REVIEWER_SUCCESSOR';
  }
  const expectedPreIntegrationErrors = [
    ...(loaded.manifest.activeWorkPackage === 'R0-W08'
      ? ['reviewerSuccessorW08 git identity unverifiable: activation carrier must be a direct child or one transparent promotion merge']
      : []),
    'active-packet EXT ref must equal pinned HEAD',
  ];
  assert.deepEqual(loaded.errors, expectedPreIntegrationErrors);
  return `PRE_INTEGRATION_${loaded.manifest.activeWorkPackage}`;
}

test('CLI subprocess matches the real repository authority phase', async () => {
  const loaded = await loadExecutionAuthorityV2(root);
  const phase = await assertRealRepositoryAuthorityPhase(loaded);
  if (phase === 'QUIESCENT') {
    for (const workPackage of ['R0-W06', 'R0-W07']) {
      await assert.rejects(
        execFileAsync(process.execPath, [cliPath, '--authorize', '--work-package', workPackage], {
          cwd: root,
        }),
        (error) => {
          const output = JSON.parse(error.stdout);
          return output.decision === 'STOP' && output.reason === 'NO_ACTIVE_WORK_PACKAGE';
        },
      );
    }
    return;
  }
  if (phase === 'PENDING_W08_REVIEWER_SUCCESSOR') {
    await assert.rejects(
      execFileAsync(process.execPath, [cliPath, '--authorize', '--work-package', 'R0-W08'], {
        cwd: root,
      }),
      (error) => {
        const output = JSON.parse(error.stdout);
        return output.decision === 'STOP' && output.reason === 'INVALID_EXECUTION_AUTHORITY';
      },
    );
    return;
  }
  if (phase.startsWith('PRE_INTEGRATION_')) {
    const activePackage = phase.replace('PRE_INTEGRATION_', '');
    await assert.rejects(
      execFileAsync(process.execPath, [cliPath, '--authorize', '--work-package', activePackage], {
        cwd: root,
      }),
      (error) => {
        const output = JSON.parse(error.stdout);
        const expectedErrors = [
          ...(activePackage === 'R0-W08'
            ? ['reviewerSuccessorW08 git identity unverifiable: activation carrier must be a direct child or one transparent promotion merge']
            : []),
          'active-packet EXT ref must equal pinned HEAD',
        ];
        return (
          output.decision === 'STOP' &&
          output.reason === 'INVALID_EXECUTION_AUTHORITY' &&
          JSON.stringify(output.errors) === JSON.stringify(expectedErrors)
        );
      },
    );
    return;
  }
  const activePackage = phase.replace('INTEGRATED_', '');

  const { stdout } = await execFileAsync(
    process.execPath,
    [cliPath, '--authorize', '--work-package', activePackage],
    { cwd: root },
  );
  assert.deepEqual(JSON.parse(stdout), {
    schemaVersion: 'execution-authority.v2',
    decision: 'GO',
    activeWorkPackage: activePackage,
    reason: 'APPROVED_WORK_PACKAGE',
  });
});

test('CLI subprocess against the real repo keeps predecessor and successor packages stopped', async () => {
  const loaded = await loadExecutionAuthorityV2(root);
  const phase = await assertRealRepositoryAuthorityPhase(loaded);
  const stoppedPackages =
    phase === 'INTEGRATED_R0-W08'
      ? ['R0-W05', 'R0-W09']
      : ['R0-W05', 'R0-W08', 'R0-W09'];
  const expectedReasons =
    phase === 'QUIESCENT'
      ? stoppedPackages.map(() => 'NO_ACTIVE_WORK_PACKAGE')
      : phase.startsWith('PRE_INTEGRATION_') || phase === 'PENDING_W08_REVIEWER_SUCCESSOR'
        ? stoppedPackages.map(() => 'INVALID_EXECUTION_AUTHORITY')
        : phase === 'INTEGRATED_R0-W07'
          ? ['WORK_PACKAGE_MISMATCH', 'BLOCKED_DEPENDENCY', 'BLOCKED_DEPENDENCY']
          : ['WORK_PACKAGE_MISMATCH', 'BLOCKED_DEPENDENCY'];
  let index = 0;
  for (const workPackage of stoppedPackages) {
    await assert.rejects(
      execFileAsync(process.execPath, [cliPath, '--authorize', '--work-package', workPackage], {
        cwd: root,
      }),
      (error) => {
        const output = JSON.parse(error.stdout);
        const matches =
          output.decision === 'STOP' && output.reason === expectedReasons[index];
        index += 1;
        return matches;
      },
    );
  }
});

test('root authorization procedure reserves product execution decisions for scoped v2 authorization', async () => {
  for (const path of [
    'AGENTS.md',
    '.harness/agents/project-owner.md',
    '.harness/rules/project-workflow.md',
    '.harness/wiki/harness-inventory.md',
  ]) {
    const source = await readFile(join(root, path), 'utf8');
    assert.match(source, /node scripts\/execution-authority\.mjs --check/, path);
    assert.match(
      source,
      /node scripts\/execution-authority-v2\.mjs --authorize --work-package <R0-Wxx>/,
      path,
    );
    assert.match(source, /V1_CHECK_INTEGRITY_ONLY_NON_AUTHORIZING/, path);
    assert.match(source, /V2_SCOPED_AUTHORIZE_SOLE_PRODUCT_DECISION/, path);
    assert.doesNotMatch(source, /node scripts\/execution-authority\.mjs --authorize/, path);
  }
});

test('project manifest registers the v2 authority consumer exactly', async () => {
  const projectManifest = JSON.parse(
    await readFile(join(root, '.harness/manifest/project-harness.json'), 'utf8'),
  );
  assert.deepEqual(
    projectManifest.executionAuthorityV2,
    EXPECTED_EXECUTION_AUTHORITY_V2_REGISTRATION,
  );
});

test('real repo v2 manifest evidence digests match on-disk bytes', async () => {
  assert.equal(EXECUTION_AUTHORITY_V2_PATH, '.harness/manifest/execution-authority.v2.json');
  assert.equal(
    EXECUTION_AUTHORITY_V2_SCHEMA_PATH,
    '.harness/contracts/execution-authority-v2.schema.json',
  );
  const loaded = await loadExecutionAuthorityV2(root);
  await assertRealRepositoryAuthorityPhase(loaded);
  assert.deepEqual(validateExecutionAuthorityV2(loaded), loaded.errors);
  assert.deepEqual(validateExecutionAuthorityV2Schema(loaded.schema), []);

  const ownerApprovalBytes = await readFile(
    join(root, loaded.manifest.approvalEvidence.ownerApprovalPath),
    'utf8',
  );
  assert.equal(sha256Hex(ownerApprovalBytes), loaded.manifest.approvalEvidence.ownerApprovalSha256);
  const reviewBytes = await readFile(join(root, loaded.manifest.approvalEvidence.reviewPath), 'utf8');
  assert.equal(sha256Hex(reviewBytes), loaded.manifest.approvalEvidence.reviewSha256);
  const amendmentBytes = await readFile(join(root, loaded.manifest.amendment.path), 'utf8');
  assert.equal(sha256Hex(amendmentBytes), loaded.manifest.amendment.approvedSourceDigest);
});

test('W06 review request owner approval is strictly machine-readable and binds the activation intent', async () => {
  const ownerApprovalPath = join(
    root,
    '.harness/changes/fix-ext-g0-authority-recovery-20260725/owner_approval/exact-h-approval.md',
  );
  const ownerApproval = await readFile(ownerApprovalPath, 'utf8');
  const evidence = parseExecutionAuthorityV2Evidence(ownerApproval, ownerApprovalPath);
  const activationIntentPath = join(
    root,
    '.harness/changes/fix-ext-g0-authority-recovery-20260725/activation_intent/r0-w06-activation-intent.json',
  );
  const activationIntentBytes = await readFile(activationIntentPath, 'utf8');
  const activationIntent = parseJsonObjectWithUniqueKeys(activationIntentBytes, activationIntentPath);
  const reviewPackagePath = join(
    root,
    '.harness/changes/fix-ext-g0-authority-recovery-20260725/review_inputs/review-7df6e4e1..e8be2ca9.diff',
  );
  const reviewPackageBytes = await readFile(reviewPackagePath, 'utf8');

  assert.equal(evidence.decision, 'APPROVED');
  assert.equal(evidence.workPackage, 'R0-W06');
  assert.equal(evidence.candidateH, '8feae838f09ad5202b21332d4280b989ab776bd7');
  assert.equal(evidence.tree, '9d63f98041e5e13174dbba4c0b9d27eef1471bf9');
  assert.equal(evidence.activationIntentSha256, sha256Hex(activationIntentBytes));
  assert.equal(activationIntent.kind, 'activation-intent');
  assert.equal(
    activationIntent.reviewPackagePath,
    '.harness/changes/fix-ext-g0-authority-recovery-20260725/review_inputs/review-7df6e4e1..e8be2ca9.diff',
  );
  assert.equal(activationIntent.reviewPackageSha256, sha256Hex(reviewPackageBytes));
  assert.equal(
    activationIntent.reviewPackageSha256,
    '0fdf3da62b977d6935b65c68e5509ee6b52eb98d7ee80a142341625bd4d3f885',
  );
  assert.deepEqual(parseExecutionAuthorityV2ReviewPackage(reviewPackageBytes), [
    '.harness/changes/fix-ext-g0-authority-recovery-20260725/activation_intent/r0-w06-activation-intent.json',
    '.harness/changes/fix-ext-g0-authority-recovery-20260725/ci_result/ci_summary.md',
    '.harness/changes/fix-ext-g0-authority-recovery-20260725/claude_code_review/review-request.md',
    '.harness/changes/fix-ext-g0-authority-recovery-20260725/owner_approval/exact-h-approval.md',
    '.harness/changes/fix-ext-g0-authority-recovery-20260725/owner_scope/recovery-boundary.md',
    '.harness/changes/fix-ext-g0-authority-recovery-20260725/request_analysis/tasks.md',
    '.harness/changes/fix-ext-g0-authority-recovery-20260725/summary.md',
    'docs/superpowers/plans/2026-07-25-ext-recovery-program.md',
    'scripts/execution-authority-v2.nodetest.mjs',
    'scripts/execution-authority.nodetest.mjs',
    'scripts/lib/execution-authority-v2.mjs',
  ]);
  assert.deepEqual(activationIntent.effectiveBase, evidence.effectiveBase);
  assert.deepEqual(activationIntent.approvalEvidence.approvedScope, ['R0-W06']);
  assert.equal(activationIntent.activeWorkPackage, 'R0-W06');
  assert.deepEqual(activationIntent.workPackageLedger.at(-1), {
    id: 'R0-W06',
    status: 'ACTIVE',
  });
});
