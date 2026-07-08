/**
 * DependencyPill — 依赖关系胶囊
 *
 * 展示 "A → B" 的依赖关系，用于 DAG 节点之间或子任务列表
 */

import { ArrowRight, Check, Clock } from 'lucide-react';

export interface DependencyPillProps {
  fromLabel: string;
  toLabel: string;
  satisfied: boolean;
  className?: string;
}

export function DependencyPill({
  fromLabel,
  toLabel,
  satisfied,
  className = '',
}: DependencyPillProps) {
  const color = satisfied ? '#3DD68C' : '#F0C66A';
  const Icon = satisfied ? Check : Clock;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] ${className}`}
      style={{
        borderColor: `${color}55`,
        backgroundColor: `${color}0f`,
        color,
      }}
    >
      <span className="font-medium">{fromLabel}</span>
      <ArrowRight size={9} />
      <span className="font-medium">{toLabel}</span>
      <Icon size={9} />
    </span>
  );
}
