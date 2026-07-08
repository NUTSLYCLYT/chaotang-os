'use client';

import { useState, useRef, useEffect } from 'react';
import { Download, FileText, FileCode, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import type { Task } from '@/types/task';
import type { ManorAnalyzeResult } from '@/types/manor';
import { exportLegalReportAsPdf } from '@/lib/export/legal-report-to-pdf';
import { legalReportToMarkdown, downloadMarkdown } from '@/lib/export/legal-report-to-markdown';
import { emitAudit } from '@/lib/audit/audit-emitter';
import { trackEvent } from '@/lib/metrics';

interface ExportMenuProps {
  task: Task;
  report: ManorAnalyzeResult;
}

function formatDateForFilename(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

export function ExportMenu({ task, report }: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<'pdf' | 'md' | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  async function handlePdf() {
    if (loading) return;
    setLoading('pdf');
    setOpen(false);
    try {
      exportLegalReportAsPdf(task, report);
      emitAudit('export_report', { targetId: task.id, metadata: { format: 'pdf' } });
      trackEvent({ name: 'report_rendered', taskId: task.id, domain: report.domain, durationMs: 0 });
      toast('PDF 已在新标签页打开，请选择「打印/保存为 PDF」');
    } finally {
      setLoading(null);
    }
  }

  async function handleMarkdown() {
    if (loading) return;
    setLoading('md');
    setOpen(false);
    try {
      const md = legalReportToMarkdown(task, report);
      const filename = `LCR-001-${task.id}-${formatDateForFilename()}.md`;
      downloadMarkdown(md, filename);
      emitAudit('export_report', { targetId: task.id, metadata: { format: 'markdown' } });
      toast('已下载到本地：' + filename);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={!!loading}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-[12px] text-[#EAEEFB] transition hover:border-[#F0C66A]/30 hover:bg-[#F0C66A]/8 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Download size={13} />
        {loading ? '生成中…' : '导出报告'}
        <ChevronDown size={11} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-1.5 w-44 rounded-lg border border-white/10 bg-[#0A0C18] py-1 shadow-xl"
          style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }}
        >
          <button
            type="button"
            onClick={handlePdf}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-[12px] text-[#EAEEFB] transition hover:bg-[#F0C66A]/8 hover:text-[#F0C66A]"
          >
            <FileText size={13} />
            导出 PDF
          </button>
          <button
            type="button"
            onClick={handleMarkdown}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-[12px] text-[#EAEEFB] transition hover:bg-[#F0C66A]/8 hover:text-[#F0C66A]"
          >
            <FileCode size={13} />
            导出 Markdown
          </button>
        </div>
      )}
    </div>
  );
}
