/**
 * 战报库详情 Hero —— 标题 / 模板 / 元数据
 */

'use client';

import Link from 'next/link';
import { ArrowLeft, Calendar, Users, GitCommit, Play } from 'lucide-react';
import { GlassPanel } from '@/components/ui/glass-panel';
import { AGENT_META } from '@/types/agent';
import type { AgentCode } from '@/types/agent';
import type { Report } from '@/types/report';
import { REPORT_TEMPLATE_META } from './report-template-meta';

export interface ReportHeroProps {
  report: Report;
}

export function ReportHero({ report }: ReportHeroProps) {
  const template = REPORT_TEMPLATE_META[report.template];
  const Icon = template.Icon;

  return (
    <GlassPanel
      variant="gold"
      tone="elevated"
      hudCorners
      padding="lg"
      className="relative overflow-hidden"
    >
      {/* 背景微光 */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(ellipse at top right, ${template.color}15, transparent 60%)`,
        }}
      />

      <div className="relative flex items-center justify-between gap-6">
        <div className="flex-1">
          {/* 返回链接 */}
          <Link
            href="/reports"
            className="mb-2 inline-flex items-center gap-1 text-[10px] text-[#6A7299] hover:text-[#F0C66A]"
          >
            <ArrowLeft size={10} />
            返回战报库
          </Link>

          {/* 模板标签 */}
          <div className="mb-2 flex items-center gap-2">
            <div
              className="flex h-6 w-6 items-center justify-center rounded"
              style={{
                backgroundColor: `${template.color}18`,
                border: `1px solid ${template.color}55`,
              }}
            >
              <Icon size={12} style={{ color: template.color }} />
            </div>
            <span
              className="rounded px-2 py-0.5 text-[10px] font-medium"
              style={{
                backgroundColor: `${template.color}15`,
                color: template.color,
              }}
            >
              {template.label}
            </span>
            <span className="font-mono text-[9px] text-[#484F72]">{template.sublabel}</span>
          </div>

          {/* 主标题 */}
          <h1 className="page-title text-[30px] leading-tight tracking-[0.03em]">
            {report.title}
          </h1>
          {report.subtitle && (
            <p className="page-meta mt-1">{report.subtitle}</p>
          )}

          {/* 元数据 */}
          <div className="mt-4 flex flex-wrap items-center gap-4 text-[10px] text-[#9AA3C4]">
            <div className="flex items-center gap-1.5">
              <Calendar size={10} />
              <span>{new Date(report.createdAt).toLocaleString('zh-CN')}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Users size={10} />
              <span>面向：{report.metadata.audience}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <GitCommit size={10} />
              <span className="font-mono">v{report.metadata.version}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span>作者：</span>
              <span className="text-[#F0C66A]">{report.metadata.author}</span>
            </div>
          </div>

          {/* 参与 Agent */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="text-[9px] text-[#484F72]">协同 Agent:</span>
            {report.metadata.contributingAgents.map((code) => {
              const meta = AGENT_META[code as AgentCode];
              if (!meta) return null;
              return (
                <span
                  key={code}
                  className="flex items-center gap-1 rounded border px-1.5 py-0.5 text-[9px]"
                  style={{
                    borderColor: `${meta.color}44`,
                    color: meta.color,
                  }}
                >
                  <span>{meta.emoji}</span>
                  {meta.nameCn}
                </span>
              );
            })}
          </div>
        </div>

        {/* 进入演示模式 */}
        <Link
          href={`/present/${report.id}`}
          className="flex items-center gap-2 rounded-lg px-5 py-3 text-[13px] font-semibold transition-all hover:opacity-90"
          style={{
            background: 'linear-gradient(135deg, #F0C66A, #D4A84B)',
            color: '#04060E',
            boxShadow: '0 0 24px rgba(240, 198, 106, 0.35)',
          }}
        >
          <Play size={14} fill="currentColor" />
          切到演示
        </Link>
      </div>
    </GlassPanel>
  );
}
