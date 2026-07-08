'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronUp, Landmark, Maximize2, ScrollText, ShieldCheck } from 'lucide-react';
import useSWR from 'swr';
import { CourtStatusBadge } from '@/features/shared/components/court-workflow';
import {
  CHANCELLOR_SUMMARY_SYSTEM,
  DEPARTMENT_MEMORIAL_FORMAT,
  TRIAGE_LABEL,
  getDepartmentGovernance,
  type MemorialTriage,
  type MemorialUrgency,
} from '@/features/departments/lib/department-governance';
import { API_MODE, api } from '@/lib/api/client';
import type { Task, TaskStatus } from '@/lib/contracts/task';
import type { SwarmPriority } from '@/lib/contracts/swarm';

const URGENCY_STYLE: Record<MemorialUrgency, { color: string; bg: string; border: string }> = {
  急: { color: '#FCA5A5', bg: 'rgba(192,57,43,0.14)', border: 'rgba(192,57,43,0.38)' },
  要: { color: '#F5D28B', bg: 'rgba(240,198,106,0.11)', border: 'rgba(240,198,106,0.30)' },
  常: { color: '#B8CCFF', bg: 'rgba(107,160,255,0.08)', border: 'rgba(107,160,255,0.24)' },
};

const PRIORITY_STYLE: Record<SwarmPriority, { color: string; bg: string; border: string }> = {
  P0: { color: '#FCA5A5', bg: 'rgba(192,57,43,0.14)', border: 'rgba(192,57,43,0.38)' },
  P1: { color: '#F5D28B', bg: 'rgba(240,198,106,0.11)', border: 'rgba(240,198,106,0.30)' },
  P2: { color: '#B8CCFF', bg: 'rgba(107,160,255,0.08)', border: 'rgba(107,160,255,0.24)' },
};

const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  draft: '草稿',
  submitted: '已提交',
  interpreting: '释义中',
  planning: '规划中',
  assigned: '已分派',
  running: '进行中',
  aggregating: '汇总中',
  report_ready: '待圣裁',
  reviewed: '已批阅',
  archived: '已归档',
  failed: '失败',
};

const DEPT_KEYWORDS: Record<string, string[]> = {
  finance: ['hu_bu', 'hubu', '户部', '财务', '现金', '预算', '报价', '毛利', '融资', '回款', '成本'],
  hubu: ['hu_bu', 'hubu', '户部', '财务', '现金', '预算', '报价', '毛利', '融资', '回款', '成本'],
  market: ['li_bu', 'li_bu_rites', 'libu', '礼部', '品牌', '宣传', '公关', '舆情', '传播', '客户沟通', '内容', '口径'],
  libu: ['li_bu', 'li_bu_rites', 'libu', '礼部', '品牌', '宣传', '公关', '舆情', '传播', '客户沟通', '内容', '口径'],
  legal: ['xing_bu', 'xingbu', '刑部', '法务', '合同', '合规', '风险', '付款', '承诺', '授权', '安全'],
  ops: ['bing_bu', 'bingbu', '兵部', '销售', '客户', '商机', '渠道', '增长', '竞品', '成交', '漏斗'],
  bingbu: ['bing_bu', 'bingbu', '兵部', '销售', '客户', '商机', '渠道', '增长', '竞品', '成交', '漏斗'],
  gongbu: ['gong_bu', 'gongbu', '工部', '工程', '产品', '交付', '质量', '供应链', 'bom', '排期', '验收'],
  works: ['gong_bu', 'gongbu', '工部', '工程', '产品', '交付', '质量', '供应链', 'bom', '排期', '验收'],
  personnel: ['li_bu_hr', 'personnel', '吏部', '组织', '人事', '负责人', '绩效', '招聘', '编制', 'raci', '干部'],
  guard: ['jin_yi_wei', 'jinyiwei', '锦衣卫', '情报', '竞品', '核验', '证据', '审计', '外部信号', '异常'],
  physician: ['tai_yi', 'physician', '太医院', '健康', '可靠性', '告警', '观测', '修复', '系统', '故障'],
};

type RealMandate = {
  kind: 'task';
  id: string;
  title: string;
  priority: SwarmPriority;
  status: TaskStatus;
  nextStep?: string | null;
  owner?: string | null;
  updatedAt?: string;
};

type RuleMandate = {
  kind: 'rule';
  id: string;
  title: string;
  urgency: MemorialUrgency;
  triage: MemorialTriage;
  cadence: string;
  gate: string;
};

type DailyMandate = RealMandate | RuleMandate;

function toRuleMandate(item: {
  id: string;
  title: string;
  urgency: MemorialUrgency;
  triage: MemorialTriage;
  cadence: string;
  gate: string;
}): RuleMandate {
  return {
    kind: 'rule',
    id: item.id,
    title: item.title,
    urgency: item.urgency,
    triage: item.triage,
    cadence: item.cadence,
    gate: item.gate,
  };
}

function normalize(value: string | null | undefined) {
  return (value ?? '').toLowerCase();
}

function getDepartmentKeywords(deptCode: string | undefined, deptLabel: string, configLabel: string) {
  const codeWords = deptCode ? (DEPT_KEYWORDS[deptCode] ?? []) : [];
  return Array.from(new Set([deptCode ?? '', deptLabel, configLabel, ...codeWords].filter(Boolean)));
}

function taskMatchesDepartment(task: Task, keywords: string[]) {
  const haystack = [
    task.title,
    task.rawCommand,
    task.description,
    task.ownerUserId,
    task.plan?.intent,
    ...(task.plan?.assignedAgents ?? []),
    ...(task.plan?.assignedNodeIds ?? []),
  ].map(normalize).join(' ');
  return keywords.some((keyword) => haystack.includes(normalize(keyword)));
}

function taskPriority(status: TaskStatus): SwarmPriority {
  if (status === 'report_ready' || status === 'failed') return 'P0';
  if (status === 'running' || status === 'aggregating' || status === 'assigned') return 'P1';
  return 'P2';
}

function sortTasks(a: Task, b: Task) {
  const priorityRank: Record<SwarmPriority, number> = { P0: 0, P1: 1, P2: 2 };
  const pa = priorityRank[taskPriority(a.status)] ?? 9;
  const pb = priorityRank[taskPriority(b.status)] ?? 9;
  if (pa !== pb) return pa - pb;
  const ta = new Date(a.updatedAt ?? a.createdAt ?? 0).getTime();
  const tb = new Date(b.updatedAt ?? b.createdAt ?? 0).getTime();
  return tb - ta;
}

export function DepartmentWorkflowChip({
  deptLabel,
  deptCode,
  embedded = false,
}: {
  deptLabel: string;
  deptCode?: string;
  embedded?: boolean;
}) {
  const [expanded, setExpanded] = useState(embedded);
  const { data: tasks, error: tasksError, isLoading: tasksLoading } = useSWR<Task[], Error>(
    ['department-workflow-tasks', deptCode ?? deptLabel],
    () => api.tasks.list({ limit: 50 }),
    { refreshInterval: 30_000 },
  );
  const config = getDepartmentGovernance(deptCode, deptLabel);
  const realTasks = useMemo(() => {
    const keywords = getDepartmentKeywords(deptCode, deptLabel, config.label);
    return (tasks ?? [])
      .filter((task) => taskMatchesDepartment(task, keywords))
      .sort(sortTasks)
      .slice(0, 3);
  }, [tasks, config.label, deptCode, deptLabel]);
  const dailyMandates: DailyMandate[] = realTasks.length > 0
    ? realTasks.map((task) => ({
        kind: 'task' as const,
        id: task.id,
        title: task.title,
        priority: taskPriority(task.status),
        status: task.status,
        nextStep: task.description ?? task.rawCommand,
        owner: task.plan?.assignedAgents?.slice(0, 2).join('、') ?? task.ownerUserId,
        updatedAt: task.updatedAt,
      }))
    : config.memorials.slice(0, 3).map(toRuleMandate);
  const expandedMandates: DailyMandate[] = realTasks.length > 0
    ? dailyMandates
    : config.memorials.map(toRuleMandate);
  const sourceLabel = realTasks.length > 0
    ? API_MODE === 'mock' ? 'DEMO TASKS' : 'TASK_POOL'
    : tasksLoading ? 'SYNCING' : tasksError ? 'RULE_SEED' : 'RULE_SEED';
  const isExpanded = embedded || expanded;
  const openDepartmentScroll = () => {
    window.dispatchEvent(new CustomEvent('chaotang:open-department-scroll'));
    document
      .querySelector<HTMLButtonElement>('[data-chaotang-department-scroll-open]')
      ?.click();
  };

  return (
    <section
      className={
        embedded
          ? 'relative flex w-full flex-col gap-2'
          : 'pointer-events-auto absolute right-4 top-[82px] z-40 flex max-w-[calc(100%-32px)] flex-col items-end gap-2'
      }
    >
      <div
        data-three-axis-ornament="daily-edict"
        className={
          embedded
            ? 'relative flex w-full items-stretch overflow-hidden rounded-[12px] border border-[#F0C66A]/30 bg-[#05070d]/92 shadow-[0_18px_40px_rgba(0,0,0,0.34),inset_0_1px_0_rgba(246,233,201,0.08)] backdrop-blur-md'
            : 'relative flex w-[min(720px,calc(100vw-32px))] items-stretch overflow-hidden rounded-[8px] border border-[#F0C66A]/30 bg-[#05070d]/92 shadow-[0_20px_64px_rgba(0,0,0,0.50),inset_0_1px_0_rgba(246,233,201,0.08)] backdrop-blur-md'
        }
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.16]"
          style={{
            background:
              'repeating-linear-gradient(90deg, rgba(240,198,106,0.09) 0 1px, transparent 1px 28px), radial-gradient(circle at 18% 0%, rgba(240,198,106,0.20), transparent 34%)',
          }}
        />
        <span aria-hidden className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-[#F0C66A]/75 to-transparent" />
        {embedded ? (
          <div className="relative flex w-full flex-col gap-3 px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <CourtStatusBadge mode="MIXED" />
                  <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8F835F]">
                    今日三令
                  </span>
                  <span
                    className="rounded-full border px-1.5 py-0.5 text-[8.5px] font-semibold tracking-[0.12em]"
                    style={{
                      borderColor: realTasks.length > 0 ? 'rgba(61,214,140,0.36)' : 'rgba(240,198,106,0.24)',
                      color: realTasks.length > 0 ? '#BFD9BD' : '#D9C79A',
                      background: realTasks.length > 0 ? 'rgba(191,217,189,0.08)' : 'rgba(240,198,106,0.06)',
                    }}
                  >
                    {sourceLabel}
                  </span>
                </div>
                <div className="mt-2 font-serif text-[15px] font-bold text-[#F5E9C9]">
                  {config.label} · 负责人汇报
                </div>
                <div className="mt-1 text-[11px] leading-5 text-[#AEB7D4]">
                  {realTasks.length > 0
                    ? `右栏展示 ${realTasks.length} 条本部门真实待办，按优先级和更新时间排序。`
                    : '当前无命中任务，按本部门规则种子展示今日三令。'}
                </div>
              </div>
              <button
                type="button"
                onClick={openDepartmentScroll}
                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#F0C66A]/18 bg-[#F0C66A]/[0.05] px-2.5 py-1 text-[10px] font-semibold text-[#7EC8E3] transition hover:bg-[#F0C66A]/10"
                aria-label="打开部门案卷"
              >
                <Maximize2 size={12} />
                案卷
              </button>
            </div>
            <div className="space-y-1.5">
              {dailyMandates.map((item) => {
                const style = item.kind === 'task' ? PRIORITY_STYLE[item.priority] : URGENCY_STYLE[item.urgency];
                return (
                  <div
                    key={item.id}
                    className="rounded-lg border border-[#F0C66A]/14 bg-[#F0C66A]/[0.035] px-3 py-2"
                  >
                    <div className="flex items-start gap-2">
                      <span
                        className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border text-[9px] font-bold"
                        style={{ color: style.color, background: style.bg, borderColor: style.border }}
                      >
                        {item.kind === 'task' ? item.priority : item.urgency}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] font-semibold leading-5 text-[#DCE5FF]">
                          {item.title}
                        </div>
                        <div className="mt-1 text-[9.5px] leading-4 text-[#8F98B8]">
                          {item.kind === 'task'
                            ? `${TASK_STATUS_LABEL[item.status]} · ${item.owner ?? '未指派'}`
                            : `${item.cadence} · ${TRIAGE_LABEL[item.triage]}`}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              data-testid="department-workflow-summary"
              className="group grid min-w-0 flex-1 gap-2 px-3 py-2 text-left transition hover:bg-[#1a1308]/72 sm:grid-cols-[150px_minmax(0,1fr)]"
              aria-expanded={isExpanded}
              aria-label={isExpanded ? '收起今日三令详情' : '展开今日三令详情'}
            >
              <span className="min-w-0">
                <span className="flex items-center gap-2">
                  <CourtStatusBadge mode="MIXED" />
                  <span className="hidden text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8F835F] sm:inline">
                    今日三令
                  </span>
                  <span
                    className="hidden rounded-full border px-1.5 py-0.5 text-[8.5px] font-semibold tracking-[0.12em] md:inline"
                    style={{
                      borderColor: realTasks.length > 0 ? 'rgba(61,214,140,0.36)' : 'rgba(240,198,106,0.24)',
                      color: realTasks.length > 0 ? '#BFD9BD' : '#D9C79A',
                      background: realTasks.length > 0 ? 'rgba(191,217,189,0.08)' : 'rgba(240,198,106,0.06)',
                    }}
                  >
                    {sourceLabel}
                  </span>
                </span>
                <span className="mt-1 block truncate font-serif text-[13px] font-bold text-[#F5E9C9]">
                  {config.label} · 负责人汇报
                </span>
              </span>
              <span className="grid min-w-0 gap-1 sm:grid-cols-3">
                {dailyMandates.map((item) => {
                  const style = item.kind === 'task' ? PRIORITY_STYLE[item.priority] : URGENCY_STYLE[item.urgency];
                  return (
                    <span
                      key={item.id}
                      className="flex min-w-0 items-center gap-1.5 rounded-md border border-[#F0C66A]/14 bg-[#F0C66A]/[0.035] px-2 py-1"
                    >
                      <span
                        className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[9px] font-bold"
                        style={{ color: style.color, background: style.bg, borderColor: style.border }}
                      >
                        {item.kind === 'task' ? item.priority : item.urgency}
                      </span>
                      <span className="min-w-0 truncate text-[10px] font-semibold text-[#DCE5FF]" title={item.title}>
                        {item.title}
                      </span>
                    </span>
                  );
                })}
              </span>
            </button>
            <div className="relative flex shrink-0 border-l border-white/10">
              <button
                type="button"
                onClick={openDepartmentScroll}
                className="hidden w-[72px] flex-col items-center justify-center gap-1 border-r border-[#F0C66A]/14 text-[10px] font-semibold text-[#7EC8E3] transition hover:bg-[#F0C66A]/10 md:flex"
                aria-label="打开部门案卷"
              >
                <Maximize2 size={13} />
                案卷
              </button>
              <button
                type="button"
                onClick={() => setExpanded((value) => !value)}
                className="flex w-10 items-center justify-center text-[#F0C66A] transition hover:bg-[#F0C66A]/10"
                aria-label={isExpanded ? '收起今日三令详情按钮' : '展开今日三令详情按钮'}
              >
                {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            </div>
          </>
        )}
      </div>

      {isExpanded ? (
        <div
          data-testid="department-workflow-detail"
          className={
            embedded
              ? 'relative max-h-[520px] w-full overflow-y-auto rounded-[12px] border border-[#F0C66A]/24 bg-[#05070d]/94 px-4 py-3 shadow-[0_18px_40px_rgba(0,0,0,0.34),inset_0_1px_0_rgba(246,233,201,0.06)] backdrop-blur-md'
              : 'relative max-h-[calc(100vh-118px)] w-[min(760px,calc(100vw-32px))] overflow-y-auto rounded-[8px] border border-[#F0C66A]/24 bg-[#05070d]/94 px-4 py-3 shadow-[0_18px_60px_rgba(0,0,0,0.48),inset_0_1px_0_rgba(246,233,201,0.06)] backdrop-blur-md'
          }
        >
          <span aria-hidden className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-[#F0C66A]/50 to-transparent" />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-[#F5E9C9]">{config.label} · {config.office}</div>
              <div className="mt-1 text-[11px] leading-5 text-[#8A92AC]">
                {realTasks.length > 0
                  ? `已接入任务池：命中 ${realTasks.length} 件本部门真实待办，按优先级和更新时间排序。`
                  : `${config.mission} · 当前无命中任务，展示部门规则种子。`}
              </div>
            </div>
            <Link
              href="/shangshufang"
              className="shrink-0 rounded-full border border-[#F0C66A]/35 bg-[#F0C66A]/10 px-3 py-1.5 text-[11px] text-[#F0C66A]"
            >
              回上书房立案
            </Link>
          </div>
          <div className={embedded ? 'mt-3 grid gap-3' : 'mt-3 grid gap-3 lg:grid-cols-[minmax(0,1.05fr)_minmax(260px,0.95fr)]'}>
            <section className="rounded-lg border border-[#F0C66A]/16 bg-black/22 px-3 py-2" data-testid="department-memorial-queue">
              <div className="mb-2 flex items-center gap-2 text-[10px] tracking-[0.18em] text-[#8F835F]">
                <ScrollText size={12} className="text-[#F0C66A]/85" />
                {realTasks.length > 0 ? '真实任务池 · 今日必须推进' : '定期奏折 · 按紧急程度'}
              </div>
              <div className="space-y-1.5">
                {expandedMandates.map((item) => {
                  const style = item.kind === 'task' ? PRIORITY_STYLE[item.priority] : URGENCY_STYLE[item.urgency];
                  return (
                    <article key={item.title} className="rounded-md border border-[#F0C66A]/12 bg-[#F0C66A]/[0.025] px-2.5 py-2">
                      <div className={embedded ? 'flex min-w-0 flex-wrap items-start gap-1.5' : 'flex min-w-0 items-center gap-1.5'}>
                        <span
                          className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[9px] font-semibold"
                          style={{ color: style.color, background: style.bg, borderColor: style.border }}
                        >
                          {item.kind === 'task' ? item.priority : item.urgency}
                        </span>
                        <span className={embedded ? 'min-w-0 flex-1 text-[11px] font-semibold leading-5 text-[#EAEEFB]' : 'min-w-0 flex-1 truncate text-[11px] font-semibold text-[#EAEEFB]'}>
                          {item.title}
                        </span>
                        <span className="shrink-0 rounded bg-white/[0.04] px-1.5 py-0.5 text-[8.5px] text-[#8F98B8]">
                          {item.kind === 'task' ? TASK_STATUS_LABEL[item.status] : item.cadence}
                        </span>
                        <span className="shrink-0 rounded border border-[#F0C66A]/18 bg-[#F0C66A]/[0.05] px-1.5 py-0.5 text-[8.5px] text-[#D9C79A]">
                          {item.kind === 'task' ? (item.owner ?? '未指派') : TRIAGE_LABEL[item.triage]}
                        </span>
                      </div>
                      <div className={embedded ? 'mt-1 text-[9.5px] leading-4 text-[#AEB7D4]' : 'mt-1 line-clamp-1 text-[9.5px] text-[#AEB7D4]'}>
                        {item.kind === 'task'
                          ? `下一步：${item.nextStep ?? '等待负责人补充下一步'}`
                          : `质门：${item.gate}`}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>

            <div className="grid gap-3">
              <section className="rounded-lg border border-[#F0C66A]/16 bg-black/22 px-3 py-2" data-testid="chancellor-triage-rules">
                <div className="mb-1.5 flex items-center gap-2 text-[10px] tracking-[0.18em] text-[#8F835F]">
                  <ScrollText size={12} className="text-[#F0C66A]" />
                  丞相分流
                </div>
                <div className={embedded ? 'grid gap-1' : 'grid grid-cols-3 gap-1'}>
                  {CHANCELLOR_SUMMARY_SYSTEM.lanes.map((lane) => (
                    <div key={lane.id} className="rounded border border-[#F0C66A]/12 bg-[#F0C66A]/[0.025] px-1.5 py-1">
                      <div className={embedded ? 'text-[9.5px] font-semibold text-[#EAEEFB]' : 'truncate text-[9.5px] font-semibold text-[#EAEEFB]'}>{lane.title}</div>
                      <div className={embedded ? 'mt-0.5 text-[8.5px] leading-4 text-[#8F98B8]' : 'mt-0.5 truncate text-[8.5px] text-[#8F98B8]'}>{lane.label} · {lane.output}</div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-lg border border-[#7EC8E3]/14 bg-black/22 px-3 py-2" data-testid="department-bureaus">
                <div className="mb-2 flex items-center gap-2 text-[10px] tracking-[0.18em] text-[#8F835F]">
                  <Landmark size={12} className="text-[#6BA0FF]" />
                  各司分工
                </div>
                <div className="space-y-1">
                  {config.bureaus.map((bureau) => (
                    <div key={bureau.name} className="grid grid-cols-[58px_minmax(0,1fr)] gap-1 text-[9.5px] leading-4">
                      <div className="font-semibold text-[#D9C79A]">{bureau.name}</div>
                      <div className={embedded ? 'text-[#AEB7D4]' : 'truncate text-[#AEB7D4]'} title={`${bureau.role} · ${bureau.scope}`}>
                        {bureau.role} · {bureau.scope}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-lg border border-[#BFD9BD]/14 bg-black/22 px-3 py-2" data-testid="department-memorial-format">
                <div className="mb-1.5 flex items-center gap-2 text-[10px] tracking-[0.18em] text-[#8F835F]">
                  <ShieldCheck size={12} className="text-[#3DD68C]" />
                  统一奏折格式
                </div>
                <div className="text-[10px] leading-5 text-[#C6BB9D]">{DEPARTMENT_MEMORIAL_FORMAT}</div>
                <div className="mt-1.5 rounded border border-[#F43F5E]/18 bg-[#F43F5E]/[0.06] px-2 py-1.5 text-[9.5px] leading-4 text-[#E8B4A6]">
                  风险红线：{config.riskLine}
                </div>
              </section>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
