import Link from 'next/link';
import { ArrowRight, ShieldCheck } from 'lucide-react';

import { CHAOTANG_V1_ZHUANSHU } from '@/config/chaotang-v1-modules';
import { assetUrl } from '@/lib/asset';

export default function ZhuanshuPage() {
  return (
    <main className="relative h-full min-h-[720px] w-full overflow-hidden bg-[#04060e] text-[#F5E9C9]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={assetUrl('/assets/jinyiwei.webp')}
        alt="专署情报中枢"
        draggable={false}
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(2,4,10,0.96)_0%,rgba(2,4,10,0.82)_38%,rgba(2,4,10,0.34)_68%,rgba(2,4,10,0.64)_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_24%_38%,rgba(224,85,58,0.12),transparent_32%),linear-gradient(180deg,rgba(2,4,10,0.2),rgba(2,4,10,0.72))]" />

      <section className="relative z-10 mx-auto flex h-full min-h-[720px] w-full max-w-[1500px] flex-col justify-center px-6 py-12 lg:px-12">
        <div className="max-w-[660px]">
          <p
            data-testid="zhuanshu-eyebrow"
            className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[#E88973]"
          >
            CHAOTANG OS · IMPERIAL DIRECTORATES
          </p>
          <h1
            data-testid="zhuanshu-page-title"
            className="mt-4 font-serif text-[clamp(3.5rem,8vw,7rem)] font-black tracking-[0.16em] text-[#F4D798] [text-shadow:0_0_32px_rgba(224,85,58,0.24)]"
          >
            专署
          </h1>
          <p
            data-testid="zhuanshu-description"
            className="mt-3 font-serif text-base tracking-[0.18em] text-[#C8B890]"
          >
            朝堂外廷专署各守专责。
          </p>

          <div className="mt-7 grid max-w-[620px] gap-4">
            {CHAOTANG_V1_ZHUANSHU.map((office) => (
              <Link
                key={office.code}
                href={office.href}
                data-testid={`zhuanshu-entry-${office.code}`}
                className="group relative overflow-hidden rounded-2xl border border-[#E0553A]/35 bg-[#070A12]/84 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.48)] backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:border-[#E0553A]/70 hover:bg-[#0B0D16]/92"
              >
                <div className="absolute inset-y-0 right-0 w-44 bg-[radial-gradient(circle_at_100%_50%,rgba(224,85,58,0.18),transparent_68%)]" />
                <div className="relative flex items-center gap-4">
                  <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl border border-[#E0553A]/45 bg-[#E0553A]/10 text-[#E0553A]">
                    <ShieldCheck size={26} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="font-serif text-2xl font-black tracking-[0.08em] text-[#F5E9C9]">{office.name}</h2>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-[#E0553A]/35 px-3 py-2 text-xs font-semibold text-[#E88973] transition group-hover:bg-[#E0553A]/12">
                    进入
                    <ArrowRight size={14} className="transition group-hover:translate-x-1" />
                  </span>
                </div>
                <div
                  data-testid={`zhuanshu-duty-${office.code}`}
                  className="relative mt-4 border-t border-[#E0553A]/20 pt-3 text-xs leading-5 tracking-[0.06em] text-[#9EA5B8]"
                >
                  <span className="mr-2 text-[#E88973]">功能职责</span>
                  {office.duty}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
