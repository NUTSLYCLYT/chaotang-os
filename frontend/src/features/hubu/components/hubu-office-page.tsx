/**
 * 户部 · 决策办公厅页（M1 四区三栏 · 2026-06-27）
 *
 * 「基于现有界面升级」：保留冻结外壳(DepartmentPageCanvas/Stage + 帝金 + 背景)。
 * 布局(PRD §5)：顶·态势 / 左·精简班底 / 中·户部卷轴(hero) / 右·急办值 / 底·CommandBar。
 * 只对 finance 生效，其余 5 部仍走 SixDepartmentOverviewPage。
 */
import { assetUrl } from '@/lib/asset';
import { DepartmentPageCanvas, DepartmentStage } from '@/features/departments/components/DepartmentPageShell';
import type { SixDepartmentContent } from '@/features/departments/lib/six-departments-content';
import { HubuCommandBar } from '@/features/hubu/components/hubu-command-bar';
import { HubuSummaryHeader } from '@/features/hubu/components/hubu-summary-header';
import { HubuWorkspace } from '@/features/hubu/components/hubu-workspace';

export function HubuOfficePage({ department }: { department: SixDepartmentContent }) {
  return (
    <DepartmentPageCanvas
      ariaLabel={`${department.name}决策办公厅`}
      bgSrc={assetUrl(department.background)}
      bgAlt={department.name}
      overlayClassName="bg-[radial-gradient(circle_at_50%_12%,rgba(240,198,106,0.08),transparent_28%),linear-gradient(180deg,rgba(2,4,8,0.22),rgba(2,4,8,0.80))]"
      imageClassName="object-cover opacity-25"
    >
      <DepartmentStage hasLiveStrip={false} className="overflow-hidden">
        <div className="mx-auto flex h-full max-w-[1760px] flex-col gap-3">
          {/* 顶 · 态势条 */}
          <header className="flex items-center justify-between rounded-[18px] border px-5 py-3" style={{ borderColor: '#F0C66A22', background: 'linear-gradient(180deg,#F0C66A10 0%,rgba(6,8,14,0.9) 100%)' }}>
            <div>
              <span className="text-[10px] uppercase tracking-[0.22em] text-[#8f835f]">{department.titleEn}</span>
              <span className="display-serif ml-3 text-[20px] text-[#F5E9C9]">户部 · 您的 CFO</span>
            </div>
            <HubuSummaryHeader />
          </header>

          {/* 中区 · 三栏 + 司选择（≥xl 固定三栏；<xl 单列堆叠、卷轴优先） */}
          <HubuWorkspace department={department} />

          {/* 底 · CommandBar */}
          <HubuCommandBar />
        </div>
      </DepartmentStage>
    </DepartmentPageCanvas>
  );
}
