'use client';

/**
 * 工部 · 右栏 急事/在办进度/已交付（M1）
 * - 🔴 急事：触对外承诺/产线锁的任务（需亲裁/转后端）。🟢 真(从任务文本判)
 * - ⚙ 在办进度：status=在办 的任务 + **真 progressPct**。🟢 真(后端 tasks 自带进度)
 * - ✅ 已交付：status=完成/归档 的任务。🟢 真
 */
import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Hammer, Loader2 } from 'lucide-react';

import { useGongbuTasks } from '@/features/gongbu/hooks/use-gongbu-tasks';
import { evaluateTask, dedupeTasksByTitle } from '@/features/gongbu/lib/gongbu-engines';
import {
  readBuildLedger,
  subscribeBuildLedger,
  syncBuildLedgerFromServer,
  BUILD_LEDGER_STATUS_LABEL,
  type BuildLedgerEntry,
} from '@/features/operating-loop/lib/build-ledger';

const ACTIVE = new Set(['running', 'submitted', 'planning', 'queued', 'in_progress']);
const DONE = new Set(['archived', 'completed', 'accepted']);

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-[16px] border px-3.5 py-3" style={{ borderColor: '#7FC9A81f', background: 'linear-gradient(180deg,#7FC9A80d 0%,rgba(6,8,14,0.92) 100%)' }}>
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.16em] text-[#7a8a82]">{icon} {title}</div>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function short(s: string, n = 20): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

/**
 * 建设台账(2026-06-29 · 从军机处理顺迁来·见 docs/JUNJICHU-REFACTOR-PLAN.md)。
 * "建设"是工部的活,部门建设进度归工部办公厅,不混进军机处御前合议。读共享 SSOT(operating-loop/build-ledger)。
 */
function BuildLedgerSection() {
  const [ledger, setLedger] = useState<BuildLedgerEntry[]>([]);
  useEffect(() => {
    const refresh = () => setLedger(readBuildLedger());
    refresh();
    // 跨会话:合服务器台账进本地再刷(与 shangshufang/shiguan 消费者契约一致·会审建议补的)。
    void syncBuildLedgerFromServer().then(refresh).catch(() => {});
    return subscribeBuildLedger(refresh);
  }, []);
  const recent = ledger.slice(0, 5);
  return (
    <Section title={`建设台账${recent.length ? ` · ${ledger.length}` : ''}`} icon={<Hammer size={13} className="text-[#C9A87F]" />}>
      {recent.length === 0 ? (
        <p className="text-[11.5px] text-[#586a62]">暂无建设案在册。立案后从此追踪各部建设进度。</p>
      ) : (
        <ul className="space-y-1.5">
          {recent.map((e) => (
            <li key={e.id} className="flex items-center justify-between rounded-[8px] px-2 py-1.5 text-[12px]" style={{ background: '#C9A87F0c' }}>
              <span className="truncate text-[#cfe0d6]">{short(e.title)}</span>
              <span className="ml-1 shrink-0 text-[10px] text-[#b39a78]">{BUILD_LEDGER_STATUS_LABEL[e.status]}</span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

export function GongbuActivityRail() {
  const { tasks } = useGongbuTasks();
  const uniq = dedupeTasksByTitle(tasks); // 去重(高效简洁,与中栏/hero 同口径)
  const urgent = uniq.filter((t) => {
    const ev = evaluateTask(t);
    return ev.forbidden.length > 0 || ev.locks.length > 0;
  }).slice(0, 4);
  const active = uniq.filter((t) => ACTIVE.has(t.status)).slice(0, 5);
  const done = uniq.filter((t) => DONE.has(t.status)).slice(0, 4);

  return (
    <div className="flex flex-col gap-3 pr-0.5 xl:h-full xl:overflow-y-auto">
      <Section title={`急事${urgent.length ? ` · ${urgent.length}` : ''}`} icon={<AlertCircle size={13} className="text-[#E5604D]" />}>
        {urgent.length === 0 ? (
          <p className="text-[11.5px] text-[#586a62]">暂无触承诺/产线红线的急事。</p>
        ) : (
          <ul className="space-y-1.5">
            {urgent.map((t) => {
              const ev = evaluateTask(t);
              return (
                <li key={t.id} className="rounded-[8px] px-2 py-1.5 text-[12px]" style={{ background: '#E5604D0c' }}>
                  <span className="text-[#EAF3EE]">{short(t.title)}</span>
                  <span className="ml-1 text-[10px] text-[#c98a82]">{ev.forbidden.length ? '需亲裁' : '产线锁·转后端'}</span>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section title="在办进度" icon={<Loader2 size={13} className="text-[#7FC9A8]" />}>
        {active.length === 0 ? (
          <p className="text-[11.5px] text-[#586a62]">暂无在办任务。</p>
        ) : (
          <ul className="space-y-2">
            {active.map((t) => (
              <li key={t.id} className="text-[12px]">
                <div className="flex items-center justify-between">
                  <span className="truncate text-[#cfe0d6]">{short(t.title, 16)}</span>
                  <span className="ml-1 shrink-0 text-[10.5px] text-[#7a8a82]">{t.progressPct}%</span>
                </div>
                <div className="mt-0.5 h-1 w-full overflow-hidden rounded-full" style={{ background: '#ffffff10' }}>
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, t.progressPct)}%`, background: '#7FC9A8' }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="已交付" icon={<CheckCircle2 size={13} className="text-[#5FB97A]" />}>
        {done.length === 0 ? (
          <p className="text-[11.5px] text-[#586a62]">暂无已交付任务。</p>
        ) : (
          <ul className="space-y-1.5">
            {done.map((t) => (
              <li key={t.id} className="rounded-[8px] px-2 py-1.5 text-[12px] text-[#cfe0d6]" style={{ background: '#5FB97A0c' }}>{short(t.title)}</li>
            ))}
          </ul>
        )}
      </Section>

      <BuildLedgerSection />
    </div>
  );
}
