/**
 * deliverable —— L1顾问→L2执行者 的交付物层（纯加法，不碰共享 dept-agent 引擎）。
 *
 * 把 runAgent 产出的 grounded 答案(AgentResult)渲染成**一份可下载的真交付物报告**(markdown)。
 * 这是"替代员工"的关键质变:司不再只给一段答案,而是交出一份用户本可花钱请人做的报告。
 *
 * 诚实纪律(铁律2/sourceLabel):
 *  - grounded=false → 报告头部明标"⚠ 含未接地数字,降级稿",绝不冒充已校验。
 *  - 来源标 sourceLabel 必须如实(LIVE/FALLBACK/DEMO)。
 *  - 不编造:只渲染 agent 真实产出的字段。
 */

import type { AgentResult } from './dept-agent';

export interface DeliverableMeta {
  deptNameCn: string;
  /** 商家原始问题 */
  command: string;
  /** 数据来源标(铁律2):LIVE=真实时 / FALLBACK=降级 / DEMO=演示 */
  sourceLabel: 'LIVE' | 'FALLBACK' | 'DEMO';
  /** 生成时间(ISO)——由调用方传入,本模块不调 Date(可测) */
  generatedAt: string;
}

/** 把 grounded 答案渲染成一份可下载报告(markdown)。 */
export function renderReport(result: AgentResult, meta: DeliverableMeta): string {
  const pct = Math.round((result.confidence ?? 0) * 100);
  const groundRate =
    result.grounding.total > 0
      ? Math.round((result.grounding.grounded / result.grounding.total) * 100)
      : 100;

  const honestyBanner = result.grounded
    ? `> ✅ 数字接地校验通过(${groundRate}% 接地)。来源:**${meta.sourceLabel}**。`
    : `> ⚠️ **降级稿**:含未接地数字(${result.grounding.ungrounded.map((u) => u.raw).join('、')}),未发"已校验"徽。来源:**${meta.sourceLabel}**。`;

  const lines: string[] = [];
  lines.push(`# ${meta.deptNameCn} · 研判报告`);
  lines.push('');
  lines.push(honestyBanner);
  lines.push('');
  lines.push(`**所议**:${meta.command}`);
  lines.push(`**把握度**:${pct}%　**生成**:${meta.generatedAt}`);
  lines.push('');
  lines.push('## 裁断');
  lines.push(result.answer || '（无结论）');
  lines.push('');
  if (result.reasoning) {
    lines.push('## 推理');
    lines.push(result.reasoning);
    lines.push('');
  }
  if (result.evidence.length) {
    lines.push('## 证据（逐字引自真实数据）');
    for (const e of result.evidence) lines.push(`- ${e}`);
    lines.push('');
  }
  if (result.assumptions.length) {
    lines.push('## 假设');
    for (const a of result.assumptions) lines.push(`- ${a}`);
    lines.push('');
  }
  lines.push('## 风险 / 待复核');
  lines.push(result.conflicts || '无');
  lines.push('');
  lines.push('---');
  lines.push(
    `*本报告由「${meta.deptNameCn}」AI 自动生成,经数字接地校验。来源标 ${meta.sourceLabel}。模型 ${result.model}。仅供决策参考,高风险事项请人工复核。*`,
  );
  return lines.join('\n');
}

/** 下载文件名(含司名+日期,日期由调用方传入)。 */
export function reportFilename(deptNameCn: string, isoDate: string): string {
  const day = isoDate.slice(0, 10);
  return `${deptNameCn}研判报告-${day}.md`;
}
