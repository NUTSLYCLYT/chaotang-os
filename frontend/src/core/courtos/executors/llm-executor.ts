/**
 * 真实 LLM executor（AGENTS.md §13.2 规则1：AI 调用经 AgentHarness）。
 *
 * 把现有 callLLM（含三层 fallback）适配成 harness 的 AgentExecutor。
 * server-only：callLLM 命中 providers / 预算 / 治理，禁在客户端 import。
 *
 * 映射：CallResult.upstream('live'|'fallback'|'scripted') → ExecutorResult.upstream，
 * 由 harness 再派生 sourceLabel（live→LIVE / fallback→FALLBACK / scripted→DEMO）。
 */
import 'server-only';
import { callLLM } from '@/lib/llm/router';
import type { LlmIntent, ProviderId } from '@/lib/llm/types';
import type { AgentExecutor, ExecutorResult } from '../harness/agent-harness';
import type { CourtReportShape } from '../types';

// 折中（2026-06-17，统一 owner 后定）：litellm→Claude 正常 2-5s，异常才触顶。
// 放宽到能等真 Claude（保 LIVE），仍有上限防永久挂起；超时由 §11 守卫诚实标 offline。
const REFINE_PROVIDER_TIMEOUT_MS = 18_000;
const REPORT_PROVIDER_TIMEOUT_MS = 38_000;
const REFINE_TOTAL_TIMEOUT_MS = 20_000;
const REPORT_TOTAL_TIMEOUT_MS = 40_000;

type CourtLlmResult = {
  data: string;
  upstream: 'live' | 'fallback' | 'scripted';
};

function timeoutFallbackText(stage: 'refine' | 'report', prompt: string): string {
  const clipped = prompt.trim().slice(0, 500);
  if (stage === 'refine') {
    return `【离线模式】丞相拟旨超时，未伪装成真实判断。原问：${clipped}。请先按补证/人工复核处理。`;
  }
  return `【离线模式】军机处奏折生成超时，未伪装成真实判断。拟旨：${clipped}。请人工复核或稍后重试。`;
}

async function callCourtLlm(
  intent: LlmIntent,
  prompt: string,
  requestId: string | undefined,
  system: string,
  providerTimeoutMs: number,
  totalTimeoutMs: number,
  stage: 'refine' | 'report',
  forceProvider?: ProviderId,
): Promise<CourtLlmResult> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | null = null;

  const timeoutResult = new Promise<CourtLlmResult>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve({ data: timeoutFallbackText(stage, prompt), upstream: 'scripted' });
    }, totalTimeoutMs);
  });

  try {
    return await Promise.race([
      callLLM(
        intent,
        prompt,
        {
          requestId,
          system,
          timeoutMs: providerTimeoutMs,
          signal: controller.signal,
          forceProvider,
        },
      ),
      timeoutResult,
    ]);
  } finally {
    if (timer) clearTimeout(timer);
    controller.abort();
  }
}

/**
 * 网关级 fallback 探测（PRD §11 / AGENTS §13 规则3：fallback 禁伪装 LIVE）。
 *
 * 真实场景：LLM 网关（litellm/蜂群）不可达时，会以 HTTP 200 返回自家"离线兜底"文案，
 * callLLM 视之为 upstream='live'。靠 upstream 信号看不出，必须按内容兜底降级，
 * 否则离线文案会被标成 LIVE，骗了裁决者。宁可误降级，绝不假 LIVE。
 */
const GATEWAY_FALLBACK_MARKERS = [
  '离线模式',
  '兜底回复',
  '上游能力仓全线不通',
  '上游不可用',
  '暂时无法',
  '稍后重试',
];

function downgradeIfGatewayFallback(
  upstream: ExecutorResult<unknown>['upstream'],
  text: string,
): ExecutorResult<unknown>['upstream'] {
  if (upstream === 'live' && GATEWAY_FALLBACK_MARKERS.some((m) => text.includes(m))) {
    return 'fallback';
  }
  return upstream;
}

const REFINE_SYSTEM =
  '你是朝堂丞相。把老板的模糊经营问题整理成可执行的"拟旨"：' +
  '一句话点明要判断什么、期望结论类型（准奏/补证/复核/驳回）、已知信息、明显缺口、应参审的部门视角。' +
  '只输出拟旨正文，简洁中文，不寒暄。';

/** 丞相拟旨 executor（真实 LLM）。 */
export function makeRefineExecutor(requestId?: string, forceProvider?: ProviderId): AgentExecutor<string, string> {
  return async (question: string) => {
    const res = await callCourtLlm(
      {
        intent: 'courtos.chancellor.refine',
        requires: ['chinese_native'],
        prefers: ['fast', 'cheap'],
        estimatedInputTokens: Math.ceil(question.length / 3),
        triage: false,
        maxCostUsd: 0.02,
      },
      question,
      requestId,
      REFINE_SYSTEM,
      REFINE_PROVIDER_TIMEOUT_MS,
      REFINE_TOTAL_TIMEOUT_MS,
      'refine',
      forceProvider,
    );
    return { output: res.data, upstream: downgradeIfGatewayFallback(res.upstream, res.data) };
  };
}

const REPORT_SYSTEM =
  '你是朝堂军机处。基于拟旨与已知证据，产出一份"奏折"JSON，字段：' +
  'verdict(圣裁:准奏/补证/复核/驳回)、summary、perspectives(数组,各部视角)、' +
  'evidence(数组)、missingEvidence(缺证数组)、risks(数组)、nextAction(后令)。' +
  '没有证据的结论必须放进 missingEvidence，不得编造。' +
  '严格只输出一个 JSON 对象，不要 markdown 代码块、不要任何解释文字。';

function safeParseReport(raw: string): CourtReportShape {
  try {
    // 剥 markdown 代码围栏(```json … ```)再取首尾大括号。
    const unfenced = raw.replace(/```(?:json)?/gi, '').trim();
    const start = unfenced.indexOf('{');
    const end = unfenced.lastIndexOf('}');
    const json = start >= 0 && end > start ? unfenced.slice(start, end + 1) : unfenced;
    const obj = JSON.parse(json) as CourtReportShape;
    return obj;
  } catch {
    // 解析失败 → 退化成缺证奏折（诚实，不假装成功）
    return {
      verdict: '补证',
      summary: raw.slice(0, 200),
      perspectives: [],
      evidence: [],
      missingEvidence: ['模型输出无法解析为结构化奏折'],
      risks: ['结果不可结构化'],
      nextAction: '人工复核原始输出或重试',
    };
  }
}

/** 生成奏折 executor（真实 LLM，输出解析为 CourtReportShape）。 */
export function makeReportExecutor(requestId?: string): AgentExecutor<string, CourtReportShape> {
  return async (refinedIntent: string) => {
    const res = await callCourtLlm(
      {
        intent: 'courtos.junjichu.report',
        requires: ['chinese_native', 'reasoning'],
        prefers: ['json_mode'],
        estimatedInputTokens: Math.ceil(refinedIntent.length / 3),
        triage: false,
        maxCostUsd: 0.08,
      },
      refinedIntent,
      requestId,
      REPORT_SYSTEM,
      REPORT_PROVIDER_TIMEOUT_MS,
      REPORT_TOTAL_TIMEOUT_MS,
      'report',
    );
    return {
      output: safeParseReport(res.data),
      upstream: downgradeIfGatewayFallback(res.upstream, res.data),
    };
  };
}
