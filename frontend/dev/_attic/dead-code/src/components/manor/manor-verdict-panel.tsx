'use client';

import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ManorFrame, ManorFrameTitle } from './manor-frame';

/**
 * ManorVerdictPanel — 详情裁决面板
 *
 * 从户部 hubu-client.tsx 的右面板 AuditBlock 模式泛化。
 * 支持两种状态：
 *   1. 选中态：摘要 + 指标网格 + 详情块列表 + 跨部链接
 *   2. 空态：icon + 标题 + 描述文字
 */

export interface ManorVerdictMetricBlock {
  label: string;
  value: string;
  icon: LucideIcon;
  color: string;
}

export interface ManorVerdictBlock {
  title: string;
  icon: LucideIcon;
  accent?: string;
  content: ReactNode;
}

export interface ManorVerdictPanelProps {
  accent: string;
  title: string;
  action?: string;
  // 选中实体
  selectedEntity?: {
    id: string;
    title: string;
    status?: string;
    statusColor?: string;
    priority?: string;
    summary?: string;
  } | null;
  metricBlocks?: ManorVerdictMetricBlock[];
  verdictBlocks?: ManorVerdictBlock[];
  linkBlocks?: ReactNode;
  // 空态
  emptyIcon?: LucideIcon;
  emptyTitle?: string;
  emptyDescription?: string;
}

export function ManorVerdictPanel({
  accent,
  title,
  action,
  selectedEntity,
  metricBlocks,
  verdictBlocks,
  linkBlocks,
  emptyIcon: EmptyIcon,
  emptyTitle = '裁决台',
  emptyDescription = '点击左侧列表\n选中任一项\n即可查看裁决详情',
}: ManorVerdictPanelProps) {
  return (
    <ManorFrame accent={accent} strength="strong" style={{ minHeight: 0, flex: 1 }}>
      <ManorFrameTitle
        title={title}
        action={action ?? selectedEntity?.id?.slice(0, 8)}
        accent={accent}
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {selectedEntity ? (
          <div className="space-y-3">
            {/* 摘要 */}
            <div
              className="rounded-md border p-3"
              style={{
                borderColor: `${selectedEntity.statusColor ?? accent}55`,
                background: `${selectedEntity.statusColor ?? accent}0f`,
              }}
            >
              <div className="flex items-center justify-between gap-2">
                {selectedEntity.status && selectedEntity.statusColor ? (
                  <span
                    className="rounded border px-1.5 py-0.5 text-[9px]"
                    style={{
                      borderColor: `${selectedEntity.statusColor}55`,
                      color: selectedEntity.statusColor,
                      background: `${selectedEntity.statusColor}12`,
                    }}
                  >
                    {selectedEntity.status}
                  </span>
                ) : null}
                {selectedEntity.priority ? (
                  <span className="text-[9px] tracking-[0.14em] text-[#6A7299]">
                    {selectedEntity.priority}
                  </span>
                ) : null}
              </div>
              <h2 className="mt-2 font-serif text-[16px] font-semibold leading-6 text-[#F5E9C9]">
                {selectedEntity.title}
              </h2>
              {selectedEntity.summary ? (
                <p className="mt-1.5 text-[11px] leading-5 text-[#C6BB9D]">
                  {selectedEntity.summary}
                </p>
              ) : null}
            </div>

            {/* 指标网格 */}
            {metricBlocks && metricBlocks.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {metricBlocks.map((m) => (
                  <div
                    key={m.label}
                    className="rounded-md border p-2.5"
                    style={{
                      borderColor: `${m.color}22`,
                      background: `${m.color}08`,
                    }}
                  >
                    <div className="flex items-center gap-1.5 text-[9px] text-[#6A7299]">
                      <m.icon size={11} />
                      {m.label}
                    </div>
                    <div
                      className="mt-1 font-mono text-[13px] font-semibold"
                      style={{ color: m.color }}
                    >
                      {m.value}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 详情块 */}
            {verdictBlocks?.map((block) => (
              <VerdictBlock key={block.title} block={block} accent={accent} />
            ))}

            {/* 链接块 */}
            {linkBlocks}
          </div>
        ) : (
          /* 空态 */
          <div className="flex flex-col items-center justify-center py-24 text-center">
            {EmptyIcon ? (
              <EmptyIcon size={32} className="text-[#6A7299] opacity-30" />
            ) : null}
            <p className="mt-4 font-serif text-[15px] text-[#F5E9C9]">
              {emptyTitle}
            </p>
            <p className="mt-2 whitespace-pre-line text-[11px] leading-5 text-[#8F9AB8]">
              {emptyDescription}
            </p>
          </div>
        )}
      </div>
    </ManorFrame>
  );
}

function VerdictBlock({
  block,
  accent,
}: {
  block: ManorVerdictBlock;
  accent: string;
}) {
  const bAccent = block.accent ?? accent;
  return (
    <div
      className="rounded-md border p-3"
      style={{
        borderColor: `${bAccent}22`,
        background: `${bAccent}08`,
      }}
    >
      <div
        className="mb-2 flex items-center gap-2 text-[11px] font-semibold tracking-[0.06em]"
        style={{ color: bAccent }}
      >
        <block.icon size={13} />
        {block.title}
      </div>
      {block.content}
    </div>
  );
}
