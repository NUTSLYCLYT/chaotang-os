import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);

async function readJson(relativePath) {
  return JSON.parse(await readFile(new URL(relativePath, root), 'utf8'));
}

test('project harness registers capability-entry inventory, telemetry and the 14-day deletion gate', async () => {
  const manifest = await readJson('.harness/manifest/project-harness.json');
  const governance = manifest.capabilityEntryGovernance;

  assert.equal(governance.status, 'OBSERVE');
  assert.equal(governance.telemetry.eventName, 'capability_entry_invoked.v1');
  assert.equal(governance.deletionGate.minimumObservationDays, 14);
  assert.equal(governance.deletionGate.maximumInvocations, 0);
  assert.equal(governance.deletionGate.requireVerifiedReplacement, true);
  assert.ok(governance.verification.includes('node --test scripts/capability-entry-governance.nodetest.mjs'));

  for (const path of [governance.documentation, governance.inventory, ...governance.contracts]) {
    await readFile(new URL(path, root));
  }
});

test('inventory keeps every known legacy entry non-deletable until telemetry and replacement evidence exist', async () => {
  const inventory = await readJson('.harness/manifest/capability-entry-inventory.json');
  const entrySchema = await readJson('.harness/contracts/capability-entry.schema.json');
  const eventSchema = await readJson('.harness/contracts/capability-entry-event.schema.json');
  assert.ok(inventory.entries.length >= 3);
  assert.equal(eventSchema.properties.eventName.const, 'capability_entry_invoked.v1');
  assert.deepEqual(eventSchema.properties.taskContext.properties.kernel.enum, ['DECISION_TASK', 'ENGINEERING_TASK']);

  for (const entry of inventory.entries) {
    for (const field of entrySchema.required) assert.ok(Object.hasOwn(entry, field), `${entry.id ?? 'entry'} missing ${field}`);
    assert.ok(entrySchema.properties.owner.enum.includes(entry.owner));
    assert.ok(entrySchema.properties.kind.enum.includes(entry.kind));
    assert.ok(entrySchema.properties.routingTarget.enum.includes(entry.routingTarget));
    assert.ok(entrySchema.properties.disposition.enum.includes(entry.disposition));
    assert.equal(entry.telemetry.eventName, 'capability_entry_invoked.v1');

    if (entry.disposition === 'DELETE_CANDIDATE') {
      assert.ok(entry.telemetry.observationDays >= 14);
      assert.equal(entry.telemetry.invocations, 0);
      assert.equal(entry.replacement.status, 'VERIFIED');
      assert.ok(entry.decisionEvidence);
    }
  }
});

test('inventory covers every discovered business fact surface and names one canonical task kernel', async () => {
  const inventory = await readJson('.harness/manifest/capability-entry-inventory.json');
  const businessEntries = inventory.entries.filter((entry) => entry.kind === 'BUSINESS');
  const ids = new Set(businessEntries.map((entry) => entry.id));
  const requiredBusinessSurfaces = [
    'canonical-shangshufang-decision-loop',
    'canonical-swarm-runs-execution-adapter',
    'legacy-chaotang-task-chain',
    'legacy-court-compat-task-chain',
    'legacy-orchestration-registry-chain',
    'legacy-frontend-decision-store',
    'legacy-court-prefixed-shangshufang-paths',
    'specialized-pack-finance-research-loops',
    'legacy-swarm-session-runner',
    'legacy-direct-executor',
    'legacy-court-flywheel-writers',
    'legacy-governance-and-shiguan-writers',
  ];

  for (const id of requiredBusinessSurfaces) {
    assert.ok(ids.has(id), `business capability inventory missing ${id}`);
  }

  const canonical = businessEntries.filter(
    (entry) => entry.routingTarget === 'DECISION_TASK_KERNEL' && entry.disposition === 'CANONICAL',
  );
  assert.deepEqual(
    canonical.map((entry) => entry.id),
    ['canonical-shangshufang-decision-loop'],
    'only the shangshufang decision loop may own canonical business terminal writes',
  );

  for (const entry of businessEntries.filter((item) => item.disposition !== 'CANONICAL')) {
    assert.notEqual(entry.disposition, 'DELETE_CANDIDATE');
    assert.equal(entry.telemetry.invocations, null, `${entry.id} must not claim zero calls before telemetry exists`);
  }
});
