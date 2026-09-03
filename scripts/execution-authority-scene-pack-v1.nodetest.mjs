import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import test from 'node:test';

import {
  EXPECTED_SCENE_PACK_AUTHORITY_REGISTRATION,
  SCENE_PACK_WORK_PACKAGE,
  executionAuthorityScenePackV1CommandResult,
  loadExecutionAuthorityScenePackV1,
  resolveScenePackAuthority,
  validateExecutionAuthorityScenePackV1,
  validateScenePackAuthorityManifest,
} from './lib/execution-authority-scene-pack-v1.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const cliPath = join(root, 'scripts/execution-authority-scene-pack-v1.mjs');
const execFileAsync = promisify(execFile);

function validManifest() {
  return {
    schemaVersion: 'execution-authority.scene-pack-v1',
    authorityId: 'scene-pack-v1-execution-authority-20260903',
    amendment: {
      id: 'SCENE-PACK-V1-FIRST-REAL-SCENES-20260903',
      path: '.harness/changes/feat-scene-pack-v1-amendment-20260903/amendment.md',
      approvedSourceDigest: '14f84c54c2f2429bc581dcc99b8534dd29a75a9dc13defbc9d842426e437dad0',
    },
    effectiveBase: {
      ref: 'origin/ext-dev',
      sha: '8282247208f3d79a8158aa7dc3138a49b1b919fb',
    },
    approvalEvidence: {
      ownerApprovalPath:
        '.harness/changes/feat-scene-pack-v1-amendment-20260903/owner_approval/exact-h-approval.md',
      ownerApprovalSha256: 'e066160486d07602bd364e3529964673c7b48ebd481b154220b3f24be084a9ae',
      approver: 'lyt',
      approvedScope: [SCENE_PACK_WORK_PACKAGE],
    },
    activeWorkPackage: SCENE_PACK_WORK_PACKAGE,
    policy: {
      allowProductRuntimeChanges: true,
      allowPush: false,
      allowMerge: false,
      allowDeploy: false,
      allowExternalActions: false,
      allowedData: 'demo_or_user_provided_non_external_execution_only',
    },
  };
}

const validDigests = {
  amendmentDigest: '14f84c54c2f2429bc581dcc99b8534dd29a75a9dc13defbc9d842426e437dad0',
  ownerApprovalDigest: 'e066160486d07602bd364e3529964673c7b48ebd481b154220b3f24be084a9ae',
};

test('valid scene authority resolves to GO for exactly SCENE-PACK-V1', () => {
  assert.deepEqual(
    resolveScenePackAuthority(validManifest(), validDigests, {
      workPackage: SCENE_PACK_WORK_PACKAGE,
    }),
    {
      schemaVersion: 'execution-authority.scene-pack-v1',
      decision: 'GO',
      activeWorkPackage: SCENE_PACK_WORK_PACKAGE,
      effectiveBase: 'origin/ext-dev@8282247208f3d79a8158aa7dc3138a49b1b919fb',
      reason: 'APPROVED_SCENE_PACK_V1',
    },
  );
});

test('missing work package fails closed', () => {
  assert.equal(
    resolveScenePackAuthority(validManifest(), validDigests, {}).reason,
    'WORK_PACKAGE_ARGUMENT_REQUIRED',
  );
});

test('wrong work package fails closed', () => {
  assert.equal(
    resolveScenePackAuthority(validManifest(), validDigests, { workPackage: 'R0-W05' }).reason,
    'WORK_PACKAGE_MISMATCH',
  );
});

test('amendment digest drift fails closed', () => {
  assert.equal(
    resolveScenePackAuthority(
      validManifest(),
      { ...validDigests, amendmentDigest: 'a'.repeat(64) },
      { workPackage: SCENE_PACK_WORK_PACKAGE },
    ).reason,
    'AMENDMENT_DIGEST_DRIFT',
  );
});

test('policy cannot authorize push merge deploy or external actions', () => {
  const manifest = {
    ...validManifest(),
    policy: { ...validManifest().policy, allowPush: true },
  };
  assert.ok(validateScenePackAuthorityManifest(manifest).some((message) => message.includes('allowPush')));
});

test('--check validates structure without granting runtime authorization', () => {
  const loaded = { manifest: validManifest(), loadedDigests: validDigests, errors: [] };
  const result = executionAuthorityScenePackV1CommandResult(loaded, '--check');
  assert.equal(result.exitCode, 0);
  assert.equal(result.output.decision, 'VALID_STRUCTURE');
});

test('real repo scene authority is valid', async () => {
  const loaded = await loadExecutionAuthorityScenePackV1(root);
  assert.deepEqual(loaded.errors, []);
  assert.deepEqual(validateExecutionAuthorityScenePackV1(loaded), []);
});

test('CLI authorizes only the real scene work package', async () => {
  await execFileAsync(
    process.execPath,
    [cliPath, '--authorize', '--work-package', SCENE_PACK_WORK_PACKAGE],
    { cwd: root },
  );

  await assert.rejects(
    execFileAsync(process.execPath, [cliPath, '--authorize', '--work-package', 'R0-W05'], {
      cwd: root,
    }),
    (error) => {
      return error.code === 2;
    },
  );
});

test('project manifest registers scene authority exactly', async () => {
  const projectManifest = JSON.parse(
    await import('node:fs/promises').then(({ readFile }) =>
      readFile(join(root, '.harness/manifest/project-harness.json'), 'utf8'),
    ),
  );
  assert.deepEqual(
    projectManifest.scenePackExecutionAuthority,
    EXPECTED_SCENE_PACK_AUTHORITY_REGISTRATION,
  );
});
