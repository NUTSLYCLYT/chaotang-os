import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const CANONICAL_ROOT = '/home/ubuntu/Projects/chaotang-os';

const cases = [
  {
    name: 'compose builds the backend from the monorepo',
    file: 'frontend/docker-compose.yml',
    banned: ['jiqun_ai_fresh'],
    required: ['build: ../backend'],
  },
  {
    name: 'web systemd unit runs the canonical frontend checkout',
    file: 'frontend/deploy/services/courtos-web.service.template',
    banned: ['/home/ubuntu/workspace/frontend/chaotang-web-lyt'],
    required: [
      `WorkingDirectory=${CANONICAL_ROOT}/frontend`,
      `EnvironmentFile=-${CANONICAL_ROOT}/frontend/.env.local`,
    ],
  },
  {
    name: 'frontend-owned backend unit runs the canonical backend checkout',
    file: 'frontend/deploy/services/jiqun.service.template',
    banned: ['/home/ubuntu/fe/fengQun/jiqun_ai_fresh', 'git@gitee.com:msxn/jiqun_ai.git'],
    required: [
      `WorkingDirectory=${CANONICAL_ROOT}/backend`,
      `EnvironmentFile=-${CANONICAL_ROOT}/backend/.env`,
    ],
  },
  {
    name: 'backend-owned systemd unit runs the canonical backend checkout',
    file: 'backend/scripts/jiqun_ai.service',
    banned: ['/home/ubuntu/workspace/jiqun_ai'],
    required: [
      `WorkingDirectory=${CANONICAL_ROOT}/backend`,
      `EnvironmentFile=${CANONICAL_ROOT}/backend/.env`,
    ],
  },
  {
    name: 'recovery guide restores one canonical monorepo',
    file: 'frontend/deploy/README.md',
    banned: [
      'chaotang-web-lyt',
      'jiqun_ai_fresh',
      '/home/ubuntu/workspace/frontend',
      '/home/ubuntu/fe/fengQun',
    ],
    required: [
      'git clone git@gitee.com:msxn/chaotang-os.git',
      CANONICAL_ROOT,
      `cd ${CANONICAL_ROOT}/frontend`,
    ],
  },
  {
    name: 'environment template names the canonical frontend',
    file: 'frontend/deploy/env.example',
    banned: ['chaotang-web-lyt'],
    required: ['chaotang-os frontend'],
  },
];

for (const { name, file, banned, required } of cases) {
  test(name, async () => {
    const content = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');

    for (const legacyPath of banned) {
      assert.equal(
        content.includes(legacyPath),
        false,
        `${file} still references legacy source: ${legacyPath}`,
      );
    }

    for (const canonicalPath of required) {
      assert.equal(
        content.includes(canonicalPath),
        true,
        `${file} is missing canonical source: ${canonicalPath}`,
      );
    }
  });
}
