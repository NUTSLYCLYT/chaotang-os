import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  EXECUTION_AUTHORITY_PATH,
  executionAuthorityCommandResult,
  loadExecutionAuthority,
  parseJsonObjectWithUniqueKeys,
  readPinnedAuthorityFile,
  resolveExecutionAuthority,
  sha256Document,
  validateGovernedDocumentContent,
  validateExecutionAuthority,
  validateExecutionAuthoritySchema,
} from './lib/execution-authority.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

function inactiveManifest() {
  return {
    schemaVersion: 'execution-authority.v1',
    authorityId: 'r0-execution-authority-20260720-v1',
    status: 'AMENDMENT_REQUIRED',
    productAuthorities: [
      {
        path: 'docs/product/PROJECT_PRODUCT.md',
        role: 'PRODUCT_CONSTITUTION',
        sha256: `sha256:${'0'.repeat(64)}`,
      },
      {
        path: 'docs/product/releases/product-r0-trusted-kernel/PRD.md',
        role: 'R0_R1_RELEASE_PRD',
        sha256: `sha256:${'0'.repeat(64)}`,
      },
    ],
    governedDocuments: [
      { path: 'AGENTS.md', role: 'ROOT_AGENT_ENTRY', sha256: `sha256:${'0'.repeat(64)}` },
      {
        path: '.harness/agents/project-owner.md',
        role: 'PROJECT_OWNER_POLICY',
        sha256: `sha256:${'0'.repeat(64)}`,
      },
      {
        path: '.harness/rules/project-workflow.md',
        role: 'PROJECT_WORKFLOW_POLICY',
        sha256: `sha256:${'0'.repeat(64)}`,
      },
      {
        path: '.harness/templates/change-template/summary.md',
        role: 'CHANGE_RECORD_TEMPLATE',
        sha256: `sha256:${'0'.repeat(64)}`,
      },
    ],
    canonicalPlan: {
      path: 'docs/plans/chaotang-os-world-class-agent-harness-execution-plan-2026-07-17.md',
      sha256: `sha256:${'0'.repeat(64)}`,
      state: 'INACTIVE',
      sequence: ['M0', 'M1', 'M2', 'M5', 'M6', 'M3', 'M4', 'M7', 'M8', 'M9', 'M10'],
    },
    referencePlans: [],
    activation: {
      activeAmendment: null,
      approvalEvidence: null,
      effectiveHead: null,
    },
  };
}

test('v1 authority is an inactive fail-closed guard and cannot self-authorize', () => {
  const manifest = inactiveManifest();
  assert.deepEqual(resolveExecutionAuthority(manifest), {
    schemaVersion: 'execution-authority.v1',
    authorityId: 'r0-execution-authority-20260720-v1',
    decision: 'STOP',
    canExecuteCanonicalPlan: false,
    reason: 'AMENDMENT_APPROVAL_REQUIRED',
    canonicalPlan: manifest.canonicalPlan.path,
  });

  for (const mutation of [
    { status: 'ACTIVE' },
    { activation: { ...manifest.activation, activeAmendment: 'amendment.md' } },
    { activation: { ...manifest.activation, approvalEvidence: 'approved' } },
    { activation: { ...manifest.activation, effectiveHead: 'a'.repeat(40) } },
    { canonicalPlan: { ...manifest.canonicalPlan, state: 'ACTIVE' } },
    {
      canonicalPlan: {
        ...manifest.canonicalPlan,
        sequence: ['M0', 'M2', 'M1', 'M5', 'M6', 'M3', 'M4', 'M7', 'M8', 'M9', 'M10'],
      },
    },
    { packetReviewVerdict: 'PACKET_REVIEW_GO' },
  ]) {
    assert.throws(
      () => resolveExecutionAuthority({ ...manifest, ...mutation }),
      /execution-authority\.v1|inactive|amendment|required|unsupported/i,
    );
  }
});

test('governed entry and product documents cannot remove amendment semantics', () => {
  assert.deepEqual(
    validateGovernedDocumentContent(
      'AGENTS.md',
      'read .harness/agents/project-owner.md\nrun node scripts/execution-authority.mjs --check\nrun node scripts/execution-authority-v2.mjs --authorize --work-package <R0-Wxx>\n',
    ),
    [],
  );
  assert.ok(
    validateGovernedDocumentContent('AGENTS.md', '# direct implementation allowed\n').length > 0,
  );
  assert.deepEqual(
    validateGovernedDocumentContent(
      'docs/product/releases/product-r0-trusted-kernel/PRD.md',
      'FROZEN_PRODUCT_SCOPE / IMPLEMENTATION_REQUIRES_AMENDMENT\n本 PRD 冻结产品需求，不自行授权修改生产代码。\n',
    ),
    [],
  );
  assert.ok(
    validateGovernedDocumentContent(
      'docs/product/releases/product-r0-trusted-kernel/PRD.md',
      'IMPLEMENTATION_APPROVED\n',
    ).length > 0,
  );
});

test('strict manifest parsing rejects duplicate keys and non-object roots', () => {
  assert.deepEqual(parseJsonObjectWithUniqueKeys('{"status":"AMENDMENT_REQUIRED"}'), {
    status: 'AMENDMENT_REQUIRED',
  });
  assert.throws(
    () => parseJsonObjectWithUniqueKeys('{"status":"ACTIVE","status":"AMENDMENT_REQUIRED"}'),
    /duplicate object key/i,
  );
  for (const source of ['null', '[]', 'false', '"manifest"']) {
    assert.throws(() => parseJsonObjectWithUniqueKeys(source), /root must be an object/i);
  }
});

test('loader turns a structurally incomplete manifest into errors instead of crashing', async () => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), 'chaotang-invalid-authority-'));
  try {
    await mkdir(join(temporaryRoot, '.harness/manifest'), { recursive: true });
    await mkdir(join(temporaryRoot, '.harness/contracts'), { recursive: true });
    await writeFile(
      join(temporaryRoot, '.harness/manifest/execution-authority.v1.json'),
      '{"schemaVersion":"execution-authority.v1"}\n',
      'utf8',
    );
    await writeFile(
      join(temporaryRoot, '.harness/contracts/execution-authority.schema.json'),
      JSON.stringify({
        $id: 'https://chaotang.local/contracts/execution-authority.v1.schema.json',
      }),
      'utf8',
    );
    const loaded = await loadExecutionAuthority(temporaryRoot);
    assert.equal(loaded.manifest.schemaVersion, 'execution-authority.v1');
    assert.ok(loaded.errors.some((message) => message.includes('top-level fields')));
    const result = executionAuthorityCommandResult(loaded, '--authorize');
    assert.equal(result.exitCode, 1);
    assert.equal(result.output.reason, 'INVALID_EXECUTION_AUTHORITY');
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test('registered JSON schema itself cannot describe an active v1 authority', async () => {
  const schema = JSON.parse(
    await readFile(join(root, '.harness/contracts/execution-authority.schema.json'), 'utf8'),
  );
  assert.deepEqual(validateExecutionAuthoritySchema(schema), []);
  const activeSchema = structuredClone(schema);
  activeSchema.properties.status.const = 'ACTIVE';
  assert.ok(validateExecutionAuthoritySchema(activeSchema).length > 0);
});

test('authority inputs reject ancestor symlinks before reading a governed file', async () => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), 'chaotang-authority-'));
  try {
    const shadow = join(temporaryRoot, 'shadow');
    await mkdir(join(shadow, 'product'), { recursive: true });
    await writeFile(join(shadow, 'product', 'policy.md'), '# shadow\n', 'utf8');
    await symlink(shadow, join(temporaryRoot, 'docs'), 'dir');
    const errors = [];
    const source = await readPinnedAuthorityFile(
      temporaryRoot,
      'docs/product/policy.md',
      errors,
    );
    assert.equal(source, null);
    assert.ok(errors.some((message) => message.includes('symbolic links are forbidden')));
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test('repository authority inventories every flat plan and pins all governed documents', async () => {
  const loaded = await loadExecutionAuthority(root);
  assert.equal(EXECUTION_AUTHORITY_PATH, '.harness/manifest/execution-authority.v1.json');
  assert.deepEqual(loaded.errors, []);
  assert.deepEqual(validateExecutionAuthority(loaded), []);

  const actualPlans = (await readdir(join(root, 'docs/plans'), { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => `docs/plans/${entry.name}`)
    .sort();
  const inventoriedPlans = [
    loaded.manifest.canonicalPlan.path,
    ...loaded.manifest.referencePlans.map((entry) => entry.path),
  ].sort();
  assert.deepEqual(inventoriedPlans, actualPlans);

  for (const authority of loaded.manifest.productAuthorities) {
    const source = await readFile(join(root, authority.path), 'utf8');
    assert.equal(authority.sha256, sha256Document(source));
  }
  for (const document of loaded.manifest.governedDocuments) {
    const source = await readFile(join(root, document.path), 'utf8');
    assert.equal(document.sha256, sha256Document(source));
  }
  for (const plan of [loaded.manifest.canonicalPlan, ...loaded.manifest.referencePlans]) {
    const source = await readFile(join(root, plan.path), 'utf8');
    assert.equal(plan.sha256, sha256Document(source));
  }
});

test('project manifest and policy consumers expose a fail-closed authority gate', async () => {
  const projectManifest = JSON.parse(
    await readFile(join(root, '.harness/manifest/project-harness.json'), 'utf8'),
  );
  assert.deepEqual(projectManifest.executionAuthority, {
    status: 'AMENDMENT_REQUIRED',
    manifest: '.harness/manifest/execution-authority.v1.json',
    schema: '.harness/contracts/execution-authority.schema.json',
    resolver: 'scripts/lib/execution-authority.mjs',
    command: 'scripts/execution-authority.mjs',
    test: 'scripts/execution-authority.nodetest.mjs',
    documentation: '.harness/wiki/execution-authority.md',
    verification: [
      'node --test scripts/execution-authority.nodetest.mjs',
      'node scripts/execution-authority.mjs --check',
      'node scripts/harness-doctor.mjs',
    ],
  });

  const owner = await readFile(join(root, '.harness/agents/project-owner.md'), 'utf8');
  const workflow = await readFile(join(root, '.harness/rules/project-workflow.md'), 'utf8');
  const template = await readFile(
    join(root, '.harness/templates/change-template/summary.md'),
    'utf8',
  );
  for (const [path, source] of [
    ['AGENTS.md', await readFile(join(root, 'AGENTS.md'), 'utf8')],
    ['.harness/agents/project-owner.md', owner],
    ['.harness/rules/project-workflow.md', workflow],
  ]) {
    assert.match(source, /node scripts\/execution-authority\.mjs --check/, path);
    assert.match(
      source,
      /node scripts\/execution-authority-v2\.mjs --authorize --work-package <R0-Wxx>/,
      path,
    );
    assert.doesNotMatch(source, /node scripts\/execution-authority\.mjs --authorize/, path);
  }
  assert.match(template, /NOT_GRANTED_BY_CHANGE_RECORD/);
});

test('CLI validates the manifest but denies canonical execution while v1 is inactive', () => {
  const loaded = { manifest: inactiveManifest(), errors: [] };

  const defaultCommand = executionAuthorityCommandResult(loaded);
  assert.equal(defaultCommand.exitCode, 2);
  assert.equal(defaultCommand.output.decision, 'STOP');
  assert.equal(defaultCommand.output.reason, 'AMENDMENT_APPROVAL_REQUIRED');

  const ambiguousCommand = executionAuthorityCommandResult(loaded, '--check', ['--authorize']);
  assert.equal(ambiguousCommand.exitCode, 64);
  assert.equal(ambiguousCommand.output.decision, 'STOP');
  assert.equal(ambiguousCommand.output.reason, 'UNSUPPORTED_COMMAND');

  const checked = executionAuthorityCommandResult(loaded, '--check');
  assert.equal(checked.exitCode, 0);
  assert.equal(checked.output.decision, 'VALID_INACTIVE_GUARD');
  assert.equal(checked.output.canExecuteCanonicalPlan, false);

  const authorize = executionAuthorityCommandResult(loaded, '--authorize');
  assert.equal(authorize.exitCode, 2);
  assert.equal(authorize.output.decision, 'STOP');
  assert.equal(authorize.output.reason, 'AMENDMENT_APPROVAL_REQUIRED');
});
