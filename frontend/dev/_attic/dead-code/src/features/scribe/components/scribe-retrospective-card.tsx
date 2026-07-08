/**
 * 朝堂 OS V2 · 史馆 · 复盘卡片
 *
 * 消费 Task.retrospective 结构化数据。
 * 本阶段 (Q3=D) 只做展示，不做录入。
 * 无复盘数据时显示空态提示。
 */

'use client';

import { Award, CheckCircle2, AlertTriangle, Lightbulb, Scroll } from 'lucide-react';
import { GlassPanel } from '@/components/ui/glass-panel';
import type { TaskRetrospective } from '@/types/task';
import { SectionLabel } from './section-label';

export interface ScribeRetrospectiveCardProps {
  retrospective?: TaskRetrospective;
}

export function ScribeRetrospectiveCard({ retrospective }: ScribeRetrospectiveCardProps) {
  if (!retrospective) {
    return (
      <GlassPanel tone="flat" padding="md">
        <SectionLabel as="h3" icon={<Award size={13} className="text-[#484F72]" />}>
          Retrospective · 复盘
        </SectionLabel>
        <div className="py-3 text-center text-[11px] text-[#6A7299]">此任务尚未完成复盘</div>
      </GlassPanel>
    );
  }

  const { score, successes, failures, lessons, playbook, authoredBy, authoredAt, synthetic } =
    retrospective;

  return (
    <GlassPanel tone="elevated" padding="md" variant="gold">
      <SectionLabel
        as="h3"
        icon={<Award size={13} className="text-[#F0C66A]" />}
        trailing={<ScoreStars score={score} />}
      >
        <span className="inline-flex items-center gap-2">
          Retrospective · 复盘
          {synthetic && (
            <span
              className="rounded px-1.5 py-0.5 text-[11px] font-medium normal-case tracking-normal"
              style={{
                color: '#93C5FD',
                background: 'rgba(147, 197, 253, 0.12)',
                border: '1px solid rgba(147, 197, 253, 0.3)',
              }}
              title="该复盘由系统自动归纳生成，供当前阅读与复盘使用"
            >
              系统归纳
            </span>
          )}
        </span>
      </SectionLabel>

      {/* 成功因素 */}
      {successes.length > 0 && (
        <Section
          icon={<CheckCircle2 size={11} className="text-[#3DD68C]" />}
          label="成功"
          tone="success"
          items={successes}
        />
      )}

      {/* 失败因素 */}
      {failures.length > 0 && (
        <Section
          icon={<AlertTriangle size={11} className="text-[#F43F5E]" />}
          label="失误"
          tone="danger"
          items={failures}
        />
      )}

      {/* 经验教训 */}
      {lessons.length > 0 && (
        <Section
          icon={<Lightbulb size={11} className="text-[#F0C66A]" />}
          label="经验"
          tone="gold"
          items={lessons}
        />
      )}

      {/* Playbook */}
      {playbook && (
        <div className="mt-3 rounded-md border border-[#1A2142] bg-[rgba(10,14,30,0.5)] p-2.5">
          <h4 className="m-0 mb-1 flex items-center gap-1.5 text-[11px] font-normal uppercase tracking-wider text-[#6A7299]">
            <Scroll size={11} className="text-[#93C5FD]" />
            Playbook · 复用模板
          </h4>
          <div className="text-[11px] leading-relaxed text-[#EAEEFB]">{playbook}</div>
        </div>
      )}

      {/* 署名 */}
      {authoredBy && (
        <div className="mt-3 border-t border-[#1A2142] pt-2 text-right font-mono text-[11px] text-[#6A7299]">
          {authoredBy} · {new Date(authoredAt).toLocaleDateString('zh-CN')}
        </div>
      )}
    </GlassPanel>
  );
}

function ScoreStars({ score }: { score: 1 | 2 | 3 | 4 | 5 }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          className="text-[11px] leading-none"
          style={{ color: n <= score ? '#F0C66A' : '#484F72' }}
        >
          ★
        </span>
      ))}
      <span className="ml-1 font-mono text-[11px] text-[#F0C66A]">{score}/5</span>
    </div>
  );
}

const TONE_STYLE: Record<'success' | 'danger' | 'gold', { bullet: string }> = {
  success: { bullet: '#3DD68C' },
  danger: { bullet: '#F43F5E' },
  gold: { bullet: '#F0C66A' },
};

function Section({
  icon,
  label,
  tone,
  items,
}: {
  icon: React.ReactNode;
  label: string;
  tone: 'success' | 'danger' | 'gold';
  items: string[];
}) {
  const { bullet } = TONE_STYLE[tone];
  return (
    <div className="mb-2.5">
      <h4 className="m-0 mb-1 flex items-center gap-1.5 text-[11px] font-normal uppercase tracking-wider text-[#6A7299]">
        {icon}
        {label}
      </h4>
      <ul className="space-y-1 pl-1">
        {items.map((item, i) => (
          <li key={i} className="flex gap-1.5 text-[11px] leading-relaxed text-[#EAEEFB]">
            <span style={{ color: bullet }}>·</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
