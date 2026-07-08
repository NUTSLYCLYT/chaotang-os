/**
 * 兵部 · 决策办公厅页（升级版 · 2026-06-27）
 *
 * 完全复刻户部 HubuOfficePage 的排布：保留冻结外壳(DepartmentPageCanvas/Stage + 背景)，
 * 左身份栏 + 中栏销售决策驾驶舱。只对 ops(兵部) 生效，其余部仍走 SixDepartmentOverviewPage。
 */
import { Suspense } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { assetUrl } from '@/lib/asset';
import { DepartmentPageCanvas, DepartmentStage } from '@/features/departments/components/DepartmentPageShell';
import type { SixDepartmentContent } from '@/features/departments/lib/six-departments-content';
import { BingbuMainView } from '@/features/bingbu/components/bingbu-main-view';
import { BingbuOrgRail } from '@/features/bingbu/components/bingbu-org-rail';
import { BingbuDetailPanel } from '@/features/bingbu/components/bingbu-detail-panel';

export function BingbuOfficePage({ department }: { department: SixDepartmentContent }) {
  const accent = department.accent;
  return (
    <DepartmentPageCanvas
      ariaLabel={`${department.name}决策办公厅`}
      bgSrc={assetUrl(department.background)}
      bgAlt={department.name}
      overlayClassName="bg-[radial-gradient(circle_at_50%_12%,rgba(107,160,255,0.08),transparent_28%),linear-gradient(180deg,rgba(2,4,8,0.22),rgba(2,4,8,0.80))]"
      imageClassName="object-cover opacity-25"
    >
      <DepartmentStage hasLiveStrip={false} className="overflow-hidden">
        <div className="mx-auto grid h-full max-w-[1680px] grid-cols-[300px_minmax(0,1fr)_360px] gap-4">
          {/* 身份栏 */}
          <aside
            className="flex flex-col overflow-y-auto rounded-[24px] border px-5 py-5 shadow-[0_18px_56px_rgba(0,0,0,0.34)]"
            style={{ borderColor: `${accent}24`, background: `linear-gradient(180deg, ${accent}14 0%, rgba(5, 7, 13, 0.92) 100%)` }}
          >
            <Link
              href="/departments"
              className="inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-[11px] text-[#C8CDD8] transition hover:text-[#F5E9C9]"
              style={{ borderColor: `${accent}30` }}
            >
              <ArrowLeft size={14} />
              返回六部大厅
            </Link>

            <div className="mt-5">
              <div className="text-[11px] uppercase tracking-[0.22em]" style={{ color: accent }}>
                {department.titleEn}
              </div>
              <h1 className="display-serif mt-2 text-[34px] font-semibold text-[#F5E9C9]">{department.name}</h1>
              <p className="body-copy mt-3">{department.positioning}</p>
            </div>

            <div className="mt-4 rounded-[14px] border px-3.5 py-3" style={{ borderColor: `${accent}1f`, background: '#ffffff05' }}>
              <div className="text-[10px] uppercase tracking-[0.2em] text-[#8f835f]">老板一句话</div>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-[#d8cba8]">{department.bossLine}</p>
            </div>

            {/* 后端六司（销售司、市场司、渠道司、客户司、竞情司、增长司） */}
            <div className="mt-4">
              <Suspense fallback={<div className="text-[10px] text-[#6f6750]">兵部六司加载中…</div>}>
                <BingbuOrgRail />
              </Suspense>
            </div>

            <div className="mt-auto pt-4 text-[10.5px] leading-relaxed text-[#6f6750]">
              兵部只读 + 追问 + 拍板意向；报价/合同/对外承诺经后端核验与人工确认（铁律9）。
            </div>
          </aside>

          {/* 决策驾驶舱 */}
          <main className="min-h-0 overflow-hidden">
            <Suspense fallback={<p className="body-copy text-[#b6ab8c]">销售决策台加载中…</p>}>
              <BingbuMainView />
            </Suspense>
          </main>

          {/* 选中事项详情 */}
          <aside className="min-h-0 overflow-hidden">
            <Suspense fallback={<div className="text-[10px] text-[#6f6750]">详情加载中…</div>}>
              <BingbuDetailPanel />
            </Suspense>
          </aside>
        </div>
      </DepartmentStage>
    </DepartmentPageCanvas>
  );
}
