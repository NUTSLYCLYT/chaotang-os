/**
 * 报告段落统一渲染器
 *
 * 根据 section.kind 切换视觉
 * - text / markdown → 段落
 * - list → 各部结论卡片（如果 content 是 DepartmentConclusion[]）
 * - 其他 kind 降级为 JSON 预览
 */

'use client';

import { AGENT_META } from '@/types/agent';
import type { AgentCode } from '@/types/agent';
import type { ReportSection, DepartmentConclusion } from '@/types/report';

export interface ReportSectionRendererProps {
  section: ReportSection;
  variant?: 'detail' | 'presentation';
}

export function ReportSectionRenderer({ section, variant = 'detail' }: ReportSectionRendererProps) {
  const textSize = variant === 'presentation' ? 'text-[18px]' : 'text-[13px]';
  const lineClass = variant === 'presentation' ? 'leading-[2.2]' : 'leading-relaxed';

  if (section.kind === 'text' || section.kind === 'markdown') {
    return (
      <div
        className={`${textSize} ${lineClass} whitespace-pre-wrap text-[#EAEEFB]`}
        style={variant === 'presentation' ? { maxWidth: 880 } : undefined}
      >
        {String(section.content)}
      </div>
    );
  }

  if (section.kind === 'list') {
    // 可能是 string[] 或 DepartmentConclusion[]
    if (!Array.isArray(section.content)) {
      return <div className="text-[11px] text-[#6A7299]">（内容异常）</div>;
    }
    const items = section.content as (string | DepartmentConclusion)[];
    if (items.length === 0) {
      return <div className="text-[11px] text-[#6A7299]">（空）</div>;
    }

    // 判断是否为 DepartmentConclusion[]
    const first = items[0];
    if (first && typeof first === 'object' && 'agentCode' in first) {
      return (
        <div className={variant === 'presentation' ? 'space-y-5' : 'space-y-3'}>
          {(items as DepartmentConclusion[]).map((c) => (
            <DepartmentConclusionCard key={c.agentCode} conclusion={c} variant={variant} />
          ))}
        </div>
      );
    }

    // 字符串列表
    return (
      <ul className={`${textSize} ${lineClass} space-y-2 text-[#EAEEFB]`}>
        {(items as string[]).map((it, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="mt-1 flex-shrink-0 text-[#F0C66A]">·</span>
            <span>{it}</span>
          </li>
        ))}
      </ul>
    );
  }

  // fallback
  return (
    <pre className="overflow-x-auto rounded bg-black/40 p-3 font-mono text-[11px] text-[#9AA3C4]">
      {JSON.stringify(section.content, null, 2)}
    </pre>
  );
}

/* ==========================================================================
   部门结论卡
   ========================================================================== */

function DepartmentConclusionCard({
  conclusion,
  variant,
}: {
  conclusion: DepartmentConclusion;
  variant: 'detail' | 'presentation';
}) {
  const meta = AGENT_META[conclusion.agentCode as AgentCode];
  const color = meta?.color ?? '#9AA3C4';
  const isPresent = variant === 'presentation';

  return (
    <div
      className="rounded-lg border p-4 transition-all"
      style={{
        borderColor: `${color}44`,
        backgroundColor: 'rgba(10, 14, 30, 0.5)',
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {meta && <span className={isPresent ? 'text-2xl' : 'text-base'}>{meta.emoji}</span>}
          <h4
            className={isPresent ? 'text-[20px] font-bold' : 'text-[13px] font-bold'}
            style={{ color }}
          >
            {conclusion.departmentName}
          </h4>
        </div>
        <span
          className={isPresent ? 'text-[14px]' : 'text-[10px]'}
          style={{
            color:
              conclusion.confidence >= 0.8
                ? '#3DD68C'
                : conclusion.confidence >= 0.6
                  ? '#F0C66A'
                  : '#F5A524',
          }}
        >
          置信度 {Math.round(conclusion.confidence * 100)}%
        </span>
      </div>

      <p
        className={`mt-2 leading-relaxed text-[#EAEEFB] ${
          isPresent ? 'text-[16px]' : 'text-[12px]'
        }`}
      >
        {conclusion.summary}
      </p>

      {conclusion.keyPoints.length > 0 && (
        <ul
          className={`mt-2 space-y-0.5 font-mono ${
            isPresent ? 'text-[12px]' : 'text-[10px]'
          }`}
          style={{ color: '#9AA3C4' }}
        >
          {conclusion.keyPoints.map((kp, i) => (
            <li key={i}>· {kp}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
