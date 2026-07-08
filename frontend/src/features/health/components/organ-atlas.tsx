/**
 * 太医院 · 脏腑图谱 v2（专业版）
 *
 * 人体正面 SVG · 心肝脾肺肾专业绘制
 * - 呼吸/心跳脉动动画
 * - 每器官悬浮卡片 + 评分徽章
 * - 点击器官 → 触发 HealthFocus，右侧响应面板显示专家/医院
 * - 中西医并置解读嵌入器官卡
 */

'use client';

import { useState } from 'react';
import { Activity, Flower2, ChevronRight, Heart, Info } from 'lucide-react';
import { GlassPanel } from '@/components/ui/glass-panel';
import { ORGAN_ATLAS, STATUS_META, type OrganInfo, type OrganStatus } from '../lib/organs';
import { useHealthFocus } from './health-focus-context';

export function OrganAtlas() {
  const first = ORGAN_ATLAS[0]!;
  const { setFocus } = useHealthFocus();
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string>(first.id);
  const selected: OrganInfo = ORGAN_ATLAS.find((o) => o.id === selectedId) ?? first;

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setFocus({ kind: 'organ', organId: id });
  };

  const counts = {
    stable: ORGAN_ATLAS.filter((o) => o.status === 'stable').length,
    watch: ORGAN_ATLAS.filter((o) => o.status === 'watch').length,
    alert: ORGAN_ATLAS.filter((o) => o.status === 'alert').length,
  };

  return (
    <GlassPanel tone="elevated" padding="lg" className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 20% 0%, rgba(52,211,153,0.12), transparent 55%), radial-gradient(circle at 80% 100%, rgba(244,63,94,0.08), transparent 50%)',
        }}
      />

      <div className="relative mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div
            className="text-[10px] uppercase tracking-[0.25em]"
            style={{ color: '#34D399' }}
          >
            Organ Atlas · 脏腑图谱
          </div>
          <h3 className="mt-1 text-[22px] font-semibold text-[#F5E9C9]">
            五脏当前态势 · 点器官看详解
          </h3>
          <div className="mt-1 text-[12px] text-[#9AA3C4]">
            图中呼吸与心跳按真实节律动态可视；右侧面板自动匹配城市专家
          </div>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <StatusChip label="稳定" count={counts.stable} status="stable" />
          <StatusChip label="关注" count={counts.watch} status="watch" />
          <StatusChip label="预警" count={counts.alert} status="alert" />
        </div>
      </div>

      <div className="relative grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="relative flex justify-center rounded-2xl border border-white/8 bg-black/45 p-4">
          <BodySvg
            selectedId={selectedId}
            hoverId={hoverId}
            onSelect={handleSelect}
            onHover={setHoverId}
          />
        </div>

        <OrganDetail organ={selected} />
      </div>
    </GlassPanel>
  );
}

/* ========================================================================== */

function StatusChip({
  label,
  count,
  status,
}: {
  label: string;
  count: number;
  status: OrganStatus;
}) {
  const meta = STATUS_META[status];
  return (
    <div
      className="flex items-center gap-1.5 rounded-full px-2.5 py-1"
      style={{
        background: `${meta.color}14`,
        border: `1px solid ${meta.color}44`,
      }}
    >
      <span
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ background: meta.color, boxShadow: `0 0 6px ${meta.glow}` }}
      />
      <span style={{ color: meta.color }}>{label}</span>
      <span className="font-mono text-[12px] font-bold" style={{ color: meta.color }}>
        {count}
      </span>
    </div>
  );
}

/* ========================================================================== */

function BodySvg({
  selectedId,
  hoverId,
  onSelect,
  onHover,
}: {
  selectedId: string;
  hoverId: string | null;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}) {
  return (
    <svg
      viewBox="0 0 360 680"
      className="h-[580px] w-auto"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* 身体皮肤金线 */}
        <linearGradient id="bodySkin" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(24,26,34,0.85)" />
          <stop offset="100%" stopColor="rgba(14,16,22,0.95)" />
        </linearGradient>
        <linearGradient id="bodyStroke2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(240,198,106,0.45)" />
          <stop offset="100%" stopColor="rgba(240,198,106,0.15)" />
        </linearGradient>

        {/* 状态渐变 · 器官填色 */}
        {(['stable', 'watch', 'alert'] as OrganStatus[]).map((s) => {
          const color = STATUS_META[s].color;
          return (
            <radialGradient key={s} id={`orgV2-${s}`} cx="0.45" cy="0.35" r="0.75">
              <stop offset="0%" stopColor={color} stopOpacity="0.95" />
              <stop offset="45%" stopColor={color} stopOpacity="0.55" />
              <stop offset="100%" stopColor={color} stopOpacity="0.15" />
            </radialGradient>
          );
        })}

        {/* 柔光 */}
        <filter id="softGlow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="3" />
          <feComponentTransfer>
            <feFuncA type="linear" slope="1.2" />
          </feComponentTransfer>
        </filter>

        {/* 呼吸脉冲 */}
        <symbol id="breathPulse" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="20" fill="none" stroke="#34D399" strokeWidth="1">
            <animate attributeName="r" values="18;28;18" dur="4s" repeatCount="indefinite" />
            <animate
              attributeName="opacity"
              values="0.5;0;0.5"
              dur="4s"
              repeatCount="indefinite"
            />
          </circle>
        </symbol>

        {/* 任督二脉装饰 */}
        <linearGradient id="channelRen" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(240,198,106,0)" />
          <stop offset="50%" stopColor="rgba(240,198,106,0.55)" />
          <stop offset="100%" stopColor="rgba(240,198,106,0)" />
        </linearGradient>
      </defs>

      {/* 背景星河点缀 */}
      <g opacity="0.06" stroke="#F0C66A" strokeWidth="0.5">
        {Array.from({ length: 14 }).map((_, i) => (
          <line key={`h${i}`} x1="0" x2="360" y1={i * 50} y2={i * 50} />
        ))}
      </g>

      {/* 身体轮廓 · 写实简化 */}
      <g fill="url(#bodySkin)" stroke="url(#bodyStroke2)" strokeWidth="1.3">
        {/* Head */}
        <ellipse cx="180" cy="70" rx="40" ry="46" />
        {/* Neck */}
        <path d="M160 112 Q160 130 168 138 L192 138 Q200 130 200 112" />
        {/* Shoulders + torso */}
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
        {/* Arms - stylised */}
        <path
          d="M110 145 L78 220 L60 320 L55 420 L60 460 L74 468"
          opacity="0.85"
        />
        <path
          d="M250 145 L282 220 L300 320 L305 420 L300 460 L286 468"
          opacity="0.85"
        />
      </g>

      {/* 任脉中线（装饰光带） */}
      <rect x="178" y="140" width="4" height="330" fill="url(#channelRen)" opacity="0.65" />
      {/* 节点 */}
      {[180, 220, 270, 320, 380, 440].map((y, i) => (
        <circle key={i} cx="180" cy={y} r="2.4" fill="#F0C66A" opacity="0.8" />
      ))}

      {/* 肋骨感辅助线 */}
      <g opacity="0.25" stroke="#F0C66A" strokeWidth="0.6" fill="none">
        {[175, 195, 215, 235, 255].map((y) => (
          <path key={y} d={`M 130 ${y} Q 180 ${y - 10} 230 ${y}`} />
        ))}
      </g>

      {/* ========== Organs ========== */}

      {/* Lungs · 双肺（带支气管） */}
      <OrganShape
        id="lungs"
        selected={selectedId === 'lungs'}
        hover={hoverId === 'lungs'}
        status={findStatus('lungs')}
        onClick={onSelect}
        onHover={onHover}
        pulseDur="4s"
      >
        {/* Left lung */}
        <path d="M130 168 Q108 182 98 220 Q92 262 102 302 Q112 322 132 318 Q148 314 150 295 L152 180 Q148 168 138 166 Z" />
        {/* Right lung */}
        <path d="M230 168 Q252 182 262 220 Q268 262 258 302 Q248 322 228 318 Q212 314 210 295 L208 180 Q212 168 222 166 Z" />
        {/* Bronchi (white-ish lines) */}
        <path d="M180 175 L168 210 M180 175 L192 210 M168 210 L160 260 M192 210 L200 260" stroke="#F5E9C9" strokeWidth="0.8" fill="none" opacity="0.35" />
      </OrganShape>

      {/* Heart · 心 + 脉动 */}
      <OrganShape
        id="heart"
        selected={selectedId === 'heart'}
        hover={hoverId === 'heart'}
        status={findStatus('heart')}
        onClick={onSelect}
        onHover={onHover}
        pulseDur="0.9s"
      >
        <path
          d="M180 210
             C 158 188, 128 195, 133 225
             C 137 250, 165 280, 182 298
             C 200 280, 228 252, 232 225
             C 237 195, 205 188, 180 210 Z"
        />
        {/* 心音波形（装饰） */}
        <polyline
          points="148,240 160,240 166,228 174,258 184,220 194,260 206,240 220,240"
          fill="none"
          stroke="#F5E9C9"
          strokeWidth="0.8"
          opacity="0.45"
        />
      </OrganShape>

      {/* Liver · 肝（右上腹） */}
      <OrganShape
        id="liver"
        selected={selectedId === 'liver'}
        hover={hoverId === 'liver'}
        status={findStatus('liver')}
        onClick={onSelect}
        onHover={onHover}
        pulseDur="6s"
      >
        <path
          d="M176 318 Q208 304 248 312 Q268 322 264 350
             Q258 370 240 378 Q210 388 184 380
             Q170 374 168 356 Q166 332 176 318 Z"
        />
        {/* Hepatic vessel lines */}
        <path d="M210 345 L240 355 M200 360 L235 368" stroke="#F5E9C9" strokeWidth="0.6" fill="none" opacity="0.4" />
      </OrganShape>

      {/* Spleen · 脾（左上腹） */}
      <OrganShape
        id="spleen"
        selected={selectedId === 'spleen'}
        hover={hoverId === 'spleen'}
        status={findStatus('spleen')}
        onClick={onSelect}
        onHover={onHover}
        pulseDur="5s"
      >
        <path
          d="M130 330 Q115 336 112 358 Q114 378 126 384 Q142 386 150 376 Q156 360 152 346 Q148 332 140 330 Z"
        />
      </OrganShape>

      {/* Kidneys · 双肾 */}
      <OrganShape
        id="kidneys"
        selected={selectedId === 'kidneys'}
        hover={hoverId === 'kidneys'}
        status={findStatus('kidneys')}
        onClick={onSelect}
        onHover={onHover}
        pulseDur="5s"
      >
        <path d="M148 400 Q132 406 130 434 Q132 456 148 460 Q162 462 166 446 Q168 418 160 402 Q155 398 148 400 Z" />
        <path d="M212 400 Q197 398 192 412 Q190 440 196 456 Q208 464 220 460 Q234 456 234 434 Q232 406 216 400 Z" />
        {/* Ureters */}
        <path d="M152 460 Q160 485 170 510 M215 460 Q207 485 197 510" stroke="#F5E9C9" strokeWidth="0.6" fill="none" opacity="0.35" />
      </OrganShape>

      {/* Meridian decorative pulse lines */}
      <g opacity="0.32" fill="none" stroke="#34D399" strokeWidth="1" strokeDasharray="2 4">
        <path d="M180 240 Q100 290 72 420" />
        <path d="M180 240 Q260 290 290 420" />
        <path d="M180 420 Q180 500 178 600" />
      </g>

      {/* Organ labels · 引出线 */}
      <OrganLabel x={90}  y={185} tx={120} ty={220} nameCn="肺" score={74}  dir="left" />
      <OrganLabel x={270} y={185} tx={240} ty={220} nameCn="肺" score={74} dir="right" />
      <OrganLabel x={252} y={255} tx={220} ty={240} nameCn="心" score={86} dir="right" />
      <OrganLabel x={280} y={340} tx={250} ty={350} nameCn="肝" score={82} dir="right" />
      <OrganLabel x={80}  y={360} tx={118} ty={358} nameCn="脾" score={71} dir="left" />
      <OrganLabel x={80}  y={435} tx={140} ty={435} nameCn="肾" score={88} dir="left" />

      {/* 呼吸脉冲（肺） */}
      <use href="#breathPulse" x="110" y="210" width="80" height="80" />
      <use href="#breathPulse" x="210" y="210" width="80" height="80" />
    </svg>
  );
}

function findStatus(id: string): OrganStatus {
  return ORGAN_ATLAS.find((o) => o.id === id)?.status ?? 'stable';
}

function OrganShape({
  id,
  selected,
  hover,
  status,
  pulseDur,
  onClick,
  onHover,
  children,
}: {
  id: string;
  selected: boolean;
  hover: boolean;
  status: OrganStatus;
  pulseDur: string;
  onClick: (id: string) => void;
  onHover: (id: string | null) => void;
  children: React.ReactNode;
}) {
  const color = STATUS_META[status].color;
  return (
    <g
      onClick={() => onClick(id)}
      onMouseEnter={() => onHover(id)}
      onMouseLeave={() => onHover(null)}
      style={{ cursor: 'pointer' }}
      filter={selected || hover ? 'url(#softGlow)' : undefined}
    >
      <g
        fill={`url(#orgV2-${status})`}
        stroke={color}
        strokeWidth={selected ? 2 : hover ? 1.5 : 1}
        opacity={selected ? 1 : hover ? 0.92 : 0.78}
      >
        {children}
        {/* 常驻呼吸脉动（气血贯通） */}
        <animate
          attributeName="opacity"
          values={selected ? '0.88;1;0.88' : '0.72;0.88;0.72'}
          dur={pulseDur}
          repeatCount="indefinite"
        />
        {selected && (
          <animate
            attributeName="stroke-width"
            values="1.6;2.4;1.6"
            dur={pulseDur}
            repeatCount="indefinite"
          />
        )}
      </g>
    </g>
  );
}

function OrganLabel({
  x,
  y,
  tx,
  ty,
  nameCn,
  score,
  dir,
}: {
  x: number;
  y: number;
  tx: number;
  ty: number;
  nameCn: string;
  score: number;
  dir: 'left' | 'right';
}) {
  const anchor = dir === 'left' ? 'end' : 'start';
  return (
    <g>
      {/* Leader line */}
      <line
        x1={tx}
        y1={ty}
        x2={x}
        y2={y}
        stroke="rgba(240,198,106,0.35)"
        strokeWidth="0.8"
      />
      <circle cx={tx} cy={ty} r="2" fill="#F0C66A" />
      {/* Name */}
      <text
        x={x}
        y={y - 6}
        textAnchor={anchor}
        fontSize="15"
        fontWeight="700"
        fill="#F5E9C9"
        style={{
          paintOrder: 'stroke',
          stroke: 'rgba(0,0,0,0.75)',
          strokeWidth: '2.5px',
        }}
      >
        {nameCn}
      </text>
      {/* Score */}
      <text
        x={x}
        y={y + 7}
        textAnchor={anchor}
        fontSize="10"
        fontFamily="monospace"
        fill="#34D399"
        style={{
          paintOrder: 'stroke',
          stroke: 'rgba(0,0,0,0.75)',
          strokeWidth: '2px',
        }}
      >
        {score} pts
      </text>
    </g>
  );
}

/* ========================================================================== */

function OrganDetail({ organ }: { organ: OrganInfo }) {
  const meta = STATUS_META[organ.status];
  const HEALTH_ACCENT = '#34D399';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div
            className="text-[10px] uppercase tracking-[0.22em]"
            style={{ color: meta.color }}
          >
            {organ.nameEn}
          </div>
          <div className="mt-1 flex items-baseline gap-3">
            <h4 className="text-[32px] font-semibold text-[#F5E9C9]">{organ.nameCn}</h4>
            <div
              className="rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]"
              style={{
                background: `${meta.color}18`,
                color: meta.color,
                border: `1px solid ${meta.color}55`,
              }}
            >
              {meta.label}
            </div>
          </div>
        </div>
        <div
          className="rounded-2xl border px-4 py-3 text-center"
          style={{
            borderColor: `${meta.color}55`,
            background: `linear-gradient(135deg, ${meta.color}1a, ${meta.color}04)`,
            boxShadow: `0 4px 20px ${meta.color}18`,
          }}
        >
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#9AA3C4]">
            综合评分
          </div>
          <div
            className="mt-1 font-mono text-[32px] font-bold"
            style={{ color: meta.color }}
          >
            {organ.score}
          </div>
        </div>
      </div>

      {/* 中西医解读 */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <FunctionCard icon={Activity} color="#6BA0FF" title="现代医学" body={organ.functionWest} />
        <FunctionCard icon={Flower2} color="#F0C66A" title="中医视角" body={organ.functionTcm} />
      </div>

      {/* 关键指标 */}
      <div>
        <div className="mb-2 text-[10px] uppercase tracking-[0.22em] text-[#8F835F]">
          Key Metrics · 关键指标
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {organ.keyMetrics.map((m) => {
            const mm = STATUS_META[m.status];
            return (
              <div
                key={m.label}
                className="rounded-xl border bg-white/[0.02] p-3"
                style={{ borderColor: `${mm.color}33` }}
              >
                <div className="text-[10px] uppercase tracking-[0.18em] text-[#6A7299]">
                  {m.label}
                </div>
                <div
                  className="mt-1 font-mono text-[15px] font-semibold"
                  style={{ color: mm.color }}
                >
                  {m.value}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Cue to right panel */}
      <div
        className="flex items-center gap-2 rounded-xl border px-3 py-2 text-[11px] leading-6"
        style={{
          borderColor: `${HEALTH_ACCENT}44`,
          background: `${HEALTH_ACCENT}0d`,
          color: '#D6CCB0',
        }}
      >
        <Info size={11} style={{ color: HEALTH_ACCENT }} />
        右侧太医面板已自动匹配城市专家与挂号入口。
      </div>
    </div>
  );
}

function FunctionCard({
  icon: Icon,
  color,
  title,
  body,
}: {
  icon: typeof Activity;
  color: string;
  title: string;
  body: string;
}) {
  return (
    <div
      className="rounded-2xl border p-3.5"
      style={{
        borderColor: `${color}33`,
        background: `linear-gradient(135deg, ${color}10, transparent)`,
      }}
    >
      <div className="flex items-center gap-2">
        <div
          className="flex h-7 w-7 items-center justify-center rounded-lg"
          style={{ background: `${color}18`, border: `1px solid ${color}55` }}
        >
          <Icon size={13} style={{ color }} />
        </div>
        <div className="text-[11px] uppercase tracking-[0.2em]" style={{ color }}>
          {title}
        </div>
      </div>
      <p className="mt-2 text-[12px] leading-6 text-[#C8CDD8]">{body}</p>
    </div>
  );
}
