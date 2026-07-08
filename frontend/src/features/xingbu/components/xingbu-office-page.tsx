/**
 * 刑部 · 决策办公厅页（M1 四区三栏 · 2026-06-28）
 *
 * 镜像 HubuOfficePage：保留冻结外壳(DepartmentPageCanvas/Stage + 帝青 + 背景)。
 * 布局：顶·态势条 / 左·8 司班底 / 中·合同审查台（hero）/ 右·案件摘要。
 * 只对 legal 生效；其余 5 部仍走 SixDepartmentOverviewPage。
 */
import { assetUrl } from '@/lib/asset';
import {
  DepartmentPageCanvas,
  DepartmentStage,
} from '@/features/departments/components/DepartmentPageShell';
import type { SixDepartmentContent } from '@/features/departments/lib/six-departments-content';
import { XingbuWorkspace } from '@/features/xingbu/components/xingbu-workspace';
import { ACCENT } from '@/features/xingbu/lib/xingbu-roster';

export function XingbuOfficePage({ department }: { department: SixDepartmentContent }) {
  return (
    <DepartmentPageCanvas
      ariaLabel={`${department.name}决策办公厅`}
      bgSrc={assetUrl(department.background)}
      bgAlt={department.name}
      overlayClassName="bg-[radial-gradient(circle_at_50%_12%,rgba(61,214,140,0.06),transparent_28%),linear-gradient(180deg,rgba(2,4,8,0.22),rgba(2,4,8,0.82))]"
      imageClassName="object-cover opacity-20"
    >
      <DepartmentStage hasLiveStrip={false} className="overflow-hidden">
        <div className="mx-auto flex h-full max-w-[1760px] flex-col gap-3">
          {/* 顶 · 态势条 */}
          <header
            className="flex flex-wrap items-center justify-between rounded-[18px] border px-5 py-3"
            style={{
              borderColor: `${ACCENT}22`,
              background: `linear-gradient(180deg,${ACCENT}10 0%,rgba(6,8,14,0.9) 100%)`,
            }}
          >
            <div>
              <span className="text-[10px] uppercase tracking-[0.22em] text-[#8f835f]">
                {department.titleEn}
              </span>
              <span className="display-serif ml-3 text-[20px] text-[#F5E9C9]">
                刑部 · 您的法务风控
              </span>
            </div>

            {/* 右侧指标：诚实占位，无真数据前不造假数字 */}
            <div className="flex items-center gap-5">
              <div className="flex flex-col items-end">
                <span className="text-[10px] uppercase tracking-[0.2em] text-[#8f835f]">
                  今日高危案件
                </span>
                <span className="mt-0.5 text-[16px] font-semibold text-[#E9DDBE]">—</span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[10px] uppercase tracking-[0.2em] text-[#8f835f]">
                  待审合同
                </span>
                <span className="mt-0.5 text-[16px] font-semibold text-[#E9DDBE]">—</span>
              </div>
              <span
                className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px]"
                style={{ borderColor: '#E5B84D40', color: '#E5B84D' }}
              >
                <span className="inline-block h-2 w-2 rounded-full bg-[#E5B84D]" />
                FALLBACK · 台账接入中
              </span>
            </div>
          </header>

          {/* 中区 · 三栏 */}
          <XingbuWorkspace department={department} />
        </div>
      </DepartmentStage>
    </DepartmentPageCanvas>
  );
}
