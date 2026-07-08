/**
 * 吏部招聘真链 · 诚实 envelope 构造(纯逻辑,可测) · 2026-06-22
 *
 * 把"jiqun 蜂群是否真启动 + 验真承重墙结果"翻成一个诚实的 sourceLabel envelope。
 * 铁律(会审 wy1tg27my C4):**只有验真通过(session 可向后端兑现)才敢标 LIVE_SWARM;
 * 否则一律 FALLBACK,绝不冒充真。** 这条纯函数是吏部第一条真链的诚实闸,被 nodetest 钉死。
 */
import type { SourceLabel } from '../types';
import type { ReverifyResult } from './reverify-swarm-trace.ts';

export interface RecruitEnvelope {
  success: boolean;
  sourceLabel: SourceLabel;
  trace_id: string | null;
  status: 'running' | 'failed';
  confidence: number;
  missingEvidence: string[];
  reverifyReason: string;
  message: string;
}

export interface RecruitInput {
  /** jiqun /api/swarm/run 是否成功返回 */
  jiqunOk: boolean;
  /** 返回的 session_id(null = 没拿到) */
  sessionId: string | null;
  /** 验真承重墙结果(null = 没走到验真) */
  reverify: ReverifyResult | null;
  httpDetail?: string;
}

export function buildRecruitEnvelope(input: RecruitInput): RecruitEnvelope {
  if (!input.jiqunOk || !input.sessionId) {
    return {
      success: false,
      sourceLabel: 'FALLBACK',
      trace_id: null,
      status: 'failed',
      confidence: 0,
      missingEvidence: ['jiqun 蜂群未返回可追踪 session'],
      reverifyReason: input.httpDetail ?? 'jiqun /api/swarm/run 未返回 session',
      message: '后端蜂群未启动,降级 FALLBACK(诚实:非真链)',
    };
  }
  const verified = input.reverify?.verified === true;
  const sourceLabel: SourceLabel = verified ? 'LIVE_SWARM' : 'FALLBACK';
  return {
    success: true,
    sourceLabel,
    trace_id: input.sessionId,
    status: 'running',
    confidence: verified ? 0.85 : 0.4,
    missingEvidence: verified ? [] : ['trace 未通过后端兑现核对,降级 FALLBACK'],
    reverifyReason: input.reverify?.reason ?? '未验真',
    message: verified
      ? '吏部人才蜂群已真启动,session 可向后端兑现(LIVE_SWARM)'
      : '蜂群 session 未能兑现,降级 FALLBACK(不冒充真)',
  };
}
