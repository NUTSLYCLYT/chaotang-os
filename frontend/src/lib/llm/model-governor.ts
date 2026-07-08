/**
 * 朝堂 OS · Model Governor · 只读模型治理判词
 *
 * 当前阶段只观察、不接管：根据 intent / selected model / fallback 状态
 * 生成 modelPolicy 与风险告警，写入 telemetry 和返回结果。
 */

import type {
  Capability,
  LlmIntent,
  ModelDef,
  ModelGovernanceVerdict,
  ModelPolicy,
  ModelPolicyMode,
  ModelRiskLevel,
} from './types';

const ONE_WAY_PATTERNS = [
  /\bdeploy\b/i,
  /\brelease\b/i,
  /\bproduction\b/i,
  /\bprod\b/i,
  /\bdelete\b/i,
  /\bdrop\b/i,
  /\bmigration\b/i,
  /生产/,
  /发布/,
  /上线/,
  /删除/,
  /迁移/,
  /放开自动执行/,
  /预算闸/,
];

const HIGH_RISK_PATTERNS = [
  /\bharness\b/i,
  /\bauth\b/i,
  /\bauthz\b/i,
  /\bsecurity\b/i,
  /\bbudget\b/i,
  /\btenant\b/i,
  /\brouter\b/i,
  /\bgovernor\b/i,
  /\bstate\s*machine\b/i,
  /鉴权/,
  /安全/,
  /预算/,
  /租户/,
  /状态机/,
  /模型治理/,
  /自进化/,
  /路由/,
];

function uniqCaps(caps: Capability[]): Capability[] {
  return Array.from(new Set(caps));
}

function inferRiskLevel(intent: LlmIntent): ModelRiskLevel {
  const text = `${intent.intent} ${intent.requires.join(' ')} ${intent.prefers?.join(' ') ?? ''}`;
  if (ONE_WAY_PATTERNS.some((re) => re.test(text))) return 'one_way';
  if (HIGH_RISK_PATTERNS.some((re) => re.test(text))) return 'high';
  if (
    intent.requires.includes('reasoning') ||
    intent.requires.includes('tool_use') ||
    intent.requires.includes('vision') ||
    intent.estimatedInputTokens > 32_000
  ) {
    return 'medium';
  }
  return 'low';
}

function inferMode(intent: LlmIntent, riskLevel: ModelRiskLevel): ModelPolicyMode {
  if (riskLevel === 'one_way') return 'manual';
  if (intent.requires.includes('vision')) return 'vision_review';
  if (riskLevel === 'high' || intent.requires.includes('reasoning')) return 'high_reasoning';
  if (intent.prefers?.includes('cheap')) return 'cheap';
  if (intent.prefers?.includes('fast')) return 'fast';
  return 'auto';
}

function defaultRequiredCaps(intent: LlmIntent, mode: ModelPolicyMode): Capability[] {
  const caps = [...intent.requires];
  if (mode === 'high_reasoning' || mode === 'manual') caps.push('reasoning');
  if (mode === 'vision_review') caps.push('vision');
  if (mode === 'cheap') caps.push('cheap');
  if (mode === 'fast') caps.push('fast');
  return uniqCaps(caps);
}

export function buildModelPolicy(intent: LlmIntent): ModelPolicy {
  const explicit = intent.modelPolicy;
  const riskLevel = explicit?.riskLevel ?? inferRiskLevel(intent);
  const mode = explicit?.mode ?? inferMode(intent, riskLevel);
  const requiredCaps = uniqCaps([
    ...defaultRequiredCaps(intent, mode),
    ...(explicit?.requiredCaps ?? []),
  ]);
  const humanGateRequired =
    explicit?.humanGate?.required ??
    (mode === 'manual' || riskLevel === 'high' || riskLevel === 'one_way');
  const allowFallback =
    explicit?.allowFallback ?? !(riskLevel === 'high' || riskLevel === 'one_way');

  return {
    mode,
    riskLevel,
    requiredCaps,
    maxCostUsd: explicit?.maxCostUsd ?? intent.maxCostUsd,
    allowFallback,
    humanGate: {
      required: humanGateRequired,
      reason:
        explicit?.humanGate?.reason ??
        (humanGateRequired
          ? `${riskLevel} risk task requires human review before adoption`
          : undefined),
    },
    reason:
      explicit?.reason ??
      `intent=${intent.intent} risk=${riskLevel} mode=${mode} caps=${requiredCaps.join(',') || 'none'}`,
  };
}

export function evaluateModelGovernance(input: {
  intent: LlmIntent;
  selected: ModelDef;
  estimatedCostUsd: number;
  fallbackUsed: boolean;
}): ModelGovernanceVerdict {
  const policy = buildModelPolicy(input.intent);
  const warnings: string[] = [];

  for (const cap of policy.requiredCaps) {
    if (!input.selected.caps.includes(cap)) {
      warnings.push(`selected model lacks required governance cap: ${cap}`);
    }
  }

  if (!policy.allowFallback && input.fallbackUsed) {
    warnings.push('fallback used even though policy disallows fallback for this risk level');
  }

  if (policy.maxCostUsd !== undefined && input.estimatedCostUsd > policy.maxCostUsd) {
    warnings.push(`estimated cost ${input.estimatedCostUsd.toFixed(6)} exceeds policy max ${policy.maxCostUsd}`);
  }

  if (policy.humanGate.required) {
    warnings.push(`human gate required: ${policy.humanGate.reason ?? 'high impact task'}`);
  }

  const violated = warnings.some(
    (w) =>
      w.includes('disallows fallback') ||
      w.includes('lacks required governance cap') ||
      w.includes('exceeds policy max'),
  );
  const status = violated ? 'violated' : warnings.length > 0 ? 'watch' : 'aligned';

  return {
    policy,
    selectedModel: input.selected.id,
    selectedProvider: input.selected.provider,
    selectedCaps: input.selected.caps,
    estimatedCostUsd: input.estimatedCostUsd,
    fallbackUsed: input.fallbackUsed,
    status,
    warnings,
  };
}
