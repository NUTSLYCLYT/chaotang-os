'use client';

import { useEffect, useMemo, useState } from 'react';
import { GlassPanel } from '@/components/ui/glass-panel';
import { HanlinRoleBadge } from '@/features/hanlin/components/hanlin-role-badge';
import { hanlinRoleHeaders, hasHanlinCapability, readHanlinRole } from '@/features/hanlin/lib/access';
import { hanlinApi } from '@/features/hanlin/lib/api';
import { PageBrief } from '@/features/shared/components/page-brief';
import type { ProductizedModule } from '@/features/hanlin/types';

export function HanlinIncubationWorkspace() {
  const role = readHanlinRole();
  const canManage = hasHanlinCapability(role, 'incubation_manage');
  const [modules, setModules] = useState<ProductizedModule[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string>('');

  async function load() {
    setStatus('loading');
    try {
      const response = await fetch(hanlinApi('/api/hanlin/incubation'));
      if (!response.ok) {
        throw new Error('hanlin_incubation_fetch_failed');
      }
      const payload = (await response.json()) as { modules: ProductizedModule[] };
      setModules(payload.modules);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const grouped = useMemo(
    () => ({
      standardizing: modules.filter((item) => item.status === 'standardizing'),
      packaged: modules.filter((item) => item.status === 'packaged'),
      sellable: modules.filter((item) => item.status === 'sellable' || item.status === 'active'),
    }),
    [modules],
  );

  async function advanceModule(item: ProductizedModule, nextStatus: ProductizedModule['status']) {
    setSubmittingId(item.id);
    setMessage('');
    const response = await fetch(hanlinApi('/api/hanlin/incubation'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...hanlinRoleHeaders(role) },
      body: JSON.stringify({ id: item.id, status: nextStatus }),
    });
    if (response.ok) {
      await load();
      setMessage(
        nextStatus === 'packaged'
          ? '修典司已将模块推进到已打包。'
          : nextStatus === 'sellable'
            ? '修典司已将模块推进到可售候选。'
            : '修典司已将模块标记为已上架。'
      );
    } else {
      setMessage('模块修典状态更新失败，请稍后重试。');
    }
    setSubmittingId(null);
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[1600px] space-y-5 p-6">
        <PageBrief
          eyebrow="Incubation Office · 修典司"
          title="修典司负责把内部优秀能力变成标准件，而不是让好东西永远散在系统里。"
          hook="修典不是装饰层，而是标准化、边界化、商品化的前置工序。"
          brief="模块只有经过文档、依赖、接口、边界四条线的整理，才有资格进入出海商品榜。"
          primaryAction={{ label: '查看出海商品台', href: '/hanlin/export' }}
          secondaryAction={{ label: '返回翰林院', href: '/hanlin', tone: 'secondary' }}
        />

        <HanlinRoleBadge
          role={role}
          note={canManage ? '当前席位可推进模块修典状态。' : '当前席位只能查看修典状态。'}
        />

        {message ? (
          <GlassPanel tone="elevated" padding="md">
            <p className="text-[12px] text-[#D7CCA9]">{message}</p>
          </GlassPanel>
        ) : null}

        <div className="grid gap-3 md:grid-cols-3">
          <SummaryStat label="修典中" value={`${grouped.standardizing.length}`} />
          <SummaryStat label="已打包" value={`${grouped.packaged.length}`} />
          <SummaryStat label="可售候选" value={`${grouped.sellable.length}`} />
        </div>

        <div className="grid gap-5 xl:grid-cols-3">
          {status === 'loading' ? (
            <GlassPanel tone="elevated" padding="lg">
              <p className="text-[12px] text-[#AEB7D1]">修典司正在同步模块标准化状态。</p>
            </GlassPanel>
          ) : status === 'error' ? (
            <GlassPanel tone="elevated" padding="lg">
              <p className="text-[12px] text-[#F6DFA2]">修典司数据暂时未取到，请稍后再试。</p>
            </GlassPanel>
          ) : (
            <>
              <ModuleColumn
                title="修典中"
                items={grouped.standardizing}
                emptyLabel="当前无修典中模块"
                submittingId={submittingId}
                canManage={canManage}
                actionLabel="推进到已打包"
                onAdvance={(item) => advanceModule(item, 'packaged')}
              />
              <ModuleColumn
                title="已打包"
                items={grouped.packaged}
                emptyLabel="当前无已打包模块"
                submittingId={submittingId}
                canManage={canManage}
                actionLabel="推进到可售候选"
                onAdvance={(item) => advanceModule(item, 'sellable')}
              />
              <ModuleColumn
                title="可售候选"
                items={grouped.sellable}
                emptyLabel="当前无可售候选"
                submittingId={submittingId}
                canManage={canManage}
                actionLabel="标记为已上架"
                onAdvance={(item) => advanceModule(item, 'active')}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <GlassPanel tone="elevated" padding="md">
      <div className="text-[11px] uppercase tracking-[0.16em] text-[#8F835F]">{label}</div>
      <div className="mt-2 text-[24px] font-semibold text-[#F5E9C9]">{value}</div>
    </GlassPanel>
  );
}

function ModuleColumn({
  title,
  items,
  emptyLabel,
  submittingId,
  canManage,
  actionLabel,
  onAdvance,
}: {
  title: string;
  items: ProductizedModule[];
  emptyLabel: string;
  submittingId?: string | null;
  canManage: boolean;
  actionLabel?: string;
  onAdvance?: (item: ProductizedModule) => Promise<void>;
}) {
  return (
    <GlassPanel tone="elevated" padding="lg">
      <div className="mb-4">
        <div className="section-eyebrow">Module Status</div>
        <h2 className="section-title text-[20px]">{title}</h2>
      </div>
      <div className="space-y-3">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4 text-[12px] text-[#AEB7D1]">
            {emptyLabel}
          </div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[13px] font-semibold text-[#F5E9C9]">{item.name}</div>
                  <div className="mt-1 text-[11px] uppercase tracking-[0.16em] text-[#8F835F]">{item.ownerName}</div>
                </div>
                <div className="rounded-full border border-[#F0C66A]/20 bg-[#F0C66A]/10 px-3 py-1 text-[11px] text-[#F0C66A]">
                  {labelForStatus(item.status)}
                </div>
              </div>
              <p className="mt-3 text-[12px] leading-6 text-[#AEB7D1]">{item.notes}</p>
              <div className="mt-4 grid gap-2 md:grid-cols-2">
                <MiniMetric label="文档" value={item.docStatus} />
                <MiniMetric label="接口" value={item.apiStatus} />
                <MiniMetric label="依赖" value={item.dependencyStatus} />
                <MiniMetric label="边界" value={item.boundaryStatus} />
              </div>
              {onAdvance && item.status !== 'active' ? (
                <button
                  type="button"
                  disabled={submittingId === item.id || !canManage}
                  onClick={() => void onAdvance(item)}
                  className="mt-4 rounded-full border border-[#F0C66A]/24 bg-[#F0C66A]/10 px-3 py-1.5 text-[11px] text-[#F0C66A] transition hover:bg-[#F0C66A]/16 disabled:opacity-60"
                >
                  {actionLabel}
                </button>
              ) : null}
            </div>
          ))
        )}
      </div>
    </GlassPanel>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/8 bg-black/20 px-3 py-2">
      <div className="text-[11px] uppercase tracking-[0.16em] text-[#8F835F]">{label}</div>
      <div className="mt-1 text-[12px] text-[#D7CCA9]">{value}</div>
    </div>
  );
}

function labelForStatus(status: ProductizedModule['status']) {
  switch (status) {
    case 'standardizing':
      return '修典中';
    case 'packaged':
      return '已打包';
    case 'sellable':
      return '可售';
    case 'active':
      return '已上架';
    default:
      return '草稿';
  }
}
