'use client';
import { motion } from 'motion/react';

export interface TimelineStep {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'done' | 'error';
}

const STATUS_STYLE = {
  pending: { dot: '#2A2E42', text: '#4A5068', line: '#2A2E42' },
  active: { dot: '#F0C66A', text: '#F0C66A', line: '#F0C66A44' },
  done: { dot: '#3DD68C', text: '#9AA3C4', line: '#3DD68C44' },
  error: { dot: '#F43F5E', text: '#F43F5E', line: '#F43F5E44' },
};

interface Props {
  steps: TimelineStep[];
}

export function ExecutionTimeline({ steps }: Props) {
  return (
    <div className="flex items-center gap-0 overflow-x-auto py-2 px-1">
      {steps.map((step, idx) => {
        const s = STATUS_STYLE[step.status];
        const isLast = idx === steps.length - 1;
        return (
          <div key={step.id} className="flex items-center flex-shrink-0">
            <div className="flex flex-col items-center">
              <motion.div
                initial={{ scale: 0.6 }}
                animate={{ scale: step.status === 'active' ? [1, 1.2, 1] : 1 }}
                transition={{ repeat: step.status === 'active' ? Infinity : 0, duration: 1.0 }}
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: s.dot,
                  boxShadow: step.status === 'active' ? `0 0 8px ${s.dot}` : 'none',
                }}
              />
              <div
                style={{
                  fontSize: 9,
                  color: s.text,
                  marginTop: 4,
                  whiteSpace: 'nowrap',
                  maxWidth: 72,
                  textAlign: 'center',
                  lineHeight: 1.3,
                }}
              >
                {step.status === 'done' && '✓ '}
                {step.status === 'error' && '✗ '}
                {step.label}
              </div>
            </div>
            {!isLast && (
              <div
                style={{
                  width: 32,
                  height: 1,
                  background: s.line,
                  margin: '0 2px',
                  marginBottom: 16,
                  flexShrink: 0,
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/** 从 SSE 状态推导时间轴步骤列表 */
export function buildTimelineSteps(params: {
  hasDecree: boolean;
  hasCouncil: boolean;
  groupCount: number;
  aggregated: boolean;
  hasMemorial: boolean;
  streamStatus: string;
}): TimelineStep[] {
  const { hasDecree, hasCouncil, groupCount, aggregated, hasMemorial, streamStatus } = params;
  return [
    { id: 'decree', label: '下旨', status: hasDecree ? 'done' : 'pending' },
    {
      id: 'council',
      label: '大臣会审',
      status: hasDecree ? (hasCouncil ? 'done' : 'active') : 'pending',
    },
    {
      id: 'groups',
      label: `蜂群(${groupCount})`,
      status: hasCouncil ? (aggregated ? 'done' : 'active') : 'pending',
    },
    { id: 'aggregate', label: '汇总', status: aggregated ? 'done' : 'pending' },
    {
      id: 'memorial',
      label: '奏折',
      status: streamStatus === 'error' ? 'error' : hasMemorial ? 'done' : 'pending',
    },
  ];
}
