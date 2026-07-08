import type { ReactNode } from 'react';
import { assetUrl } from '@/lib/asset';
import { SHANGSHUFANG_ASSETS } from '@/features/shangshufang/constants';

type DepartmentStudyFrameProps = {
  children: ReactNode;
  deptCode?: string;
};

const DEPARTMENT_BACKGROUND: Record<string, string> = {
  finance: '/assets/hubu/scene-full.webp',
  legal: '/assets/six-ministries/xingbu-bg.webp',
  market: '/assets/libu/rites-cinematic-bg.webp',
  libu: '/assets/libu/rites-cinematic-bg.webp',
  ops: '/assets/bingbu/scene-full.webp',
  gongbu: '/assets/gongbu/gongbu.webp',
  works: '/assets/gongbu/gongbu.webp',
  personnel: '/assets/six-ministries/libu-officials-bg.webp',
  guard: '/assets/jinyiwei/scene-full.webp',
  physician: '/assets/taiyi/scene-full.webp',
  zhuangyuan: '/assets/zhuangyuan/04-zhuangyuan-new.webp',
};

export function DepartmentStudyFrame({ children, deptCode }: DepartmentStudyFrameProps) {
  const background = (deptCode && DEPARTMENT_BACKGROUND[deptCode]) || SHANGSHUFANG_ASSETS.bgScene;

  return (
    <div className="department-study-art relative min-h-screen overflow-hidden bg-[#05070d] text-[#EAEEFB]">
      <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div
          className="absolute inset-0 scale-[1.03] bg-cover bg-center opacity-[0.78] contrast-[1.08] saturate-[0.92]"
          style={{ backgroundImage: `url(${assetUrl(background)})` }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(76%_56%_at_50%_40%,rgba(240,198,106,0.12),rgba(4,7,13,0.28)_42%,rgba(2,4,9,0.88)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,5,10,0.82)_0%,rgba(3,5,10,0.34)_34%,rgba(3,5,10,0.66)_70%,rgba(3,5,10,0.94)_100%)]" />
        <div className="absolute inset-y-0 left-0 w-[22rem] bg-gradient-to-r from-[#02040a]/95 to-transparent" />
        <div className="absolute inset-y-0 right-0 w-[22rem] bg-gradient-to-l from-[#02040a]/95 to-transparent" />
        <div
          aria-hidden
          data-three-axis-ornament="palace-depth-vault"
          className="absolute left-1/2 top-[72px] h-[72vh] w-[min(980px,72vw)] -translate-x-1/2 opacity-[0.36]"
          style={{
            background:
              'linear-gradient(90deg, transparent 0%, rgba(240,198,106,0.16) 1px, transparent 2px 12%, rgba(240,198,106,0.10) 12.2%, transparent 12.8% 87.2%, rgba(240,198,106,0.10) 87.8%, transparent 88% 100%), linear-gradient(180deg, rgba(240,198,106,0.20), transparent 18%, transparent 76%, rgba(240,198,106,0.08))',
            clipPath: 'polygon(19% 0, 81% 0, 100% 100%, 0 100%)',
            maskImage: 'linear-gradient(180deg, black, black 58%, transparent)',
          }}
        />
        <div
          aria-hidden
          data-three-axis-ornament="imperial-axis-floor"
          className="absolute bottom-0 left-1/2 h-[38vh] w-[min(1120px,86vw)] -translate-x-1/2 opacity-[0.24]"
          style={{
            background:
              'repeating-linear-gradient(90deg, rgba(240,198,106,0.18) 0 1px, transparent 1px 92px), repeating-linear-gradient(0deg, rgba(240,198,106,0.12) 0 1px, transparent 1px 44px)',
            clipPath: 'polygon(30% 0, 70% 0, 100% 100%, 0 100%)',
            transform: 'translateX(-50%) perspective(760px) rotateX(58deg)',
            transformOrigin: '50% 100%',
          }}
        />
        <div className="absolute left-1/2 top-[20%] h-[38rem] w-[38rem] -translate-x-1/2 rounded-full bg-[#F0C66A]/10 blur-3xl" />
        <div
          aria-hidden
          data-three-axis-ornament="court-dust-lamplight"
          className="absolute inset-0 opacity-[0.18] mix-blend-screen"
          style={{
            background:
              'radial-gradient(circle at 28% 26%, rgba(255,242,184,0.28) 0 1px, transparent 2px), radial-gradient(circle at 64% 18%, rgba(255,242,184,0.20) 0 1px, transparent 2px), radial-gradient(circle at 76% 42%, rgba(255,242,184,0.18) 0 1px, transparent 2px), radial-gradient(circle at 42% 55%, rgba(255,242,184,0.16) 0 1px, transparent 2px)',
            backgroundSize: '210px 190px, 260px 230px, 190px 170px, 310px 260px',
          }}
        />
        <div className="absolute inset-0 opacity-[0.13] mix-blend-screen [background-image:linear-gradient(90deg,transparent_0,rgba(240,198,106,0.18)_50%,transparent_100%),repeating-linear-gradient(0deg,rgba(244,231,192,0.12)_0px,rgba(244,231,192,0.12)_1px,transparent_1px,transparent_22px)]" />
      </div>

      <div className="relative z-10 min-h-screen">{children}</div>

      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[65] opacity-[0.13] mix-blend-color"
        style={{ background: 'linear-gradient(135deg, rgba(240,198,106,0.26), rgba(126,200,227,0.08) 46%, rgba(52,28,8,0.26))' }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[66] opacity-[0.11] mix-blend-soft-light"
        style={{ background: 'radial-gradient(ellipse at 50% 36%, rgba(246,233,201,0.45), transparent 58%)' }}
      />
    </div>
  );
}
