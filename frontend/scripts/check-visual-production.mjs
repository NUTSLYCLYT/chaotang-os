#!/usr/bin/env node
/**
 * Visual production dependency doctor.
 *
 * Read-only checks for the CourtOS visual production stack:
 * - manifest readability
 * - service HTTP health
 * - VAM visual production board
 * - provider bridge readiness
 * - latest playable output signal
 */

import fs from 'node:fs/promises';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';

const cwd = process.cwd();
const manifestPath = process.env.VISUAL_PRODUCTION_MANIFEST
  ?? path.join(cwd, 'config', 'visual-production.manifest.json');
const asJson = process.argv.includes('--json');
const timeoutMs = Number(process.env.VISUAL_DOCTOR_TIMEOUT_MS ?? 8000);

function requestJson(url, timeout = timeoutMs) {
  return new Promise((resolve) => {
    const client = url.startsWith('https:') ? https : http;
    const req = client.get(url, { headers: { Accept: 'application/json' } }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(body);
        } catch {
          // keep null
        }
        resolve({
          ok: (res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 300,
          status: res.statusCode ?? 0,
          json,
          body: json ? undefined : body.slice(0, 240),
        });
      });
    });
    req.on('error', (error) => resolve({ ok: false, status: 0, error: error.message }));
    req.setTimeout(timeout, () => {
      req.destroy();
      resolve({ ok: false, status: 0, error: 'timeout' });
    });
  });
}

function joinUrl(base, suffix) {
  return `${String(base).replace(/\/$/, '')}${suffix.startsWith('/') ? suffix : `/${suffix}`}`;
}

function providerEnvReady(provider) {
  const readyWhen = provider.ready_when ?? [];
  if (provider.id === 'image2') {
    return Boolean(process.env.OPENAI_API_KEY || process.env.IMAGE2_API_KEY);
  }
  if (provider.id === 'video_mcp') {
    return Boolean(process.env.VIDEO_MCP_URL || process.env.VIDEO_MCP_ENDPOINT);
  }
  if (provider.id === 'wan2.2') {
    return Boolean(process.env.WAN_API_WORKFLOW);
  }
  return readyWhen.length === 0;
}

async function main() {
  const startedAt = Date.now();
  const manifestRaw = await fs.readFile(manifestPath, 'utf8');
  const manifest = JSON.parse(manifestRaw);
  const checks = [];

  checks.push({
    id: 'manifest',
    ok: true,
    state: 'ready',
    detail: `${manifest.schema} @ ${manifest.updated_at}`,
    path: manifestPath,
  });

  for (const service of manifest.services ?? []) {
    const healthPath = service.health_path ?? '/';
    const url = joinUrl(service.url, healthPath);
    const response = await requestJson(url);
    checks.push({
      id: `service:${service.id}`,
      ok: response.ok || service.expected_state === 'degradable' || service.expected_state === 'degradable_for_visual' || service.expected_state === 'dev_optional',
      state: response.ok ? 'ready' : service.expected_state === 'required_for_visual' ? 'blocked' : 'degraded',
      url,
      status: response.status,
      requiredFor: service.required_for,
      detail: response.ok ? 'reachable' : response.error ?? response.body ?? 'unreachable',
    });

    if (service.id === 'vam_studio' && service.board_path) {
      const boardUrl = joinUrl(service.url, service.board_path);
      const board = await requestJson(boardUrl, Math.max(timeoutMs, 15000));
      const jobs = board.json?.jobs;
      const quality = board.json?.quality;
      const latestOutputCount = Array.isArray(jobs?.jobs)
        ? jobs.jobs.filter((job) => (job.runtime?.outputs?.length ?? 0) > 0).length
        : 0;
      checks.push({
        id: 'vam:visual-board',
        ok: board.ok && board.json?.status === 'ready',
        state: board.ok ? 'ready' : 'blocked',
        url: boardUrl,
        status: board.status,
        detail: board.ok
          ? `jobs=${jobs?.count ?? 0}; quality=${quality?.score ?? 'n/a'}; jobs_with_outputs=${latestOutputCount}`
          : board.error ?? board.body ?? 'visual board unreachable',
        summary: {
          jobCount: jobs?.count ?? 0,
          qualityScore: quality?.score ?? null,
          jobsWithOutputs: latestOutputCount,
          providerStatus: board.json?.provider_status ?? null,
        },
      });

      const statusUrl = joinUrl(service.url, '/api/status');
      const status = await requestJson(statusUrl, Math.max(timeoutMs, 15000));
      const latestVideo = status.json?.latest_video;
      const outputCount = latestVideo?.outputs?.length ?? 0;
      checks.push({
        id: 'vam:latest-video',
        ok: status.ok,
        state: status.ok && outputCount > 0 ? 'ready' : status.ok ? 'no_output_yet' : 'degraded',
        url: statusUrl,
        status: status.status,
        detail: status.ok
          ? `latest_video=${latestVideo?.job_id ?? 'none'}; status=${latestVideo?.status ?? 'none'}; outputs=${outputCount}`
          : status.error ?? status.body ?? 'status unreachable',
        summary: {
          latestVideoId: latestVideo?.job_id ?? null,
          latestVideoStatus: latestVideo?.status ?? null,
          outputCount,
        },
      });
    }
  }

  for (const provider of manifest.providers ?? []) {
    const envReady = providerEnvReady(provider);
    checks.push({
      id: `provider:${provider.id}`,
      ok: envReady || provider.degradation === 'job_package_only' || provider.degradation === 'package_only',
      state: envReady ? 'ready' : provider.degradation ?? 'degraded',
      detail: envReady ? 'provider env configured' : `not configured; degradation=${provider.degradation}`,
      readyWhen: provider.ready_when,
    });
  }

  const failed = checks.filter((check) => !check.ok);
  const result = {
    status: failed.length === 0 ? 'ready' : 'blocked',
    elapsedMs: Date.now() - startedAt,
    manifest: manifestPath,
    failed: failed.map((check) => check.id),
    checks,
  };

  if (asJson) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`Visual Production Doctor: ${result.status.toUpperCase()} (${result.elapsedMs}ms)`);
    for (const check of checks) {
      const mark = check.ok ? 'OK ' : 'BAD';
      console.log(`${mark} ${check.id} [${check.state}] ${check.detail}`);
    }
  }

  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((error) => {
  const result = {
    status: 'blocked',
    manifest: manifestPath,
    error: error instanceof Error ? error.message : String(error),
  };
  if (asJson) console.log(JSON.stringify(result, null, 2));
  else console.error(`Visual Production Doctor: BLOCKED\n${result.error}`);
  process.exit(1);
});
