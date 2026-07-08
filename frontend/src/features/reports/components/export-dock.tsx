/**
 * 报告导出工具栏
 *
 * PDF  = window.print() + 打印样式（每段一页）
 * MD   = 客户端序列化 ReportSection[]
 * JSON = 原始结构体
 */

'use client';

import { useMemo, useState } from 'react';
import { Download, FileText, FileCode, CheckCircle2, Presentation } from 'lucide-react';
import Link from 'next/link';
import { GlassPanel } from '@/components/ui/glass-panel';
import type { Report, ReportSection } from '@/types/report';

export interface ExportDockProps {
  /** Either pass full report for MD/JSON serialization or reportId for a thin variant */
  report?: Report;
  reportId?: string;
}

export function ExportDock({ report, reportId }: ExportDockProps) {
  const id = report?.id ?? reportId;
  const [flash, setFlash] = useState<string | null>(null);
  const markdownHref = useMemo(
    () => (report ? `data:text/markdown;charset=utf-8,${encodeURIComponent(serializeReportToMarkdown(report))}` : null),
    [report],
  );
  const jsonHref = useMemo(
    () => (report ? `data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(report, null, 2))}` : null),
    [report],
  );

  const showFlash = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(null), 1800);
  };

  const exportPdf = () => {
    if (typeof window === 'undefined') return;
    window.print();
    showFlash('已调用系统打印对话框');
  };

  const exportMarkdown = () => {
    if (!report) {
      showFlash('完整报告不可用');
      return;
    }
    const md = serializeReportToMarkdown(report);
    downloadBlob(md, `${report.id}.md`, 'text/markdown');
    showFlash('Markdown 已下载');
  };

  const exportJson = () => {
    if (!report) {
      showFlash('完整报告不可用');
      return;
    }
    downloadBlob(
      JSON.stringify(report, null, 2),
      `${report.id}.json`,
      'application/json',
    );
    showFlash('JSON 已下载');
  };

  return (
    <GlassPanel tone="elevated" padding="md">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Download size={13} className="text-[#F0C66A]" />
          <div>
            <div className="section-eyebrow">文书导出</div>
            <h3 className="section-title text-[16px]">导出呈报</h3>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <ExportButton
            icon={<FileText size={11} />}
            label="PDF 呈报"
            color="#F43F5E"
            onClick={exportPdf}
          />
          {id && (
            <Link
              href={`/present/${id}`}
              className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[11px] transition-all hover:opacity-80"
              style={{
                borderColor: '#F0C66A55',
                backgroundColor: '#F0C66A10',
                color: '#F0C66A',
              }}
            >
              <Presentation size={11} />
              切到演示
            </Link>
          )}
          <ExportButton
            icon={<FileCode size={11} />}
            label="Markdown"
            color="#6BA0FF"
            onClick={exportMarkdown}
            disabled={!report}
          />
          <ExportButton
            icon={<FileCode size={11} />}
            label="JSON"
            color="#3DD68C"
            onClick={exportJson}
            disabled={!report}
          />
          {report && markdownHref && jsonHref && (
            <>
              <a
                href={markdownHref}
                download={`${report.id}.md`}
                className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[11px] transition-all hover:opacity-80"
                style={{
                  borderColor: '#6BA0FF55',
                  backgroundColor: '#6BA0FF10',
                  color: '#AFC8FF',
                }}
              >
                <Download size={11} />
                下载 MD 文件
              </a>
              <a
                href={jsonHref}
                download={`${report.id}.json`}
                className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[11px] transition-all hover:opacity-80"
                style={{
                  borderColor: '#3DD68C55',
                  backgroundColor: '#3DD68C10',
                  color: '#B9F6D2',
                }}
              >
                <Download size={11} />
                下载 JSON 文件
              </a>
            </>
          )}
        </div>
      </div>
      {flash ? (
        <div className="mt-2 flex items-center gap-1.5 text-[10px] text-[#3DD68C]">
          <CheckCircle2 size={10} />
          {flash}
        </div>
      ) : (
        <div className="body-copy mt-3 text-[12px] leading-6 text-[#6F7898]">
          PDF 使用系统打印 · 每段自动分页 · Markdown / JSON 为前端序列化
        </div>
      )}
    </GlassPanel>
  );
}

function ExportButton({
  icon,
  label,
  color,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  color: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[11px] transition-all hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-30"
      style={{
        borderColor: `${color}55`,
        backgroundColor: `${color}10`,
        color,
      }}
    >
      {icon}
      {label}
    </button>
  );
}

/* ==========================================================================
   Serialization
   ========================================================================== */

function serializeReportToMarkdown(report: Report): string {
  const lines: string[] = [];
  lines.push(`# ${report.title}`);
  if (report.subtitle) lines.push(`\n_${report.subtitle}_`);
  lines.push('');
  lines.push(`> **模板**: ${report.template}`);
  lines.push(`> **作者**: ${report.metadata.author}`);
  lines.push(`> **受众**: ${report.metadata.audience}`);
  lines.push(`> **版本**: v${report.metadata.version}`);
  lines.push(`> **创建**: ${new Date(report.createdAt).toLocaleString('zh-CN')}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  const ordered = [...report.sections].sort((a, b) => a.order - b.order);
  for (const [i, section] of ordered.entries()) {
    lines.push(`## ${i + 1}. ${section.title}`);
    lines.push('');
    lines.push(renderSectionContent(section));
    lines.push('');
  }

  return lines.join('\n');
}

function renderSectionContent(section: ReportSection): string {
  const { kind, content } = section;
  switch (kind) {
    case 'text':
    case 'markdown':
      return typeof content === 'string' ? content : JSON.stringify(content);
    case 'list':
      if (Array.isArray(content)) {
        return content.map((item) => `- ${String(item)}`).join('\n');
      }
      return String(content);
    case 'quote':
      return `> ${typeof content === 'string' ? content : JSON.stringify(content)}`;
    case 'table':
    case 'chart':
    case 'metric_grid':
    case 'scenario':
    default:
      return '```json\n' + JSON.stringify(content, null, 2) + '\n```';
  }
}

function downloadBlob(content: string, filename: string, mime: string) {
  if (typeof window === 'undefined') return;
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
