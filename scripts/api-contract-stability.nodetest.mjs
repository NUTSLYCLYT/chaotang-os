import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
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

test('rejects attempts to repin the fixed baseline through the environment', () => {
  const result = spawnSync(
    process.execPath,
    ['scripts/api-contract-stability.mjs'],
    {
      cwd: new URL('..', import.meta.url),
      encoding: 'utf8',
      env: {
        ...process.env,
        API_CONTRACT_BASE_REF:
          'ea267d1c27cd8fa68ec3cee2f3356c06566c3923',
      },
    },
  );

  assert.notEqual(result.status, 0);
  assert.match(`${result.stderr}\n${result.stdout}`, /fixed baseline/i);
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

test('allows additive optional component properties without repinning', () => {
  const base = {
    paths: {},
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
  current.components.schemas.Example.properties.optional_identity = {
    anyOf: [{ type: 'string' }, { type: 'null' }],
  };

  const diff = compareContracts(base, current);

  assert.deepEqual(diff.breaking, []);
  assert.deepEqual(diff.warnings, [{
    type: 'component_optional_properties_added',
    key: 'Example',
    properties: ['optional_identity'],
  }]);
});
