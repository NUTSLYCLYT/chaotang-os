import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const ROOT = '/home/ubuntu/Projects/chaotang-os';
const FRONTEND = `${ROOT}/frontend`;
const BACKEND = `${ROOT}/backend`;

const cases = [
  {
    name: 'study-edict cron enters the canonical frontend',
    file: 'frontend/scripts/cron-verify-study-edict.sh',
    required: [`FE=${FRONTEND}`],
  },
  {
    name: 'self-healing cron example enters the canonical frontend',
    file: 'frontend/scripts/self-healing-monitor.sh',
    required: [`cd ${FRONTEND} && bash scripts/self-healing-monitor.sh`],
  },
  {
    name: 'system restore fallback points to the canonical backend production runner',
    file: 'frontend/scripts/system-restore.sh',
    required: [
      `cd ${BACKEND}`,
      '.venv/bin/python -m gunicorn -c gunicorn.conf.py web.main:app',
    ],
  },
  {
    name: 'real-swarm cron enters the canonical frontend',
    file: 'frontend/scripts/cron-chaotang-real-swarm-gate.sh',
    required: [
      `${FRONTEND}/scripts/cron-chaotang-real-swarm-gate.sh`,
      `FE=${FRONTEND}`,
    ],
  },
  {
    name: 'health monitor recovery instructions use canonical checkouts',
    file: 'frontend/scripts/health-monitor.mjs',
    required: [
      `cd ${FRONTEND} && node scripts/health-monitor.mjs`,
      `cd ${BACKEND} && .venv/bin/python -m gunicorn -c gunicorn.conf.py web.main:app`,
      `bash ${FRONTEND}/scripts/system-restore.sh`,
    ],
  },
  {
    name: 'daily metrics cron example enters the canonical frontend',
    file: 'frontend/scripts/daily-metrics.mjs',
    required: [`cd ${FRONTEND} &&`],
  },
  {
    name: 'evidence-deficit cron enters the canonical backend',
    file: 'backend/scripts/cron-evidence-deficit-daily.sh',
    required: [
      `${BACKEND}/scripts/cron-evidence-deficit-daily.sh`,
      `cd ${BACKEND}`,
    ],
  },
  {
    name: 'backend upgrade monitor tests the canonical backend',
    file: 'backend/scripts/backend_upgrade_watch.sh',
    required: [`PROJECT_ROOT="${BACKEND}"`],
  },
];

const banned = [
  'chaotang-web-lyt',
  'jiqun_ai_fresh',
  '/home/ubuntu/fe/fengQun',
  '/home/ubuntu/workspace/frontend',
];

for (const { name, file, required } of cases) {
  test(name, async () => {
    const content = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');

    for (const legacySource of banned) {
      assert.equal(
        content.includes(legacySource),
        false,
        `${file} still references legacy operational source: ${legacySource}`,
      );
    }

    for (const canonicalSource of required) {
      assert.equal(
        content.includes(canonicalSource),
        true,
        `${file} is missing canonical operational source: ${canonicalSource}`,
      );
    }
  });
}
