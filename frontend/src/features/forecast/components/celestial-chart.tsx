/**
 * 观天台 · 天象盘（Celestial Chart）
 *
 * 4 层同心旋转：
 *   Outer R=170 · 二十八宿 星点带（慢 CW）
 *   Mid-outer R=140 · 十二地支 文字环（半速 CCW）
 *   Mid-inner R=105 · 情景三弧（上/中/下策 · 按概率切弧长） · 可点击
 *   Core R=50 · 紫微垣 + 北斗七星 · 呼吸发光
 *
 * 获得 "惊叹" 的四要素：多层立体、缓动旋转、星点闪烁、情景弧点击响应
 */

'use client';

import { useMemo } from 'react';
import { Telescope, Star } from 'lucide-react';
import { GlassPanel } from '@/components/ui/glass-panel';
import { colors } from '@/config/design-tokens';
import type { ForecastScenario, ScenarioName } from '@/types/forecast';
import { useForecastFocus } from './forecast-focus-context';

const SCENARIO_COLOR: Record<ScenarioName, string> = {
  optimistic: colors.success,
  base: colors.goldBright,
  pessimistic: colors.danger,
};
const SCENARIO_LABEL: Record<ScenarioName, string> = {
  optimistic: '上策',
  base: '中策',
  pessimistic: '下策',
};

/** 二十八宿 */
const MANSIONS_28 = [
  '角', '亢', '氐', '房', '心', '尾', '箕',
  '斗', '牛', '女', '虚', '危', '室', '壁',
  '奎', '娄', '胃', '昴', '毕', '觜', '参',
  '井', '鬼', '柳', '星', '张', '翼', '轸',
];
/** 十二地支 */
const BRANCHES_12 = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

/** 北斗七星 · 相对核心坐标 */
const BIG_DIPPER: [number, number][] = [
  [-20, 12], [-8, 6], [0, 10], [10, 6],
  [22, 0], [28, -10], [16, -18],
];

export interface CelestialChartProps {
  scenarios: ForecastScenario[];
}

export function CelestialChart({ scenarios }: CelestialChartProps) {
  const { focus, setFocus } = useForecastFocus();
  const selectedId = focus.kind === 'scenario' ? focus.scenarioId : undefined;

  // 情景弧数据
  const arcs = useMemo(() => {
    const total = scenarios.reduce((s, sc) => s + sc.probability, 0) || 1;
    let cursor = -90; // 起始角度（顶部）
    return scenarios.map((sc) => {
      const sweep = (sc.probability / total) * 360;
      const arc = { scenario: sc, start: cursor, end: cursor + sweep };
      cursor += sweep;
      return arc;
    });
  }, [scenarios]);

  return (
    <GlassPanel tone="elevated" padding="lg" className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 50% 50%, rgba(183,148,244,0.14), transparent 55%), radial-gradient(circle at 0% 0%, rgba(240,198,106,0.08), transparent 60%)',
        }}
      />

      {/* Header */}
      <div className="relative mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div
            className="text-[11px] uppercase tracking-[0.25em]"
            style={{ color: colors.gold }}
          >
            Celestial Chart · 天象盘
          </div>
          <h3 className="mt-1 text-[22px] font-semibold" style={{ color: colors.text }}>
            二十八宿 · 十二地支 · 三策分野
          </h3>
          <div className="mt-1 text-[12px]" style={{ color: colors.textDim }}>
            点击三策弧查看详情；星环按自然节律缓转，代表天道自运
          </div>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          {arcs.map((a) => (
            <ArcChip
              key={a.scenario.id}
              scenario={a.scenario}
              onClick={() => setFocus({ kind: 'scenario', scenarioId: a.scenario.id })}
              active={selectedId === a.scenario.id}
            />
          ))}
        </div>
      </div>

      <div className="relative grid gap-5 xl:grid-cols-[1fr_0.95fr]">
        {/* Chart SVG */}
        <div className="relative flex justify-center rounded-3xl border border-white/10 bg-black/50 p-4">
          <StarField />
          <svg
            viewBox="-200 -200 400 400"
            className="relative h-[520px] w-[520px]"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <radialGradient id="coreGlow" cx="0.5" cy="0.5" r="0.5">
                <stop offset="0%" stopColor={colors.text} stopOpacity="0.95" />
                <stop offset="40%" stopColor={colors.goldBright} stopOpacity="0.5" />
                <stop offset="100%" stopColor={colors.goldBright} stopOpacity="0" />
              </radialGradient>
              <radialGradient id="ringGrad" cx="0.5" cy="0.5" r="0.6">
                <stop offset="70%" stopColor="rgba(183,148,244,0)" />
                <stop offset="90%" stopColor="rgba(183,148,244,0.25)" />
                <stop offset="100%" stopColor="rgba(183,148,244,0)" />
              </radialGradient>
              <filter id="starGlow" x="-100%" y="-100%" width="300%" height="300%">
                <feGaussianBlur stdDeviation="2" />
              </filter>
              <filter id="arcGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" />
              </filter>
            </defs>

            {/* 背景径向光 */}
            <circle r="190" fill="url(#ringGrad)" />

            {/* Ring guides */}
            <circle r="170" fill="none" stroke="rgba(240,198,106,0.18)" strokeWidth="0.6" />
            <circle r="140" fill="none" stroke="rgba(183,148,244,0.2)" strokeWidth="0.6" strokeDasharray="2 6" />
            <circle r="105" fill="none" stroke="rgba(240,198,106,0.3)" strokeWidth="1" />
            <circle r="50" fill="none" stroke="rgba(240,198,106,0.35)" strokeWidth="0.8" />

            {/* ============ Ring 1 · 二十八宿 ============ */}
            <g>
              {MANSIONS_28.map((name, i) => {
                const angle = (i / 28) * 2 * Math.PI - Math.PI / 2;
                const x = Math.cos(angle) * 170;
                const y = Math.sin(angle) * 170;
                const tx = Math.cos(angle) * 183;
                const ty = Math.sin(angle) * 183;
                const bright = i % 4 === 0; // 每 4 宿放亮一颗
                const r = bright ? 2.8 : 1.6;
                return (
                  <g key={name}>
                    <circle
                      cx={x}
                      cy={y}
                      r={r}
                      fill={colors.text}
                      opacity={bright ? 0.95 : 0.65}
                      filter={bright ? 'url(#starGlow)' : undefined}
                    >
                      <animate
                        attributeName="opacity"
                        values={`${bright ? 0.95 : 0.65};${bright ? 0.5 : 0.25};${bright ? 0.95 : 0.65}`}
                        dur={`${3 + (i % 5)}s`}
                        repeatCount="indefinite"
                      />
                    </circle>
                    <text
                      x={tx}
                      y={ty}
                      textAnchor="middle"
                      fontSize="9"
                      fill={colors.textDim}
                      opacity="0.8"
                      style={{
                        paintOrder: 'stroke',
                        stroke: 'rgba(0,0,0,0.85)',
                        strokeWidth: '2px',
                      }}
                    >
                      {name}
                    </text>
                  </g>
                );
              })}
              <animateTransform
                attributeName="transform"
                type="rotate"
                from="0"
                to="360"
                dur="180s"
                repeatCount="indefinite"
              />
            </g>

            {/* ============ Ring 2 · 十二地支 ============ */}
            <g>
              {BRANCHES_12.map((name, i) => {
                const angle = (i / 12) * 2 * Math.PI - Math.PI / 2;
                const x = Math.cos(angle) * 140;
                const y = Math.sin(angle) * 140;
                return (
                  <g key={name}>
                    {/* 小圆槽 */}
                    <circle cx={x} cy={y} r="11" fill="rgba(183,148,244,0.08)" stroke="rgba(183,148,244,0.35)" strokeWidth="0.6" />
                    <text
                      x={x}
                      y={y + 4}
                      textAnchor="middle"
                      fontSize="13"
                      fontWeight="600"
                      fill={colors.gold}
                    >
                      {name}
                    </text>
                  </g>
                );
              })}
              <animateTransform
                attributeName="transform"
                type="rotate"
                from="0"
                to="-360"
                dur="240s"
                repeatCount="indefinite"
              />
            </g>

            {/* ============ Ring 3 · 情景弧（可点击） ============ */}
            <g>
              {arcs.map((a) => {
                const color = SCENARIO_COLOR[a.scenario.name];
                const active = a.scenario.id === selectedId;
                const R = 105;
                const W = 22;
                return (
                  <g
                    key={a.scenario.id}
                    onClick={() => setFocus({ kind: 'scenario', scenarioId: a.scenario.id })}
                    style={{ cursor: 'pointer' }}
                  >
                    <path
                      d={arcPath(a.start, a.end, R - W / 2, R + W / 2)}
                      fill={color}
                      fillOpacity={active ? 0.45 : 0.22}
                      stroke={color}
                      strokeWidth={active ? 2 : 1}
                      filter={active ? 'url(#arcGlow)' : undefined}
                    >
                      {active && (
                        <animate
                          attributeName="fill-opacity"
                          values="0.35;0.55;0.35"
                          dur="3s"
                          repeatCount="indefinite"
                        />
                      )}
                    </path>
                    {/* 弧中心标签 */}
                    <ArcLabel
                      start={a.start}
                      end={a.end}
                      r={R}
                      label={SCENARIO_LABEL[a.scenario.name]}
                      color={color}
                      probability={a.scenario.probability}
                    />
                  </g>
                );
              })}
            </g>

            {/* ============ Core · 紫微垣 + 北斗 + 浑天仪 ============ */}
            <g>
              {/* 中心光晕 */}
              <circle r="52" fill="url(#coreGlow)">
                <animate
                  attributeName="r"
                  values="48;55;48"
                  dur="4s"
                  repeatCount="indefinite"
                />
              </circle>
              {/* 浑天仪 · 三环黄道/赤道/子午（缓慢自转） */}
              <g opacity="0.5">
                {/* 黄道斜环（倾 23.5°） */}
                <ellipse
                  rx="46"
                  ry="14"
                  fill="none"
                  stroke={colors.goldBright}
                  strokeWidth="0.6"
                  opacity="0.6"
                  transform="rotate(23.5)"
                />
                {/* 赤道 */}
                <ellipse
                  rx="48"
                  ry="12"
                  fill="none"
                  stroke="rgba(183,148,244,0.6)"
                  strokeWidth="0.5"
                />
                {/* 子午 */}
                <ellipse
                  rx="12"
                  ry="48"
                  fill="none"
                  stroke={colors.goldBright}
                  strokeWidth="0.4"
                  opacity="0.45"
                />
                {/* 四游仪 · 十字准线 */}
                <line x1="-50" y1="0" x2="50" y2="0" stroke="rgba(240,198,106,0.25)" strokeWidth="0.3" />
                <line x1="0" y1="-50" x2="0" y2="50" stroke="rgba(240,198,106,0.25)" strokeWidth="0.3" />
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  from="0"
                  to="360"
                  dur="90s"
                  repeatCount="indefinite"
                />
              </g>
              {/* 北斗七星 */}
              {BIG_DIPPER.map(([x, y], i) => (
                <circle
                  key={i}
                  cx={x}
                  cy={y}
                  r={i === 3 ? 2.8 : 2}
                  fill={colors.text}
                  filter="url(#starGlow)"
                >
                  <animate
                    attributeName="opacity"
                    values="0.7;1;0.7"
                    dur={`${2 + i * 0.4}s`}
                    repeatCount="indefinite"
                  />
                </circle>
              ))}
              {/* 连线 */}
              <polyline
                points={BIG_DIPPER.map((p) => `${p[0]},${p[1]}`).join(' ')}
                fill="none"
                stroke={colors.goldBright}
                strokeWidth="0.6"
                opacity="0.55"
              />
              {/* 紫微极星 */}
              <circle r="3.5" fill={colors.text} filter="url(#starGlow)" />
              <circle r="1.5" fill="#fff" />
            </g>

            {/* 4 方位标识 */}
            {(['东 · 青龙','南 · 朱雀','西 · 白虎','北 · 玄武'] as const).map((label, i) => {
              const angle = (i / 4) * 2 * Math.PI;
              const x = Math.cos(angle) * 195;
              const y = Math.sin(angle) * 195;
              return (
                <text
                  key={label}
                  x={x}
                  y={y + 3}
                  textAnchor="middle"
                  fontSize="9"
                  fill={colors.goldBright}
                  opacity="0.7"
                  style={{
                    paintOrder: 'stroke',
                    stroke: 'rgba(0,0,0,0.8)',
                    strokeWidth: '2px',
                  }}
                >
                  {label}
                </text>
              );
            })}
          </svg>
        </div>

        {/* 右半 · 总览 + 选中情景摘要 */}
        <div className="space-y-3">
          <Legend />
          <ProbabilityBars scenarios={scenarios} selectedId={selectedId} />
          {focus.kind === 'scenario' && (
            <ScenarioPreview
              scenario={scenarios.find((s) => s.id === focus.scenarioId)}
            />
          )}
        </div>
      </div>
    </GlassPanel>
  );
}

/* ========================================================================== */

function ArcChip({
  scenario,
  onClick,
  active,
}: {
  scenario: ForecastScenario;
  onClick: () => void;
  active: boolean;
}) {
  const color = SCENARIO_COLOR[scenario.name];
  const label = SCENARIO_LABEL[scenario.name];
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] transition-all"
      style={{
        background: active ? `${color}1a` : 'rgba(255,255,255,0.03)',
        border: active ? `1px solid ${color}66` : '1px solid rgba(255,255,255,0.08)',
        color: active ? color : colors.textDim,
        boxShadow: active ? `0 2px 14px ${color}22` : undefined,
      }}
    >
      <Star size={10} style={{ color }} fill="currentColor" />
      <span className="font-semibold">{label}</span>
      <span className="font-mono text-[11px]" style={{ color }}>
        {Math.round(scenario.probability * 100)}%
      </span>
    </button>
  );
}

function Legend() {
  return (
    <div className="rounded-2xl border border-white/8 bg-black/30 p-4">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em]" style={{ color: colors.goldDeep }}>
        <Telescope size={11} style={{ color: colors.gold }} />
        Ring Legend · 盘面释义
      </div>
      <ul className="mt-2 space-y-1.5 text-[11px] leading-6" style={{ color: colors.text }}>
        <li><span style={{ color: colors.text }}>外环 ·</span> 二十八宿 —— 慢转表宇宙节律</li>
        <li><span style={{ color: colors.gold }}>中外环 ·</span> 十二地支 —— 反转表阴阳</li>
        <li><span style={{ color: colors.goldBright }}>中内环 ·</span> 三策分野 —— 可点击</li>
        <li><span style={{ color: colors.text }}>核心 ·</span> 紫微垣 + 北斗七星</li>
      </ul>
    </div>
  );
}

function ProbabilityBars({
  scenarios,
  selectedId,
}: {
  scenarios: ForecastScenario[];
  selectedId?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-black/30 p-4">
      <div className="text-[11px] uppercase tracking-[0.22em]" style={{ color: colors.goldDeep }}>
        Scenario Probability · 三策概率
      </div>
      <div className="mt-2 space-y-2">
        {scenarios.map((s) => {
          const color = SCENARIO_COLOR[s.name];
          const pct = Math.round(s.probability * 100);
          const active = s.id === selectedId;
          return (
            <div key={s.id} className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span style={{ color }} className="font-semibold">
                  {SCENARIO_LABEL[s.name]} · {s.label}
                </span>
                <span className="font-mono" style={{ color }}>
                  {pct}%
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${pct}%`,
                    background: `linear-gradient(90deg, ${color}, ${color}88)`,
                    boxShadow: active ? `0 0 8px ${color}` : undefined,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ScenarioPreview({ scenario }: { scenario?: ForecastScenario }) {
  if (!scenario) return null;
  const color = SCENARIO_COLOR[scenario.name];
  return (
    <div
      className="rounded-2xl border p-4"
      style={{
        borderColor: `${color}55`,
        background: `linear-gradient(135deg, ${color}14, transparent 70%)`,
      }}
    >
      <div
        className="text-[11px] uppercase tracking-[0.22em]"
        style={{ color }}
      >
        Selected · {SCENARIO_LABEL[scenario.name]}
      </div>
      <div className="mt-1 text-[17px] font-semibold" style={{ color: colors.text }}>
        {scenario.label}
      </div>
      <div className="mt-2 text-[11px] leading-6" style={{ color: colors.text }}>
        {scenario.payoffDescription}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px]">
        <Metric label="概率" value={`${Math.round(scenario.probability * 100)}%`} color={color} />
        <Metric label="置信" value={`${Math.round(scenario.confidence * 100)}%`} color={color} />
        <Metric label="窗口" value={`${scenario.riskWindows.length}`} color={color} />
      </div>
    </div>
  );
}

function Metric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg border border-white/8 bg-white/[0.03] p-2">
      <div className="text-[11px] uppercase tracking-[0.18em]" style={{ color: colors.textMuted }}>
        {label}
      </div>
      <div className="mt-0.5 font-mono text-[13px] font-bold" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

/* ========================================================================== */

function ArcLabel({
  start,
  end,
  r,
  label,
  color,
  probability,
}: {
  start: number;
  end: number;
  r: number;
  label: string;
  color: string;
  probability: number;
}) {
  const midAngle = ((start + end) / 2) * (Math.PI / 180);
  const x = Math.cos(midAngle) * r;
  const y = Math.sin(midAngle) * r;
  return (
    <g>
      <text
        x={x}
        y={y - 3}
        textAnchor="middle"
        fontSize="12"
        fontWeight="700"
        fill={color}
        style={{
          paintOrder: 'stroke',
          stroke: 'rgba(0,0,0,0.85)',
          strokeWidth: '2.5px',
        }}
      >
        {label}
      </text>
      <text
        x={x}
        y={y + 10}
        textAnchor="middle"
        fontSize="9"
        fontFamily="monospace"
        fill={color}
        opacity="0.9"
        style={{
          paintOrder: 'stroke',
          stroke: 'rgba(0,0,0,0.85)',
          strokeWidth: '2px',
        }}
      >
        {Math.round(probability * 100)}%
      </text>
    </g>
  );
}

function arcPath(startDeg: number, endDeg: number, rInner: number, rOuter: number): string {
  const s = startDeg * (Math.PI / 180);
  const e = endDeg * (Math.PI / 180);
  const sweep = endDeg - startDeg;
  const largeArc = sweep > 180 ? 1 : 0;
  const x1 = Math.cos(s) * rOuter;
  const y1 = Math.sin(s) * rOuter;
  const x2 = Math.cos(e) * rOuter;
  const y2 = Math.sin(e) * rOuter;
  const x3 = Math.cos(e) * rInner;
  const y3 = Math.sin(e) * rInner;
  const x4 = Math.cos(s) * rInner;
  const y4 = Math.sin(s) * rInner;
  return [
    `M ${x1} ${y1}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${x2} ${y2}`,
    `L ${x3} ${y3}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 0 ${x4} ${y4}`,
    'Z',
  ].join(' ');
}

/* ========================================================================== */

/** 背景星场 · 全局随机点 */
function StarField() {
  const stars = useMemo(() => {
    const arr: { x: number; y: number; r: number; d: number }[] = [];
    const rng = mulberry32(42);
    for (let i = 0; i < 80; i++) {
      arr.push({
        x: rng() * 100,
        y: rng() * 100,
        r: rng() * 1.2 + 0.3,
        d: rng() * 4 + 2,
      });
    }
    return arr;
  }, []);
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid slice"
    >
      {stars.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={s.r} fill={colors.text} opacity="0.4">
          <animate
            attributeName="opacity"
            values="0.1;0.7;0.1"
            dur={`${s.d}s`}
            repeatCount="indefinite"
          />
        </circle>
      ))}
    </svg>
  );
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
