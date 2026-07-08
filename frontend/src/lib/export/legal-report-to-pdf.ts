import type { Task } from '@/types/task';
import type { ManorAnalyzeResult } from '@/types/manor';

const RISK_COLORS: Record<string, string> = {
  high: '#F43F5E',
  medium: '#F0C66A',
  low: '#9AA3C4',
};

const RISK_ZH: Record<string, string> = { high: '高风险', medium: '中风险', low: '低风险' };
const ACTION_ZH: Record<string, string> = { red: '紧急处置', yellow: '本周处理', green: '立即行动' };
const ACTION_BG: Record<string, string> = { red: '#F43F5E22', yellow: '#F0C66A22', green: '#4ADE8022' };
const ACTION_BORDER: Record<string, string> = { red: '#F43F5E', yellow: '#F0C66A', green: '#4ADE80' };

function buildPrintHtml(task: Task, report: ManorAnalyzeResult, date: string): string {
  const risksHtml = report.risks.map((r) => `
    <div style="margin-bottom:8px;padding:10px 12px;border-left:3px solid ${RISK_COLORS[r.level] ?? '#9AA3C4'};background:#ffffff08;border-radius:0 4px 4px 0;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
        <span style="font-size:10px;background:${RISK_COLORS[r.level] ?? '#9AA3C4'}22;color:${RISK_COLORS[r.level] ?? '#9AA3C4'};padding:1px 6px;border-radius:20px;font-weight:600;">${RISK_ZH[r.level] ?? r.level}</span>
        <strong style="font-size:12px;color:#1a1a2e;">${r.title}</strong>
      </div>
      <div style="font-size:11px;color:#444;line-height:1.6;">${r.mitigation}</div>
    </div>
  `).join('');

  const actionsHtml = report.action_cards.map((c) => `
    <div style="margin-bottom:8px;padding:10px 12px;border:1px solid ${ACTION_BORDER[c.light] ?? '#666'};background:${ACTION_BG[c.light] ?? '#fff'};border-radius:6px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
        <span style="font-size:10px;color:${ACTION_BORDER[c.light] ?? '#666'};font-weight:700;">${ACTION_ZH[c.light] ?? c.light}</span>
        <strong style="font-size:12px;color:#1a1a2e;">${c.title}</strong>
      </div>
      <div style="font-size:11px;color:#666;">处置时间：${c.when}</div>
      ${c.why ? `<div style="font-size:11px;color:#666;margin-top:4px;">${c.why}</div>` : ''}
    </div>
  `).join('');

  const citationsHtml = (report.citations ?? []).map((cit) => `
    <div style="margin-bottom:8px;padding:8px 12px;background:#f8f9fc;border-radius:4px;border:1px solid #e8ecf0;">
      <div style="font-size:11px;font-weight:700;color:#1a1a2e;margin-bottom:4px;">${cit.code} · ${cit.title}</div>
      <div style="font-size:11px;color:#555;line-height:1.6;font-style:italic;">${cit.fullText}</div>
    </div>
  `).join('');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>法务研判报告 · ${task.id}</title>
<style>
  @page { size: A4 portrait; margin: 20mm 18mm 25mm 18mm; }
  body { font-family: "PingFang SC", "Microsoft YaHei", "Heiti SC", sans-serif; color: #1a1a2e; font-size: 12px; line-height: 1.7; }
  h1 { font-size: 20px; font-weight: 700; margin: 0 0 6px; color: #1a1a2e; }
  h2 { font-size: 13px; font-weight: 700; margin: 18px 0 10px; padding-bottom: 4px; border-bottom: 1.5px solid #e0d5b0; color: #5a4a1a; }
  .seal { display:inline-block; border:2px solid #c8933a; border-radius:6px; padding:3px 10px; font-size:11px; font-weight:700; color:#c8933a; margin-bottom:12px; }
  .meta-row { font-size:10px; color:#888; margin-bottom:16px; }
  .summary-box { background:#fafaf6; border-left:4px solid #c8933a; padding:12px 14px; border-radius:0 6px 6px 0; font-size:13px; line-height:1.8; color:#2a2a3e; margin-bottom:8px; }
  .dept-chip { display:inline-block; border:1px solid #c8933a55; background:#c8933a15; color:#8a6228; padding:2px 8px; border-radius:20px; font-size:10px; margin:2px; }
  .page-footer { position:fixed; bottom:8mm; left:18mm; right:18mm; font-size:9px; color:#bbb; text-align:center; border-top:1px solid #e0e0e0; padding-top:4px; }
  .rawcmd { font-family: monospace; font-size:11px; background:#f5f5f8; padding:10px; border-radius:4px; color:#555; white-space:pre-wrap; word-break:break-all; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>

<div class="seal">法务研判 · LCR-001</div>
<h1>${task.title}</h1>
<div class="meta-row">任务编号：${task.id} &nbsp;|&nbsp; 生成时间：${date} &nbsp;|&nbsp; CourtOS · 法务庄园</div>

<h2>一、律师研判摘要</h2>
<div class="summary-box">${report.summary}</div>
${report.requires_departments.length > 0 ? `<div style="margin-top:6px;">${report.requires_departments.map((d) => `<span class="dept-chip">${d}</span>`).join('')}</div>` : ''}

${report.risks.length > 0 ? `<h2>二、风险清单</h2>${risksHtml}` : ''}

${report.action_cards.length > 0 ? `<h2>三、行动建议</h2>${actionsHtml}` : ''}

${(report.citations ?? []).length > 0 ? `<h2>四、引用法条</h2>${citationsHtml}` : ''}

<h2>五、原始发令</h2>
<div class="rawcmd">${task.rawCommand.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>

<div class="page-footer">CourtOS · 内部使用 · ${date}</div>

</body>
</html>`;
}

export function exportLegalReportAsPdf(task: Task, report: ManorAnalyzeResult): void {
  const date = new Date().toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const html = buildPrintHtml(task, report, date);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (win) {
    win.onload = () => {
      setTimeout(() => {
        win.print();
        URL.revokeObjectURL(url);
      }, 300);
    };
  }
}
