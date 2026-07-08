import { HERO } from "@/features/dadian/lib/dadian";

export default function PalaceHero() {
  return (
    <div className="pointer-events-none absolute left-1/2 top-[38px] z-10 -translate-x-1/2 text-center animate-fade-in max-md:top-[154px]">
      <div className="mx-auto mb-3 inline-flex items-center gap-2 rounded-[6px] border border-[#F0C66A]/18 bg-[#050912]/52 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.24em] text-[#D8B76A]/88 shadow-[0_8px_24px_rgba(0,0,0,0.2)] backdrop-blur-md">
        <span className="h-1.5 w-1.5 rounded-full bg-[#3DD68C] shadow-[0_0_10px_rgba(61,214,140,0.8)]" />
        Chaotang OS
      </div>
      {/* 标题 + 两侧云纹 */}
      <div className="flex items-center justify-center gap-5 max-md:gap-2">
        <CloudFlourish className="rotate-180 max-md:hidden" />
        <h1 className="title-gold text-[64px] font-black leading-none tracking-[0.18em] drop-shadow-[0_12px_28px_rgba(0,0,0,0.52)] max-md:text-[38px]">
          {HERO.title}
        </h1>
        <CloudFlourish className="max-md:hidden" />
      </div>
      {/* 副标题 */}
      <p className="mt-3 text-[15px] font-light tracking-[0.34em] text-gold-200/88 drop-shadow-[0_2px_12px_rgba(0,0,0,0.66)] max-md:text-[11px] max-md:tracking-[0.18em]">
        {HERO.subtitle}
      </p>
      <div className="mx-auto mt-4 h-px w-[min(520px,82vw)] bg-gradient-to-r from-transparent via-[#F0C66A]/55 to-transparent" />
    </div>
  );
}

/** 如意云纹（对称装饰） */
function CloudFlourish({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 40"
      className={`h-7 w-[120px] ${className}`}
      fill="none"
    >
      <path
        d="M2 20h54"
        stroke="#C9A55C"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path
        d="M56 20c6 0 8-6 14-6s8 6 14 6"
        stroke="#D4B164"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M98 14c4 0 6 3 6 6s-2 6-6 6-5-3-3-6c1.4-2.2 4-2 4-2"
        stroke="#E6CB85"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
