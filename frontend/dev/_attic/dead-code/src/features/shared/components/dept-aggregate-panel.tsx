'use client';

/**
 * 部门脱敏聚合面板(2026-06-24 · 两层诚实故事的"聚合层"显示)。
 *
 * 读 /api/court/dept-aggregate/<dept>(本地脱敏快照),只显计数:项目总数/已交付/在研/有问题。
 * 军工真数据安全展示:绝不显项目名/型号/人名/军方单位。无快照 → 诚实空态,不编。
 *
 * 自包含、不依赖 jiqun。挂载示例:
 *   import { DeptAggregatePanel } from '@/features/shared/components/dept-aggregate-panel';
 *   <DeptAggregatePanel dept="tech" title="技术部 · 项目台账(聚合)" />
 */

import useSWR from 'swr';
import { GlassPanel } from '@/components/ui/glass-panel';
import { swrFetcher } from '@/lib/api';
import { withBasePath } from '@/lib/base-path';

interface DeptAggregate {
  source?: string;
  projects_total?: number;
  projects_delivered?: number;
  projects_in_progress?: number;
  projects_with_issues?: number;
}

interface AggregateEnvelope {
  success: boolean;
  available: boolean;
  data: DeptAggregate;
}

function Stat({ label, value, tone }: { label: string; value: number | string; tone?: 'ok' | 'warn' }) {
  const color = tone === 'ok' ? '#8BE4B4' : tone === 'warn' ? '#F0C66A' : '#F5E9C9';
  return (
    <div className="rounded-lg border border-white/8 bg-white/[0.03] px-3 py-3">
      <div className="text-[11px] uppercase tracking-[0.18em] text-[#8F835F]">{label}</div>
      <div className="mt-1 text-[20px] font-semibold tabular-nums" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

export function DeptAggregatePanel({ dept, title }: { dept: string; title?: string }) {
  const { data, isLoading } = useSWR<AggregateEnvelope, Error>(
    withBasePath(`/api/court/dept-aggregate/${encodeURIComponent(dept)}`),
    swrFetcher<AggregateEnvelope>,
  );

  const agg = data?.data;
  const available = data?.available === true && typeof agg?.projects_total === 'number';

  return (
    <GlassPanel variant="gold" tone="elevated" padding="md" hudCorners>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="section-eyebrow">{title ?? '部门台账 · 聚合脱敏'}</div>
        <span className="rounded-full border border-[#3DD68C]/30 bg-[#3DD68C]/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#8BE4B4]">
          本地真账 · 聚合
        </span>
      </div>

      {isLoading ? (
        <div className="mt-3 text-[12px] text-[#B6BDD5]">加载中…</div>
      ) : available ? (
        <>
          <div className="mt-3 grid gap-3 grid-cols-2 md:grid-cols-4">
            <Stat label="项目总数" value={agg!.projects_total ?? 0} />
            <Stat label="已交付" value={agg!.projects_delivered ?? 0} tone="ok" />
            <Stat label="在研" value={agg!.projects_in_progress ?? 0} />
            <Stat label="待解问题" value={agg!.projects_with_issues ?? 0} tone="warn" />
          </div>
          <div className="mt-2 text-[11px] leading-5 text-[#8F835F]">
            仅显安全聚合计数 · 不含项目名/型号/人员/军方明细(军工合规)。
          </div>
        </>
      ) : (
        <div className="mt-3 text-[12px] leading-6 text-[#B6BDD5]">
          暂无本地聚合快照 · 运行 <code className="text-[#F0C66A]">scripts/import-dept-aggregate.py</code> 导入脱敏计数后显示。
        </div>
      )}
    </GlassPanel>
  );
}
