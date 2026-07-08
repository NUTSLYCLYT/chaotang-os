/**
 * 朝堂 OS · ModelRegistry · 模型元数据唯一事实源
 *
 * 加新模型 / 改价 · 全在这一处
 * git diff 一目了然 · 任何改动有 review trail
 *
 * 价格更新日：2026-04 · Anthropic Sonnet 4.6 / Haiku 4.5 / OpenAI GPT-4o-mini
 */

import type { ModelDef } from './types';
import { loadSharedLlmEnv } from './shared-env';

loadSharedLlmEnv();

const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL ?? 'deepseek-chat';
const DEEPSEEK_ENABLED = Boolean(
  process.env.DEEPSEEK_API_KEY ||
  (process.env.OPENAI_BASE_URL?.includes('deepseek') && process.env.OPENAI_API_KEY),
);

export const MODELS: ModelDef[] = [
  // -------------- Anthropic --------------
  {
    id: 'claude-sonnet-4-6',
    provider: 'anthropic',
    caps: [
      'reasoning',
      'long_context',
      'tool_use',
      'streaming',
      'json_mode',
      'chinese_native',
    ],
    costPerMTokenIn: 3.0,
    costPerMTokenOut: 15.0,
    contextWindow: 200_000,
    p50LatencyMs: 1800,
    qualityScore: 92,
    enabled: true,
    note: '主力 · 复杂推理 / 长文 / 三省审议门下用',
  },
  {
    id: 'claude-haiku-4-5-20251001',
    provider: 'anthropic',
    caps: ['cheap', 'fast', 'streaming', 'json_mode', 'chinese_native'],
    costPerMTokenIn: 0.8,
    costPerMTokenOut: 4.0,
    contextWindow: 200_000,
    p50LatencyMs: 600,
    qualityScore: 78,
    enabled: true,
    note: '高频 · triage / annals / 简单 chat 全靠它 · 性价比之王',
  },
  {
    id: 'claude-opus-4-7',
    provider: 'anthropic',
    caps: ['reasoning', 'long_context', 'tool_use', 'streaming', 'chinese_native'],
    costPerMTokenIn: 15.0,
    costPerMTokenOut: 75.0,
    contextWindow: 200_000,
    p50LatencyMs: 3000,
    qualityScore: 96,
    enabled: false, // 仅特别审议时才开
    note: '顶配 · 默认禁用 · 御前裁决重大决策时手动启用',
  },

  // -------------- DeepSeek(OpenAI-compatible) --------------
  {
    id: DEEPSEEK_MODEL,
    provider: 'deepseek',
    caps: ['cheap', 'fast', 'streaming', 'json_mode', 'chinese_native', 'reasoning'],
    costPerMTokenIn: 0.27,
    costPerMTokenOut: 1.1,
    contextWindow: 64_000,
    p50LatencyMs: 1200,
    qualityScore: 88,
    enabled: DEEPSEEK_ENABLED,
    note: 'OpenAI-compatible DeepSeek · reads DEEPSEEK_API_KEY / DEEPSEEK_MODEL',
  },

  // -------------- OpenAI 兼容(本机 LiteLLM :4444 → Claude via OAuth)--------------
  {
    id: 'swarm-judge', // LiteLLM 路由名(Claude Sonnet)。需 OPENAI_BASE_URL=http://localhost:4444/v1
    provider: 'openai',
    caps: ['cheap', 'fast', 'streaming', 'json_mode', 'tool_use', 'chinese_native', 'reasoning'],
    costPerMTokenIn: 0,
    costPerMTokenOut: 0,
    contextWindow: 200_000,
    p50LatencyMs: 1500,
    qualityScore: 90,
    enabled: true,
    note: 'LIVE 主力 · 经本机 LiteLLM :4444 走 Claude(OAuth/Max),中文原生 + 推理',
  },

  // -------------- legal-agent (本地能力仓) --------------
  {
    id: 'legal-agent-consult',
    provider: 'legal-agent',
    caps: ['reasoning', 'streaming', 'chinese_native', 'tool_use'],
    costPerMTokenIn: 0,
    costPerMTokenOut: 0,
    contextWindow: 32_000,
    p50LatencyMs: 2500,
    qualityScore: 80,
    enabled: true,
    note: '免费 · 朝堂 7 庄园专家 · 法律/HR/财务等垂直问答',
  },

  // -------------- 兜底脚本 --------------
  {
    id: 'scripted-fallback',
    provider: 'scripted',
    caps: ['cheap', 'fast', 'chinese_native'],
    costPerMTokenIn: 0,
    costPerMTokenOut: 0,
    contextWindow: 100_000,
    p50LatencyMs: 50,
    qualityScore: 30,
    enabled: true,
    note: '永不可禁用 · 所有 LLM 全挂时的最后一道防线',
  },
];

/** 按 ID 查 */
export function getModel(id: string): ModelDef | null {
  return enabledModels().find((m) => m.id === id) ?? null;
}

/** 列出能用的模型 */
export function enabledModels(): ModelDef[] {
  loadSharedLlmEnv();
  const deepSeekEnabled = Boolean(
    process.env.DEEPSEEK_API_KEY ||
    (process.env.OPENAI_BASE_URL?.includes('deepseek') && process.env.OPENAI_API_KEY),
  );
  return MODELS
    .map((model) => {
      if (model.provider !== 'deepseek') return model;
      return {
        ...model,
        id: process.env.DEEPSEEK_MODEL ?? model.id,
        enabled: deepSeekEnabled,
      };
    })
    .filter((m) => m.enabled);
}

/**
 * 估算成本（USD）
 *  · output 估为 input 的 60%（粗略 · 但够指导决策）
 */
export function estimateCost(model: ModelDef, inTokens: number): number {
  const outTokens = Math.ceil(inTokens * 0.6);
  return (
    (inTokens / 1_000_000) * model.costPerMTokenIn +
    (outTokens / 1_000_000) * model.costPerMTokenOut
  );
}
