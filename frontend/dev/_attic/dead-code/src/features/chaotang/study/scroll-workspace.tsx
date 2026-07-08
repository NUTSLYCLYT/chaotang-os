'use client';

/**
 * StudyScrollWorkspace — 御案智能奏折台（中央卷轴）
 * 五个真实信息区：今日御览 / 待朱批事项 / 重要风险·事件 / 进行中任务 / 最近奏折
 * 所有按钮均为真按钮，带跳转或 toast 反馈。
 */

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Eye,
  Sparkles,
  ShieldAlert,
  Wand2,
  Send,
  Clock,
  Bell,
  FileText,
  MessageSquarePlus,
  Archive,
  ChevronDown,
  Cpu,
} from 'lucide-react';
import {
  todayImperialBriefingsMock as TODAY,
  pendingImperialVerdictsMock,
  criticalEventsMock,
  activeTasksMock,
  recentMemorialsMock,
  DEPT_COLOR,
  PRIORITY_META,
  STUDY_COPY,
  type VerdictItem,
} from '@/features/chaotang/mock/study.mock';
import { ScrollSection, ScrollSealBadge, ActionButton, DeptDot } from './scroll-primitives';

const GOLD = '#F0C66A';

/* helper: 查看奏折 → /reports/[id]，无则 toast */
function useReportNav() {
  const router = useRouter();
  return useCallback(
    (reportId: string | null, title: string) => {
      if (reportId) router.push(`/reports/${reportId}`);
      else toast('暂无对应奏折', { description: `「${title}」尚未生成正式奏折，可先让丞相拆解生成。` });
    },
    [router],
  );
}

export function StudyScrollWorkspace() {
  return (
    <div className="space-y-5">
      <TodayImperialBriefing />
      <PendingImperialVerdicts />
      <CriticalEventsPanel />
      <div className="grid gap-5 xl:grid-cols-2">
        <ActiveTasksPanel />
        <RecentMemorialsPanel />
      </div>
      <TechStatusCollapse />
    </div>
  );
}

/* ════════════ 1. 今日御览 ════════════ */
export function TodayImperialBriefing() {
  const router = useRouter();
  return (
    <ScrollSection title="今日御览" eyebrow={TODAY.updatedLabel} onViewAll={() => router.push('/overview')}>
      {/* KPI 四指标 */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {TODAY.metrics.map((m) => (
          <div
            key={m.key}
            className="rounded-xl border px-3 py-2.5 text-center"
            style={{ borderColor: 'rgba(240,198,106,0.16)', background: 'rgba(4,6,14,0.4)' }}
          >
            <div className="text-[11px] text-[#8A93B5]">{m.label}</div>
            <div className="display-serif mt-1 text-[24px] font-bold" style={{ color: GOLD }}>
              {m.value}
              <span className="ml-0.5 text-[12px] font-normal text-[#6A7299]">件</span>
            </div>
            <div
              className="mt-0.5 text-[10px]"
              style={{ color: m.deltaTone === 'up' ? '#3DD68C' : m.deltaTone === 'down' ? '#F5A524' : '#6A7299' }}
            >
              {m.deltaLabel}
            </div>
          </div>
        ))}
      </div>
      {/* 御览要点 */}
      <ul className="mt-3 divide-y" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
        {TODAY.items.map((it) => {
          const pr = PRIORITY_META[it.priority];
          return (
            <li key={it.id} className="group flex items-center gap-3 py-2.5" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
              <span
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-bold"
                style={{ color: pr.color, background: `${pr.color}1a`, border: `1px solid ${pr.color}55` }}
                title={`优先级 ${pr.label}`}
              >
                {pr.label}
              </span>
              <DeptDot name={it.dept} color={DEPT_COLOR[it.dept]} />
              <span className="min-w-0 flex-1 truncate text-[13px] text-[#EAEEFB]">{it.title}</span>
              <span className="hidden font-mono text-[10px] text-[#6A7299] sm:inline">{it.time}</span>
              <div className="flex shrink-0 gap-1.5 opacity-60 transition-opacity group-hover:opacity-100">
                <ActionButton variant="ghost" icon={<Eye size={12} />} onClick={() => toast('御览详情', { description: it.title })}>
                  查看详情
                </ActionButton>
                <ActionButton
                  variant="soft"
                  icon={<Sparkles size={12} />}
                  onClick={() => toast.success('已生成任务', { description: `「${it.title}」已交丞相拆解为可执行任务。` })}
                >
                  生成任务
                </ActionButton>
              </div>
            </li>
          );
        })}
      </ul>
    </ScrollSection>
  );
}

/* ════════════ 2. 待朱批事项 ════════════ */
type VerdictState = Record<string, 'pending' | 'approved' | 'rejected'>;

export function PendingImperialVerdicts() {
  const router = useRouter();
  const viewReport = useReportNav();
  const [state, setState] = useState<VerdictState>(() =>
    Object.fromEntries(pendingImperialVerdictsMock.map((v) => [v.id, 'pending'])),
  );

  const decide = useCallback((v: VerdictItem, decision: 'approved' | 'rejected') => {
    setState((s) => ({ ...s, [v.id]: decision }));
    if (decision === 'approved') toast.success(`已准奏 · ${v.title}`, { description: '朱批已盖印，旨意下达相关部门。' });
    else toast(`已驳回 · ${v.title}`, { description: '已退回重议，相关部门将重新呈报。' });
  }, []);

  const remaining = pendingImperialVerdictsMock.filter((v) => state[v.id] === 'pending');

  return (
    <div id="study-verdicts">
      <ScrollSection title="待朱批事项" count={`${remaining.length} 件待批`} onViewAll={() => router.push('/command-center')}>
        {remaining.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <div className="text-[13px] text-[#9AA3C4]">{STUDY_COPY.empty}</div>
            <ActionButton variant="gold" icon={<Send size={12} />} onClick={() => router.push('/throne/compose')}>
              直接下旨
            </ActionButton>
          </div>
        ) : (
          <div className="space-y-2.5">
            {pendingImperialVerdictsMock.map((v) => {
              const st = state[v.id];
              const decided = st !== 'pending';
              return (
                <div
                  key={v.id}
                  className="rounded-xl border p-3.5 transition"
                  style={{
                    borderColor: decided ? 'rgba(255,255,255,0.08)' : `${DEPT_COLOR[v.dept]}3a`,
                    background: decided ? 'rgba(255,255,255,0.015)' : `linear-gradient(120deg, ${DEPT_COLOR[v.dept]}10, transparent 60%), rgba(4,6,14,0.4)`,
                    opacity: decided ? 0.7 : 1,
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="display-serif text-[15px] font-bold text-[#F5E9C9]">{v.title}</span>
                        {st === 'approved' && <ScrollSealBadge label="已准奏" tone="approved" />}
                        {st === 'rejected' && <ScrollSealBadge label="已驳回" tone="rejected" />}
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-[11px]">
                        <DeptDot name={v.dept} color={DEPT_COLOR[v.dept]} />
                        <span style={{ color: v.urgency === '紧急' ? '#F43F5E' : '#F5A524' }}>· {v.urgency}</span>
                      </div>
                      <p className="mt-1.5 text-[12.5px] leading-relaxed text-[#9AA3C4]">{v.summary}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <ActionButton variant="gold" onClick={() => decide(v, 'approved')} disabled={decided} title="批准通过">
                      准奏
                    </ActionButton>
                    <ActionButton variant="danger" onClick={() => decide(v, 'rejected')} disabled={decided} title="退回重议">
                      驳回
                    </ActionButton>
                    <ActionButton
                      variant="ghost"
                      onClick={() => { toast('转交军机处会审', { description: '会审在「军机处」进行。' }); router.push('/grand-council'); }}
                    >
                      会审
                    </ActionButton>
                    <ActionButton variant="ghost" icon={<FileText size={12} />} onClick={() => viewReport(v.reportId, v.title)}>
                      查看奏折
                    </ActionButton>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollSection>
    </div>
  );
}

/* ════════════ 3. 重要风险 / 重要事件 ════════════ */
export function CriticalEventsPanel() {
  const router = useRouter();
  return (
    <ScrollSection title="重要风险 · 重要事件" accent="#F43F5E" count={`${criticalEventsMock.length} 项`} onViewAll={() => router.push('/intel')}>
      <div className="space-y-2.5">
        {criticalEventsMock.map((e) => {
          const pr = PRIORITY_META[e.level];
          return (
            <div
              key={e.id}
              className="group rounded-xl border p-3"
              style={{ borderColor: `${pr.color}33`, background: `linear-gradient(120deg, ${pr.color}0d, transparent 60%), rgba(4,6,14,0.4)` }}
            >
              <div className="flex items-center gap-2">
                <ShieldAlert size={13} style={{ color: pr.color }} />
                <span className="display-serif text-[14px] font-bold text-[#F5E9C9]">{e.title}</span>
                <span className="rounded px-1.5 py-0.5 text-[10px] font-bold" style={{ color: pr.color, background: `${pr.color}1a` }}>
                  {pr.label}
                </span>
                <span className="ml-auto font-mono text-[10px] text-[#6A7299]">{e.time}</span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <DeptDot name={e.dept} color={DEPT_COLOR[e.dept]} />
              </div>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-[#9AA3C4]">{e.desc}</p>
              <div className="mt-2.5 flex flex-wrap gap-2 opacity-60 transition-opacity group-hover:opacity-100">
                <ActionButton variant="soft" icon={<Wand2 size={12} />} onClick={() => toast('正在分析风险', { description: `丞相正研判「${e.title}」的成因与影响。` })}>
                  分析风险
                </ActionButton>
                <ActionButton variant="ghost" icon={<Sparkles size={12} />} onClick={() => toast.success('已生成应对方案', { description: '应对方案草案已呈，待陛下过目。' })}>
                  生成应对方案
                </ActionButton>
                <ActionButton variant="ghost" onClick={() => router.push('/grand-council')}>
                  转入军机处
                </ActionButton>
              </div>
            </div>
          );
        })}
      </div>
    </ScrollSection>
  );
}

/* ════════════ 4. 进行中任务 ════════════ */
export function ActiveTasksPanel() {
  const router = useRouter();
  return (
    <ScrollSection title="进行中任务" count={`${activeTasksMock.length} 个`} onViewAll={() => router.push('/command-center')}>
      <div className="space-y-3">
        {activeTasksMock.map((t) => {
          const pct = Math.round((t.done / t.total) * 100);
          return (
            <div key={t.id} className="group">
              <div className="flex items-center justify-between text-[13px]">
                <span className="font-medium text-[#EAEEFB]">{t.title}</span>
                <span className="font-mono text-[12px]" style={{ color: GOLD }}>
                  {t.done}/{t.total}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <div
                  className="h-full rounded-full"
                  style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #D4A84B, #F0C66A)' }}
                />
              </div>
              <div className="mt-1.5 flex items-center justify-between">
                <span className="text-[10px] text-[#6A7299]">承办 · {t.owner}</span>
                <div className="flex gap-1.5 opacity-60 transition-opacity group-hover:opacity-100">
                  <ActionButton variant="ghost" icon={<Eye size={11} />} onClick={() => toast('任务进度', { description: `${t.title}：已完成 ${t.done}/${t.total}` })}>
                    查看进度
                  </ActionButton>
                  <ActionButton variant="ghost" icon={<Bell size={11} />} onClick={() => toast.success('已催办', { description: `已知会 ${t.owner} 加紧办理「${t.title}」。` })}>
                    催办
                  </ActionButton>
                  <ActionButton variant="soft" icon={<FileText size={11} />} onClick={() => toast.success('已生成奏折', { description: `「${t.title}」进度奏折已呈。` })}>
                    生成奏折
                  </ActionButton>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </ScrollSection>
  );
}

/* ════════════ 5. 最近奏折 ════════════ */
export function RecentMemorialsPanel() {
  const router = useRouter();
  const viewReport = useReportNav();
  const [archived, setArchived] = useState<Record<string, boolean>>({});
  return (
    <ScrollSection title="最近奏折" count={`${recentMemorialsMock.length} 件`} onViewAll={() => router.push('/reports')}>
      <ul className="space-y-1">
        {recentMemorialsMock.map((m) => (
          <li
            key={m.id}
            className="group flex items-center gap-3 rounded-lg px-2 py-2 transition hover:bg-white/[0.03]"
            style={{ opacity: archived[m.id] ? 0.55 : 1 }}
          >
            <DeptDot name={m.dept} color={DEPT_COLOR[m.dept]} />
            <span className="min-w-0 flex-1 truncate text-[13px] text-[#EAEEFB]">{m.title}</span>
            <span
              className="hidden rounded px-1.5 py-0.5 text-[10px] sm:inline"
              style={{
                color: archived[m.id] ? '#6A7299' : m.status === '已批' ? '#3DD68C' : m.status === '待批' ? '#F5A524' : '#6BA0FF',
                background: 'rgba(255,255,255,0.04)',
              }}
            >
              {archived[m.id] ? '已归档' : m.status}
            </span>
            <span className="hidden font-mono text-[10px] text-[#6A7299] md:inline">{m.time}</span>
            <div className="flex shrink-0 gap-1.5 opacity-60 transition-opacity group-hover:opacity-100">
              <ActionButton variant="ghost" icon={<Eye size={11} />} onClick={() => viewReport(m.reportId, m.title)}>
                查看
              </ActionButton>
              <ActionButton variant="ghost" icon={<MessageSquarePlus size={11} />} onClick={() => router.push(`/throne/compose?seed=${encodeURIComponent('就「' + m.title + '」继续追问：')}`)}>
                继续追问
              </ActionButton>
              <ActionButton
                variant="ghost"
                icon={<Archive size={11} />}
                disabled={archived[m.id]}
                onClick={() => { setArchived((a) => ({ ...a, [m.id]: true })); toast('已归档', { description: m.title }); }}
              >
                归档
              </ActionButton>
            </div>
          </li>
        ))}
      </ul>
    </ScrollSection>
  );
}

/* ════════════ TechStatusCollapse — 折叠技术状态 ════════════ */
export function TechStatusCollapse() {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="overflow-hidden rounded-xl border"
      style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(4,6,14,0.4)' }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-2.5 text-[12px] text-[#9AA3C4] transition hover:text-[#C6CEE6]"
      >
        <span className="flex items-center gap-2">
          <Cpu size={13} className="text-[#6A7299]" />
          技术状态 · 数据链路
        </span>
        <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="grid grid-cols-2 gap-2 border-t px-4 py-3 text-[11px] sm:grid-cols-4" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          {[
            { k: '数据来源', v: '演示数据 (mock)', c: '#60A5FA' },
            { k: 'API 模式', v: 'local', c: '#60A5FA' },
            { k: '实时事件', v: '未连接', c: '#6A7299' },
            { k: 'AI 模型', v: 'Opus · 待配置', c: '#F0C66A' },
          ].map((r) => (
            <div key={r.k} className="flex flex-col">
              <span className="text-[#6A7299]">{r.k}</span>
              <span className="font-mono" style={{ color: r.c }}>{r.v}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
