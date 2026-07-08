/**
 * 健康中心 · 总分圆盘 HERO
 *
 * 太医院视觉锚点：御医监护仪风格
 * - 外圈：进度圆弧（按 riskLevel 着色）
 * - 次外圈：刻度标记（每 10 分一格）
 * - 中心：大号数字 + 单位
 * - 四角：HUD 装饰
 */

'use client';

import { Heart, Clock, CheckCircle2, AlertTriangle, ShieldAlert, Flame } from 'lucide-react';
import type { HealthRiskLevel } from '@/types/health';

export interface HealthTotalScoreProps {
  score: number;
  riskLevel: HealthRiskLevel;
  subjectName: string;
  updatedAt: string;
}

const RISK_STYLE: Record<
  HealthRiskLevel,
  { label: string; color: string; glow: string; Icon: typeof Heart }
> = {
  normal: {
    label: '安康',
    color: '#3DD68C',
    glow: 'rgba(61, 214, 140, 0.4)',
    Icon: CheckCircle2,
  },
  watch: {
    label: '关注',
    color: '#F0C66A',
    glow: 'rgba(240, 198, 106, 0.4)',
    Icon: ShieldAlert,
  },
  warning: {
    label: '警戒',
    color: '#F5A524',
    glow: 'rgba(245, 165, 36, 0.45)',
    Icon: AlertTriangle,
  },
  danger: {
    label: '危急',
    color: '#F43F5E',
    glow: 'rgba(244, 63, 94, 0.5)',
    Icon: Flame,
  },
};

const SVG_SIZE = 320;
const CENTER = SVG_SIZE / 2;
const OUTER_R = 132;
const RING_R = 118;
const CIRCUMFERENCE = 2 * Math.PI * RING_R;

export function HealthTotalScore({
  score,
  riskLevel,
  subjectName,
  updatedAt,
}: HealthTotalScoreProps) {
  const style = RISK_STYLE[riskLevel];
  const Icon = style.Icon;
  const progress = Math.max(0, Math.min(100, score));
  const dashLength = (progress / 100) * CIRCUMFERENCE;

  return (
    <div
      className="relative flex h-full flex-col items-center justify-center overflow-hidden rounded-xl p-6"
      style={{
        background:
          'radial-gradient(ellipse at center, rgba(15, 20, 40, 0.9) 0%, rgba(4, 6, 14, 0.95) 80%)',
        border: `1px solid ${style.color}55`,
        boxShadow: `0 0 40px ${style.glow}, inset 0 1px 0 rgba(255, 255, 255, 0.04)`,
      }}
    >
      {/* HUD 角标 */}
      <CornerMarks color={style.color} />

      {/* 顶部 HUD */}
      <div className="absolute left-0 right-0 top-0 flex items-center justify-between px-4 pt-3 font-mono text-[9px] text-[#6A7299]">
        <span className="flex items-center gap-1 tracking-wider">
          <Heart size={9} className="text-[#34D399]" />
          TAI YI YUAN · VITAL MONITOR
        </span>
        <span className="flex items-center gap-1">
          <span className="h-1 w-1 animate-pulse rounded-full bg-[#3DD68C]" />
          LIVE
        </span>
      </div>

      {/* 主体 SVG 圆盘 */}
      <div className="relative my-2">
        <svg width={SVG_SIZE} height={SVG_SIZE} viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}>
          <defs>
            <linearGradient id="score-arc" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={style.color} stopOpacity="0.3" />
              <stop offset="50%" stopColor={style.color} stopOpacity="1" />
              <stop offset="100%" stopColor={style.color} stopOpacity="0.6" />
            </linearGradient>
            <radialGradient id="center-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={style.color} stopOpacity="0.15" />
              <stop offset="60%" stopColor={style.color} stopOpacity="0.04" />
              <stop offset="100%" stopColor={style.color} stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* 内部柔和光晕 */}
          <circle cx={CENTER} cy={CENTER} r={RING_R - 10} fill="url(#center-glow)" />

          {/* 外层装饰圈 */}
          <circle
            cx={CENTER}
            cy={CENTER}
            r={OUTER_R}
            fill="none"
            stroke="rgba(107, 160, 255, 0.15)"
            strokeWidth="0.8"
            strokeDasharray="2 4"
          />

          {/* 刻度（每 10 分一格） */}
          {Array.from({ length: 40 }, (_, i) => {
            const angle = (i / 40) * Math.PI * 2 - Math.PI / 2;
            const outer = OUTER_R - 4;
            const inner = i % 4 === 0 ? outer - 10 : outer - 5;
            const x1 = CENTER + Math.cos(angle) * outer;
            const y1 = CENTER + Math.sin(angle) * outer;
            const x2 = CENTER + Math.cos(angle) * inner;
            const y2 = CENTER + Math.sin(angle) * inner;
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={i % 4 === 0 ? style.color : 'rgba(107, 160, 255, 0.25)'}
                strokeWidth={i % 4 === 0 ? 1.2 : 0.6}
                opacity={i % 4 === 0 ? 0.8 : 0.4}
              />
            );
          })}

          {/* 刻度数字（0, 25, 50, 75） */}
          {[
            { label: '0', angle: -Math.PI / 2 },
            { label: '25', angle: 0 },
            { label: '50', angle: Math.PI / 2 },
            { label: '75', angle: Math.PI },
          ].map(({ label, angle }, i) => {
            const r = OUTER_R + 12;
            const x = CENTER + Math.cos(angle) * r;
            const y = CENTER + Math.sin(angle) * r;
            return (
              <text
                key={i}
                x={x}
                y={y}
                fontSize="9"
                fontFamily="monospace"
                fill="rgba(154, 163, 196, 0.5)"
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {label}
              </text>
            );
          })}

          {/* 背景轨道圆环 */}
          <circle
            cx={CENTER}
            cy={CENTER}
            r={RING_R}
            fill="none"
            stroke="rgba(26, 33, 66, 0.9)"
            strokeWidth="10"
          />

          {/* 进度弧 */}
          <circle
            cx={CENTER}
            cy={CENTER}
            r={RING_R}
            fill="none"
            stroke="url(#score-arc)"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${dashLength} ${CIRCUMFERENCE}`}
            transform={`rotate(-90 ${CENTER} ${CENTER})`}
            style={{
              filter: `drop-shadow(0 0 8px ${style.color})`,
              transition: 'stroke-dasharray 1.5s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          />

          {/* 进度末端光点 */}
          {(() => {
            const endAngle = (progress / 100) * Math.PI * 2 - Math.PI / 2;
            const x = CENTER + Math.cos(endAngle) * RING_R;
            const y = CENTER + Math.sin(endAngle) * RING_R;
            return (
              <circle
                cx={x}
                cy={y}
                r="5"
                fill={style.color}
                style={{ filter: `drop-shadow(0 0 8px ${style.color})` }}
              />
            );
          })()}

          {/* 中心大号分数 */}
          <text
            x={CENTER}
            y={CENTER - 6}
            fontSize="72"
            fontFamily="monospace"
            fontWeight="700"
            fill="#EAEEFB"
            textAnchor="middle"
            dominantBaseline="middle"
          >
            {score}
          </text>
          <text
            x={CENTER}
            y={CENTER + 38}
            fontSize="12"
            fontFamily="monospace"
            fill="#6A7299"
            textAnchor="middle"
          >
            / 100 VITAL SCORE
          </text>
        </svg>
      </div>

      {/* 底部状态栏 */}
      <div className="flex w-full items-center justify-between px-2">
        <div className="flex items-center gap-2">
          <Icon size={14} style={{ color: style.color }} />
          <div>
            <div className="text-[9px] uppercase tracking-wider text-[#6A7299]">状态</div>
            <div className="text-[13px] font-bold" style={{ color: style.color }}>
              {style.label}
            </div>
          </div>
        </div>

        <div className="text-right">
          <div className="text-[9px] uppercase tracking-wider text-[#6A7299]">监护对象</div>
          <div className="text-[13px] font-bold text-[#EAEEFB]">{subjectName}</div>
        </div>
      </div>

      {/* 最后更新时间 */}
      <div className="mt-3 flex items-center gap-1 font-mono text-[9px] text-[#484F72]">
        <Clock size={9} />
        更新于 {new Date(updatedAt).toLocaleString('zh-CN')}
      </div>
    </div>
  );
}

function CornerMarks({ color }: { color: string }) {
  return (
    <>
      {(['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const).map((pos) => (
        <div
          key={pos}
          className="pointer-events-none absolute h-3 w-3"
          style={{
            top: pos.startsWith('top') ? 8 : undefined,
            bottom: pos.startsWith('bottom') ? 8 : undefined,
            left: pos.endsWith('left') ? 8 : undefined,
            right: pos.endsWith('right') ? 8 : undefined,
            borderColor: color,
            borderWidth: '1.5px',
            borderStyle: 'solid',
            opacity: 0.8,
            borderTop: pos.startsWith('bottom') ? 'none' : undefined,
            borderBottom: pos.startsWith('top') ? 'none' : undefined,
            borderLeft: pos.endsWith('right') ? 'none' : undefined,
            borderRight: pos.endsWith('left') ? 'none' : undefined,
          }}
        />
      ))}
    </>
  );
}
