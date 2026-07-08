/**
 * 观天台 · 玄机 · 中国古典推演
 *
 * 周易（Hexagram）· 奇门遁甲（九宫盘）· 六壬（天地盘）
 */

'use client';

import { GlassPanel } from '@/components/ui/glass-panel';
import { Compass, Hexagon, CircleDot, Sparkles, ArrowRight } from 'lucide-react';

const GOLD = '#F0C66A';
const PURPLE = '#B794F4';
const TEAL = '#5EEAD4';

/* ========================================================================== */
/*   周易 · Hexagram                                                          */
/* ========================================================================== */

interface YiHexagram {
  nameCn: string;
  code: string;           // e.g. "䷀"
  /** 6 爻 · 阳=1 阴=0 · 底到顶 */
  lines: (0 | 1)[];
  judgment: string;       // 卦辞
  image: string;          // 象辞
  reading: string;        // 当前解读
}

const TODAY_HEX: YiHexagram = {
  nameCn: '水火既济',
  code: '䷾',
  lines: [1, 0, 1, 0, 1, 0], // 离下坎上
  judgment: '亨，小利贞，初吉终乱。',
  image: '水在火上，既济；君子以思患而豫防之。',
  reading: '万事已成，然乱象潜伏。宜守成 + 防微 · 不宜冒进。与当前中策吻合。',
};

const CHANGE_HEX: YiHexagram = {
  nameCn: '火水未济',
  code: '䷿',
  lines: [0, 1, 0, 1, 0, 1],
  judgment: '亨。小狐汔济，濡其尾，无攸利。',
  image: '火在水上，未济；君子以慎辨物居方。',
  reading: '变卦提醒：形势虽成但未彻底 · 需二次确认 · 见上策前有一次回调。',
};

/* ========================================================================== */
/*   奇门遁甲 · 九宫盘                                                          */
/* ========================================================================== */

interface NinePalace {
  /** 九宫位置 · 按 洛书 顺序：4 9 2 / 3 5 7 / 8 1 6 */
  palaces: {
    number: number;
    trigram: string;   // 八卦
    direction: string; // 方位
    star: string;      // 九星
    gate: string;      // 八门
    god: string;       // 八神
    tone: 'auspicious' | 'neutral' | 'ominous';
  }[];
  hourPillar: string;  // 当前时辰
  summary: string;
}

const TODAY_NINE: NinePalace = {
  hourPillar: '甲子日 · 午时 · 天辅',
  summary: '中宫见天芮 · 休门临坤 · 宜议和、忌强攻 · 东南方位吉',
  palaces: [
    // 4 巽  · 9 离  · 2 坤
    { number: 4, trigram: '巽', direction: '东南', star: '天辅', gate: '杜门', god: '太阴', tone: 'auspicious' },
    { number: 9, trigram: '离', direction: '南',  star: '天英', gate: '景门', god: '六合', tone: 'neutral' },
    { number: 2, trigram: '坤', direction: '西南', star: '天冲', gate: '休门', god: '白虎', tone: 'auspicious' },
    // 3 震  · 5 中  · 7 兑
    { number: 3, trigram: '震', direction: '东',  star: '天任', gate: '伤门', god: '玄武', tone: 'ominous' },
    { number: 5, trigram: '中', direction: '中',  star: '天芮', gate: '死门', god: '值符', tone: 'ominous' },
    { number: 7, trigram: '兑', direction: '西',  star: '天柱', gate: '惊门', god: '九地', tone: 'neutral' },
    // 8 艮  · 1 坎  · 6 乾
    { number: 8, trigram: '艮', direction: '东北', star: '天禽', gate: '生门', god: '九天', tone: 'auspicious' },
    { number: 1, trigram: '坎', direction: '北',  star: '天蓬', gate: '开门', god: '腾蛇', tone: 'neutral' },
    { number: 6, trigram: '乾', direction: '西北', star: '天心', gate: '勾陈', god: '值使', tone: 'neutral' },
  ],
};

const TONE_COLOR: Record<NinePalace['palaces'][number]['tone'], string> = {
  auspicious: '#3DD68C',
  neutral: '#F0C66A',
  ominous: '#F43F5E',
};

/* ========================================================================== */
/*   六壬 · 天地盘                                                             */
/* ========================================================================== */

interface LiuRen {
  hour: string;
  earthPlate: string[];  // 12 地支
  heavenPlate: string[]; // 12 天将（排列）
  fourCourses: { name: string; description: string }[];
  threeTransitions: string;
  summary: string;
}

const TODAY_LR: LiuRen = {
  hour: '甲子旬 · 丁巳时',
  earthPlate: ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'],
  heavenPlate: ['贵人', '螣蛇', '朱雀', '六合', '勾陈', '青龙', '天空', '白虎', '太常', '玄武', '太阴', '天后'],
  fourCourses: [
    { name: '干上神', description: '青龙乘巳 · 主求谋利市' },
    { name: '支上神', description: '贵人乘申 · 主得助' },
    { name: '干阴神', description: '白虎入戌 · 主惊动' },
    { name: '支阴神', description: '太常入子 · 主礼乐' },
  ],
  threeTransitions: '初传巳 · 中传申 · 末传戌',
  summary: '青龙贵人并临 · 谋利可成 · 但白虎在戌宜防财耗',
};

/* ========================================================================== */
/*   主组件                                                                    */
/* ========================================================================== */

export function ClassicalArtsBoard() {
  return (
    <div className="space-y-5">
      <GlassPanel variant="gold" tone="elevated" padding="md">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{
              background: 'linear-gradient(135deg, rgba(240,198,106,0.3), rgba(183,148,244,0.1))',
              border: '1px solid rgba(240,198,106,0.5)',
            }}
          >
            <Sparkles size={17} className="text-[#F0C66A]" />
          </div>
          <div>
            <div className="page-eyebrow">Classical Arts · 玄机推演</div>
            <h2 className="mt-1 text-[20px] font-semibold text-[#F5E9C9]">
              周易 · 奇门遁甲 · 六壬 —— 古典推演三式
            </h2>
            <div className="mt-1 text-[11px] text-[#9AA3C4]">
              与群策交叉验证 · 与星象互参 · 仅作决策辅助不作决策替代
            </div>
          </div>
        </div>
      </GlassPanel>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="xl:col-span-5">
          <YiJingPanel />
        </div>
        <div className="xl:col-span-7">
          <NinePalacePanel />
        </div>
      </div>

      <LiuRenPanel />
    </div>
  );
}

/* ========================================================================== */

function YiJingPanel() {
  return (
    <GlassPanel tone="elevated" padding="lg" className="relative h-full overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 100% 0%, rgba(240,198,106,0.14), transparent 55%)',
        }}
      />
      <div className="relative flex items-center gap-2">
        <Hexagon size={14} style={{ color: GOLD }} />
        <div>
          <div className="text-[10px] uppercase tracking-[0.22em]" style={{ color: GOLD }}>
            Book of Changes · 周易起卦
          </div>
          <h3 className="mt-0.5 text-[16px] font-semibold text-[#F5E9C9]">今日本卦 · 变卦</h3>
        </div>
      </div>

      <div className="relative mt-4 grid grid-cols-2 gap-4">
        <HexagramCard hex={TODAY_HEX} label="本卦" />
        <HexagramCard hex={CHANGE_HEX} label="变卦" accent={PURPLE} />
      </div>

      <div
        className="relative mt-4 rounded-xl border p-3"
        style={{ borderColor: `${GOLD}44`, background: `${GOLD}0c` }}
      >
        <div className="text-[9px] uppercase tracking-[0.22em]" style={{ color: GOLD }}>
          钦天监解读
        </div>
        <p className="mt-2 text-[12px] leading-7 text-[#D6CCB0]">
          本卦 <span style={{ color: GOLD }}>{TODAY_HEX.nameCn}</span> · 变卦{' '}
          <span style={{ color: PURPLE }}>{CHANGE_HEX.nameCn}</span>。
        </p>
        <p className="mt-2 text-[12px] leading-7 text-[#C8CDD8]">{TODAY_HEX.reading}</p>
        <p className="mt-2 text-[12px] leading-7 text-[#C8CDD8]">{CHANGE_HEX.reading}</p>
      </div>
    </GlassPanel>
  );
}

function HexagramCard({
  hex,
  label,
  accent = GOLD,
}: {
  hex: YiHexagram;
  label: string;
  accent?: string;
}) {
  return (
    <div
      className="rounded-2xl border p-4"
      style={{
        borderColor: `${accent}55`,
        background: `linear-gradient(160deg, ${accent}10, rgba(20,22,30,0.5))`,
      }}
    >
      <div className="flex items-center justify-between">
        <div className="text-[9px] uppercase tracking-[0.22em]" style={{ color: accent }}>
          {label}
        </div>
        <div className="text-[22px]" style={{ color: accent }}>
          {hex.code}
        </div>
      </div>
      <div className="mt-2 text-[16px] font-semibold text-[#F5E9C9]">{hex.nameCn}</div>

      {/* 6 爻 · 从顶到底 */}
      <div className="mt-3 flex flex-col gap-[5px]">
        {[...hex.lines].reverse().map((line, i) => (
          <HexLine key={i} yang={line === 1} color={accent} />
        ))}
      </div>

      <div className="mt-3 text-[10px] leading-5 text-[#9AA3C4]">
        <span className="text-[9px] uppercase tracking-[0.18em]" style={{ color: accent }}>
          卦辞 ·{' '}
        </span>
        {hex.judgment}
      </div>
      <div className="mt-1 text-[10px] leading-5 text-[#9AA3C4]">
        <span className="text-[9px] uppercase tracking-[0.18em]" style={{ color: accent }}>
          象辞 ·{' '}
        </span>
        {hex.image}
      </div>
    </div>
  );
}

function HexLine({ yang, color }: { yang: boolean; color: string }) {
  if (yang) {
    return (
      <div
        className="h-2 w-full rounded-sm"
        style={{
          background: `linear-gradient(90deg, ${color}aa, ${color}, ${color}aa)`,
          boxShadow: `0 0 6px ${color}44`,
        }}
      />
    );
  }
  return (
    <div className="flex w-full gap-1.5">
      <div
        className="h-2 flex-1 rounded-sm"
        style={{ background: `linear-gradient(90deg, ${color}aa, ${color})` }}
      />
      <div
        className="h-2 flex-1 rounded-sm"
        style={{ background: `linear-gradient(90deg, ${color}, ${color}aa)` }}
      />
    </div>
  );
}

/* ========================================================================== */

function NinePalacePanel() {
  return (
    <GlassPanel tone="elevated" padding="lg" className="relative h-full overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 0% 100%, rgba(183,148,244,0.16), transparent 55%)',
        }}
      />
      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Compass size={14} style={{ color: PURPLE }} />
          <div>
            <div className="text-[10px] uppercase tracking-[0.22em]" style={{ color: PURPLE }}>
              Qimen Dunjia · 奇门遁甲
            </div>
            <h3 className="mt-0.5 text-[16px] font-semibold text-[#F5E9C9]">
              九宫盘 · {TODAY_NINE.hourPillar}
            </h3>
          </div>
        </div>
      </div>

      {/* 九宫 */}
      <div className="relative mx-auto mt-4 grid max-w-[520px] grid-cols-3 gap-2">
        {TODAY_NINE.palaces.map((p, i) => (
          <PalaceCell key={i} palace={p} isCenter={i === 4} />
        ))}
      </div>

      <div
        className="relative mt-4 rounded-xl border p-3"
        style={{ borderColor: `${PURPLE}44`, background: `${PURPLE}0c` }}
      >
        <div className="text-[9px] uppercase tracking-[0.22em]" style={{ color: PURPLE }}>
          当前格局
        </div>
        <p className="mt-2 text-[12px] leading-7 text-[#D6CCB0]">{TODAY_NINE.summary}</p>
      </div>
    </GlassPanel>
  );
}

function PalaceCell({
  palace,
  isCenter,
}: {
  palace: NinePalace['palaces'][number];
  isCenter: boolean;
}) {
  const color = TONE_COLOR[palace.tone];
  return (
    <div
      className="relative overflow-hidden rounded-xl border p-2.5 text-center"
      style={{
        borderColor: isCenter ? `${color}77` : `${color}44`,
        background: isCenter
          ? `linear-gradient(160deg, ${color}18, rgba(20,22,30,0.6))`
          : `linear-gradient(160deg, ${color}08, rgba(20,22,30,0.4))`,
        boxShadow: isCenter ? `0 4px 20px ${color}22, inset 0 1px 0 ${color}33` : undefined,
        aspectRatio: '1',
      }}
    >
      <div className="absolute right-1 top-1 text-[9px] font-mono" style={{ color }}>
        {palace.number}
      </div>
      <div className="absolute left-1 top-1 text-[9px]" style={{ color }}>
        {palace.direction}
      </div>
      <div className="mt-3 text-[20px] font-bold" style={{ color: isCenter ? color : '#F5E9C9' }}>
        {palace.trigram}
      </div>
      <div className="mt-0.5 text-[9px]" style={{ color }}>
        {palace.star}
      </div>
      <div className="mt-0.5 text-[9px] text-[#D6CCB0]">{palace.gate}</div>
      <div className="mt-0.5 text-[8px] text-[#9AA3C4]">{palace.god}</div>
    </div>
  );
}

/* ========================================================================== */

function LiuRenPanel() {
  return (
    <GlassPanel tone="elevated" padding="lg" className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 50% 0%, rgba(94,234,212,0.12), transparent 55%)',
        }}
      />

      <div className="relative flex items-center gap-2">
        <CircleDot size={14} style={{ color: TEAL }} />
        <div>
          <div className="text-[10px] uppercase tracking-[0.22em]" style={{ color: TEAL }}>
            Liuren · 六壬
          </div>
          <h3 className="mt-0.5 text-[16px] font-semibold text-[#F5E9C9]">
            天地盘 · {TODAY_LR.hour}
          </h3>
        </div>
      </div>

      <div className="relative mt-4 grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        {/* 天地盘 SVG */}
        <div className="flex justify-center rounded-2xl border border-white/8 bg-black/40 p-4">
          <svg viewBox="-100 -100 200 200" className="h-[280px] w-[280px]">
            <defs>
              <radialGradient id="lrCore" cx="0.5" cy="0.5" r="0.5">
                <stop offset="0%" stopColor="#F5E9C9" />
                <stop offset="60%" stopColor={TEAL} stopOpacity="0.6" />
                <stop offset="100%" stopColor={TEAL} stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* 外环 · 天盘（天将） */}
            <circle r="90" fill="none" stroke={TEAL} strokeWidth="0.8" opacity="0.6" />
            <circle r="60" fill="none" stroke={GOLD} strokeWidth="0.6" strokeDasharray="2 4" opacity="0.55" />
            <circle r="30" fill="none" stroke={GOLD} strokeWidth="0.6" opacity="0.5" />

            {/* 天盘天将 */}
            {TODAY_LR.heavenPlate.map((name, i) => {
              const a = (i / 12) * 2 * Math.PI - Math.PI / 2;
              const r = 75;
              return (
                <text
                  key={i}
                  x={Math.cos(a) * r}
                  y={Math.sin(a) * r + 3}
                  textAnchor="middle"
                  fontSize="9"
                  fill={TEAL}
                  opacity="0.9"
                  style={{
                    paintOrder: 'stroke',
                    stroke: 'rgba(0,0,0,0.7)',
                    strokeWidth: '2px',
                  }}
                >
                  {name}
                </text>
              );
            })}

            {/* 地盘地支 */}
            {TODAY_LR.earthPlate.map((name, i) => {
              const a = (i / 12) * 2 * Math.PI - Math.PI / 2;
              const r = 45;
              return (
                <g key={i}>
                  <circle cx={Math.cos(a) * r} cy={Math.sin(a) * r} r="9" fill={`${GOLD}10`} stroke={`${GOLD}66`} strokeWidth="0.6" />
                  <text
                    x={Math.cos(a) * r}
                    y={Math.sin(a) * r + 3}
                    textAnchor="middle"
                    fontSize="10"
                    fontWeight="600"
                    fill={GOLD}
                  >
                    {name}
                  </text>
                </g>
              );
            })}

            {/* 核心 */}
            <circle r="14" fill="url(#lrCore)">
              <animate attributeName="r" values="12;16;12" dur="4s" repeatCount="indefinite" />
            </circle>
            <text y="4" textAnchor="middle" fontSize="11" fontWeight="700" fill="#F5E9C9">
              壬
            </text>
          </svg>
        </div>

        {/* 四课 + 三传 + 断语 */}
        <div className="space-y-3">
          <div
            className="rounded-xl border p-3"
            style={{ borderColor: `${TEAL}44`, background: `${TEAL}0c` }}
          >
            <div className="text-[9px] uppercase tracking-[0.22em]" style={{ color: TEAL }}>
              四课 · Four Courses
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {TODAY_LR.fourCourses.map((fc, i) => (
                <div key={i} className="rounded-lg border border-white/8 bg-white/[0.03] p-2">
                  <div className="text-[10px] font-semibold" style={{ color: GOLD }}>
                    {fc.name}
                  </div>
                  <div className="mt-1 text-[10px] leading-5 text-[#C8CDD8]">{fc.description}</div>
                </div>
              ))}
            </div>
          </div>
          <div
            className="flex items-center justify-between rounded-xl border p-3"
            style={{ borderColor: `${GOLD}44`, background: `${GOLD}0a` }}
          >
            <div className="text-[9px] uppercase tracking-[0.22em]" style={{ color: GOLD }}>
              三传
            </div>
            <div className="flex items-center gap-2 text-[11px]" style={{ color: '#F5E9C9' }}>
              {TODAY_LR.threeTransitions.split(' · ').map((t, i, arr) => (
                <span key={i} className="flex items-center gap-1">
                  <span className="rounded-md border border-[#F0C66A]/40 bg-[#F0C66A]/10 px-2 py-0.5">
                    {t}
                  </span>
                  {i < arr.length - 1 && <ArrowRight size={10} style={{ color: GOLD }} />}
                </span>
              ))}
            </div>
          </div>
          <div
            className="rounded-xl border p-3"
            style={{ borderColor: `${TEAL}55`, background: `${TEAL}10` }}
          >
            <div className="text-[9px] uppercase tracking-[0.22em]" style={{ color: TEAL }}>
              断语
            </div>
            <p className="mt-2 text-[12px] leading-7 text-[#D6CCB0]">{TODAY_LR.summary}</p>
          </div>
        </div>
      </div>
    </GlassPanel>
  );
}
