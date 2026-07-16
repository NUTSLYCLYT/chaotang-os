import assert from 'node:assert/strict';
import { readFile, rm } from 'node:fs/promises';
import test from 'node:test';

const dbPath = `/tmp/courtos-mvp-api-${process.pid}.db`;
process.env.TURSO_DB_URL = `file:${dbPath}`;

test('swarm-deepen remains a direct backend bridge and is not auto-triggered after decree confirmation', async (t) => {
  t.after(async () => {
    await rm(dbPath, { force: true });
    await rm(`${dbPath}-shm`, { force: true });
    await rm(`${dbPath}-wal`, { force: true });
  });

  const backendApiText = await readFile(new URL('../../../lib/backend-api.ts', import.meta.url), 'utf8');
  assert.match(backendApiText, /export async function backendFetch/);
  assert.match(backendApiText, /\/api\/court\/shangshufang\//);
  assert.match(backendApiText, /\/api\/shangshufang\//);

  const jiqunApiText = await readFile(new URL('../../../lib/jiqun-api.ts', import.meta.url), 'utf8');
  assert.match(jiqunApiText, /export async function shangshufangSwarmDeepen/);
  assert.match(jiqunApiText, /fetchLocalCourtApi/);
  assert.match(jiqunApiText, /\/api\/court\/shangshufang\/tasks\/\$\{encodeURIComponent\(taskId\)\}\/swarm-deepen/);

  const shangshufangPageText = await readFile(new URL('../../../features/shangshufang/ShangshufangPage.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(shangshufangPageText, /shangshufangSwarmDeepen\(draft\.task_id\)/);
  assert.doesNotMatch(shangshufangPageText, /chaotang\.orchestrateAll\(backendCommand/);
});

test('archive retrospective is reached through the chaotang backend API client', async () => {
  const chaotangApiText = await readFile(new URL('../../../lib/api/chaotang.ts', import.meta.url), 'utf8');
  assert.match(chaotangApiText, /const BASE = '\/api\/chaotang'/);
  assert.match(chaotangApiText, /backendFetch/);
  assert.match(chaotangApiText, /archive\/\$\{encodeURIComponent\(taskId\)\}\/retrospective/);
});

test('retired API-cluster schema tables are kept until a real migration removes them', async () => {
  const schemaText = await readFile(new URL('../../../lib/db/schema.ts', import.meta.url), 'utf8');
  for (const table of [
    'decision_tasks',
    'draft_edicts',
    'court_reviews',
    'department_review_runs',
    'memorials',
    'emperor_decisions',
    'shiguan_archives',
    'court_loop_runs',
  ]) {
    assert.match(schemaText, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
    assert.match(schemaText, new RegExp(`name: "${table}"`));
  }
  assert.match(schemaText, /decision_tasks_user_status_updated/);
});

test('Shangshufang production view projects canonical memorials without local synthesis', async () => {
  const pageText = await readFile(
    new URL('../../../features/shangshufang/ShangshufangPage.tsx', import.meta.url),
    'utf8',
  );

  for (const marker of [
    'runMinistryReview(',
    'runYushitaiAudit(',
    'synthesizeImperialReport(',
    'runCourtUnifiedDecisionLoop(',
  ]) {
    assert.equal(pageText.includes(marker), false, `production page still calls ${marker}`);
  }
  assert.match(pageText, /function pollForRealVerdict/);
  assert.match(pageText, /projectCanonicalMemorialView/);
  assert.match(pageText, /pollForRealVerdict\(draft\.task_id, setEdictOverride\)/);
});
