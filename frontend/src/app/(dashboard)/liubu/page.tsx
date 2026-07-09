import Link from 'next/link';
import { ArrowRight, Building2, CircleDot, Landmark, LockKeyhole, ScrollText } from 'lucide-react';

import { CHAOTANG_V1_LIUBU } from '@/config/chaotang-v1-modules';

const MODULE_CONTEXT = [
  { label: '一级模块', value: '六部' },
  { label: '1.0 范围', value: '6 部 / 8 个已定司' },
  { label: '事实边界', value: '礼部暂不定' },
];

export default function LiubuPage() {
  const activeDepartments = CHAOTANG_V1_LIUBU.filter((department) => department.status === 'active');
  const pendingDepartments = CHAOTANG_V1_LIUBU.filter((department) => department.status === 'pending');

  return (
    <main className="min-h-full bg-[#05070d] text-[#F5E9C9]">
      <section className="border-b border-[#F0C66A]/14 bg-[linear-gradient(180deg,rgba(16,22,36,0.96),rgba(5,7,13,0.98))]">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-5 py-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#F0C66A]">
                <Landmark size={14} />
                Chaotang OS 1.0
              </div>
              <h1 className="mt-2 text-2xl font-semibold tracking-normal text-[#F7EFD5]">六部</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#AEB7CC]">
                1.0 版本只承诺当前已定的部门和司局：户部、吏部、兵部、刑部、工部进入执行面，礼部保留席位但暂不展开二级模块。
              </p>
            </div>
            <Link
              href="/shangshufang"
              className="inline-flex items-center gap-2 rounded-[8px] border border-[#F0C66A]/30 bg-[#F0C66A]/10 px-3 py-2 text-sm font-semibold text-[#F0C66A] transition hover:bg-[#F0C66A]/16"
            >
              回上书房
              <ArrowRight size={15} />
            </Link>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {MODULE_CONTEXT.map((item) => (
              <div key={item.label} className="rounded-[8px] border border-[#F0C66A]/16 bg-black/24 px-4 py-3">
                <div className="text-[11px] text-[#8F98B8]">{item.label}</div>
                <div className="mt-1 text-sm font-semibold text-[#F7EFD5]">{item.value}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-7xl gap-4 px-5 py-6 lg:grid-cols-[1fr_320px] lg:px-8">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {activeDepartments.map((department) => (
            <article key={department.code} className="rounded-[8px] border border-[#F0C66A]/16 bg-[#0b0f19] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-[11px] font-semibold text-[#F0C66A]">
                    <Building2 size={14} />
                    已纳入 1.0
                  </div>
                  <h2 className="mt-2 text-lg font-semibold text-[#F7EFD5]">{department.name}</h2>
                </div>
                {department.href ? (
                  <Link
                    href={department.href}
                    className="rounded-[8px] border border-[#F0C66A]/24 px-2.5 py-1.5 text-xs text-[#F0C66A] transition hover:bg-[#F0C66A]/10"
                  >
                    进入
                  </Link>
                ) : null}
              </div>

              <div className="mt-4 space-y-2">
                {department.offices.map((office) => (
                  <Link
                    key={office.slug}
                    href={`${department.href}/${office.slug}`}
                    className="group flex items-start justify-between gap-3 rounded-[8px] border border-white/10 bg-white/[0.03] px-3 py-2 transition hover:border-[#F0C66A]/32 hover:bg-[#F0C66A]/8"
                  >
                    <span>
                      <span className="flex items-center gap-2 text-sm font-semibold text-[#F7EFD5]">
                        <CircleDot size={12} className="text-[#F0C66A]" />
                        {office.name}
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-[#9AA3C4]">{office.scope}</span>
                    </span>
                    <ArrowRight size={13} className="mt-1 shrink-0 text-[#7C86A6] transition group-hover:translate-x-0.5" />
                  </Link>
                ))}
              </div>
            </article>
          ))}
        </div>

        <aside className="space-y-4">
          <section className="rounded-[8px] border border-[#6BA0FF]/18 bg-[#08101c] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#9EC8FF]">
              <ScrollText size={15} />
              二级模块清单
            </div>
            <div className="mt-3 space-y-2 text-sm leading-6 text-[#D7DFF2]">
              <p>户部：预算司、出纳司</p>
              <p>吏部：任免司、招聘司</p>
              <p>兵部：报价司、线索司</p>
              <p>刑部：合同司</p>
              <p>工部：产研司</p>
            </div>
          </section>

          {pendingDepartments.map((department) => (
            <section key={department.code} className="rounded-[8px] border border-[#8F98B8]/18 bg-black/24 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#C8CDD8]">
                <LockKeyhole size={15} />
                {department.name}
              </div>
              <p className="mt-2 text-sm leading-6 text-[#9AA3C4]">1.0 暂不定，不展示二级模块，不承诺运行能力。</p>
            </section>
          ))}
        </aside>
      </section>
    </main>
  );
}
