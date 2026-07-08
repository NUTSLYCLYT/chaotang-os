'use client';
import { useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type NodeProps,
  Position,
  Handle,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { FlowConfig, FlowStep } from '@/lib/jiqun-api';

interface Props {
  config: FlowConfig;
  /** 可选：当前运行高亮 — step_id → status (success/error/running/skipped) */
  stepStatus?: Record<string, string>;
}

const STATUS_BORDER: Record<string, string> = {
  success: 'rgba(61,214,140,0.6)',
  error: 'rgba(244,63,94,0.6)',
  running: 'rgba(212,168,75,0.7)',
  warning: 'rgba(245,165,36,0.6)',
  skipped: 'rgba(106,114,153,0.4)',
};

const STATUS_BG: Record<string, string> = {
  success: 'rgba(61,214,140,0.08)',
  error: 'rgba(244,63,94,0.08)',
  running: 'rgba(212,168,75,0.12)',
  warning: 'rgba(245,165,36,0.08)',
  skipped: 'rgba(26,33,66,0.6)',
};

interface StepNodeData extends Record<string, unknown> {
  step: FlowStep;
  status?: string;
}

function StepNode({ data }: NodeProps) {
  const { step, status } = data as StepNodeData;
  const border = STATUS_BORDER[status ?? ''] ?? 'rgba(212,168,75,0.4)';
  const bg = STATUS_BG[status ?? ''] ?? 'rgba(26,33,66,0.7)';
  return (
    <div
      style={{
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 12,
        padding: '10px 14px',
        minWidth: 180,
        maxWidth: 220,
        backdropFilter: 'blur(6px)',
        color: '#EAEEFB',
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: '#D4A84B', width: 6, height: 6 }} />
      <div style={{ fontSize: 11, color: '#9AA3C4', marginBottom: 2, fontFamily: 'var(--font-mono)' }}>{step.id}</div>
      <div style={{ fontSize: 13, fontWeight: 500, marginBottom: step.description ? 4 : 0 }}>{step.name}</div>
      {step.description && (
        <div style={{ fontSize: 11, color: '#6A7299', lineHeight: 1.4 }}>{step.description}</div>
      )}
      <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
        {step.model && (
          <span style={{ fontSize: 10, color: '#6BA0FF', background: 'rgba(74,130,240,0.12)', padding: '1px 6px', borderRadius: 4 }}>
            {step.model.split('/').pop()}
          </span>
        )}
        {step.step_type && (
          <span style={{ fontSize: 10, color: '#F0C66A', background: 'rgba(212,168,75,0.12)', padding: '1px 6px', borderRadius: 4 }}>
            {step.step_type}
          </span>
        )}
        {status && (
          <span
            style={{
              fontSize: 10,
              color: STATUS_BORDER[status] ?? '#9AA3C4',
              background: STATUS_BG[status] ?? 'rgba(106,114,153,0.15)',
              padding: '1px 6px',
              borderRadius: 4,
              marginLeft: 'auto',
            }}
          >
            {status}
          </span>
        )}
      </div>
      <Handle type="source" position={Position.Right} style={{ background: '#D4A84B', width: 6, height: 6 }} />
    </div>
  );
}

const NODE_TYPES = { step: StepNode };

export function JiqunFlowCanvas({ config, stepStatus }: Props) {
  const { nodes, edges } = useMemo(() => buildGraph(config, stepStatus), [config, stepStatus]);

  return (
    <div style={{ width: '100%', height: 480, borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(106,114,153,0.2)' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        fitView
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{
          style: { stroke: 'rgba(212,168,75,0.4)', strokeWidth: 1.5 },
        }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
      >
        <Background color="rgba(106,114,153,0.15)" gap={24} />
        <Controls
          style={{ background: 'rgba(26,33,66,0.8)', border: '1px solid rgba(212,168,75,0.3)' }}
          showInteractive={false}
        />
        <MiniMap
          style={{ background: 'rgba(13,16,40,0.9)', border: '1px solid rgba(212,168,75,0.2)' }}
          nodeColor={() => 'rgba(212,168,75,0.4)'}
          maskColor="rgba(13,16,40,0.6)"
        />
      </ReactFlow>
    </div>
  );
}

function buildGraph(config: FlowConfig, stepStatus?: Record<string, string>): { nodes: Node[]; edges: Edge[] } {
  const steps = config.steps ?? [];
  if (steps.length === 0) return { nodes: [], edges: [] };

  // Compute layout: simple layered DAG (level by max(parent.level)+1)
  const levelOf = new Map<string, number>();
  function getLevel(id: string, visiting = new Set<string>()): number {
    if (levelOf.has(id)) return levelOf.get(id)!;
    if (visiting.has(id)) return 0; // cycle guard
    visiting.add(id);
    const step = steps.find(s => s.id === id);
    if (!step) return 0;
    const deps = step.depends_on && step.depends_on.length > 0
      ? step.depends_on
      : (() => {
          const idx = steps.findIndex(s => s.id === id);
          return idx > 0 ? [steps[idx - 1].id] : [];
        })();
    if (deps.length === 0) {
      levelOf.set(id, 0);
      return 0;
    }
    const lvl = Math.max(...deps.map(d => getLevel(d, visiting))) + 1;
    levelOf.set(id, lvl);
    return lvl;
  }
  steps.forEach(s => getLevel(s.id));

  // group by level for vertical spacing
  const byLevel = new Map<number, FlowStep[]>();
  for (const step of steps) {
    const lvl = levelOf.get(step.id) ?? 0;
    if (!byLevel.has(lvl)) byLevel.set(lvl, []);
    byLevel.get(lvl)!.push(step);
  }

  const X_GAP = 280;
  const Y_GAP = 130;

  const nodes: Node[] = steps.map(step => {
    const lvl = levelOf.get(step.id) ?? 0;
    const sameLevel = byLevel.get(lvl) ?? [];
    const idxInLevel = sameLevel.indexOf(step);
    const yOffset = (idxInLevel - (sameLevel.length - 1) / 2) * Y_GAP;
    return {
      id: step.id,
      type: 'step',
      position: { x: lvl * X_GAP, y: yOffset },
      data: { step, status: stepStatus?.[step.id] },
    };
  });

  // Edges: explicit depends_on > implicit sequential
  const edges: Edge[] = [];
  steps.forEach((step, i) => {
    const deps = step.depends_on && step.depends_on.length > 0
      ? step.depends_on
      : (i > 0 ? [steps[i - 1].id] : []);
    deps.forEach(d => {
      edges.push({
        id: `${d}->${step.id}`,
        source: d,
        target: step.id,
        label: step.edge_labels?.[d],
        labelStyle: { fill: '#9AA3C4', fontSize: 10 },
        labelBgStyle: { fill: 'rgba(13,16,40,0.8)' },
      });
    });
    // visual back edges (for repair loops)
    step.visual_back_edges?.forEach(b => {
      edges.push({
        id: `back-${step.id}->${b.to}`,
        source: step.id,
        target: b.to,
        label: b.label ?? '回环',
        animated: true,
        style: { stroke: 'rgba(244,63,94,0.5)', strokeDasharray: '5 5', strokeWidth: 1.5 },
        labelStyle: { fill: '#F43F5E', fontSize: 10 },
        labelBgStyle: { fill: 'rgba(13,16,40,0.8)' },
      });
    });
  });

  return { nodes, edges };
}
