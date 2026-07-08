/**
 * 朝堂 OS V2 · 中央丞相状态环 · Prime Minister Hub
 *
 * 这是 DEMO-BIBLE.md §九 定义的核心视觉锚——客户回到办公室向同事
 * 描述 demo 时**唯一会画出来的画面**。
 *
 * 视觉构成：
 * - 中央 200×200 旋转金色光环（丞相中枢）
 * - 中心 prime_minister emoji
 * - 10 个部门 emoji 围绕中央按 36° 等分布在外环
 * - 每个部门有 4 态：待命 / 激活 / 工作中 / 完成
 * - 激活时金色光线从中央 drawn-line 到部门
 * - 工作中状态用 Pulse 呼吸光晕
 * - 整体氛围："星图 / 天文台 / 作战指挥室"
 *
 * 使用：
 *   <PrimeMinisterHub runsByCode={runsByCode} />
 *
 * 性能：
 * - 主体是 SVG，单层 compositor friendly
 * - 中央旋转用 CSS keyframes 而非 JS，零 jank
 * - 所有部门动画由 Pulse / DrawLine 驱动
 * - reduce-motion 时停止旋转，但保留 emoji 位置和状态色
 *
 * 归属：m8-demo / src/components/effects/
 */

'use client';

import { motion, useReducedMotion } from 'motion/react';
import type { AgentCode, AgentRun, AgentState } from '@/types/agent';
import { AGENT_META } from '@/types/agent';
import { Pulse } from './pulse';
import { DrawLine } from './draw-line';

/* ==========================================================================
   常量与几何
   ========================================================================== */

/** Hub 整体尺寸（正方形） */
const HUB_SIZE = 600;
/** 中央丞相节点半径 */
const CENTER_RADIUS = 56;
/** 部门节点半径 */
const NODE_RADIUS = 38;
/** 外环到中心的距离 */
const ORBIT_RADIUS = 220;
/** 中央光环半径（旋转的金圈） */
const RING_RADIUS = 100;

/** 在外环上排布的 10 个部门（prime_minister 在中央，scribe 也在中央旁，避免拥挤把它放外圈） */
const ORBIT_AGENTS: AgentCode[] = [
  'hu_bu',
  'gong_bu',
  'li_bu_rites',
  'bing_bu',
  'xing_bu',
  'li_bu',
  'jin_yi_wei',
  'qin_tian_jian',
  'tai_yi_yuan',
  'scribe',
];

/** 中央节点（不在外环） */
const CENTER_AGENT: AgentCode = 'prime_minister';

/** 外环每个 agent 的角度（顶部为 0°，顺时针） */
function agentAngle(index: number, total: number): number {
  // -90° 让第一个 agent 在 12 点位置
  return (index / total) * 2 * Math.PI - Math.PI / 2;
}

function agentPosition(index: number, total: number): { x: number; y: number } {
  const angle = agentAngle(index, total);
  return {
    x: HUB_SIZE / 2 + Math.cos(angle) * ORBIT_RADIUS,
    y: HUB_SIZE / 2 + Math.sin(angle) * ORBIT_RADIUS,
  };
}

/* ==========================================================================
   状态映射
   ========================================================================== */

type NodeVisualState = 'idle' | 'active' | 'working' | 'done' | 'error';

function mapAgentState(run: AgentRun | undefined): NodeVisualState {
  if (!run) return 'idle';
  switch (run.state) {
    case 'idle':
      return 'idle';
    case 'assigned':
      return 'active';
    case 'running':
    case 'summarizing':
      return 'working';
    case 'completed':
    case 'fallback_completed':
      return 'done';
    case 'failed':
      return 'error';
    default:
      return 'idle';
  }
}

const STATE_COLOR: Record<NodeVisualState, string> = {
  idle: '#484F72',
  active: '#F0C66A',
  working: '#F0C66A',
  done: '#3DD68C',
  error: '#F43F5E',
};

const STATE_BG: Record<NodeVisualState, string> = {
  idle: 'rgba(20, 26, 52, 0.7)',
  active: 'rgba(240, 198, 106, 0.12)',
  working: 'rgba(240, 198, 106, 0.18)',
  done: 'rgba(61, 214, 140, 0.15)',
  error: 'rgba(244, 63, 94, 0.18)',
};

/* ==========================================================================
   主组件
   ========================================================================== */

export interface PrimeMinisterHubProps {
  /** 各部门当前 run 状态，以 agentCode 为 key */
  runsByCode: Map<AgentCode, AgentRun>;
  /** 是否处于"调度中"——会让中央光环加速旋转 */
  dispatching?: boolean;
  /** Hub 渲染尺寸（px），默认 600 */
  size?: number;
  /** 容器额外 className */
  className?: string;
}

export function PrimeMinisterHub({
  runsByCode,
  dispatching = false,
  size = HUB_SIZE,
  className,
}: PrimeMinisterHubProps) {
  const reduce = useReducedMotion();
  const center = HUB_SIZE / 2;

  // 哪些部门处于 active/working/done → 需要画金线
  const activeOrbitAgents = ORBIT_AGENTS.map((code, i) => {
    const run = runsByCode.get(code);
    const visualState = mapAgentState(run);
    return { code, index: i, state: visualState, run };
  });

  return (
    <div
      className={`relative inline-block ${className ?? ''}`}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox={`0 0 ${HUB_SIZE} ${HUB_SIZE}`}
        width={size}
        height={size}
        style={{
          display: 'block',
          // SVG <text> 必须显式声明字体回退链：CJK 走 Noto Sans SC，
          // emoji 走系统 emoji 字体（macOS/Windows/Linux 通吃，避免 □ tofu）
          fontFamily:
            '"Noto Sans SC", "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Twemoji Mozilla", system-ui, sans-serif',
        }}
      >
        {/* ========== 背景网格（星图氛围） ========== */}
        <defs>
          <radialGradient id="hub-bg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(74, 130, 240, 0.08)" />
            <stop offset="60%" stopColor="rgba(20, 26, 52, 0.4)" />
            <stop offset="100%" stopColor="rgba(4, 6, 14, 0)" />
          </radialGradient>
          <radialGradient id="center-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(240, 198, 106, 0.45)" />
            <stop offset="50%" stopColor="rgba(240, 198, 106, 0.12)" />
            <stop offset="100%" stopColor="rgba(240, 198, 106, 0)" />
          </radialGradient>
          <filter id="ring-glow">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* 背景径向渐变 */}
        <circle cx={center} cy={center} r={ORBIT_RADIUS + 40} fill="url(#hub-bg)" />

        {/* 外环参考圈（淡） */}
        <circle
          cx={center}
          cy={center}
          r={ORBIT_RADIUS}
          fill="none"
          stroke="rgba(240, 198, 106, 0.08)"
          strokeWidth={1}
          strokeDasharray="2 6"
        />

        {/* 中央 glow */}
        <circle cx={center} cy={center} r={CENTER_RADIUS + 30} fill="url(#center-glow)" />

        {/* ========== 旋转金环 ========== */}
        {!reduce ? (
          <motion.g
            animate={{ rotate: 360 }}
            transition={{
              duration: dispatching ? 8 : 24,
              repeat: Infinity,
              ease: 'linear',
            }}
            style={{ originX: `${center}px`, originY: `${center}px` }}
          >
            <circle
              cx={center}
              cy={center}
              r={RING_RADIUS}
              fill="none"
              stroke="rgba(240, 198, 106, 0.5)"
              strokeWidth={1.5}
              strokeDasharray="2 8"
              filter="url(#ring-glow)"
            />
            {/* 4 个旋转标记点 */}
            {[0, 90, 180, 270].map((deg) => {
              const rad = (deg * Math.PI) / 180;
              return (
                <circle
                  key={deg}
                  cx={center + Math.cos(rad) * RING_RADIUS}
                  cy={center + Math.sin(rad) * RING_RADIUS}
                  r={2}
                  fill="#F0C66A"
                />
              );
            })}
          </motion.g>
        ) : (
          <circle
            cx={center}
            cy={center}
            r={RING_RADIUS}
            fill="none"
            stroke="rgba(240, 198, 106, 0.5)"
            strokeWidth={1.5}
            strokeDasharray="2 8"
          />
        )}

        {/* ========== 金线：从中央射向激活的部门 ==========
            关键：key 包含 state，让 idle→working→done 状态变化时 React 重新挂载
            DrawLine，触发金线/绿线的重新绘制动画。*/}
        {activeOrbitAgents
          .filter((a) => a.state !== 'idle')
          .map((a) => {
            const pos = agentPosition(a.index, ORBIT_AGENTS.length);
            const color =
              a.state === 'done' ? '#3DD68C' : a.state === 'error' ? '#F43F5E' : '#F0C66A';
            // 缩短线条避免穿透节点
            const dx = pos.x - center;
            const dy = pos.y - center;
            const len = Math.sqrt(dx * dx + dy * dy);
            const nx = dx / len;
            const ny = dy / len;
            const startX = center + nx * (CENTER_RADIUS + 4);
            const startY = center + ny * (CENTER_RADIUS + 4);
            const endX = pos.x - nx * (NODE_RADIUS + 4);
            const endY = pos.y - ny * (NODE_RADIUS + 4);
            return (
              <DrawLine
                key={`line-${a.code}-${a.state}`}
                from={{ x: startX, y: startY }}
                to={{ x: endX, y: endY }}
                color={color}
                strokeWidth={1.5}
                durationMs={900}
                delayMs={a.state === 'active' ? a.index * 80 : 0}
                glow
              />
            );
          })}

        {/* ========== 外环 10 个部门节点 ==========
            motion.circle 让 stroke / fill 颜色在状态变化时平滑过渡。
            状态变化时 scale 短暂放大，给一个"激活心跳"的视觉反馈。*/}
        {activeOrbitAgents.map((a) => {
          const pos = agentPosition(a.index, ORBIT_AGENTS.length);
          const meta = AGENT_META[a.code];
          return (
            <g key={a.code}>
              <motion.circle
                cx={pos.x}
                cy={pos.y}
                r={NODE_RADIUS}
                initial={{
                  fill: STATE_BG[a.state],
                  stroke: STATE_COLOR[a.state],
                  strokeWidth: a.state === 'idle' ? 1 : 2,
                  scale: 1,
                }}
                animate={{
                  fill: STATE_BG[a.state],
                  stroke: STATE_COLOR[a.state],
                  strokeWidth: a.state === 'idle' ? 1 : 2,
                  // 状态从 idle 跳出时短暂放大，再回到 1
                  scale: a.state === 'idle' ? 1 : [1, 1.08, 1],
                }}
                transition={{
                  fill: { duration: 0.4, ease: 'easeOut' },
                  stroke: { duration: 0.4, ease: 'easeOut' },
                  strokeWidth: { duration: 0.3 },
                  scale: { duration: 0.6, times: [0, 0.5, 1], ease: 'easeOut' },
                }}
                style={{
                  transformOrigin: `${pos.x}px ${pos.y}px`,
                  transformBox: 'fill-box',
                }}
              />
              <text
                x={pos.x}
                y={pos.y}
                fontSize={28}
                textAnchor="middle"
                dominantBaseline="central"
              >
                {meta.emoji}
              </text>
              <motion.text
                x={pos.x}
                y={pos.y + NODE_RADIUS + 16}
                fontSize={11}
                textAnchor="middle"
                fontWeight={500}
                animate={{ fill: STATE_COLOR[a.state] }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
              >
                {meta.nameCn}
              </motion.text>
            </g>
          );
        })}

        {/* ========== 中央丞相节点 ========== */}
        <circle
          cx={center}
          cy={center}
          r={CENTER_RADIUS}
          fill="rgba(20, 26, 52, 0.85)"
          stroke="#F0C66A"
          strokeWidth={2.5}
          filter="url(#ring-glow)"
        />
        <text
          x={center}
          y={center}
          fontSize={42}
          textAnchor="middle"
          dominantBaseline="central"
        >
          {AGENT_META[CENTER_AGENT].emoji}
        </text>
        <text
          x={center}
          y={center + CENTER_RADIUS + 18}
          fontSize={12}
          fill="#F0C66A"
          textAnchor="middle"
          fontWeight={600}
          letterSpacing={2}
        >
          {AGENT_META[CENTER_AGENT].nameCn}
        </text>
      </svg>

      {/* ========== Pulse overlay 给"working"状态的节点 ========== */}
      {/*
        SVG 内部不便用 box-shadow 做光晕，所以用绝对定位的 div + Pulse 叠加。
        每个 working 节点对应一个浮在 SVG 上方的 Pulse 圆盘。
      */}
      {activeOrbitAgents
        .filter((a) => a.state === 'working')
        .map((a) => {
          const pos = agentPosition(a.index, ORBIT_AGENTS.length);
          // 把 SVG 坐标按 size 缩放到容器坐标
          const scale = size / HUB_SIZE;
          return (
            <div
              key={`pulse-${a.code}`}
              className="pointer-events-none absolute"
              style={{
                left: pos.x * scale - NODE_RADIUS * scale,
                top: pos.y * scale - NODE_RADIUS * scale,
                width: NODE_RADIUS * 2 * scale,
                height: NODE_RADIUS * 2 * scale,
              }}
            >
              <Pulse color="#F0C66A" intensity="strong" periodMs={1800}>
                <div
                  className="rounded-full"
                  style={{
                    width: NODE_RADIUS * 2 * scale,
                    height: NODE_RADIUS * 2 * scale,
                  }}
                />
              </Pulse>
            </div>
          );
        })}
    </div>
  );
}
