/**
 * dept-agent —— 通用单 agent 核心（从户部抽出，规则三泛化）。
 *
 * 一个核心 × N 个部门配置：把"对答案负责"的范式（schema + 调大脑 + 数字接地校验 + 打回重写）
 * 与具体部门的 role/context 解耦。户部、兵部等只需提供 {role, context, command}。
 */

import { callLLM } from '@/lib/llm/router';
import { verifyNumbers, verifyEvidenceBinding, type GroundingResult } from './number-verifier';

/* ── 对答案负责输出契约 ──────────────────────────────────────────────────── */
export interface AgentAnswer {
  answer: string;
  reasoning: string;
  evidence: string[];
  assumptions: string[];
  conflicts: string;
  confidence: number;
}

export interface AgentResult extends AgentAnswer {
  grounding: GroundingResult;
  /** 证据绑定（会审升级）：answer 里数字是否也出现在 evidence[]——比纯 context 溯源更接近"数字↔断言绑定"。 */
  evidenceBinding: GroundingResult;
  reprompted: boolean;
  /** 终止 gate（会审 #1 Karpathy）：重写后仍有未接地数字 → false → UI 降级、route 落盘，不发"已校验"徽标。 */
  grounded: boolean;
  model: string;
  latencyMs: number;
}

export const AGENT_SCHEMA =
  '产出【可直接拍板的真内容】，不是任务分解、不是分类框架。硬性要求（缺一不可）：' +
  '1) 引用给定事实里的具体内容/数字下结论；2) reasoning 推理链；3) evidence 逐字引用你用到的事实/数据；' +
  '4) assumptions 假设（仅数据真缺时标注；已给的不得说"缺失"，不得编造）；5) confidence 0-1；' +
  '6) conflicts：声明"我这结论会被哪个部门/哪类数据推翻或需其复核"（没有写"无"，不要替别的部门下结论）。' +
  '严格只输出 JSON：{"answer":"...","reasoning":"...","evidence":["..."],"assumptions":["..."],"conflicts":"...","confidence":0.x}';

async function callBrain(
  messages: Array<{ role: string; content: string }>,
): Promise<{ content: string; parsed: AgentAnswer; model: string }> {
  const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
  const prompt = messages.filter((m) => m.role !== 'system').map((m) => `${m.role}: ${m.content}`).join('\n\n');
  const result = await callLLM(
    {
      intent: 'dept_agent_structured_answer',
      requires: ['chinese_native'],
      prefers: ['json_mode', 'reasoning', 'fast'],
      estimatedInputTokens: Math.max(1200, Math.ceil((system.length + prompt.length) / 2)),
      maxCostUsd: 0.05,
    },
    prompt,
    {
      system,
      timeoutMs: 90_000,
    },
  );
  const content = String(result.data ?? '');
  return { content, parsed: coerce(content), model: result.decision.selected.id };
}

function coerce(content: string): AgentAnswer {
  let raw: Partial<AgentAnswer> = {};
  try {
    raw = JSON.parse(content.match(/\{[\s\S]*\}/)?.[0] ?? content) as Partial<AgentAnswer>;
  } catch {
    raw = { answer: content };
  }
  return {
    answer: String(raw.answer ?? ''),
    reasoning: String(raw.reasoning ?? ''),
    evidence: Array.isArray(raw.evidence) ? raw.evidence.map(String) : [],
    assumptions: Array.isArray(raw.assumptions) ? raw.assumptions.map(String) : [],
    conflicts: String(raw.conflicts ?? '无'),
    confidence: typeof raw.confidence === 'number' ? raw.confidence : 0,
  };
}

const checkText = (a: AgentAnswer): string => [a.answer, a.reasoning].filter(Boolean).join('\n');

/**
 * runAgent —— 跑一次单 agent。
 * 流程：组 system(role+schema) → 调大脑 → 数字接地校验 → 若有无依据数字打回重写一次 → 结构化结果。
 * 抛 'BRAIN_NOT_CONFIGURED'（无 key）或 'brain <status>'（上游错误），由 route 转 503/500。
 */
export async function runAgent(input: {
  role: string;
  context: string;
  command: string;
}): Promise<AgentResult> {
  const t0 = Date.now();
  const sys = `${input.role}\n${AGENT_SCHEMA}`;
  const userMsg = `${input.context}\n\n问题：${input.command}`;

  let r = await callBrain([
    { role: 'system', content: sys },
    { role: 'user', content: userMsg },
  ]);
  let grounding = verifyNumbers(checkText(r.parsed), input.context);
  let reprompted = false;

  if (grounding.ungrounded.length) {
    reprompted = true;
    const bad = grounding.ungrounded.map((n) => n.raw).join('、');
    r = await callBrain([
      { role: 'system', content: sys },
      { role: 'user', content: userMsg },
      { role: 'assistant', content: r.content },
      {
        role: 'user',
        content: `下列数字在给定数据/已核算指标里【找不到逐字依据】，很可能是你自己心算或脑补的衍生数：${bad}。请只用给定数据与已核算指标重写，删除或修正这些无依据数字，evidence 逐字引用你真正用到的原文。仍按同一 JSON 契约输出。`,
      },
    ]);
    grounding = verifyNumbers(checkText(r.parsed), input.context);
  }

  return {
    ...r.parsed,
    grounding,
    evidenceBinding: verifyEvidenceBinding(r.parsed.answer, r.parsed.evidence),
    reprompted,
    grounded: grounding.ungrounded.length === 0, // 重写后仍未接地 → false
    model: r.model,
    latencyMs: Date.now() - t0,
  };
}
