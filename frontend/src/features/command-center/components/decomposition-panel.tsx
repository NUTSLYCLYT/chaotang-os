'use client';

import { GlassPanel } from '@/components/ui/glass-panel';
import { aggregationStrategyInPlainWords, taskTypeInPlainWords } from '@/features/throne/lib/plain-language';
import type { Task } from '@/types/task';

function Tag({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="rounded px-2 py-0.5 text-[10px]"
      style={{
        backgroundColor: `${color}15`,
        border: `1px solid ${color}40`,
        color,
      }}
    >
      {label}
    </span>
  );
}

export function DecompositionPanel({ task }: { task: Task }) {
  const plan = task.plan;
  const isPriority =
    task.status === 'draft' ||
    task.status === 'submitted' ||
    task.status === 'interpreting' ||
    task.status === 'planning';
  if (!plan) {
    return (
      <GlassPanel
        variant="gold"
        tone="flat"
        padding="lg"
        hudCorners={isPriority}
        className={isPriority ? 'ring-1 ring-[#F0C66A]/20' : undefined}
      >
        <div className="section-eyebrow">丞相拆解</div>
        <div className="body-copy mt-2">
          丞相正在研判密旨。当前不是执行问题，而是意图还未被拆成可落地的差事。
        </div>
      </GlassPanel>
    );
  }

  return (
    <GlassPanel
      variant="gold"
      tone="elevated"
      padding="lg"
      hudCorners={isPriority}
      className={isPriority ? 'ring-1 ring-[#F0C66A]/22' : undefined}
    >
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="section-eyebrow">丞相拆解</div>
          <h3 className="section-title mt-0.5 text-[#f0c66a]">
            丞相研判 · 自动拆解
          </h3>
        </div>
        <div className="rounded-full border border-[#F0C66A]/18 bg-[#F0C66A]/10 px-3 py-1 text-[10px] text-[#F0C66A]">
          {isPriority ? '当前优先查看' : '基础拆解'}
        </div>
      </div>

      <p className="body-copy mb-3 text-[#d9cfb4]">{plan.intent}</p>

      <div className="mb-3 rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3 text-[11px] leading-6 text-[#C8CDD8]">
        丞相批注：先确认此处拆解是否准确，再看依赖是否完整。若这里没有错，后面的执行就不会散。
      </div>

      <div className="flex flex-wrap gap-2">
        <Tag label={`类型: ${taskTypeInPlainWords(plan.taskType)}`} color="#F0C66A" />
        <Tag label={`聚合: ${aggregationStrategyInPlainWords(plan.aggregationStrategy)}`} color="#6BA0FF" />
        {plan.escalationFlags.map((f) => (
          <Tag key={f} label={f} color="#F5A524" />
        ))}
      </div>
    </GlassPanel>
  );
}
