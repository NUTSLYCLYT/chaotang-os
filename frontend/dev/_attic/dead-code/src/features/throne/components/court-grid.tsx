'use client';

/**
 * 朝堂全图 · 2×2 密度板
 *
 * 第二屏核心模块：把六部 / 十庄园 / 执行中任务 / 急报简讯 四个核心
 * 压成 2×2 小板块，所有入口一眼可见，简讯级信息即可。
 *
 * 数据源全部来自 throne/page.tsx 已拉取的四份数据，不新增 API。
 */

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { Task } from '@/types/task';
import type { IntelSignal } from '@/types/intel';
import type { AgentRun } from '@/types/agent';
import { MinistriesMini } from './court-grid/ministries-mini';
import { ManorsMini } from './court-grid/manors-mini';
import { TasksMini } from './court-grid/tasks-mini';
import { IntelMini } from './court-grid/intel-mini';

interface Props {
  tasks: Task[];
  signals: IntelSignal[];
  runs: AgentRun[];
}

export function CourtGrid({ tasks, signals, runs }: Props) {
  return (
    <section className="mt-6 grid gap-4 xl:grid-cols-2">
      <Panel
        eyebrow="Six Ministries · 六部当值"
        title="六部速览"
        more={{ href: '/departments', label: '进朝堂' }}
      >
        <MinistriesMini runs={runs} />
      </Panel>

      <Panel
        eyebrow="Ten Manors · 十庄园动静"
        title="庄园速览"
        more={{ href: '/manors', label: '巡按庄园' }}
      >
        <ManorsMini />
      </Panel>

      <Panel
        eyebrow="In-Flight · 办理中"
        title="执行中的旨意"
        more={{ href: '/command-center', label: '进军机处' }}
      >
        <TasksMini tasks={tasks} />
      </Panel>

      <Panel
        eyebrow="Dispatches · 急报与简讯"
        title="锦衣卫密报"
        more={{ href: '/intel', label: '进情报中心' }}
      >
        <IntelMini signals={signals} />
      </Panel>
    </section>
  );
}

function Panel({
  eyebrow,
  title,
  more,
  children,
}: {
  eyebrow: string;
  title: string;
  more: { href: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/6 bg-white/[0.03] px-4 py-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-[#8F835F]">{eyebrow}</div>
          <h3 className="mt-1.5 text-[15px] font-semibold leading-6 text-[#F5E9C9]">{title}</h3>
        </div>
        <Link
          href={more.href}
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[10px] text-[#C8CDD8] transition hover:border-[#F0C66A]/30 hover:text-[#F0C66A]"
        >
          {more.label}
          <ArrowRight size={10} />
        </Link>
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}
