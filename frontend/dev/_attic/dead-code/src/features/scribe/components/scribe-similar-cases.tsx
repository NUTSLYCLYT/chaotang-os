/**
 * 朝堂 OS V2 · 史馆 · 右栏相似案例 + 成功模板
 */

'use client';

import { Sparkles, CheckCircle2 } from 'lucide-react';
import { GlassPanel } from '@/components/ui/glass-panel';
import { EmptyState } from '@/features/shared/components/imperial/empty-state';
import { taskTypeInPlainWords } from '@/features/throne/lib/plain-language';
import type { SimilarCase } from '../lib/similarity';
import { SectionLabel } from './section-label';

export interface ScribeSimilarCasesProps {
  similarCases: SimilarCase[];
  onSelect: (id: string) => void;
}

/** 硬编码成功模板（Q3=D：本阶段不做模板聚合，保持 mock） */
const SUCCESS_TEMPLATES = [
  { name: '三部联合调研', uses: 7, winRate: 92 },
  { name: '锦衣卫 + 钦天监 预警', uses: 5, winRate: 88 },
  { name: '户部压力测试', uses: 4, winRate: 85 },
];

export function ScribeSimilarCases({ similarCases, onSelect }: ScribeSimilarCasesProps) {
  return (
    <div className="space-y-5">
      <GlassPanel tone="elevated" padding="md">
        <SectionLabel as="h3" icon={<Sparkles size={13} className="text-[#F0C66A]" />}>相似案例</SectionLabel>
        <div className="space-y-2">
          {similarCases.length === 0 && (
            <EmptyState
              icon={Sparkles}
              title="当前没有相似案例"
              body="等史馆积累到更多同类卷宗后，这里会回召可直接对照的处理路径与经验。"
            />
          )}
          {similarCases.map(({ task, score }) => (
            <button
              key={task.id}
              onClick={() => onSelect(task.id)}
              className="w-full rounded-md border border-[#1A2142] bg-[rgba(10,14,30,0.4)] p-2 text-left transition-colors hover:border-[#F0C66A]/50"
            >
              <div className="line-clamp-2 text-[11px] text-[#EAEEFB]">{task.title}</div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-[11px] text-[#6A7299]">
                  {task.plan?.taskType ? taskTypeInPlainWords(task.plan.taskType) : '—'}
                </span>
                <span className="font-mono text-[11px] text-[#F0C66A]">匹配 {score}</span>
              </div>
            </button>
          ))}
        </div>
      </GlassPanel>

      <GlassPanel tone="elevated" padding="md">
        <SectionLabel as="h3" icon={<CheckCircle2 size={13} className="text-[#3DD68C]" />}>成功模板</SectionLabel>
        <div className="space-y-2">
          {SUCCESS_TEMPLATES.map((tpl) => (
            <div
              key={tpl.name}
              className="rounded-md border border-[#1A2142] bg-[rgba(10,14,30,0.4)] p-2"
            >
              <div className="text-[10px] font-medium text-[#EAEEFB]">{tpl.name}</div>
              <div className="mt-1 flex items-center justify-between font-mono text-[11px]">
                <span className="text-[#6A7299]">{tpl.uses} 次复用</span>
                <span className="text-[#3DD68C]">胜率 {tpl.winRate}%</span>
              </div>
            </div>
          ))}
        </div>
      </GlassPanel>
    </div>
  );
}
