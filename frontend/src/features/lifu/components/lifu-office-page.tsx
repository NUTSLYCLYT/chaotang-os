/**
 * 礼部 · 对外增长办公厅页（M1 四区三栏 · 2026-06-29）
 *
 * 镜像 XingbuOfficePage：DepartmentPageCanvas/Stage 冻结外壳。
 * 布局：顶·态势条 / 左·8 司班底 / 中·关系台账+流量增长台（hero）/ 右·司详情。
 * 只对 market 生效；其余部门走 SixDepartmentOverviewPage。
 */
import { assetUrl } from '@/lib/asset';
import {
  DepartmentPageCanvas,
  DepartmentStage,
} from '@/features/departments/components/DepartmentPageShell';
import type { SixDepartmentContent } from '@/features/departments/lib/six-departments-content';
import { LifuWorkspace } from '@/features/lifu/components/lifu-workspace';
import { ACCENT } from '@/features/lifu/lib/lifu-roster';

export function LifuOfficePage({ department }: { department: SixDepartmentContent }) {
  return (
    <DepartmentPageCanvas
      ariaLabel={`${department.name}对外增长办公厅`}
      bgSrc={assetUrl(department.background)}
      bgAlt={department.name}
      overlayClassName="bg-[radial-gradient(circle_at_50%_12%,rgba(192,112,208,0.07),transparent_28%),linear-gradient(180deg,rgba(2,4,8,0.20),rgba(2,4,8,0.82))]"
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
                礼部 · 您的对外增长官
              </span>
            </div>

            {/* 右侧指标：诚实占位，无真数据前不造假数字 */}
            <div className="flex items-center gap-5">
              <div className="flex flex-col items-end">
                <span className="text-[10px] uppercase tracking-[0.2em] text-[#8f835f]">
                  活跃关系
                </span>
                <span className="mt-0.5 text-[16px] font-semibold text-[#E9DDBE]">—</span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[10px] uppercase tracking-[0.2em] text-[#8f835f]">
                  待跟进
                </span>
                <span className="mt-0.5 text-[16px] font-semibold text-[#E9DDBE]">—</span>
              </div>
              <span
                className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px]"
                style={{ borderColor: '#E5B84D40', color: '#E5B84D' }}
              >
                <span className="inline-block h-2 w-2 rounded-full bg-[#E5B84D]" />
                LOCAL · 本地咨询
              </span>
            </div>
          </header>

          {/* 中区 · 三栏 */}
          <LifuWorkspace department={department} />
        </div>
      </DepartmentStage>
    </DepartmentPageCanvas>
  );
}
