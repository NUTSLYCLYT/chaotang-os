import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  compareContracts,
  DEFAULT_BASE_REF,
} from './api-contract-stability.mjs';

test('API stability report timestamps are deterministic', () => {
  const source = readFileSync(new URL('./api-contract-stability.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /generatedAt:\s*new Date\(\)\.toISOString\(\)/);
  assert.match(source, /generatedAt:\s*DATE/);
});

test('generated array types parenthesize union item types', () => {
  const source = readFileSync(new URL('./api-contract-stability.mjs', import.meta.url), 'utf8');
  assert.match(
    source,
    /schema\.type === 'array'\) return `\(\$\{schemaToTs\(schema\.items\)\}\)\[\]`/,
  );
});

test('uses an immutable git ref instead of the mutable output snapshot', () => {
  const source = readFileSync(new URL('./api-contract-stability.mjs', import.meta.url), 'utf8');

  assert.equal(
    DEFAULT_BASE_REF,
    'ed822255a452e8dd8dda8f86a180fd7c099b181e',
  );
  assert.doesNotMatch(source, /readJsonIfExists\(OUT_ROUTE_SNAPSHOT\)/);
  assert.match(source, /exportOpenApiAtRef/);
  assert.match(source, /\^\[0-9a-f\]\{40\}\$/);
});

test('detects component schema content changes behind a stable ref', () => {
  const base = {
    paths: {
      '/example': {
        get: {
          responses: {
            200: {
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Example' },
                },
              },
            },
          },
        },
      },
    },
    components: {
      schemas: {
        Example: {
          type: 'object',
          properties: { value: { type: 'string' } },
          required: ['value'],
        },
      },
    },
  };
  const current = structuredClone(base);
  current.components.schemas.Example.properties.value.type = 'integer';

  const diff = compareContracts(base, current);

  assert.deepEqual(diff.breaking.map((item) => item.type), [
    'component_schema_changed',
  ]);
});
