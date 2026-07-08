/**
 * AgentHarness（AGENTS.md §13.2 规则1）—— AI 调用的安全壳。
 *
 * 设计：runAgent 接收一个 `executor`（注入真实 callLLM 或 mock）。
 *   harness 只负责：生成 auditId、捕获错误、统一返回带 sourceLabel +
 *   needsHumanConfirmation 的结构。默认不直连模型（executor 注入）。
 *   → 纯壳，无 @/ 运行时依赖，可脱离真实 LLM 单测。
 *
 * 真实 LLM 接线见 executors/llm-executor.ts（包 callLLM）。
 */
import type { AgentHarnessInput, AgentHarnessOutput, RealityState, SourceLabel } from '../types';

/** executor 返回：业务输出 + 实际来源（live/fallback/scripted）。 */
export interface ExecutorResult<TOutput> {
  output: TOutput;
  /** 实际命中的上游，对应 CallResult.upstream。 */
  upstream: 'live' | 'fallback' | 'scripted';
}

export type AgentExecutor<TInput, TOutput> = (
  input: TInput,
) => Promise<ExecutorResult<TOutput>>;

interface RunAgentParams<TInput, TOutput> extends AgentHarnessInput<TInput> {
  executor: AgentExecutor<TInput, TOutput>;
  /** 注入式 auditId（测试用）；缺省随机。 */
  auditId?: string;
}

const UPSTREAM_TO_REALITY: Record<ExecutorResult<unknown>['upstream'], RealityState> = {
  live: 'real',
  fallback: 'fallback',
  scripted: 'mock',
};

const REALITY_TO_LABEL: Record<RealityState, SourceLabel> = {
  real: 'LIVE',
  fallback: 'FALLBACK',
  mock: 'DEMO',
  degraded: 'FALLBACK',
  missing: 'FALLBACK',
};

function makeAuditId(injected?: string): string {
  if (injected) return injected;
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `audit-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
}

/**
 * 执行一个 agent。成功 → 按实际 upstream 定 sourceLabel；
 * 失败 → ok=false，sourceLabel=FALLBACK，needsHumanConfirmation=true（不静默）。
 */
export async function runAgent<TInput, TOutput>(
  params: RunAgentParams<TInput, TOutput>,
): Promise<AgentHarnessOutput<TOutput>> {
  // 输出 sourceLabel 由 executor 实际 upstream 派生（见下），params.sourceLabel 仅作声明。
  const auditId = makeAuditId(params.auditId);

  try {
    const result = await params.executor(params.input);
    const reality = UPSTREAM_TO_REALITY[result.upstream];
    const sourceLabel = REALITY_TO_LABEL[reality];
    // fallback/demo 结果默认需人工确认（PRD §11：不实结果禁当确定依据）
    const needsHumanConfirmation = reality !== 'real';
    return {
      ok: true,
      output: result.output,
      sourceLabel,
      reality,
      auditId,
      needsHumanConfirmation,
      fallbackUsed: reality !== 'real',
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      sourceLabel: 'FALLBACK',
      reality: 'fallback',
      auditId,
      needsHumanConfirmation: true,
      fallbackUsed: true,
    };
  }
}
