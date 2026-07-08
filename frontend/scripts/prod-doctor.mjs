#!/usr/bin/env node
/**
 * Production doctor for Chaotang.
 *
 * Read-only release gate:
 * - validates port/process discipline before page QA
 * - validates production build artifacts
 * - validates 3050 HTTP health
 * - validates true-chain health and classifies STOP/FIX/PROD
 */

import { execFile } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const cwd = process.cwd();
const baseUrl = process.env.PROD_DOCTOR_BASE_URL ?? process.env.HARNESS_BASE_URL ?? 'http://127.0.0.1:3050';
const basePath = process.env.PROD_DOCTOR_BASE_PATH ?? process.env.HARNESS_BASE_PATH ?? '/chaotang';
const asJson = process.argv.slice(2).includes('--json');
const allowDev = process.env.PROD_DOCTOR_ALLOW_DEV === '1';

function b64url(input) {
  return Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function makeToken() {
  const now = Math.floor(Date.now() / 1000);
  return `${b64url(JSON.stringify({ alg: 'none', typ: 'JWT' }))}.${b64url(JSON.stringify({
    sub: 'prod-doctor',
    username: 'prod-doctor',
    tenantId: 6,
    accountType: 0,
    iat: now,
    exp: now + 60 * 60,
  }))}.prod-doctor`;
}

async function run(command, args) {
  try {
    const { stdout } = await execFileAsync(command, args, { cwd, timeout: 5000, maxBuffer: 1024 * 1024 });
    return stdout;
  } catch (error) {
    return error?.stdout ? String(error.stdout) : '';
  }
}

async function getProcessLines() {
  const stdout = await run('ps', ['-eo', 'pid,ppid,stat,etime,cmd']);
  return stdout.split('\n').filter(Boolean);
}

async function getListeningLines() {
  const stdout = await run('ss', ['-tlnp']);
  return stdout.split('\n').filter(Boolean);
}

function requestText(url, timeoutMs, token) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result) => {
      if (!settled) {
        settled = true;
        resolve(result);
      }
    };
    const client = url.startsWith('https:') ? https : http;
    const headers = token
      ? {
          Cookie: `courtos.access_token=${encodeURIComponent(token)}`,
          Accept: 'application/json',
        }
      : { Accept: 'application/json' };

    const req = client.get(url, { headers }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        finish({
          ok: (res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 300,
          status: res.statusCode ?? 0,
          body,
        });
      });
    });
    req.on('error', (error) => finish({ ok: false, status: 0, body: error.message }));
    req.setTimeout(timeoutMs, () => {
      finish({ ok: false, status: 0, body: 'request timeout' });
      req.destroy();
    });
  });
}

function checkBuildArtifacts() {
  const required = [
    '.next/package.json',
    '.next/required-server-files.json',
    '.next/server/app-paths-manifest.json',
    '.next/server/middleware-manifest.json',
    '.next/static',
  ];
  const missing = required.filter((file) => !fs.existsSync(path.join(cwd, file)));
  const devArtifactPresent = fs.existsSync(path.join(cwd, '.next/dev'));
  const buildDiagnosticsPath = path.join(cwd, '.next/diagnostics/build-diagnostics.json');
  const buildDiagnostics = fs.existsSync(buildDiagnosticsPath)
    ? JSON.parse(fs.readFileSync(buildDiagnosticsPath, 'utf8'))
    : null;

  return {
    id: 'build-artifacts',
    ok: missing.length === 0,
    state: missing.length > 0 ? 'missing' : 'ready',
    missing,
    devArtifactPresent,
    buildDiagnostics,
    detail: missing.length > 0
        ? `missing production artifacts: ${missing.join(', ')}`
        : devArtifactPresent
          ? 'production artifacts present; .next/dev exists but no dev listener is allowed by port-discipline.'
          : 'production artifacts present',
  };
}

function classifyPorts(listeningLines, processLines) {
  const trackedPorts = ['3001', '3002', '3050', '3051', '3052', '3053', '3054'];
  const trackedListeners = trackedPorts
    .map((port) => ({ port, lines: listeningLines.filter((line) => line.includes(`:${port}`)) }))
    .filter((item) => item.lines.length > 0);
  const dynamicNextListeners = listeningLines
    .filter((line) => line.includes('next-server'))
    .map((line) => {
      const match = line.match(/:(\d+)\s+/);
      return match ? { port: match[1], lines: [line] } : null;
    })
    .filter(Boolean);
  const merged = new Map();
  for (const item of [...trackedListeners, ...dynamicNextListeners]) {
    const current = merged.get(item.port) ?? { port: item.port, lines: [] };
    current.lines.push(...item.lines.filter((line) => !current.lines.includes(line)));
    merged.set(item.port, current);
  }
  const listeners = [...merged.values()]
    .map((item) => ({ ...item, sameRepo: item.lines.some((line) => listenerBelongsToCwd(line)) }))
    .sort((a, b) => Number(a.port) - Number(b.port));
  const nonStandardNext = listeners.filter((item) => item.sameRepo && !['3002', '3050'].includes(item.port));
  const prod3050 = listeners.find((item) => item.port === '3050');
  const dev3002 = listeners.find((item) => item.port === '3002');
  const nextDevSameRepo = processLines.filter(
    (line) => line.includes('next dev -p 3002') && line.includes(cwd),
  );

  const failures = [];
  if (!prod3050) failures.push('3050_not_listening');
  if (nonStandardNext.length > 0) failures.push(`non_standard_next_ports:${nonStandardNext.map((item) => item.port).join(',')}`);
  if (!allowDev && dev3002 && nextDevSameRepo.length > 0) failures.push('same_repo_dev_3002_running');

  return {
    id: 'port-discipline',
    ok: failures.length === 0,
    state: failures.length > 0 ? 'fix' : 'ready',
    failures,
    listeners,
    detail: failures.length > 0
      ? failures.join('; ')
      : '3050 is the only production Next listener; no blocking dev/non-standard port detected.',
  };
}

function listenerBelongsToCwd(line) {
  const match = line.match(/pid=(\d+)/);
  if (!match) return false;
  try {
    return fs.realpathSync(`/proc/${match[1]}/cwd`) === fs.realpathSync(cwd);
  } catch {
    return false;
  }
}

async function checkHttpHealth() {
  const url = `${baseUrl}${basePath}/api/health`;
  const response = await requestText(url, 5000);
  let json = null;
  try {
    json = JSON.parse(response.body);
  } catch {
    // keep null
  }
  return {
    id: 'http-health',
    ok: response.ok,
    state: response.ok ? (json?.status ?? 'ready') : 'down',
    status: response.status,
    url,
    body: json ?? response.body.slice(0, 240),
  };
}

async function checkTrueChain() {
  const url = `${baseUrl}${basePath}/api/court/true-chain-health`;
  const response = await requestText(url, 9000, makeToken());
  if (!response.ok) {
    return {
      id: 'true-chain',
      ok: false,
      state: 'stop',
      status: response.status,
      url,
      detail: response.body.slice(0, 240),
      failedRequired: ['true-chain-health-unreachable'],
    };
  }

  let json;
  try {
    json = JSON.parse(response.body);
  } catch {
    return {
      id: 'true-chain',
      ok: false,
      state: 'stop',
      status: response.status,
      url,
      detail: `invalid json: ${response.body.slice(0, 240)}`,
      failedRequired: ['true-chain-health-invalid-json'],
    };
  }

  const data = json?.data;
  const checks = Array.isArray(data?.checks) ? data.checks : [];
  const failedRequired = checks
    .filter((check) => check?.requiredForLive && ['down', 'missing'].includes(check?.state))
    .map((check) => ({
      key: check.key,
      label: check.label,
      state: check.state,
      detail: check.detail,
    }));
  const ok =
    failedRequired.length === 0 &&
    data?.liveReady?.backend === true &&
    data?.liveReady?.swarmRun === true &&
    data?.liveReady?.requiredDependencies === true;

  return {
    id: 'true-chain',
    ok,
    state: ok ? 'ready' : 'fix',
    status: response.status,
    url,
    liveReady: data?.liveReady,
    summary: data?.summary,
    failedRequired,
    recommendation: data?.recommendation,
  };
}

function decide(checks) {
  if (!checks.find((check) => check.id === 'port-discipline')?.ok) return 'STOP';
  if (!checks.find((check) => check.id === 'build-artifacts')?.ok) return 'STOP';
  if (!checks.find((check) => check.id === 'http-health')?.ok) return 'STOP';
  if (!checks.find((check) => check.id === 'true-chain')?.ok) return 'FIX';
  return 'PROD';
}

const [processLines, listeningLines] = await Promise.all([getProcessLines(), getListeningLines()]);
const portDiscipline = classifyPorts(listeningLines, processLines);
const buildArtifacts = checkBuildArtifacts();
const httpHealth = await checkHttpHealth();
const trueChain = httpHealth.ok ? await checkTrueChain() : {
  id: 'true-chain',
  ok: false,
  state: 'stop',
  detail: 'skipped because 3050 HTTP health is unavailable',
  failedRequired: ['http-health-unavailable'],
};

const checks = [portDiscipline, buildArtifacts, httpHealth, trueChain];
const decision = decide(checks);
const report = {
  checkedAt: new Date().toISOString(),
  cwd,
  baseUrl,
  basePath,
  decision,
  allowDev,
  summary: {
    total: checks.length,
    passed: checks.filter((check) => check.ok).length,
    failed: checks.filter((check) => !check.ok).map((check) => check.id),
  },
  checks,
};

if (asJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`prod-doctor decision: ${decision}`);
  for (const check of checks) {
    console.log(`${check.ok ? 'PASS' : 'FAIL'} ${check.id}: ${check.detail ?? check.state}`);
  }
  if (trueChain?.failedRequired?.length) {
    console.log('failed required dependencies:');
    for (const item of trueChain.failedRequired) {
      if (typeof item === 'string') console.log(`- ${item}`);
      else console.log(`- ${item.key}: ${item.state} · ${item.detail}`);
    }
  }
}

process.exit(decision === 'PROD' ? 0 : decision === 'FIX' ? 1 : 2);
