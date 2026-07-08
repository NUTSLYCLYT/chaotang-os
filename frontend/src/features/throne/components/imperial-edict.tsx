'use client';

/**
 * 圣旨 · Imperial Edict
 *
 * 御座主厅的核心视觉信物：一卷展开的圣旨，承载 5 条最重要的信息。
 *   两端铜木卷轴（轴头描金）· 帝金绫缎卷身 · 锦缎回纹边 ·
 *   「奉天承運 / 皇帝詔曰」起手 · 五列竖排诏文 · 「欽此」收束 · 朱红玺印。
 *
 * 视觉规则：金帛底 + 玄墨字 + 朱红印（克制三色），不引入暗厅那 5 个霓虹色。
 * 所有 keyframe 用 edict- 前缀就地声明，绝不动 globals.css。
 */

/* ── 5 条诏文（= 御厅五大价值钩子，忠实原文，不改语义）──────────────── */
const EDICT_ITEMS = [
  { ord: '一', title: '不是软件', sub: '是你的 AI 军队' },
  { ord: '二', title: '一句话', sub: '十员 AI 同时出发' },
  { ord: '三', title: '三分钟交卷', sub: '人类团队要三天' },
  { ord: '四', title: '全程战场直播', sub: '一键裁决 · 绝非黑盒' },
  { ord: '五', title: 'AI 永不下班', sub: '无限产能 · 零等待' },
] as const;

const INK = '#2E2008'; // 玄墨
const INK_SOFT = '#6E5A2A'; // 淡墨
const VERMILION = '#9E2B25'; // 朱红
const BRONZE = '#8A6A2A'; // 锦缎边

export function ImperialEdict() {
  return (
    <section aria-label="圣旨" className="edict-root relative">
      <EdictStyles />

      {/* 外层柔和帝金光晕，让卷轴落在深色指挥舱上不突兀 */}
      <div
        aria-hidden
        className="edict-aura pointer-events-none absolute -inset-6 rounded-[32px]"
      />

      <div className="edict-scroll relative flex items-stretch">
        <Roller side="left" />

        {/* ── 卷身（绫缎 + 诏文）─────────────────────────────── */}
        <div className="edict-silk relative flex-1 overflow-hidden">
          {/* 绫缎织纹 + 织锦斜光 */}
          <div aria-hidden className="edict-weave pointer-events-none absolute inset-0" />
          {/* 巨幅「詔」字水印 */}
          <div aria-hidden className="edict-watermark pointer-events-none absolute inset-0 flex items-center justify-center">
            詔
          </div>
          {/* 上下锦缎回纹边 */}
          <MeanderBand position="top" />
          <MeanderBand position="bottom" />
          {/* 一次性流光 */}
          <div aria-hidden className="edict-sheen pointer-events-none absolute inset-0" />

          {/* 诏文：右起竖排（flex-row-reverse 让起手居右）*/}
          <div className="edict-body relative flex flex-row-reverse items-center justify-center gap-6 px-12 py-12 md:gap-9 md:px-16">
            {/* 起手 */}
            <Opening />

            {/* 五列诏文 */}
            {EDICT_ITEMS.map((it, i) => (
              <EdictColumn key={it.ord} item={it} delay={0.55 + i * 0.13} />
            ))}

            {/* 收束 + 玺印 */}
            <Closing />
          </div>
        </div>

        <Roller side="right" />
      </div>
    </section>
  );
}

/* ════════════ 起手：奉天承運 · 皇帝詔曰 ════════════ */
function Opening() {
  return (
    <div
      className="edict-col edict-vert flex shrink-0 flex-col items-center justify-start gap-7"
      style={{ animationDelay: '0.35s' }}
    >
      <span
        className="edict-opening-text edict-vert text-[30px] font-bold leading-[1.18] tracking-[0.12em] md:text-[36px]"
        style={{ color: INK, textShadow: '0 1px 0 rgba(255,240,200,0.5)' }}
      >
        奉天承運
      </span>
      <span
        className="edict-opening-text edict-vert text-[30px] font-bold leading-[1.18] tracking-[0.12em] md:text-[36px]"
        style={{ color: INK, textShadow: '0 1px 0 rgba(255,240,200,0.5)' }}
      >
        皇帝詔曰
      </span>
    </div>
  );
}

/* ════════════ 单列诏文 ════════════ */
function EdictColumn({
  item,
  delay,
}: {
  item: (typeof EDICT_ITEMS)[number];
  delay: number;
}) {
  return (
    <div
      className="edict-col flex shrink-0 flex-col items-center justify-start gap-3"
      style={{ animationDelay: `${delay}s` }}
    >
      {/* 序号印 */}
      <span
        className="edict-ord flex h-7 w-7 items-center justify-center rounded-full text-[14px] font-bold"
        style={{
          color: VERMILION,
          border: `1.5px solid ${VERMILION}`,
          background: 'rgba(158,43,37,0.06)',
        }}
      >
        {item.ord}
      </span>
      <span
        className="edict-title-text edict-vert text-[26px] font-bold leading-[1.32] tracking-[0.08em] md:text-[30px]"
        style={{ color: INK, textShadow: '0 1px 0 rgba(255,240,200,0.45)' }}
      >
        {item.title}
      </span>
      <span
        className="edict-sub-text edict-vert text-[14px] leading-[1.7] tracking-[0.06em] md:text-[15px]"
        style={{ color: INK_SOFT }}
      >
        {item.sub}
      </span>
    </div>
  );
}

/* ════════════ 收束：欽此 + 朱印 ════════════ */
function Closing() {
  return (
    <div
      className="edict-col relative flex shrink-0 flex-col items-center justify-start gap-5"
      style={{ animationDelay: '1.3s' }}
    >
      <span
        className="edict-closing-text edict-vert text-[26px] font-bold leading-[1.3] tracking-[0.12em] md:text-[30px]"
        style={{ color: INK, textShadow: '0 1px 0 rgba(255,240,200,0.45)' }}
      >
        欽此
      </span>
      {/* 朱红玺印 */}
      <div
        className="edict-seal grid h-[68px] w-[68px] grid-cols-2 grid-rows-2 place-items-center rounded-[6px] md:h-[76px] md:w-[76px]"
        style={{
          color: '#FBEAD0',
          background: 'linear-gradient(145deg, #B23B30, #8E211C)',
          border: '2.5px solid #7C1A16',
          boxShadow:
            'inset 0 0 10px rgba(0,0,0,0.35), 0 2px 6px rgba(0,0,0,0.3)',
          transform: 'rotate(-5deg)',
        }}
      >
        {['朝', '堂', '之', '寶'].map((c) => (
          <span
            key={c}
            className="text-[18px] font-bold md:text-[20px]"
            style={{ fontFamily: 'var(--font-serif)' }}
          >
            {c}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ════════════ 卷轴（铜木轴杆 + 描金轴头）════════════ */
function Roller({ side }: { side: 'left' | 'right' }) {
  return (
    <div className="edict-roller relative w-9 shrink-0 self-stretch md:w-11" aria-hidden>
      {/* 轴杆 */}
      <div
        className="edict-roller-rod absolute inset-y-4 left-1/2 w-4 -translate-x-1/2 rounded-full md:w-5"
        style={{
          background:
            'linear-gradient(90deg,#241a0a 0%,#5a4620 30%,#caa75a 50%,#5a4620 70%,#1f1708 100%)',
          boxShadow: '0 0 14px rgba(0,0,0,0.4)',
        }}
      />
      {/* 上下描金轴头 */}
      {(['top', 'bottom'] as const).map((pos) => (
        <div
          key={pos}
          className="edict-roller-head absolute left-1/2 h-6 w-9 -translate-x-1/2 rounded-full md:h-7 md:w-11"
          style={{
            [pos]: 0,
            background:
              'radial-gradient(circle at 40% 35%, #FFE9A8 0%, #F0C66A 38%, #B8893A 78%, #6B4E1E 100%)',
            boxShadow:
              '0 0 16px rgba(240,198,106,0.45), inset 0 -2px 4px rgba(0,0,0,0.3)',
          }}
        />
      ))}
      {/* 与卷身衔接的小投影 */}
      <div
        className={`absolute inset-y-5 ${side === 'left' ? 'right-0' : 'left-0'} w-2`}
        style={{
          background:
            side === 'left'
              ? 'linear-gradient(90deg, transparent, rgba(0,0,0,0.28))'
              : 'linear-gradient(270deg, transparent, rgba(0,0,0,0.28))',
        }}
      />
    </div>
  );
}

/* ════════════ 锦缎回纹边 ════════════ */
function MeanderBand({ position }: { position: 'top' | 'bottom' }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 h-[22px] md:h-[26px]"
      style={{
        [position]: 0,
        background:
          'linear-gradient(180deg,#9c7c34 0%,#7a5d24 100%)',
        borderTop: position === 'bottom' ? '1px solid rgba(255,225,150,0.5)' : undefined,
        borderBottom: position === 'top' ? '1px solid rgba(255,225,150,0.5)' : undefined,
      }}
    >
      {/* 回纹 */}
      <svg className="h-full w-full" preserveAspectRatio="none">
        <defs>
          <pattern id={`meander-${position}`} width="22" height="26" patternUnits="userSpaceOnUse">
            <path
              d="M3 19 V7 H15 V13 H9 V10"
              fill="none"
              stroke="rgba(255,232,170,0.55)"
              strokeWidth="1.3"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#meander-${position})`} />
      </svg>
    </div>
  );
}

/* ════════════ 竖排 + 入场 + 流光 keyframe（就地，前缀 edict-）════════ */
function EdictStyles() {
  return (
    <style>{`
      .edict-vert {
        writing-mode: vertical-rl;
        text-orientation: upright;
        font-family: var(--font-serif), "Noto Serif SC", serif;
      }
      .edict-root {
        max-width: 100%;
        min-width: 0;
      }
      .edict-scroll {
        max-width: 100%;
        min-width: 0;
        min-height: 360px;
        filter: drop-shadow(0 24px 60px rgba(0,0,0,0.55));
        animation: edict-settle 0.9s cubic-bezier(0.16,1,0.3,1) both;
      }
      @media (min-width: 1024px) { .edict-scroll { min-height: 420px; } }

      .edict-silk {
        background:
          radial-gradient(130% 90% at 50% 0%, #FBEFCB 0%, #F3DEA2 42%, #E8C97E 78%, #D9B560 100%);
        box-shadow:
          inset 0 0 0 1px rgba(124,90,30,0.35),
          inset 0 0 60px rgba(150,110,40,0.22);
      }
      .edict-weave {
        background:
          repeating-linear-gradient(90deg, rgba(255,255,255,0.05) 0 1px, transparent 1px 5px),
          repeating-linear-gradient(0deg, rgba(120,90,30,0.04) 0 1px, transparent 1px 6px);
        mix-blend-mode: overlay;
      }
      .edict-watermark {
        font-family: var(--font-serif), serif;
        font-size: 280px;
        font-weight: 700;
        color: rgba(110,80,20,0.06);
        user-select: none;
      }
      .edict-sheen {
        background: linear-gradient(115deg, transparent 38%, rgba(255,248,225,0.5) 50%, transparent 62%);
        transform: translateX(-120%);
        animation: edict-sheen-sweep 1.6s ease-out 0.5s 1 both;
      }
      .edict-col {
        opacity: 0;
        animation: edict-col-in 0.6s cubic-bezier(0.16,1,0.3,1) both;
      }
      .edict-seal {
        opacity: 0;
        animation: edict-stamp 0.45s cubic-bezier(0.34,1.56,0.64,1) 1.55s both;
      }
      .edict-aura {
        background: radial-gradient(60% 70% at 50% 40%, rgba(240,198,106,0.16), transparent 70%);
        animation: edict-breathe 5s ease-in-out infinite;
      }
      @media (max-width: 900px) {
        .edict-scroll {
          min-height: 330px;
        }
        .edict-body {
          gap: clamp(10px, 2.4vw, 24px) !important;
          padding: 42px clamp(18px, 4vw, 40px) !important;
        }
        .edict-watermark {
          font-size: clamp(150px, 28vw, 230px);
        }
        .edict-opening-text {
          font-size: clamp(22px, 4.2vw, 30px) !important;
        }
        .edict-title-text,
        .edict-closing-text {
          font-size: clamp(19px, 3.6vw, 26px) !important;
        }
        .edict-sub-text {
          font-size: clamp(12px, 2.1vw, 14px) !important;
        }
        .edict-seal {
          height: clamp(54px, 8.5vw, 68px) !important;
          width: clamp(54px, 8.5vw, 68px) !important;
        }
      }
      @media (max-width: 560px) {
        .edict-scroll {
          min-height: 300px;
        }
        .edict-roller {
          width: 24px !important;
        }
        .edict-roller-rod {
          width: 12px !important;
        }
        .edict-roller-head {
          height: 20px !important;
          width: 24px !important;
        }
        .edict-body {
          gap: 4px !important;
          padding: 38px 4px !important;
        }
        .edict-opening-text {
          font-size: clamp(18px, 5vw, 22px) !important;
        }
        .edict-title-text,
        .edict-closing-text {
          font-size: clamp(15px, 4.2vw, 18px) !important;
        }
        .edict-sub-text {
          font-size: 10px !important;
          line-height: 1.5 !important;
        }
        .edict-ord {
          height: 22px !important;
          width: 22px !important;
          font-size: 12px !important;
        }
        .edict-seal {
          height: 40px !important;
          width: 40px !important;
        }
        .edict-seal span {
          font-size: 12px !important;
        }
      }

      @keyframes edict-settle {
        0%   { opacity: 0; transform: translateY(16px) scale(0.985); }
        100% { opacity: 1; transform: translateY(0) scale(1); }
      }
      @keyframes edict-col-in {
        0%   { opacity: 0; transform: translateY(14px); }
        100% { opacity: 1; transform: translateY(0); }
      }
      @keyframes edict-sheen-sweep {
        0%   { transform: translateX(-120%); }
        100% { transform: translateX(120%); }
      }
      @keyframes edict-stamp {
        0%   { opacity: 0; transform: rotate(-5deg) scale(1.5); }
        70%  { opacity: 1; }
        100% { opacity: 1; transform: rotate(-5deg) scale(1); }
      }
      @keyframes edict-breathe {
        0%, 100% { opacity: 0.7; }
        50%      { opacity: 1; }
      }
      @media (prefers-reduced-motion: reduce) {
        .edict-scroll, .edict-col, .edict-seal, .edict-sheen, .edict-aura {
          animation: none !important;
          opacity: 1 !important;
          transform: none !important;
        }
      }
    `}</style>
  );
}
