'use client';

import { useEffect, useMemo, useState } from 'react';
import { GlassPanel } from '@/components/ui/glass-panel';
import { HanlinRoleBadge } from '@/features/hanlin/components/hanlin-role-badge';
import { hanlinRoleHeaders, hasHanlinCapability, readHanlinRole } from '@/features/hanlin/lib/access';
import { fetchHanlin } from '@/features/hanlin/lib/api';
import { PageBrief } from '@/features/shared/components/page-brief';
import type { ExportOffering, ProductizedModule } from '@/features/hanlin/types';

export function HanlinExportWorkspace() {
  const role = readHanlinRole();
  const canManage = hasHanlinCapability(role, 'export_manage');
  const [offerings, setOfferings] = useState<ExportOffering[]>([]);
  const [modules, setModules] = useState<ProductizedModule[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string>('');

  async function load() {
    setStatus('loading');
    try {
      const response = await fetchHanlin('/api/hanlin/export-offerings');
      if (!response.ok) {
        throw new Error('hanlin_export_fetch_failed');
      }
      const payload = (await response.json()) as {
        offerings: ExportOffering[];
        modules: ProductizedModule[];
      };
      setOfferings(payload.offerings);
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
      sellable: offerings.filter((item) => item.salesStatus === 'sellable' || item.salesStatus === 'active'),
      internal: offerings.filter((item) => item.salesStatus === 'internal_only'),
      draft: offerings.filter((item) => item.salesStatus === 'draft'),
    }),
    [offerings],
  );

  async function updateOffering(item: ExportOffering, nextStatus: ExportOffering['salesStatus']) {
    setSubmittingId(item.id);
    setMessage('');
    const response = await fetchHanlin('/api/hanlin/export-offerings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...hanlinRoleHeaders(role) },
      body: JSON.stringify({ id: item.id, salesStatus: nextStatus }),
    });
    if (response.ok) {
      await load();
      setMessage(
        nextStatus === 'active'
          ? '出海司已将商品标记为已上架。'
          : nextStatus === 'sellable'
            ? '出海司已将商品转为可售。'
            : '出海司已将商品转为内部专用。'
      );
    } else {
      setMessage('商品状态更新失败，请稍后重试。');
    }
    setSubmittingId(null);
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[1600px] space-y-5 p-6">
        <PageBrief
          eyebrow="Export Office · 出海司"
          title="出海司负责把修典完成的模块变成真正可售的 API、插件、工作流包和服务包。"
          hook="商品化不是把功能搬出去，而是把价值、边界和价格一起明确。"
          brief="这一步承接修典司的产出，决定哪些模块只适合内部使用，哪些已经可以对外卖。"
          primaryAction={{ label: '返回修典司', href: '/hanlin/incubation' }}
          secondaryAction={{ label: '返回翰林院', href: '/hanlin', tone: 'secondary' }}
        />

        <HanlinRoleBadge
          role={role}
          note={canManage ? '当前席位可推进商品状态与售卖边界。' : '当前席位只能查看出海商品台。'}
        />

        {message ? (
          <GlassPanel tone="elevated" padding="md">
            <p className="text-[12px] text-[#D7CCA9]">{message}</p>
          </GlassPanel>
        ) : null}

        <div className="grid gap-3 md:grid-cols-3">
          <SummaryStat label="可售 / 已上架" value={`${grouped.sellable.length}`} />
          <SummaryStat label="内部专用" value={`${grouped.internal.length}`} />
          <SummaryStat label="草稿商品" value={`${grouped.draft.length}`} />
        </div>

        <div className="grid gap-5 xl:grid-cols-3">
          {status === 'loading' ? (
            <GlassPanel tone="elevated" padding="lg">
              <p className="text-[12px] text-[#AEB7D1]">出海司正在同步商品化状态与定价带。</p>
            </GlassPanel>
          ) : status === 'error' ? (
            <GlassPanel tone="elevated" padding="lg">
              <p className="text-[12px] text-[#F6DFA2]">出海司数据暂时未取到，请稍后再试。</p>
            </GlassPanel>
          ) : (
            <>
              <OfferingColumn
                title="可售商品"
                items={grouped.sellable}
                modules={modules}
                emptyLabel="当前无可售商品"
                submittingId={submittingId}
                canManage={canManage}
                actionLabel="标记为已上架"
                nextStatus="active"
                onAdvance={updateOffering}
              />
              <OfferingColumn
                title="内部专用"
                items={grouped.internal}
                modules={modules}
                emptyLabel="当前无内部专用商品"
                submittingId={submittingId}
                canManage={canManage}
                actionLabel="转为可售"
                nextStatus="sellable"
                onAdvance={updateOffering}
              />
              <OfferingColumn
                title="草稿中的商品"
                items={grouped.draft}
                modules={modules}
                emptyLabel="当前无草稿商品"
                submittingId={submittingId}
                canManage={canManage}
                actionLabel="转为内部专用"
                nextStatus="internal_only"
                onAdvance={updateOffering}
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

function OfferingColumn({
  title,
  items,
  modules,
  emptyLabel,
  submittingId,
  canManage,
  actionLabel,
  nextStatus,
  onAdvance,
}: {
  title: string;
  items: ExportOffering[];
  modules: ProductizedModule[];
  emptyLabel: string;
  submittingId?: string | null;
  canManage: boolean;
  actionLabel?: string;
  nextStatus?: ExportOffering['salesStatus'];
  onAdvance?: (item: ExportOffering, nextStatus: ExportOffering['salesStatus']) => Promise<void>;
}) {
  return (
    <GlassPanel tone="elevated" padding="lg">
      <div className="mb-4">
        <div className="section-eyebrow">Offering Status</div>
        <h2 className="section-title text-[20px]">{title}</h2>
      </div>
      <div className="space-y-3">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4 text-[12px] text-[#AEB7D1]">
            {emptyLabel}
          </div>
        ) : (
          items.map((item) => {
            const module = modules.find((entry) => entry.id === item.productizedModuleId);
            return (
              <div key={item.id} className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[13px] font-semibold text-[#F5E9C9]">{item.displayName}</div>
                    <div className="mt-1 text-[11px] uppercase tracking-[0.16em] text-[#8F835F]">
                      {labelForType(item.offeringType)} · {module?.name ?? '未知模块'}
                    </div>
                  </div>
                  <div className="rounded-full border border-[#F0C66A]/20 bg-[#F0C66A]/10 px-3 py-1 text-[11px] text-[#F0C66A]">
                    {labelForSalesStatus(item.salesStatus)}
                  </div>
                </div>
                <p className="mt-3 text-[12px] leading-6 text-[#AEB7D1]">{item.summary}</p>
                <div className="mt-4 rounded-xl border border-white/8 bg-black/20 px-3 py-3">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-[#8F835F]">建议定价</div>
                  <div className="mt-1 text-[13px] text-[#D7CCA9]">
                    {item.pricingMode} · ¥{item.priceFloor} - ¥{item.priceCeiling}
                  </div>
                </div>
                {onAdvance && nextStatus && item.salesStatus !== nextStatus ? (
                  <button
                    type="button"
                    disabled={submittingId === item.id || !canManage}
                    onClick={() => void onAdvance(item, nextStatus)}
                    className="mt-4 rounded-full border border-[#F0C66A]/24 bg-[#F0C66A]/10 px-3 py-1.5 text-[11px] text-[#F0C66A] transition hover:bg-[#F0C66A]/16 disabled:opacity-60"
                  >
                    {actionLabel}
                  </button>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </GlassPanel>
  );
}

function labelForType(type: ExportOffering['offeringType']) {
  switch (type) {
    case 'api':
      return 'API';
    case 'plugin':
      return '插件';
    case 'workflow_pack':
      return '工作流包';
    default:
      return '服务包';
  }
}

function labelForSalesStatus(status: ExportOffering['salesStatus']) {
  switch (status) {
    case 'sellable':
      return '可售';
    case 'active':
      return '已上架';
    case 'internal_only':
      return '内部专用';
    default:
      return '草稿';
  }
}
