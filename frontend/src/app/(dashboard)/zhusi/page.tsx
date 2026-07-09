import Link from 'next/link';
import { ArrowRight, Eye, Landmark, ShieldCheck } from 'lucide-react';

import { CHAOTANG_V1_ZHUSI } from '@/config/chaotang-v1-modules';

export default function ZhusiPage() {
  return (
    <main className="min-h-full bg-[#04060e] text-[#F5E9C9]">
      <section className="border-b border-[#6BA0FF]/16 bg-[linear-gradient(180deg,rgba(8,16,28,0.98),rgba(4,6,14,0.98))]">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-5 py-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9EC8FF]">
                <Eye size={14} />
                Chaotang OS 1.0
              </div>
              <h1 className="mt-2 text-2xl font-semibold text-[#F7EFD5]">诸司</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#AEB7CC]">
                1.0 版本诸司只纳入锦衣卫，负责外部信号、情报核验、风险预警和证据分拨。
              </p>
            </div>
            <Link
              href="/shangshufang"
              className="inline-flex items-center gap-2 rounded-[8px] border border-[#6BA0FF]/28 bg-[#6BA0FF]/10 px-3 py-2 text-sm font-semibold text-[#9EC8FF] transition hover:bg-[#6BA0FF]/16"
            >
              回上书房
              <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-6xl gap-4 px-5 py-6 md:grid-cols-2 lg:px-8">
        {CHAOTANG_V1_ZHUSI.map((office) => (
          <article key={office.code} className="rounded-[8px] border border-[#6BA0FF]/18 bg-[#08101c] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-[11px] font-semibold text-[#9EC8FF]">
                  <ShieldCheck size={14} />
                  已纳入 1.0
                </div>
                <h2 className="mt-2 text-lg font-semibold text-[#F7EFD5]">{office.name}</h2>
                <p className="mt-2 text-sm leading-6 text-[#AEB7CC]">
                  外部信号、竞品异动、开源观察、风险情报和证据核验统一从这里进入军机处与六部。
                </p>
              </div>
              <Link
                href={office.href}
                className="rounded-[8px] border border-[#6BA0FF]/24 px-2.5 py-1.5 text-xs text-[#9EC8FF] transition hover:bg-[#6BA0FF]/10"
              >
                进入
              </Link>
            </div>
          </article>
        ))}

        <aside className="rounded-[8px] border border-[#F0C66A]/16 bg-black/24 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#F0C66A]">
            <Landmark size={15} />
            1.0 边界
          </div>
          <p className="mt-2 text-sm leading-6 text-[#C8CDD8]">
            钦天监、御史、太医院等历史能力暂不作为 1.0 一级/二级模块展示；如被后端流程调用，只作为运行协议或门禁角色存在。
          </p>
        </aside>
      </section>
    </main>
  );
}
