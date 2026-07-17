/** P6: task-registering compatibility POSTs are backend-owned and backend-authenticated. */
import assert from 'node:assert/strict';
import { existsSync, globSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

test('frontend has no server BFF route tree after backend contract cutover', () => {
  assert.equal(existsSync(path.join(process.cwd(), 'src/app/api')), false);
});

test('frontend HTTP route source cannot carry the backend admin credential', () => {
  const files = globSync('src/app/**/route.{ts,tsx,js,mjs}', { cwd: process.cwd() });
  const exposed = files.filter((file) =>
    readFileSync(path.join(process.cwd(), file), 'utf8').includes('JIQUN_ADMIN_TOKEN'),
  );
  assert.deepEqual(exposed, [], `frontend HTTP route exposes backend credential: ${exposed.join(', ')}`);
});
