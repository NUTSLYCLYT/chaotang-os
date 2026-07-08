/**
 * 朝堂 OS · 部门代言人 · 历史简介 + AI 时代寄语（三体风格）
 *
 * 挂在 DeptHeroBanner 下方。两栏：左「史笔」历史简介，右「寄语」AI 时代的独白。
 * 排版克制：一行金色小标 + 一段文字，绝不抢 banner 的主视觉。
 */

'use client';

interface PersonaQuoteStripProps {
  personaName: string;
  accent: string;
  historicalIntro?: string;
  aiEraQuote?: string;
  duty?: string;
}

export function PersonaQuoteStrip({
  personaName,
  accent,
  historicalIntro,
  aiEraQuote,
  duty,
}: PersonaQuoteStripProps) {
  if (!historicalIntro && !aiEraQuote && !duty) return null;

  return (
    <div
      className="relative grid grid-cols-1 gap-4 overflow-hidden rounded-xl border px-5 py-4 md:grid-cols-2 md:gap-6"
      style={{
        borderColor: `${accent}33`,
        background:
          'linear-gradient(135deg, rgba(21,18,10,0.85) 0%, rgba(10,7,4,0.95) 60%, rgba(7,5,15,0.9) 100%)',
        boxShadow: `inset 0 0 0 1px ${accent}14`,
      }}
    >
      {/* 左金条 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-3 left-0 w-[2px]"
        style={{
          background: `linear-gradient(180deg, transparent, ${accent}, transparent)`,
        }}
      />

      {/* 历史简介 · 史笔 */}
      {historicalIntro && (
        <div className="flex gap-3">
          <div
            className="mt-[2px] shrink-0 rounded-sm border px-1.5 py-0.5 text-[11px] font-semibold tracking-[0.08em]"
            style={{
              color: accent,
              borderColor: `${accent}55`,
              background: `${accent}10`,
              fontFamily: 'var(--font-serif)',
            }}
          >
            史笔
          </div>
          <div className="min-w-0 flex-1">
            <div
              className="text-[11px] font-semibold uppercase tracking-[0.08em]"
              style={{ color: `${accent}cc` }}
            >
              {personaName} · 其人
            </div>
            <p
              className="mt-1 text-[12.5px] leading-6"
              style={{
                color: '#D8CFB4',
              }}
            >
              {historicalIntro}
            </p>
            {duty && (
              <p className="mt-1 text-[11px] leading-5 tracking-[0.04em] text-[#8A92AC]">
                本殿职责 · {duty}
              </p>
            )}
          </div>
        </div>
      )}

      {/* AI 时代寄语 · 三体风格 */}
      {aiEraQuote && (
        <div className="flex gap-3">
          <div
            className="mt-[2px] shrink-0 rounded-sm border px-1.5 py-0.5 text-[11px] font-semibold tracking-[0.08em]"
            style={{
              color: '#E6DBBC',
              borderColor: '#E6DBBC55',
              background: 'rgba(230,219,188,0.06)',
              fontFamily: 'var(--font-serif)',
            }}
          >
            寄语
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8A92AC]">
              AI 时代 · 独白
            </div>
            <p
              className="mt-1 text-[12.5px] italic leading-6"
              style={{
                color: '#E6DBBC',
                textShadow: '0 1px 12px rgba(230,219,188,0.08)',
              }}
            >
              「{aiEraQuote}」
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
