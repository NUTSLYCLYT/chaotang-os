'use client';

/** 工部 · 顶部态势条（M1）：任务总数/在办/已交付 + 数据源灯。 */
import { useGongbuTasks } from '@/features/gongbu/hooks/use-gongbu-tasks';

const ACTIVE = new Set(['running', 'submitted', 'planning', 'queued', 'in_progress']);
const DONE = new Set(['archived', 'completed', 'accepted']);

function Stat({ label, value, teal }: { label: string; value: string; teal?: boolean }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-[0.2em] text-[#7a8a82]">{label}</span>
      <span className={`mt-0.5 text-[16px] font-semibold ${teal ? 'text-[#9fe6c4]' : 'text-[#EAF3EE]'}`}>{value}</span>
    </div>
  );
}

export function GongbuSummaryHeader() {
  const { tasks, source } = useGongbuTasks();
  const active = tasks.filter((t) => ACTIVE.has(t.status)).length;
  const done = tasks.filter((t) => DONE.has(t.status)).length;
  const isLive = source === 'backend' || source === 'jiqun';
  return (
    <div className="flex items-center gap-6">
      <Stat label="建设任务" value={`${tasks.length}`} teal />
      <Stat label="在办" value={`${active}`} />
      <Stat label="已交付" value={`${done}`} />
      <span
        className="ml-2 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px]"
        style={{ borderColor: isLive ? '#5FB97A40' : '#E5B84D40', color: isLive ? '#5FB97A' : '#E5B84D' }}
      >
        <span className="inline-block h-2 w-2 rounded-full" style={{ background: isLive ? '#5FB97A' : '#E5B84D' }} />
        {isLive ? 'LIVE · 主库/后端 tasks' : '兜底 / 待接后端蜂群'}
      </span>
    </div>
  );
}
