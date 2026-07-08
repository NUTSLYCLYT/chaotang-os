/**
 * 朝堂 OS · LLM Telemetry · 调用审计
 *
 * 当前：stderr JSON · 可被 Loki / Vector / OpenTelemetry collector 抓
 * 上线后：再加一层进 audit DB（已有 audit-emitter）
 */

import { logger } from '@/lib/logger';
import { safeAppend } from './safe-jsonl';
import type { ModelGovernanceVerdict, ProviderId } from './types';

const AUDIT_PATH = process.env.LLM_AUDIT_PATH ?? '/tmp/courtos-llm-audit.jsonl';

async function appendAudit(rec: CallRecord & { ts: string }) {
  try {
    await safeAppend(AUDIT_PATH, JSON.stringify(rec));
  } catch (err) {
    logger.warn('llm audit write failed', {
      err: err instanceof Error ? err.message : String(err),
    });
  }
}

export interface CallRecord {
  requestId: string;
  intent: string;
  modelId: string;
  provider: ProviderId;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number;
  attempts: number;
  ok: boolean;
  err?: string;
  fallback?: boolean;
  governance?: ModelGovernanceVerdict;
}

/** 单个调用入审计 · 全字段结构化 + 自动入进程聚合 */
export function recordCall(rec: CallRecord): void {
  const log = logger.child({ requestId: rec.requestId });
  if (rec.ok) {
    log.info('llm_call', {
      llm: {
        intent: rec.intent,
        model: rec.modelId,
        provider: rec.provider,
        in: rec.inputTokens,
        out: rec.outputTokens,
        cost_usd: rec.costUsd,
        latency_ms: rec.latencyMs,
        attempts: rec.attempts,
        fallback: rec.fallback ?? false,
        governance: rec.governance
          ? {
              mode: rec.governance.policy.mode,
              risk: rec.governance.policy.riskLevel,
              status: rec.governance.status,
              human_gate: rec.governance.policy.humanGate.required,
              allow_fallback: rec.governance.policy.allowFallback,
              warnings: rec.governance.warnings,
            }
          : undefined,
      },
    });
  } else {
    log.warn('llm_call_failed', {
      llm: {
        intent: rec.intent,
        model: rec.modelId,
        provider: rec.provider,
        attempt: rec.attempts,
        err: rec.err,
        governance: rec.governance
          ? {
              mode: rec.governance.policy.mode,
              risk: rec.governance.policy.riskLevel,
              status: rec.governance.status,
              warnings: rec.governance.warnings,
            }
          : undefined,
      },
    });
  }
  appendRecent(rec);
  void appendAudit({ ...rec, ts: new Date().toISOString() });
}

/* ==========================================================================
 * 进程内聚合 · /api/llm/stats 可读
 * 简化设计：只记最近 1000 条 · 不持久化
 * ========================================================================== */

const recentCalls: CallRecord[] = [];
const MAX_RECENT = 1000;

export function appendRecent(rec: CallRecord): void {
  recentCalls.push(rec);
  if (recentCalls.length > MAX_RECENT) recentCalls.splice(0, recentCalls.length - MAX_RECENT);
}

export function getRecentStats(): {
  totalCalls: number;
  totalCostUsd: number;
  byProvider: Record<string, { count: number; cost: number; failed: number }>;
  byIntent: Record<string, { count: number; cost: number; avgLatency: number }>;
  governance: {
    byStatus: Record<string, number>;
    byRisk: Record<string, number>;
    humanGateRequired: number;
    fallbackPolicyViolations: number;
    recentWarnings: Array<{
      requestId: string;
      intent: string;
      status: string;
      riskLevel: string;
      warnings: string[];
    }>;
  };
} {
  const byProvider: Record<string, { count: number; cost: number; failed: number }> = {};
  const byIntent: Record<string, { count: number; cost: number; latSum: number }> = {};
  const byStatus: Record<string, number> = {};
  const byRisk: Record<string, number> = {};
  const recentWarnings: Array<{
    requestId: string;
    intent: string;
    status: string;
    riskLevel: string;
    warnings: string[];
  }> = [];
  let totalCost = 0;
  let humanGateRequired = 0;
  let fallbackPolicyViolations = 0;

  for (const r of recentCalls) {
    totalCost += r.costUsd;
    byProvider[r.provider] ??= { count: 0, cost: 0, failed: 0 };
    byProvider[r.provider]!.count++;
    byProvider[r.provider]!.cost += r.costUsd;
    if (!r.ok) byProvider[r.provider]!.failed++;

    if (r.ok) {
      byIntent[r.intent] ??= { count: 0, cost: 0, latSum: 0 };
      byIntent[r.intent]!.count++;
      byIntent[r.intent]!.cost += r.costUsd;
      byIntent[r.intent]!.latSum += r.latencyMs;
    }

    if (r.governance) {
      const status = r.governance.status;
      const risk = r.governance.policy.riskLevel;
      byStatus[status] = (byStatus[status] ?? 0) + 1;
      byRisk[risk] = (byRisk[risk] ?? 0) + 1;
      if (r.governance.policy.humanGate.required) humanGateRequired++;
      if (!r.governance.policy.allowFallback && r.governance.fallbackUsed) {
        fallbackPolicyViolations++;
      }
      if (r.governance.warnings.length > 0) {
        recentWarnings.push({
          requestId: r.requestId,
          intent: r.intent,
          status,
          riskLevel: risk,
          warnings: r.governance.warnings,
        });
        if (recentWarnings.length > 20) recentWarnings.shift();
      }
    }
  }

  const byIntentNorm: Record<string, { count: number; cost: number; avgLatency: number }> = {};
  for (const [k, v] of Object.entries(byIntent)) {
    byIntentNorm[k] = {
      count: v.count,
      cost: v.cost,
      avgLatency: Math.round(v.latSum / v.count),
    };
  }

  return {
    totalCalls: recentCalls.length,
    totalCostUsd: totalCost,
    byProvider,
    byIntent: byIntentNorm,
    governance: {
      byStatus,
      byRisk,
      humanGateRequired,
      fallbackPolicyViolations,
      recentWarnings,
    },
  };
}
