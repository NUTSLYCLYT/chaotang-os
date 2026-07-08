'use client';

/** StudyHeroTitle — 上书房中部标题 */
import { DemoBadge } from './scroll-primitives';

export function StudyHeroTitle() {
  return (
    <div className="relative">
      <div className="flex items-center gap-3">
        <span className="h-px w-8 bg-gradient-to-r from-[#F0C66A]/50 to-transparent" />
        <span className="text-[11px] uppercase tracking-[0.4em] text-[#F0C66A]/55">
          上书房 · 御案智能奏折台
        </span>
        <DemoBadge />
      </div>
      <h1
        className="display-serif mt-3 text-[34px] font-bold leading-tight lg:text-[44px]"
        style={{ letterSpacing: '-0.02em' }}
      >
        <span
          style={{
            background: 'linear-gradient(135deg, #FFFFFF 0%, #EDE5CC 38%, #F0C66A 78%, #D4A84B 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          今日朝政，请陛下御览定夺。
        </span>
      </h1>
      <p className="mt-2.5 max-w-[760px] text-[14px] leading-[1.85] text-[#9AA3C4]">
        私人 AI 内阁已备齐今日企业要务 —— 左有丞相研判，中为御案奏折，右有钦天监引导。
      </p>
    </div>
  );
}
