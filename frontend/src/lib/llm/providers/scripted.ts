/**
 * 朝堂 OS · scripted fallback
 * 永远在线 · 永远 0 成本
 *
 * 当所有 LLM 全部不可达时 · 这里给出"礼貌的不可用"回复
 * 不是为了好看 · 是为了让业务永远不抛异常 · UI 永远有内容显示
 */

import type { CallOptions } from '../types';

const TEMPLATES = [
  '【离线模式】朝堂 LLM 服务暂不可用 · 已记入史馆 · 请稍后再呈。',
  '【离线模式】上游能力仓全线不通 · 此为兜底回复 · 真正分析须待恢复。',
  '【离线模式】此非真章 · 仅为流程占位 · 请检查 LLM provider 配置。',
];

export async function callScripted(
  prompt: string,
  _opts: CallOptions,
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  // 模拟极小延迟 · 避免下游 race
  await new Promise((r) => setTimeout(r, 30));

  const index = Math.abs(simpleHash(prompt)) % TEMPLATES.length;
  const text = TEMPLATES[index]!;
  return {
    text,
    inputTokens: Math.ceil(prompt.length / 4),
    outputTokens: Math.ceil(text.length / 4),
  };
}

function simpleHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return h;
}
