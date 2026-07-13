import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const CANONICAL_BACKEND = '/home/ubuntu/Projects/chaotang-os/backend';
const PRODUCTION_EXEC = `${CANONICAL_BACKEND}/.venv/bin/python -m gunicorn -c gunicorn.conf.py web.main:app`;

test('user backend unit uses the project virtualenv production runner', async () => {
  const file = 'frontend/deploy/services/jiqun.service.template';
  const content = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');

  assert.equal(
    content.includes(`${CANONICAL_BACKEND}/.venv/bin/uvicorn`),
    false,
    `${file} bypasses the declared gunicorn production configuration`,
  );
  assert.match(content, new RegExp(`^ExecStart=${escapeRegExp(PRODUCTION_EXEC)}$`, 'm'));
});

test('system backend unit uses the same project virtualenv production runner', async () => {
  const file = 'backend/scripts/jiqun_ai.service';
  const content = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');

  assert.equal(
    content.includes('/home/ubuntu/miniforge3/bin/python'),
    false,
    `${file} depends on a host-specific interpreter outside the canonical checkout`,
  );
  assert.match(content, new RegExp(`^ExecStart=${escapeRegExp(PRODUCTION_EXEC)}$`, 'm'));
});

test('recovery guide installs and validates the backend production environment', async () => {
  const file = 'frontend/deploy/README.md';
  const content = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');

  for (const command of [
    `cd ${CANONICAL_BACKEND}`,
    'python3 -m venv .venv',
    '.venv/bin/python -m pip install -r requirements.txt',
    '.venv/bin/python -m pip check',
    '.venv/bin/python -c "import gunicorn, uvicorn, web.main"',
  ]) {
    assert.equal(content.includes(command), true, `${file} is missing runtime proof command: ${command}`);
  }
});

test('declared backend requirements provide the production runner', async () => {
  const aggregate = await readFile(new URL('../backend/requirements.txt', import.meta.url), 'utf8');
  const core = await readFile(new URL('../backend/requirements-core.txt', import.meta.url), 'utf8');
  const optional = await readFile(new URL('../backend/requirements-optional.txt', import.meta.url), 'utf8');

  assert.match(aggregate, /^-r requirements-core\.txt$/m);
  assert.match(aggregate, /^-r requirements-optional\.txt$/m);
  assert.match(core, /^uvicorn(?:\[standard\])?>=/m);
  assert.match(optional, /^gunicorn>=/m);
});

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
