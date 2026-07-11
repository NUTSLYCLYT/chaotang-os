import { fetchLocalCourtApi } from '@/lib/jiqun-api';
import { normalizeJunjichuSourceLabel } from '../model/source-label';
import type { QualityGateView, SwarmRunMode, SwarmRunStatus, SwarmRunView } from '../model/types';

interface SwarmRunPayload {
  task_id?: string;
  command?: string;
  mode?: SwarmRunMode | string;
  departments?: string[];
  [key: string]: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function readJson<T>(res: Response, label: string): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `${label} failed with ${res.status}`);
  }
  return (await res.json()) as T;
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function normalizeStatus(value: unknown): SwarmRunStatus {
  if (value === 'running' || value === 'completed' || value === 'quality_blocked' || value === 'failed') return value;
  if (value === 'blocked') return 'quality_blocked';
  if (value === 'direct_completed') return 'completed';
  return 'idle';
}

function normalizeMode(value: unknown): SwarmRunMode {
  if (value === 'dry_run' || value === 'standard' || value === 'deep' || value === 'live_swarm') return value;
  return 'standard';
}

function normalizeGate(value: unknown): QualityGateView | null {
  if (!isRecord(value)) return null;
  const statusValue = value.status ?? value.gate_status;
  const status =
    statusValue === 'passed' || statusValue === 'warning' || statusValue === 'blocked'
      ? statusValue
      : 'idle';
  const blockingReasons = Array.isArray(value.blocking_reasons)
    ? value.blocking_reasons.map(String)
    : Array.isArray(value.blockingReasons)
      ? value.blockingReasons.map(String)
      : [];
  const warnings = Array.isArray(value.warnings) ? value.warnings.map(String) : [];
  return {
    status,
    blockingReasons,
    warnings,
    sourceLabel: normalizeJunjichuSourceLabel(value.source_label ?? value.sourceLabel, 'LIVE_SWARM'),
    canAdopt: status === 'passed' || status === 'warning',
    requiresHumanConfirmation: status === 'warning' || value.requires_human_confirmation === true,
  };
}

export function normalizeSwarmRun(value: unknown): SwarmRunView | null {
  if (!isRecord(value)) return null;
  const id = readString(value.id) ?? readString(value.swarm_run_id) ?? readString(value.run_id);
  if (!id) return null;
  const qualityResult = normalizeGate(value.quality_result ?? value.qualityResult);
  const taskRunsRaw = Array.isArray(value.task_runs) ? value.task_runs : Array.isArray(value.taskRuns) ? value.taskRuns : [];
  return {
    id,
    mode: normalizeMode(value.mode),
    status: normalizeStatus(value.status ?? (qualityResult?.status === 'blocked' ? 'quality_blocked' : undefined)),
    progressUrl: readString(value.progress_url) ?? readString(value.progressUrl),
    briefUrl: readString(value.brief_url) ?? readString(value.briefUrl),
    taskRuns: taskRunsRaw.filter(isRecord).map((item, index) => ({
      id: readString(item.id) ?? readString(item.task_id) ?? `${id}:${index}`,
      name: readString(item.name) ?? readString(item.swarm) ?? readString(item.department) ?? `swarm-${index + 1}`,
      status: readString(item.status) ?? 'unknown',
      summary: readString(item.summary) ?? readString(item.result),
    })),
    qualityResult,
    sourceLabel: normalizeJunjichuSourceLabel(value.source_label ?? value.sourceLabel, 'LIVE_SWARM'),
  };
}

export async function createSwarmRun(payload: SwarmRunPayload): Promise<SwarmRunView> {
  const res = await fetchLocalCourtApi('/api/swarm-runs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await readJson<unknown>(res, 'create swarm run');
  const run = normalizeSwarmRun(data);
  if (!run) throw new Error('蜂群产线返回缺少 swarm_run_id');
  return run;
}

export async function createSerialSwarmRun(payload: SwarmRunPayload): Promise<SwarmRunView> {
  const res = await fetchLocalCourtApi('/api/swarm-runs/serial', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await readJson<unknown>(res, 'create serial swarm run');
  const run = normalizeSwarmRun(data);
  if (!run) throw new Error('串行蜂群返回缺少 swarm_run_id');
  return run;
}

export async function getSwarmRun(runId: string): Promise<SwarmRunView> {
  const res = await fetchLocalCourtApi(`/api/swarm-runs/${encodeURIComponent(runId)}`);
  const data = await readJson<unknown>(res, 'get swarm run');
  const run = normalizeSwarmRun(data);
  if (!run) throw new Error('蜂群产线详情缺少 swarm_run_id');
  return run;
}

export async function getSwarmRunProgress(runId: string): Promise<unknown> {
  const res = await fetchLocalCourtApi(`/api/swarm-runs/${encodeURIComponent(runId)}/progress`);
  return readJson<unknown>(res, 'get swarm run progress');
}

export async function getSwarmRunBrief(runId: string): Promise<unknown> {
  const res = await fetchLocalCourtApi(`/api/swarm-runs/${encodeURIComponent(runId)}/brief`);
  return readJson<unknown>(res, 'get swarm run brief');
}

export async function retrySwarmRun(runId: string): Promise<SwarmRunView> {
  const res = await fetchLocalCourtApi(`/api/swarm-runs/${encodeURIComponent(runId)}/retry`, { method: 'POST' });
  const data = await readJson<unknown>(res, 'retry swarm run');
  const run = normalizeSwarmRun(data);
  if (!run) throw new Error('重跑蜂群返回缺少 swarm_run_id');
  return run;
}
