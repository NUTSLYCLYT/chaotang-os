import type { Task } from '@/types/task';
import type { ManorAnalyzeResult } from '@/types/manor';

const RISK_LEVEL_ZH: Record<string, string> = {
  high: '高',
  medium: '中',
  low: '低',
};

const ACTION_LIGHT_ZH: Record<string, string> = {
  red: '紧急处置',
  yellow: '本周处理',
  green: '立即行动',
};

export function legalReportToMarkdown(task: Task, report: ManorAnalyzeResult): string {
  const date = new Date().toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const lines: string[] = [];

  lines.push(`# 法务研判报告 · LCR-001`);
  lines.push('');
  lines.push(`| 字段 | 内容 |`);
  lines.push(`|------|------|`);
  lines.push(`| 任务编号 | ${task.id} |`);
  lines.push(`| 任务标题 | ${task.title} |`);
  lines.push(`| 生成时间 | ${date} |`);
  lines.push(`| 生成工具 | CourtOS · 法务庄园 |`);
  lines.push('');

  lines.push(`## 一、律师研判摘要`);
  lines.push('');
  lines.push(report.summary);
  lines.push('');

  if (report.requires_departments.length > 0) {
    lines.push(`**需协调部门：** ${report.requires_departments.join('、')}`);
    lines.push('');
  }

  if (report.risks.length > 0) {
    lines.push(`## 二、风险清单`);
    lines.push('');
    lines.push('| 风险等级 | 风险描述 | 建议应对 |');
    lines.push('|----------|----------|----------|');
    for (const r of report.risks) {
      lines.push(`| ${RISK_LEVEL_ZH[r.level] ?? r.level} | ${r.title} | ${r.mitigation} |`);
    }
    lines.push('');
  }

  if (report.action_cards.length > 0) {
    lines.push(`## 三、行动建议`);
    lines.push('');
    for (const c of report.action_cards) {
      const urgency = ACTION_LIGHT_ZH[c.light] ?? c.light;
      lines.push(`### ${urgency} · ${c.title}`);
      lines.push('');
      lines.push(`**处置时间：** ${c.when}`);
      if (c.why) {
        lines.push('');
        lines.push(`**原因：** ${c.why}`);
      }
      lines.push('');
    }
  }

  if (report.citations && report.citations.length > 0) {
    lines.push(`## 四、引用法条`);
    lines.push('');
    for (const cit of report.citations) {
      lines.push(`### ${cit.code} · ${cit.title}`);
      lines.push('');
      lines.push(`> ${cit.fullText}`);
      lines.push('');
    }
  }

  lines.push(`## 五、原始发令`);
  lines.push('');
  lines.push('```');
  lines.push(task.rawCommand);
  lines.push('```');
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push(`*CourtOS · 内部使用 · 生成时间 ${date}*`);

  return lines.join('\n');
}

export function downloadMarkdown(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
