/**
 * 朝堂 OS · 多模型路由层 · 类型契约
 *
 * 设计原则：
 *   - intent 驱动 · 不是 model 驱动（业务说"我要什么能力"，不说"我要 GPT-4"）
 *   - capability 是模型间唯一可比较的语言
 *   - 所有 cost 单位统一为 USD · 单价以 1M tokens 计
 */

export type Capability =
  | 'cheap'
  | 'fast'
  | 'reasoning'
  | 'long_context'
  | 'vision'
  | 'tool_use'
  | 'streaming'
  | 'json_mode'
  | 'chinese_native';

export type ProviderId = 'anthropic' | 'openai' | 'deepseek' | 'legal-agent' | 'scripted';

export type ModelPolicyMode =
  | 'auto'
  | 'cheap'
  | 'fast'
  | 'high_reasoning'
  | 'vision_review'
  | 'manual';

export type ModelRiskLevel = 'low' | 'medium' | 'high' | 'one_way';

export interface ModelPolicy {
  mode: ModelPolicyMode;
  riskLevel: ModelRiskLevel;
  requiredCaps: Capability[];
  maxCostUsd?: number;
  allowFallback: boolean;
  humanGate: {
    required: boolean;
    reason?: string;
  };
  reason: string;
}

export interface ModelGovernanceVerdict {
  policy: ModelPolicy;
  selectedModel: string;
  selectedProvider: ProviderId;
  selectedCaps: Capability[];
  estimatedCostUsd: number;
  fallbackUsed: boolean;
  status: 'aligned' | 'watch' | 'violated';
  warnings: string[];
}

export interface ModelDef {
  id: string;
  provider: ProviderId;
  caps: Capability[];
  costPerMTokenIn: number;
  costPerMTokenOut: number;
  contextWindow: number;
  p50LatencyMs: number;
  qualityScore: number;
  /** 是否启用 · 关键开关 · 出问题可一键禁用 */
  enabled: boolean;
  /** 注释 · 用于 /settings/llm 展示 */
  note?: string;
}

export interface LlmIntent {
  intent: string;
  requires: Capability[];
  prefers?: Capability[];
  estimatedInputTokens: number;
  triage?: boolean;
  maxCostUsd?: number;
  /** 只读模型治理提示；当前不改变路由，只进入 telemetry / 史馆判词。 */
  modelPolicy?: Partial<ModelPolicy>;
}

export interface RoutingDecision {
  selected: ModelDef;
  candidates: Array<{ model: ModelDef; score: number }>;
  reason: string;
  estimatedCostUsd: number;
  triageVerdict?: 'simple' | 'complex' | 'skipped';
  decisionMs: number;
  governance?: ModelGovernanceVerdict;
}

export interface CallOptions {
  requestId?: string;
  signal?: AbortSignal;
  /** 超时（毫秒） · 不传走 model.p50 × 5 */
  timeoutMs?: number;
  /** 系统提示 · 可选 */
  system?: string;
  /** 强制走某个 provider · 调试用 */
  forceProvider?: ProviderId;
  /** 用户 ID · 用于 per-user budget · 不传走 'anonymous' 共享池 */
  userId?: string;
}

export interface CallResult<T = string> {
  data: T;
  decision: RoutingDecision;
  upstream: 'live' | 'fallback' | 'scripted';
  upstreamMs: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  attempts: number;
}

export class LlmRouterError extends Error {
  constructor(
    message: string,
    public phase: 'validate' | 'triage' | 'route' | 'call' | 'all_failed',
    public detail?: unknown,
  ) {
    super(message);
    this.name = 'LlmRouterError';
  }
}
