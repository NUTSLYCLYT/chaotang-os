/**
 * 工部 · 决策办公厅页（四区三栏 · M1 · 2026-06-27）
 *
 * 与户部同构：保留冻结外壳(DepartmentPageCanvas/Stage + 帝金)，四区=顶态势/左班底/中卷轴/右急办值/底CommandBar。
 * 只对 gongbu 生效。工部克制：真实产线资产(成本/BOM/交期)上锁转后端(铁律9)。
 */
import { assetUrl } from '@/lib/asset';
import { DepartmentPageCanvas, DepartmentStage } from '@/features/departments/components/DepartmentPageShell';
import type { SixDepartmentContent } from '@/features/departments/lib/six-departments-content';
import { GongbuCommandBar } from '@/features/gongbu/components/gongbu-command-bar';
import { GongbuSummaryHeader } from '@/features/gongbu/components/gongbu-summary-header';
import { GongbuWorkspace } from '@/features/gongbu/components/gongbu-workspace';

export function GongbuOfficePage({ department }: { department: SixDepartmentContent }) {
  return (
    <DepartmentPageCanvas
      ariaLabel={`${department.name}决策办公厅`}
      bgSrc={assetUrl(department.background)}
      bgAlt={department.name}
      overlayClassName="bg-[radial-gradient(circle_at_50%_12%,rgba(127,201,168,0.08),transparent_28%),linear-gradient(180deg,rgba(2,4,8,0.22),rgba(2,4,8,0.80))]"
      imageClassName="object-cover opacity-25"
    >
      <DepartmentStage hasLiveStrip={false} className="overflow-hidden">
        <div className="mx-auto flex h-full max-w-[1760px] flex-col gap-3">
          <header className="flex items-center justify-between rounded-[18px] border px-5 py-3" style={{ borderColor: '#7FC9A822', background: 'linear-gradient(180deg,#7FC9A810 0%,rgba(6,8,14,0.9) 100%)' }}>
            <div>
              <span className="text-[10px] uppercase tracking-[0.22em] text-[#7a8a82]">{department.titleEn}</span>
              <span className="display-serif ml-3 text-[20px] text-[#EAF3EE]">工部 · 产品技术与交付</span>
            </div>
            <GongbuSummaryHeader />
          </header>

          <GongbuWorkspace department={department} />

          <GongbuCommandBar />
        </div>
      </DepartmentStage>
    </DepartmentPageCanvas>
  );
}
