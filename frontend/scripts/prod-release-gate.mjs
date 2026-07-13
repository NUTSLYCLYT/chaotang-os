#!/usr/bin/env node
/**
 * Production release gate for ChaotangOS.
 *
 * This is the one red/green gate before exposing the current build:
 *   1. production doctor on :3050 + /chaotang
 *   2. final browser release harness
 *   3. live jiqun backend contract smoke
 *
 * It intentionally reuses existing gates instead of creating a parallel QA
 * system. A skipped jiqun smoke is a release STOP by default, because a public
 * launch without the execution arm is not a green launch.
 */

import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';

import { runJiqunContractSmoke } from './jiqun-contract-smoke.mjs';
import { assertReleaseCommander } from '../../scripts/lib/release-commander.mjs';

const execFileAsync = promisify(execFile);
const cwd = process.cwd();

for (const envFile of [
  path.join(cwd, '.env.local'),
  process.env.CHAOTANG_BACKEND_ENV_FILE,
  process.env.JIQUN_ENV_FILE,
  process.env.JIQUN_AI_ENV_FILE,
  path.resolve(cwd, '..', 'backend', '.env'),
]) {
  if (envFile) loadEnvFile(envFile);
}

const baseUrl = process.env.HARNESS_BASE_URL ?? process.env.PROD_DOCTOR_BASE_URL ?? 'http://127.0.0.1:3050';
const basePath = process.env.HARNESS_BASE_PATH ?? process.env.PROD_DOCTOR_BASE_PATH ?? '/chaotang';
const allowJiqunSkip = process.env.RELEASE_GATE_ALLOW_JIQUN_SKIP === '1';
const requireAuthArmed = process.env.RELEASE_GATE_REQUIRE_AUTH_ARMED !== '0';
const requireTrueChain = process.env.RELEASE_GATE_REQUIRE_TRUE_CHAIN !== '0';

const summary = [];

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const idx = line.indexOf('=');
    const key = line.slice(0, idx).trim().replace(/^export\s+/, '');
    let value = line.slice(idx + 1).trim();
    if (!key || key.startsWith('export ')) continue;
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] == null) process.env[key] = value;
  }
}

function printSection(title) {
  console.log(`\n== ${title} ==`);
}

async function runCommand(id, command, args, options = {}) {
  printSection(id);
  try {
    const { stdout, stderr } = await execFileAsync(command, args, {
      cwd,
      timeout: options.timeoutMs ?? 120_000,
      maxBuffer: options.maxBuffer ?? 1024 * 1024 * 4,
      env: {
        ...process.env,
        HARNESS_BASE_URL: baseUrl,
        HARNESS_BASE_PATH: basePath,
        PROD_DOCTOR_BASE_URL: baseUrl,
        PROD_DOCTOR_BASE_PATH: basePath,
        ...(requireTrueChain ? { HARNESS_REQUIRE_TRUE_CHAIN: '1' } : {}),
        ...(requireAuthArmed ? { HARNESS_REQUIRE_AUTH_ARMED: '1' } : {}),
        ...options.env,
      },
    });
    if (stdout.trim()) console.log(stdout.trim());
    if (stderr.trim()) console.error(stderr.trim());
    summary.push({ id, ok: true });
    return { ok: true, stdout, stderr };
  } catch (error) {
    const stdout = String(error?.stdout ?? '');
    const stderr = String(error?.stderr ?? '');
    if (stdout.trim()) console.log(stdout.trim());
    if (stderr.trim()) console.error(stderr.trim());
    const detail = error?.message ?? `${command} ${args.join(' ')} failed`;
    summary.push({ id, ok: false, detail });
    return { ok: false, stdout, stderr, detail };
  }
}

function parseProdDoctor(stdout) {
  try {
    return JSON.parse(stdout);
  } catch {
    return null;
  }
}

async function runProdDoctorGate() {
  const result = await runCommand('prod-doctor', 'node', ['scripts/prod-doctor.mjs', '--json'], {
    timeoutMs: 20_000,
  });
  const report = parseProdDoctor(result.stdout);
  const failed = report?.checks?.filter((check) => check.ok === false).map((check) => check.id).join(', ') || 'invalid-report';
  const commandSummary = summary.find((item) => item.id === 'prod-doctor');
  if (!result.ok) {
    if (commandSummary) commandSummary.detail = `${report?.decision ?? 'COMMAND_FAILED'}: ${failed}`;
    return false;
  }
  if (!report || report.decision !== 'PROD') {
    const decision = report?.decision ?? 'UNKNOWN';
    summary.push({ id: 'prod-doctor-decision', ok: false, detail: `${decision}: ${failed}` });
    console.error(`prod-doctor decision is ${decision}, expected PROD (${failed})`);
    return false;
  }
  summary.push({ id: 'prod-doctor-decision', ok: true, detail: 'PROD' });
  return true;
}

async function runHarnessGate() {
  const result = await runCommand('final-release-harness', 'node', ['scripts/final-release-harness.mjs'], {
    timeoutMs: 180_000,
    maxBuffer: 1024 * 1024 * 8,
  });
  return result.ok;
}

async function runJiqunGate() {
  printSection('jiqun-live-smoke');
  try {
    const result = await runJiqunContractSmoke();
    const ok = result.failed === 0 && result.alive === true && result.skipped === 0;
    if (!ok) {
      const detail = result.alive
        ? `failed=${result.failed}, skipped=${result.skipped}`
        : `jiqun unreachable, skipped=${result.skipped}`;
      const allowed = allowJiqunSkip && result.alive === false;
      summary.push({ id: 'jiqun-live-smoke', ok: allowed, detail: allowed ? `${detail} (allowed)` : detail });
      if (!allowed) {
        console.error(`jiqun live smoke is not green: ${detail}`);
        return false;
      }
    } else {
      summary.push({ id: 'jiqun-live-smoke', ok: true, detail: `${result.passed} contracts` });
    }
    return true;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    summary.push({ id: 'jiqun-live-smoke', ok: false, detail });
    console.error(detail);
    return false;
  }
}

function printSummary(ok) {
  printSection('release-gate-summary');
  for (const item of summary) {
    console.log(`${item.ok ? 'PASS' : 'FAIL'} ${item.id}${item.detail ? ` — ${item.detail}` : ''}`);
  }
  console.log(`\n${ok ? 'GREEN: release gate passed.' : 'RED: release gate failed.'}`);
}

async function main() {
  const testBypass=process.env.NODE_ENV==='test'&&process.env.CHAOTANG_CONTROL_PLANE_TEST_ADAPTER==='1'&&process.env.CHAOTANG_TEST_COMMANDER_BYPASS==='1';
  if(!testBypass)assertReleaseCommander({releaseId:process.env.CHAOTANG_RELEASE_RUN_ID,taskId:process.env.CHAOTANG_RELEASE_TASK_ID,commander:process.env.CHAOTANG_RELEASE_COMMANDER,credential:{fencingEpoch:Number(process.env.CHAOTANG_RELEASE_EPOCH),nonce:process.env.CHAOTANG_RELEASE_NONCE}},{cwd:path.resolve(cwd,'..')});
  console.log(`ChaotangOS production release gate`);
  console.log(`baseUrl=${baseUrl} basePath=${basePath}`);
  console.log(`requireTrueChain=${requireTrueChain} requireAuthArmed=${requireAuthArmed} allowJiqunSkip=${allowJiqunSkip}`);

  const prodDoctorOk = await runProdDoctorGate();
  if (!prodDoctorOk) {
    printSummary(false);
    process.exit(1);
  }

  const harnessOk = await runHarnessGate();
  if (!harnessOk) {
    printSummary(false);
    process.exit(1);
  }

  const jiqunOk = await runJiqunGate();
  printSummary(jiqunOk);
  process.exit(jiqunOk ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(2);
});
