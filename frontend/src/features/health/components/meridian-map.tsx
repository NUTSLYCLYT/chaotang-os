/**
 * 太医院 · 经络图 v2（专业版）
 *
 * 8 条正经 + 任督 · 流动脉冲 · 穴位发光点 · 五行配色
 * 点击穴位 / 经络 → 触发 HealthFocus，右侧响应面板展示推拿师/针灸专家
 */

'use client';

import { useMemo, useState } from 'react';
import { Hand, Info } from 'lucide-react';
import { GlassPanel } from '@/components/ui/glass-panel';
import { MERIDIANS, type Meridian, type Acupoint } from '../lib/meridians';
import { useHealthFocus } from './health-focus-context';

const HEALTH_ACCENT = '#34D399';

export function MeridianMap() {
  const { setFocus } = useHealthFocus();
  const [activeMeridian, setActiveMeridian] = useState<string>('all');
  const [selectedPoint, setSelectedPoint] = useState<Acupoint | null>(null);

  const visible = useMemo(() => {
    if (activeMeridian === 'all') return MERIDIANS;
    return MERIDIANS.filter((m) => m.id === activeMeridian);
  }, [activeMeridian]);

  const selectedMeridian = selectedPoint
    ? MERIDIANS.find((m) => m.points.some((p) => p.id === selectedPoint.id))
    : null;

  const handleSelectPoint = (p: Acupoint, meridianId: string) => {
    setSelectedPoint(p);
    setFocus({ kind: 'meridian', meridianId, pointId: p.id });
  };

  const handleSelectMeridian = (id: string) => {
    setActiveMeridian(id);
    if (id !== 'all') {
      const m = MERIDIANS.find((x) => x.id === id);
      setFocus({ kind: 'meridian', meridianId: id, pointId: m?.points[0]?.id });
    }
  };

  return (
    <GlassPanel tone="elevated" padding="lg" className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 85% 0%, rgba(183,148,244,0.12), transparent 55%), radial-gradient(circle at 0% 100%, rgba(52,211,153,0.08), transparent 55%)',
        }}
      />

      <div className="relative mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div
            className="text-[10px] uppercase tracking-[0.25em]"
            style={{ color: '#B794F4' }}
          >
            Meridian Map · 经络穴位图
          </div>
          <h3 className="mt-1 text-[22px] font-semibold text-[#F5E9C9]">
            十二正经 · 任督二脉 · 流动显示气血
          </h3>
          <div className="mt-1 text-[12px] text-[#9AA3C4]">
            脉冲光点按经络方向流动 · 点穴位查主治与按摩 · 右侧面板匹配针灸师
          </div>
        </div>
      </div>

      {/* 经络选择 chips */}
      <div className="relative mb-4 flex flex-wrap gap-2">
        <MeridianChip
          active={activeMeridian === 'all'}
          color="#F0C66A"
          label="全部"
          onClick={() => handleSelectMeridian('all')}
        />
        {MERIDIANS.map((m) => (
          <MeridianChip
            key={m.id}
            active={activeMeridian === m.id}
            color={m.color}
            label={m.nameShort}
            element={m.element}
            onClick={() => handleSelectMeridian(m.id)}
          />
        ))}
      </div>

      <div className="relative grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="relative flex justify-center rounded-2xl border border-white/8 bg-black/45 p-4">
          <BodyMeridianSvg
            visible={visible}
            selectedPointId={selectedPoint?.id ?? null}
            onSelectPoint={handleSelectPoint}
          />
        </div>

        <AcupointDetail
          selected={selectedPoint}
          meridian={selectedMeridian ?? null}
        />
      </div>
    </GlassPanel>
  );
}

/* ========================================================================== */

function MeridianChip({
  active,
  color,
  label,
  element,
  onClick,
}: {
  active: boolean;
  color: string;
  label: string;
  element?: Meridian['element'];
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] transition-all"
      style={{
        background: active
          ? `linear-gradient(135deg, ${color}2a, ${color}08)`
          : 'rgba(255,255,255,0.03)',
        border: active ? `1px solid ${color}80` : '1px solid rgba(255,255,255,0.08)',
        color: active ? '#F5E9C9' : '#B8C0DA',
        boxShadow: active ? `0 2px 14px ${color}33` : undefined,
      }}
    >
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{
          background: color,
          boxShadow: active ? `0 0 6px ${color}` : undefined,
        }}
      />
      <span>{label}</span>
      {element && (
        <span
          className="rounded px-1 text-[9px]"
          style={{ color, background: `${color}16` }}
        >
          {element}
        </span>
      )}
    </button>
  );
}

/* ========================================================================== */

function BodyMeridianSvg({
  visible,
  selectedPointId,
  onSelectPoint,
}: {
  visible: Meridian[];
  selectedPointId: string | null;
  onSelectPoint: (p: Acupoint, meridianId: string) => void;
}) {
  return (
    <svg
      viewBox="0 0 360 680"
      className="h-[600px] w-auto"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="mBodySkin2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(24,26,34,0.8)" />
          <stop offset="100%" stopColor="rgba(14,16,22,0.95)" />
        </linearGradient>
        <linearGradient id="mBodyStroke2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(240,198,106,0.5)" />
          <stop offset="100%" stopColor="rgba(240,198,106,0.2)" />
        </linearGradient>
        <filter id="ptGlow2" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="2.5" />
        </filter>
        <filter id="lineGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.6" />
        </filter>
        <radialGradient id="bodyAura" cx="50%" cy="50%">
          <stop offset="0%" stopColor="rgba(52,211,153,0.18)" />
          <stop offset="60%" stopColor="rgba(52,211,153,0.04)" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
        <radialGradient id="crownGlow" cx="50%" cy="20%">
          <stop offset="0%" stopColor="rgba(240,198,106,0.25)" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
      </defs>

      {/* 呼吸的体周光晕 */}
      <ellipse cx="180" cy="340" rx="170" ry="320" fill="url(#bodyAura)">
        <animate
          attributeName="rx"
          values="160;180;160"
          dur="6s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="opacity"
          values="0.6;1;0.6"
          dur="6s"
          repeatCount="indefinite"
        />
      </ellipse>

      {/* 头顶金光（气冲百会） */}
      <ellipse cx="180" cy="62" rx="80" ry="30" fill="url(#crownGlow)" opacity="0.75" />

      {/* 太极图 watermark（右下角） */}
      <g transform="translate(310,620)" opacity="0.18">
        <circle r="28" fill="none" stroke="#F0C66A" strokeWidth="1" />
        <path
          d="M 0 -26 A 26 26 0 0 1 0 26 A 13 13 0 0 1 0 0 A 13 13 0 0 0 0 -26"
          fill="#F0C66A"
        />
        <circle cx="0" cy="-13" r="3" fill="#0a0704" />
        <circle cx="0" cy="13" r="3" fill="#F0C66A" />
      </g>

      {/* 背景格 */}
      <g opacity="0.07" stroke="#F0C66A" strokeWidth="0.5">
        {Array.from({ length: 14 }).map((_, i) => (
          <line key={`h${i}`} x1="0" x2="360" y1={i * 50} y2={i * 50} />
        ))}
      </g>

      {/* Body · same silhouette as organ atlas for coherence */}
      <g fill="url(#mBodySkin2)" stroke="url(#mBodyStroke2)" strokeWidth="1.2">
        <ellipse cx="180" cy="70" rx="40" ry="46" />
        <path d="M160 112 Q160 130 168 138 L192 138 Q200 130 200 112" />
        <path
          d="M110 145 Q135 135 160 138 L200 138 Q225 135 250 145
             Q278 160 286 200 L292 280
             Q288 340 276 390
             L262 460 Q256 510 266 560
             L272 620 L252 640 L238 645 L220 640
             Q210 595 206 550 L200 495 L190 480
             L180 478 L170 480 L160 495 L154 550
             Q150 595 140 640 L122 645 L108 640 L88 620
             L94 560 Q104 510 98 460
             L84 390 Q72 340 68 280 L74 200
             Q82 160 110 145 Z"
        />
        <path d="M110 145 L78 220 L60 320 L55 420 L60 460 L74 468" opacity="0.85" />
        <path d="M250 145 L282 220 L300 320 L305 420 L300 460 L286 468" opacity="0.85" />
      </g>

      {/* ======= Meridian lines ======= */}
      {visible.map((m) => (
        <g key={m.id} filter="url(#lineGlow)">
          {/* faint underlay */}
          <path
            d={m.path}
            fill="none"
            stroke={m.color}
            strokeWidth={4}
            opacity="0.12"
          />
          {/* main dashed line */}
          <path
            d={m.path}
            fill="none"
            stroke={m.color}
            strokeWidth={1.5}
            strokeDasharray="4 4"
            opacity="0.9"
          />
          {/* Animated flow dots */}
          <circle r="3" fill={m.color} opacity="0.95">
            <animateMotion dur="5s" repeatCount="indefinite" path={m.path} />
          </circle>
          <circle r="1.6" fill="#F5E9C9" opacity="0.9">
            <animateMotion dur="5s" repeatCount="indefinite" path={m.path} begin="-2s" />
          </circle>
        </g>
      ))}

      {/* ======= Acupoints ======= */}
      {visible.flatMap((m) =>
        m.points.map((p) => {
          const selected = selectedPointId === p.id;
          return (
            <g
              key={p.id}
              onClick={() => onSelectPoint(p, m.id)}
              style={{ cursor: 'pointer' }}
            >
              {/* Outer halo */}
              <circle
                cx={p.x}
                cy={p.y}
                r={selected ? 12 : 8}
                fill={m.color}
                opacity={selected ? 0.4 : 0.2}
                filter="url(#ptGlow2)"
              >
                {selected && (
                  <animate
                    attributeName="r"
                    values="10;16;10"
                    dur="2s"
                    repeatCount="indefinite"
                  />
                )}
              </circle>
              {/* Ring */}
              <circle
                cx={p.x}
                cy={p.y}
                r={selected ? 6 : 4.2}
                fill="none"
                stroke={m.color}
                strokeWidth={selected ? 1.4 : 0.8}
                opacity="0.95"
              />
              {/* Core */}
              <circle
                cx={p.x}
                cy={p.y}
                r={selected ? 3 : 2}
                fill="#F5E9C9"
              />
              {/* Label */}
              <text
                x={p.x + 10}
                y={p.y + 4}
                fontSize="12"
                fontWeight="700"
                fill="#F5E9C9"
                style={{
                  paintOrder: 'stroke',
                  stroke: 'rgba(0,0,0,0.9)',
                  strokeWidth: '3px',
                }}
              >
                {p.nameCn}
              </text>
              <text
                x={p.x + 10}
                y={p.y + 17}
                fontSize="9"
                fontFamily="monospace"
                fill={m.color}
                style={{
                  paintOrder: 'stroke',
                  stroke: 'rgba(0,0,0,0.85)',
                  strokeWidth: '2px',
                }}
              >
                {p.code}
              </text>
            </g>
          );
        }),
      )}

      {/* 任脉中线装饰 · 当选中任脉时更鲜艳 */}
    </svg>
  );
}

/* ========================================================================== */

function AcupointDetail({
  selected,
  meridian,
}: {
  selected: Acupoint | null;
  meridian: Meridian | null;
}) {
  if (!selected || !meridian) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-dashed border-white/10 bg-black/20 p-8 text-center">
        <div>
          <Hand size={22} className="mx-auto text-[#6A7299]" />
          <div className="mt-3 text-[13px] text-[#9AA3C4]">
            点击人体图上的任一穴位查看主治与按摩作用
          </div>
          <div className="mt-1 text-[11px] text-[#6A7299]">
            共 {MERIDIANS.flatMap((m) => m.points).length} 个常用穴位可查
          </div>
          <div className="mt-3 inline-flex rounded-full border border-[#B794F4]/40 bg-[#B794F4]/08 px-3 py-1 text-[10px] text-[#B794F4]">
            右侧太医面板已就位 · 选穴即匹配专家
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div
        className="rounded-2xl border p-4"
        style={{
          borderColor: `${meridian.color}55`,
          background: `linear-gradient(135deg, ${meridian.color}14, transparent 70%)`,
        }}
      >
        <div
          className="text-[10px] uppercase tracking-[0.22em]"
          style={{ color: meridian.color }}
        >
          {meridian.nameCn} · {meridian.element} 行
        </div>
        <div className="mt-1 flex items-baseline gap-3">
          <h4 className="text-[30px] font-semibold text-[#F5E9C9]">{selected.nameCn}</h4>
          <span
            className="font-mono text-[13px]"
            style={{ color: meridian.color }}
          >
            {selected.code}
          </span>
        </div>
        <div className="mt-2 text-[11px] text-[#9AA3C4]">{meridian.summary}</div>
      </div>

      <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-[#8F835F]">
          <Info size={11} style={{ color: HEALTH_ACCENT }} />
          主治功效
        </div>
        <div className="mt-2 text-[14px] font-semibold text-[#F5E9C9]">
          {selected.function}
        </div>
      </div>

      <div
        className="rounded-2xl border p-4"
        style={{
          borderColor: `${HEALTH_ACCENT}55`,
          background: `linear-gradient(135deg, ${HEALTH_ACCENT}12, transparent)`,
          boxShadow: `0 4px 20px ${HEALTH_ACCENT}12`,
        }}
      >
        <div
          className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em]"
          style={{ color: HEALTH_ACCENT }}
        >
          <Hand size={11} />
          按摩方法与作用
        </div>
        <div className="mt-2 text-[13px] leading-7 text-[#D6CCB0]">
          {selected.massage}
        </div>
      </div>

      <div
        className="flex items-center gap-2 rounded-xl border px-3 py-2 text-[11px] leading-6"
        style={{
          borderColor: `${HEALTH_ACCENT}44`,
          background: `${HEALTH_ACCENT}0d`,
          color: '#D6CCB0',
        }}
      >
        <Info size={11} style={{ color: HEALTH_ACCENT }} />
        右侧太医面板已匹配针灸/推拿专家，可一键挂号。
      </div>
    </div>
  );
}
