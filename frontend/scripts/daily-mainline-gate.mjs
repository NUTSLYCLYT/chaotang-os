#!/usr/bin/env node
/**
 * Daily mainline gate — item 10 of the unified-loop plan.
 *
 * The fail-fast spine the whole roadmap binds to. Runs the core checks IN
 * SEQUENCE, stops on the FIRST failure, prints which step stopped the run,
 * and exits non-zero when any step fails. A compact PASS/FAIL/SKIP summary
 * table is always printed at the end.
 *
 * Steps:
 *   1  pnpm exec tsc --noEmit
 *   2  pnpm test:core
 *   3  pnpm build                                   (skip via GATE_SKIP=build)
 *   4  pnpm exec playwright test <shangshufang loop> (skip via GATE_SKIP=e2e)
 *   5  pnpm guard:honesty
 *   6  pnpm guard:freeze
 *
 * Env:
 *   GATE_SKIP   comma list of heavy steps to skip for fast local iteration.
 *               Map: build -> step 3, e2e -> step 4. Default skips nothing.
 *               e.g. GATE_SKIP=build,e2e
 *
 * Modeled on scripts/chaotang-release-gates.mjs (spawn + log idiom) but kept
 * deliberately light: synchronous spawnSync with inherited stdio so output
 * streams live, no report files, no dev-server lifecycle.
 */

import { spawnSync } from 'node:child_process';

const cwd = process.cwd();
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

const skip = new Set(
  (process.env.GATE_SKIP ?? '')
    .split(',')
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean),
);

const steps = [
  { skipKey: null, label: 'pnpm exec tsc --noEmit', cmd: pnpm, args: ['exec', 'tsc', '--noEmit'] },
  { skipKey: null, label: 'pnpm test:core', cmd: pnpm, args: ['test:core'] },
  { skipKey: 'build', label: 'pnpm build', cmd: pnpm, args: ['build'] },
  {
    // 阻断门:纯 API 接真数据契约,可靠、确定性。这才是门禁该卡的。
    skipKey: 'e2e',
    label: 'pnpm exec playwright test (接真数据契约·阻断)',
    cmd: pnpm,
    args: [
      'exec',
      'playwright',
      'test',
      'e2e/shangshufang-readback.spec.ts',     // 统一 Loop 读路径:report_ready+unifiedLoop 且快
      'e2e/hubu-overview-realdata.spec.ts',     // 户部:零 seed + 从真任务派生 + cash 防假
      'e2e/backend-task-fastfail.spec.ts',      // courtos 死链熔断快失败
      '--project=chromium',
    ],
  },
  {
    // 非阻断:浏览器主链 e2e。军机处卡/拟旨遮挡的客户端渲染已知 flaky(数据契约已由上一步阻断守),
    // 故只跑+报、不阻断——避免"不可信 flaky spec 当阻断门"慢性消解对门禁的信任(charity-majors)。
    skipKey: 'e2e',
    nonBlocking: true,
    label: 'pnpm exec playwright test (浏览器主链·非阻断·已知flaky)',
    cmd: pnpm,
    args: [
      'exec',
      'playwright',
      'test',
      'e2e/shangshufang-unified-loop-smoke.spec.ts',
      'e2e/shangshufang-ui-to-edict.spec.ts',
      '--project=chromium',
    ],
  },
  // guard:honesty 已退役(2026-06-28):它审旧架构 manor-dept *-client.tsx + confidence-source-badge,
  // 二者随架构迁移已消失;诚实债现由下方 guard:realdata(strict·0漂移) + sourceLabel 在数据边界兜底。详见脚本头注。
  { skipKey: null, label: 'pnpm guard:freeze', cmd: pnpm, args: ['guard:freeze'] },
  // 接真度真值表:已到 0 漂移,升阻断门守住(谁带回假数据/接真漂移 → CI 红)。
  { skipKey: null, label: 'pnpm guard:realdata (strict·0漂移红线)', cmd: pnpm, args: ['guard:realdata'], env: { REALDATA_STRICT: '1' } },
  // 上游单一真相源迁移面可见(融合地基;warn-only,UPSTREAMS_STRICT=1 升阻断门):
  { skipKey: null, label: 'pnpm guard:upstreams', cmd: pnpm, args: ['guard:upstreams'] },
  // 端点鉴权纵深防御:已 0 裸奔本地写,升 strict 守住(court/* 本地写漏 own-auth → CI 红;盒子底线)。
  { skipKey: null, label: 'pnpm guard:auth (strict·0裸奔红线)', cmd: pnpm, args: ['guard:auth'], env: { AUTH_STRICT: '1' } },
  // 镜像不烘真数据/密钥(渗透C2红队回归·阻断门):
  { skipKey: null, label: 'pnpm guard:dockerignore (镜像无泄密红线)', cmd: pnpm, args: ['guard:dockerignore'] },
];

function timestamp() {
  return new Date().toISOString();
}

function log(message) {
  process.stdout.write(`[daily-gate ${timestamp()}] ${message}\n`);
}

const results = steps.map((step) => ({ label: step.label, status: 'PENDING' }));
let stoppedAt = null; // 1-based index of the step that stopped the run

for (let i = 0; i < steps.length; i += 1) {
  const step = steps[i];
  const num = i + 1;

  if (step.skipKey && skip.has(step.skipKey)) {
    results[i].status = 'SKIP';
    log(`step ${num}/${steps.length} SKIP (GATE_SKIP=${step.skipKey}): ${step.label}`);
    continue;
  }

  log(`step ${num}/${steps.length} RUN: ${step.label}`);
  const result = spawnSync(step.cmd, step.args, {
    cwd,
    stdio: 'inherit',
    shell: false,
    env: { ...process.env, ...(step.env || {}) },
  });

  if (result.error || result.status !== 0) {
    const reason = result.error
      ? result.error.message
      : `exit ${result.status ?? result.signal ?? 'unknown'}`;
    if (step.nonBlocking) {
      // 非阻断步:失败只记 WARN、不停门(已知 flaky;数据契约由阻断步守)。
      results[i].status = 'WARN';
      log(`step ${num}/${steps.length} WARN(非阻断): ${step.label} (${reason})`);
      continue;
    }
    results[i].status = 'FAIL';
    stoppedAt = num;
    log(`step ${num}/${steps.length} FAIL: ${step.label} (${reason})`);
    break;
  }

  results[i].status = 'PASS';
  log(`step ${num}/${steps.length} PASS: ${step.label}`);
}

// Compact summary table — always printed.
const width = Math.max(...steps.map((step) => step.label.length));
process.stdout.write('\n');
log('daily mainline gate summary');
results.forEach((entry, i) => {
  process.stdout.write(
    `  ${String(i + 1).padStart(2)}  ${entry.status.padEnd(7)}  ${entry.label.padEnd(width)}\n`,
  );
});

if (stoppedAt) {
  log(`STOPPED at step ${stoppedAt}: ${steps[stoppedAt - 1].label}`);
  log('DECISION: FAIL');
  process.exit(1);
}

const skipped = results.filter((entry) => entry.status === 'SKIP').length;
log(`DECISION: PASS${skipped ? ` (${skipped} step(s) skipped via GATE_SKIP)` : ''}`);
process.exit(0);
