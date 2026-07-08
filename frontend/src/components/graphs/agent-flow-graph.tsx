/**
 * AgentFlowGraph — 多 Agent 协同依赖图（真正的 DAG）
 *
 * 输入 subtasks + runs，通过层级拓扑排序自动布局，
 * 用 SVG 绘制节点与贝塞尔连线。
 *
 * 算法：
 * 1. 按 dependsOn 计算每个节点的 layer（最长路径法）
 * 2. 按 layer 分组，每组垂直居中排列
 * 3. 节点用 agent 主色调，状态影响边框和发光
 * 4. 边用贝塞尔曲线，依赖满足为金色，否则为灰虚线
 */

'use client';

import { useMemo } from 'react';
import { AGENT_META } from '@/types/agent';
import type { AgentCode, AgentRun, AgentState } from '@/types/agent';

export interface AgentFlowSubtask {
  id: string;
  description: string;
  assignedAgent: AgentCode;
  dependsOn: string[];
  priority: number;
}

export interface AgentFlowGraphProps {
  subtasks: AgentFlowSubtask[];
  runs?: AgentRun[];
  onNodeClick?: (subtaskId: string) => void;
  /** 画布宽度 */
  width?: number;
  /** 画布高度 */
  height?: number;
}

interface LaidOutNode {
  id: string;
  subtask: AgentFlowSubtask;
  run?: AgentRun;
  layer: number;
  row: number;
  x: number;
  y: number;
}

interface LaidOutEdge {
  from: LaidOutNode;
  to: LaidOutNode;
  satisfied: boolean;
}

const NODE_R = 26;
const LAYER_GAP = 190;
const ROW_GAP = 90;
const PADDING_X = 60;
const PADDING_Y = 60;

const STATE_COLOR: Record<AgentState, string> = {
  idle: '#6A7299',
  assigned: '#4A82F0',
  running: '#F0C66A',
  waiting_dependency: '#60A5FA',
  summarizing: '#6BA0FF',
  completed: '#3DD68C',
  failed: '#F43F5E',
  fallback_completed: '#F5A524',
  archived: '#484F72',
};

/* ==========================================================================
   Layout engine
   ========================================================================== */

function computeLayers(subtasks: AgentFlowSubtask[]): Map<string, number> {
  const layers = new Map<string, number>();
  const taskById = new Map(subtasks.map((s) => [s.id, s]));

  function getLayer(id: string, visiting = new Set<string>()): number {
    if (layers.has(id)) return layers.get(id)!;
    if (visiting.has(id)) return 0; // 循环依赖保护
    visiting.add(id);
    const task = taskById.get(id);
    if (!task || task.dependsOn.length === 0) {
      layers.set(id, 0);
      return 0;
    }
    const parentLayers = task.dependsOn
      .filter((d) => taskById.has(d))
      .map((d) => getLayer(d, visiting));
    const layer = parentLayers.length === 0 ? 0 : Math.max(...parentLayers) + 1;
    layers.set(id, layer);
    return layer;
  }

  for (const s of subtasks) getLayer(s.id);
  return layers;
}

function layoutNodes(
  subtasks: AgentFlowSubtask[],
  runs: AgentRun[] = [],
): { nodes: LaidOutNode[]; edges: LaidOutEdge[]; svgW: number; svgH: number } {
  if (subtasks.length === 0) {
    return { nodes: [], edges: [], svgW: 600, svgH: 300 };
  }

  const layers = computeLayers(subtasks);
  const runBySubtask = new Map(runs.map((r) => [r.subtaskId, r]));

  // group by layer
  const byLayer = new Map<number, AgentFlowSubtask[]>();
  for (const st of subtasks) {
    const layer = layers.get(st.id)!;
    const arr = byLayer.get(layer) ?? [];
    arr.push(st);
    byLayer.set(layer, arr);
  }

  const sortedLayers = [...byLayer.keys()].sort((a, b) => a - b);
  const maxRows = Math.max(...[...byLayer.values()].map((g) => g.length));
  const svgW = PADDING_X * 2 + (sortedLayers.length - 1) * LAYER_GAP + NODE_R * 4;
  const svgH = PADDING_Y * 2 + Math.max(1, maxRows - 1) * ROW_GAP + NODE_R * 2;
  const centerY = svgH / 2;

  const nodes: LaidOutNode[] = [];
  for (const layer of sortedLayers) {
    const group = byLayer.get(layer)!;
    const count = group.length;
    const layerX = PADDING_X + NODE_R + layer * LAYER_GAP;
    const groupStartY = centerY - ((count - 1) * ROW_GAP) / 2;
    group.forEach((st, i) => {
      nodes.push({
        id: st.id,
        subtask: st,
        run: runBySubtask.get(st.id),
        layer,
        row: i,
        x: layerX,
        y: groupStartY + i * ROW_GAP,
      });
    });
  }

  // edges
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const edges: LaidOutEdge[] = [];
  for (const node of nodes) {
    for (const parentId of node.subtask.dependsOn) {
      const parent = nodeById.get(parentId);
      if (!parent) continue;
      const parentRun = parent.run;
      const satisfied =
        parentRun?.state === 'completed' || parentRun?.state === 'fallback_completed';
      edges.push({ from: parent, to: node, satisfied });
    }
  }

  return { nodes, edges, svgW, svgH };
}

/* ==========================================================================
   Component
   ========================================================================== */

export function AgentFlowGraph({
  subtasks,
  runs = [],
  onNodeClick,
  width,
  height,
}: AgentFlowGraphProps) {
  const { nodes, edges, svgW, svgH } = useMemo(
    () => layoutNodes(subtasks, runs),
    [subtasks, runs],
  );

  if (subtasks.length === 0) {
    return (
      <div className="flex h-full min-h-[200px] items-center justify-center text-[11px] text-[#6A7299]">
        暂无子任务
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-auto">
      <svg
        width={width ?? svgW}
        height={height ?? svgH}
        viewBox={`0 0 ${svgW} ${svgH}`}
        className="block"
      >
        <defs>
          {/* 发光滤镜 */}
          <filter id="node-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* 金色线性渐变 */}
          <linearGradient id="edge-satisfied" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#F0C66A" stopOpacity="0.3" />
            <stop offset="50%" stopColor="#F0C66A" stopOpacity="1" />
            <stop offset="100%" stopColor="#F0C66A" stopOpacity="0.6" />
          </linearGradient>
          {/* 箭头 */}
          <marker
            id="arrow-gold"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#F0C66A" />
          </marker>
          <marker
            id="arrow-pending"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#6A7299" />
          </marker>
        </defs>

        {/* 淡背景栅格 */}
        <g opacity="0.15">
          {Array.from({ length: 20 }, (_, i) => (
            <line
              key={`h-${i}`}
              x1="0"
              y1={i * 40}
              x2={svgW}
              y2={i * 40}
              stroke="rgba(107, 160, 255, 0.1)"
              strokeWidth="0.5"
            />
          ))}
        </g>

        {/* 层级分隔线 */}
        {[...new Set(nodes.map((n) => n.layer))].map((layer) => {
          const x = PADDING_X + NODE_R + layer * LAYER_GAP;
          return (
            <g key={`layer-${layer}`}>
              <text
                x={x}
                y={26}
                fontSize="9"
                fontFamily="monospace"
                fill="rgba(154, 163, 196, 0.4)"
                textAnchor="middle"
              >
                LAYER {layer + 1}
              </text>
            </g>
          );
        })}

        {/* 边 */}
        <g>
          {edges.map((edge, i) => {
            const { from, to, satisfied } = edge;
            const dx = to.x - from.x;
            const midX = from.x + dx / 2;
            // 贝塞尔控制点
            const c1x = midX;
            const c1y = from.y;
            const c2x = midX;
            const c2y = to.y;
            const path = `M ${from.x + NODE_R} ${from.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${to.x - NODE_R} ${to.y}`;

            return (
              <path
                key={`edge-${i}`}
                d={path}
                fill="none"
                stroke={satisfied ? 'url(#edge-satisfied)' : '#6A7299'}
                strokeWidth={satisfied ? 2 : 1.2}
                strokeDasharray={satisfied ? '0' : '4 4'}
                markerEnd={satisfied ? 'url(#arrow-gold)' : 'url(#arrow-pending)'}
                opacity={satisfied ? 0.95 : 0.5}
              />
            );
          })}
        </g>

        {/* 节点 */}
        <g>
          {nodes.map((node) => {
            const meta = AGENT_META[node.subtask.assignedAgent];
            const state = node.run?.state ?? 'idle';
            const borderColor = STATE_COLOR[state];
            const isActive = state === 'running' || state === 'summarizing';
            const progressPct = node.run?.progressPct ?? 0;
            const progress = Math.max(0, Math.min(1, progressPct / 100));
            const circumference = 2 * Math.PI * (NODE_R - 2);

            return (
              <g
                key={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                className={onNodeClick ? 'cursor-pointer' : ''}
                onClick={() => onNodeClick?.(node.id)}
              >
                {/* 背景圆 */}
                <circle
                  r={NODE_R}
                  fill="rgba(10, 14, 30, 0.95)"
                  stroke="rgba(26, 33, 66, 0.8)"
                  strokeWidth="1"
                />
                {/* 进度圆弧 */}
                <circle
                  r={NODE_R - 2}
                  fill="none"
                  stroke={borderColor}
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={`${progress * circumference} ${circumference}`}
                  transform="rotate(-90)"
                  style={{
                    filter: isActive ? `drop-shadow(0 0 8px ${borderColor})` : undefined,
                    transition: 'stroke-dasharray 0.6s ease-out',
                  }}
                />
                {/* 呼吸光晕 */}
                {isActive && (
                  <circle
                    r={NODE_R + 6}
                    fill="none"
                    stroke={borderColor}
                    strokeWidth="1"
                    opacity="0.3"
                    className="animate-breathe"
                  />
                )}
                {/* Emoji */}
                <text
                  y="2"
                  fontSize="18"
                  textAnchor="middle"
                  dominantBaseline="central"
                >
                  {meta.emoji}
                </text>
                {/* 名称下方 */}
                <text
                  y={NODE_R + 16}
                  fontSize="10"
                  fontFamily="sans-serif"
                  fill={isActive ? borderColor : '#EAEEFB'}
                  textAnchor="middle"
                  fontWeight="500"
                >
                  {meta.nameCn}
                </text>
                {/* 进度 % */}
                {progressPct > 0 && progressPct < 100 && (
                  <text
                    y={NODE_R + 28}
                    fontSize="8"
                    fontFamily="monospace"
                    fill={borderColor}
                    textAnchor="middle"
                  >
                    {progressPct}%
                  </text>
                )}
                {progressPct === 100 && (
                  <text
                    y={NODE_R + 28}
                    fontSize="8"
                    fontFamily="monospace"
                    fill="#3DD68C"
                    textAnchor="middle"
                  >
                    ✓ 完成
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
