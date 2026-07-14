import assert from 'node:assert/strict';
import test from 'node:test';

import {
  validateRepositoryStructure,
} from './lib/repository-structure.mjs';

test('accepts the canonical repository roots', () => {
  const result = validateRepositoryStructure([
    '.claude/settings.json',
    '.harness/manifest/project-harness.json',
    'AGENTS.md',
    'backend/src/runtime_paths.py',
    'courtos-brain/VAULT-GUIDE.md',
    'docs/plans/example.md',
    'frontend/src/app/page.tsx',
    'scripts/harness-doctor.mjs',
    'skills/personas/example/SKILL.md',
  ]);

  assert.deepEqual(result, []);
});

test('rejects unknown roots and retired ambiguous paths', () => {
  const result = validateRepositoryStructure([
    'mystery/file.txt',
    'plans/legacy-plan.md',
    'PROJECT_STATUS.md',
    'frontend/harness/example/README.md',
  ]);

  assert.deepEqual(result, [
    'unknown repository root: mystery',
    'retired root path: plans/legacy-plan.md',
    'retired root path: PROJECT_STATUS.md',
    'retired frontend evaluation path: frontend/harness/example/README.md',
  ]);
});

test('rejects tracked backend runtime state', () => {
  const result = validateRepositoryStructure([
    'backend/data/fengqun.db',
    'backend/events/event.json',
    'backend/memory/persons/example.md',
    'backend/traces/trace-1/span.json',
    'backend/sessions/session.json',
    'backend/swarm_sessions/swarm.json',
    'backend/direct_cache/result.json',
    'backend/direct_feedback/feedback.json',
    'backend/runs/run.json',
    'backend/repairs/repair.json',
    'backend/drafts/draft.json',
    'backend/reports/report.json',
    'backend/cases/case.json',
    'backend/ab_tests/result.json',
    'backend/var/data/fengqun.db',
    'backend/resources/memory_profiles/persons/example.md',
    'backend/tests/fixtures/traces/span.json',
  ]);

  assert.deepEqual(result, [
    'tracked backend runtime state: backend/data/fengqun.db',
    'tracked backend runtime state: backend/events/event.json',
    'tracked backend runtime state: backend/memory/persons/example.md',
    'tracked backend runtime state: backend/traces/trace-1/span.json',
    'tracked backend runtime state: backend/sessions/session.json',
    'tracked backend runtime state: backend/swarm_sessions/swarm.json',
    'tracked backend runtime state: backend/direct_cache/result.json',
    'tracked backend runtime state: backend/direct_feedback/feedback.json',
    'tracked backend runtime state: backend/runs/run.json',
    'tracked backend runtime state: backend/repairs/repair.json',
    'tracked backend runtime state: backend/drafts/draft.json',
    'tracked backend runtime state: backend/reports/report.json',
    'tracked backend runtime state: backend/cases/case.json',
    'tracked backend runtime state: backend/ab_tests/result.json',
    'tracked backend runtime state: backend/var/data/fengqun.db',
  ]);
});
