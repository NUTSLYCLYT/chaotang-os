'use client';

import { Suspense } from 'react';
import type { Task } from '@/types/task';
import type { AsyncState } from '@/types/async-state';
import { StateSwitch } from '@/components/ui/state-switch';
import { GlassPanel } from '@/components/ui/glass-panel';
import { useScribeFilters } from '../hooks/use-scribe-filters';
import { applyScribeFilters } from '@/lib/store/selectors/filtered-tasks';
import { ExpFilterBar } from './exp-filter-bar';
import { ArchiveTaskRow } from './archive-task-row';
import { useAppStore } from '@/lib/store/app-store';

interface ScribeArchive {
  tasks: Task[];
  runs: unknown[];
}

function FilteredArchiveInner({ archive }: { archive: AsyncState<ScribeArchive> }) {
  const { filters, setFilters, clearFilters, isActive } = useScribeFilters();
  const currentUserId = useAppStore((s) => s.currentUserId);

  return (
    <div className="space-y-4">
      <Suspense>
        <StateSwitch state={archive} minHeight={80}>
          {({ tasks }) => {
            const scoped = currentUserId
              ? tasks.filter((t) => !t.ownerUserId || t.ownerUserId === currentUserId)
              : tasks;
            const filtered = applyScribeFilters(scoped, filters);

            return (
              <>
                <ExpFilterBar
                  filters={filters}
                  onFiltersChange={setFilters}
                  onClear={clearFilters}
                  hitCount={filtered.length}
                  totalCount={scoped.length}
                />

                {filtered.length === 0 ? (
                  <GlassPanel tone="flat" padding="lg" className="text-center text-[12px] text-[#6A7299]">
                    {isActive
                      ? '没有匹配的历史任务，调整筛选条件试试'
                      : '复盘台尚无档案 — 待陛下下达首道密旨'}
                  </GlassPanel>
                ) : (
                  <div className="space-y-2">
                    {filtered.map((t) => (
                      <ArchiveTaskRow key={t.id} task={t} />
                    ))}
                  </div>
                )}
              </>
            );
          }}
        </StateSwitch>
      </Suspense>
    </div>
  );
}

export function FilteredArchiveTab({ archive }: { archive: AsyncState<ScribeArchive> }) {
  return (
    <Suspense fallback={
      <GlassPanel tone="flat" padding="lg" className="text-center text-[12px] text-[#6A7299]">
        翻阅卷宗...
      </GlassPanel>
    }>
      <FilteredArchiveInner archive={archive} />
    </Suspense>
  );
}
