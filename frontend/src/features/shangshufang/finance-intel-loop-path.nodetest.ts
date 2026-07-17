import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const source = readFileSync(new URL('./ShangshufangPage.tsx', import.meta.url), 'utf8');

describe('finance intel loop API path', () => {
  it('uses the backend transport with the canonical completion endpoint', () => {
    assert.match(
      source,
      /backendFetch\('\/api\/shangshufang\/finance-intel-loop\/complete'/,
    );
    assert.doesNotMatch(
      source,
      /['"]\/api\/court\/shangshufang\/finance-intel-loop\/complete['"]/,
    );
  });
});
