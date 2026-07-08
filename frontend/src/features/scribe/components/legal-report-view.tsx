'use client';

import { GlassPanel } from '@/components/ui/glass-panel';
import type { Task } from '@/types/task';
import { LegalReportHeader } from './legal-report-header';
import { RiskList } from './risk-list';
import { ActionCards } from './action-cards';
import { CitationList } from './citation-list';
import { SimilarCases } from './similar-cases';
import { ExportMenu } from './export-menu';

const SECTION_EYEBROW = 'text-[11px] uppercase tracking-[0.24em] text-[#8F835F]';

interface LegalReportViewProps {
  task: Task;
}

export function LegalReportView({ task }: LegalReportViewProps) {
  const report = task.manorReport;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <LegalReportHeader
            taskId={task.id}
            taskTitle={task.title}
            createdAt={task.createdAt}
            domain={report?.domain}
          />
        </div>
        {report && (
          <div className="shrink-0 pt-1">
            <ExportMenu task={task} report={report} />
          </div>
        )}
      </div>

      {/* Summary */}
      {report && (
        <GlassPanel tone="elevated" padding="lg">
          <div className={SECTION_EYEBROW}>研判摘要 · Analysis Summary</div>
          <p className="mt-3 text-[15px] leading-[1.8] text-[#E8DFCA]">{report.summary}</p>
          {report.requires_departments.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {report.requires_departments.map((dept) => (
                <span
                  key={dept}
                  className="rounded-full border border-[#F0C66A]/20 bg-[#F0C66A]/8 px-2.5 py-1 text-[11px] text-[#F0C66A]"
                >
                  {dept}
                </span>
              ))}
            </div>
          )}
        </GlassPanel>
      )}

      {/* Risks */}
      {report && report.risks.length > 0 && (
        <GlassPanel tone="flat" padding="lg">
          <div className={`${SECTION_EYEBROW} mb-4`}>风险清单 · Risk Assessment</div>
          <RiskList risks={report.risks} />
        </GlassPanel>
      )}

      {/* Actions */}
      {report && report.action_cards.length > 0 && (
        <GlassPanel tone="flat" padding="lg">
          <div className={`${SECTION_EYEBROW} mb-4`}>行动卡 · Action Plan</div>
          <ActionCards cards={report.action_cards} />
        </GlassPanel>
      )}

      {/* Citations — only show when data exists */}
      {report && (report.citations ?? []).length > 0 && (
        <GlassPanel tone="flat" padding="lg">
          <div className={`${SECTION_EYEBROW} mb-4`}>引用法规 · References</div>
          <CitationList citations={report.citations!} />
        </GlassPanel>
      )}

      {/* Similar cases */}
      <GlassPanel tone="flat" padding="lg">
        <div className={`${SECTION_EYEBROW} mb-4`}>相似历史案例 · Similar Cases</div>
        <SimilarCases currentRawCommand={task.rawCommand} currentTaskId={task.id} domain={report?.domain} />
      </GlassPanel>

      {/* Original command */}
      <GlassPanel tone="flat" padding="lg">
        <div className={`${SECTION_EYEBROW} mb-3`}>原始发令 · Original Command</div>
        <p className="rounded-lg border border-white/5 bg-black/20 p-3 text-[12px] leading-relaxed text-[#9AA3C4]">
          {task.rawCommand}
        </p>
      </GlassPanel>
    </div>
  );
}
