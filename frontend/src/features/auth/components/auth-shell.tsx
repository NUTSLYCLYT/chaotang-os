'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { Crown } from 'lucide-react';
import { GlassPanel } from '@/components/ui/glass-panel';
import { withBasePath } from '@/lib/base-path';

export function AuthShell({
  eyebrow,
  title,
  body,
  footer,
  children,
}: {
  eyebrow: string;
  title: string;
  body: string;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const bgImage = withBasePath('/shangshufang/bg-shangshufang-scene.webp');

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#04060E]">
      <AuthBackdrop bgImage={bgImage} />
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1320px] flex-col justify-center px-6 py-10 md:px-10">
        <div className="grid gap-6 lg:grid-cols-[1.08fr_520px]">
          <GlassPanel variant="gold" tone="deep" padding="lg" className="overflow-hidden">
            <div className="flex h-full flex-col justify-between gap-8">
              <div>
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-11 w-11 items-center justify-center rounded-full"
                    style={{
                      background: 'radial-gradient(circle at 30% 30%, #F0C66A, #8A6A2A)',
                      boxShadow: '0 0 24px rgba(240,198,106,0.25)',
                    }}
                  >
                    <Crown size={18} className="text-[#04060E]" />
                  </div>
                  <div>
                    <div className="page-eyebrow">CourtOS Access</div>
                    <div className="page-title">朝堂OS</div>
                  </div>
                </div>

                <div className="mt-8 max-w-[620px]">
                  <div className="page-eyebrow">{eyebrow}</div>
                  <h1 className="display-serif mt-3 text-[34px] font-bold leading-[1.14] text-[#F6EFD8] md:text-[44px]">
                    {title}
                  </h1>
                  <p className="mt-4 max-w-[560px] text-[14px] leading-8 text-[#B8C0DA]">
                    {body}
                  </p>
                </div>

                <div className="mt-8 rounded-lg border border-white/8 bg-white/[0.03] p-4">
                  <div className="text-[11px] uppercase tracking-[0.22em] text-[#8F835F]">
                    Trial Path
                  </div>
                  <div className="mt-3 text-[14px] leading-8 text-[#D8DEEF]">
                    注册或登录后，先建立实例，再进入 <span className="font-mono text-[#F0C66A]">/throne</span> 开始主链体验。
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#9AA3C4]">
                <Link
                  href="/intro"
                  className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 transition hover:border-white/15 hover:bg-white/[0.05] hover:text-[#F5E9C9]"
                >
                  返回开场
                </Link>
                <Link
                  href="/about"
                  className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 transition hover:border-white/15 hover:bg-white/[0.05] hover:text-[#F5E9C9]"
                >
                  了解产品
                </Link>
              </div>
            </div>
          </GlassPanel>

          <GlassPanel tone="elevated" padding="lg" className="self-center">
            {children}
            {footer ? <div className="mt-6 border-t border-white/8 pt-5">{footer}</div> : null}
          </GlassPanel>
        </div>
      </div>
    </div>
  );
}

function AuthBackdrop({ bgImage }: { bgImage: string }) {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-55"
        style={{
          backgroundImage: `url("${bgImage}")`,
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(90deg, rgba(4,6,14,0.92) 0%, rgba(4,6,14,0.70) 42%, rgba(4,6,14,0.88) 100%), linear-gradient(180deg, rgba(4,6,14,0.56) 0%, rgba(4,6,14,0.25) 42%, rgba(4,6,14,0.94) 100%)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.075]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(240,198,106,1) 1px, transparent 1px), linear-gradient(90deg, rgba(240,198,106,1) 1px, transparent 1px)',
          backgroundSize: '96px 96px',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 h-full w-[34vw] min-w-[280px] border-r border-[#F0C66A]/10"
        style={{
          background:
            'linear-gradient(90deg, rgba(240,198,106,0.08), rgba(240,198,106,0.015) 58%, transparent)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[28vh] border-t border-[#F0C66A]/10"
        style={{
          background:
            'linear-gradient(180deg, transparent, rgba(240,198,106,0.10) 48%, rgba(4,6,14,0.92))',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-[7%] top-[12%] hidden h-[72%] w-px bg-gradient-to-b from-transparent via-[#F0C66A]/25 to-transparent lg:block"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute right-[9%] top-[10%] hidden h-[76%] w-px bg-gradient-to-b from-transparent via-[#8AA4FF]/18 to-transparent lg:block"
      />
    </>
  );
}
