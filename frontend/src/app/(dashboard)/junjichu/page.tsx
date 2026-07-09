'use client';

/**
 * 军机处 — 上书房式三轴案卷 + 真实 SSE 作战流骨架。
 *
 * 顶部导航由 (dashboard)/layout.tsx 的 ChaotangTopNav 统一提供；
 * 这里使用与上书房/六部详情一致的左栏、中央主卷、右栏三轴结构。
 *
 * 数据来源:
 *   - URL ?taskId=xxx → 从上书房/大殿 decreeDispatch 跳转带入
 *   - chaotang.taskDetail(taskId) → 任务详情（圣旨/意图/状态）
 *   - subscribeCourtStream(taskId) via BattleStream → SSE 实时拆解/会审/蜂群/奏折
 *
 * 设计原则: 无 taskId 时显示待接案主卷；有 taskId 时中央主卷与 BattleStream 同屏回写。
 */

import { Suspense, useCallback, useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Archive, FilePlus2, Landmark, ScrollText, Users } from 'lucide-react';
import { chaotang } from '@/lib/api/chaotang';
import { assetUrl } from '@/lib/asset';
import { ImperialButton } from '@/features/shangshufang/components/atoms';
import { BattleStream } from '@/features/command-center/BattleStream';
import type { MinisterRow, RiskBanner, GroupCard, MemorialSnapshot } from '@/features/command-center/BattleStream';
import type { CourtDialogueAction } from '@/features/court-shell';
import { EdictStage } from '@/features/shangshufang/components/MemorialScroll';
import { EDICT_SCROLL_THEME, type EdictView } from '@/features/shangshufang/edict-content';
import {
  ShangshufangLayoutShell,
  ShangshufangRailPanel,
} from '@/features/shared/components/shangshufang-layout-shell';
import { DepartmentWorkflowChip } from '@/features/departments/components/DepartmentWorkflowChip';
import { CaseSpine } from '@/features/shared/components/case-spine';
import type { CategorySelection } from '@/lib/contracts/decree';
import type { SourceLabel } from '@/core/courtos/types';
import { resolvePanelMode, type PanelMode } from './panel-mode';
import { runMinistryReview } from '@/core/courtos/ministries/ministry-review-loop.ts';
import { hubuEngineCard } from '@/features/hubu/lib/hubu-ministry-card';
import { gongbuEngineCard } from '@/features/gongbu/lib/gongbu-ministry-card';
import { runYushitaiAudit } from '@/core/courtos/ministries/yushitai-auditor.ts';
import { synthesizeImperialReport, type ImperialReport } from '@/core/courtos/ministries/imperial-report-synthesizer.ts';
import { MINISTRY_REGISTRY } from '@/core/courtos/ministries/ministry-registry.ts';
import type { MinistryId, MinistryReviewResult, YushitaiAuditResult } from '@/core/courtos/ministries/ministry-types.ts';
import { runCourtUnifiedDecisionLoop } from '@/core/courtos/unified/unified-decision-loop.ts';
import { buildUnifiedLoopViewModel, type UnifiedLoopViewModel } from '@/core/courtos/unified/unified-ui-adapter.ts';
import {
  shangshufangTaskDecision,
  shangshufangTaskStatus,
  type ShangshufangTaskStatusResponse,
} from '@/lib/jiqun-api';
import { CouncilView } from '@/features/command-center/views/CouncilView';
import { CasesView } from '@/features/command-center/views/CasesView';
import {
  BUILD_STATUS_LABEL,
  DEPARTMENT_BUILD_TASKS,
  type DepartmentBuildTask,
} from '@/features/operating-loop/lib/department-build-workflow';
import {
  // 建设台账显示侧(read/subscribe/assess/transition/drawer)已迁工部(2026-06-29 军机处理顺);
  // 此处只留建设案派发的写入(create→SSOT→工部展示)。
  persistBuildLedgerEntry,
  saveBuildLedgerEntry,
} from '@/features/operating-loop/lib/build-ledger';

const PANEL_BG = 'linear-gradient(180deg, rgba(8,18,25,0.78), rgba(5,10,16,0.58))';
const PANEL_BORDER = 'rgba(240,198,106,0.18)';
const PANEL_SHADOW = '0 14px 38px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.06)';
const COMMAND_CENTER_PANEL_CLASS = 'rounded-[8px] border border-[#F0C66A]/30 bg-black/30 px-3 py-3 shadow-[0_18px_46px_rgba(0,0,0,0.30)] backdrop-blur-md';
const COMMAND_CENTER_CARD_CLASS = 'rounded-[8px] border border-[#F0C66A]/24 bg-black/24 backdrop-blur-sm';

/** 任务概要（从 taskDetail 取 rawCommand/intent/status） */
interface TaskSummary {
  id: string;
  rawCommand?: string;
  intent?: string;
  status?: string;
  title?: string;
  runId?: string;
  source?: string;
  updatedAt?: string;
  decisionId?: string | number | null;
  jiqunSwarm?: CommandIntegrationSwarm | null;
  coverage?: CommandIntegrationCoverage | null;
}

interface CommandIntegrationSwarm {
  taskId?: string | null;
  sessionId?: string | null;
  entrySwarm?: string | null;
  streamUrl?: string | null;
  status?: number | string | null;
}

interface CommandIntegrationCoverage {
  responded: string[];
  absent: { dept: string; status: number; kind: string }[];
  realExpected: number;
  realResponded: number;
}

function commandCenterToEdict(input: {
  taskId: string | null;
  taskSummary: TaskSummary | null;
  ministers: MinisterRow[];
  risks: RiskBanner[];
  groups: GroupCard[];
  councilSummary?: string;
  memorial: MemorialSnapshot | null;
  ministryBrief: CommandCenterMinistryBrief | null;
}): EdictView {
  const { taskId, taskSummary, ministers, risks, groups, councilSummary, memorial, ministryBrief } = input;
  const hasTask = Boolean(taskId);
  const title = taskSummary?.title ?? taskSummary?.intent ?? taskSummary?.rawCommand ?? (hasTask ? '军机处已接案' : '军机处待接案');
  const sourceLabel = taskSummary?.source ?? ministryBrief?.review.sourceLabel ?? (hasTask ? 'MIXED' : 'DEMO');
  const riskText = risks.length
    ? risks.map((risk) => `${risk.level}：${risk.label}`).join('\n')
    : hasTask
      ? '风险尚未回写。'
      : '暂无真案风险；从上书房立案后由军机处会审生成。';
  const ministerText = ministers.length
    ? ministers.map((item) => `${item.name}：${item.opinion || item.status}`).join('\n')
    : hasTask
      ? '会审待召，尚无大臣表态。'
      : '待上书房发来一条可执行军令。';
  const groupText = groups.length
    ? groups.map((group) => `${group.name}：${group.status}${group.summary ? ` · ${group.summary}` : ''}`).join('\n')
    : hasTask
      ? '蜂群执行流尚未回写。'
      : '真案建立后，蜂群执行流会在中央沙盘展开。';

  return {
    id: `command-center:${taskId ?? 'empty'}`,
    title,
    subtitle: hasTask ? '军机处会审与执行主卷' : '请先从上书房立一条真案，军机处即接案作战。',
    headerKicker: 'JUNJICHU COMMAND',
    issuerLine: '军机处 · 上书房式会审主卷',
    question: taskSummary?.rawCommand ?? taskSummary?.intent ?? '等待圣意',
    seal: 'secret',
    meta: {
      accent: EDICT_SCROLL_THEME.junjichu.accent,
      accentSoft: EDICT_SCROLL_THEME.junjichu.accentSoft,
      reporter: '军机处',
      priority: risks.some((risk) => risk.level === 'high' || risk.level === 'critical') ? 'high' : 'medium',
      badges: [
        { label: sourceLabel, tone: sourceLabel.includes('LIVE') ? 'green' : 'amber' },
        { label: hasTask ? '已接案' : '待接案', tone: hasTask ? 'blue' : 'amber' },
        { label: `${ministers.length}部`, tone: 'blue' },
      ],
    },
    rows: [
      {
        label: '圣裁',
        body: hasTask
          ? '本案进入军机处：先看丞相拆解，再看六部会审、蜂群执行、风险封询和奏折回写。'
          : '尚未接入真案。请回上书房下旨，或携 taskId 进入军机处。',
      },
      { label: '原旨', body: taskSummary?.rawCommand ?? taskSummary?.intent ?? '等待上书房来旨。' },
      { label: '会审', body: ministerText },
      { label: '蜂群', body: groupText },
      { label: '风险', body: riskText },
      { label: '汇总', body: councilSummary ?? ministryBrief?.report.verdict ?? (memorial ? `奏折 ${memorial.memorialId ?? '已成稿'} · 质量 ${memorial.qualityScore ?? '待评'}` : '奏折尚未成稿。') },
      { label: '后令', body: ministryBrief?.report.nextAction ?? (hasTask ? '等待奏折成稿后送御前裁断与史馆归档。' : '回上书房立真案。') },
    ],
    sealDate: taskSummary?.updatedAt,
  };
}

interface CommandCenterMinistryBrief {
  review: MinistryReviewResult;
  audit: YushitaiAuditResult;
  report: ImperialReport;
  unified: UnifiedLoopViewModel;
  source: 'shangshufang' | 'stream' | 'demo';
}

interface BuildDraftContext {
  origin?: string | null;
  source?: string | null;
  suggestion?: string | null;
  evidence: string[];
  ministers: string[];
}

function parseListParam(value: string | null, separator: string) {
  return (value ?? '')
    .split(separator)
    .map((item) => item.trim())
    .filter(Boolean);
}

function contextLines(context: BuildDraftContext) {
  const lines: string[] = [];
  if (context.origin === 'shangshufang') lines.push('来源入口：上书房每日建议');
  if (context.origin === 'capability-debt') lines.push('来源入口：能力债务榜');
  if (context.suggestion) lines.push(`原始建议：${context.suggestion}`);
  if (context.source) lines.push(context.source);
  if (context.ministers.length) lines.push(`推荐会审：${context.ministers.join('、')}`);
  if (context.evidence.length) lines.push(`证据：${context.evidence.join('；')}`);
  return lines;
}

function commandWithContext(command: string, context: BuildDraftContext) {
  const lines = contextLines(context);
  if (lines.length === 0) return command;
  return `${command}\n\n【立项上下文】\n${lines.map((line) => `- ${line}`).join('\n')}`;
}

function commandCenterSourceTone(label: SourceLabel): string {
  if (label === 'LIVE' || label === 'LIVE_SWARM') return '#3DD68C';
  if (label === 'MIXED') return '#8AA4FF';
  if (label === 'DEMO') return '#F0C66A';
  return '#F58B8B';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function parseIntegrationSwarm(value: unknown): CommandIntegrationSwarm | null {
  if (!isRecord(value)) return null;
  const taskId = readText(value.taskId) ?? readText(value.task_id) ?? null;
  const sessionId = readText(value.sessionId) ?? readText(value.session_id) ?? null;
  const entrySwarm = readText(value.entrySwarm) ?? readText(value.entry_swarm) ?? null;
  const streamUrl = readText(value.streamUrl) ?? readText(value.stream_url) ?? null;
  const status = readNumber(value.status) ?? readText(value.status) ?? null;
  if (!taskId && !sessionId && !entrySwarm) return null;
  return { taskId, sessionId, entrySwarm, streamUrl, status };
}

function parseIntegrationCoverage(value: unknown): CommandIntegrationCoverage | null {
  if (!isRecord(value)) return null;
  const responded = Array.isArray(value.responded)
    ? value.responded.map((item) => readText(item)).filter((item): item is string => Boolean(item))
    : [];
  const absent = Array.isArray(value.absent)
    ? value.absent
        .filter(isRecord)
        .map((item) => ({
          dept: readText(item.dept) ?? 'unknown',
          status: readNumber(item.status) ?? 0,
          kind: readText(item.kind) ?? 'unknown',
        }))
    : [];
  const realExpected = readNumber(value.realExpected) ?? responded.length;
  const realResponded = readNumber(value.realResponded) ?? responded.length;
  if (responded.length === 0 && absent.length === 0 && realExpected === 0) return null;
  return { responded, absent, realExpected, realResponded };
}

/** 后端 result.merge 快照:真六部合议(各部真实回奏 + 主判 + 硬冲突)。上书房已消费,军机处此前没读。 */
interface MergeCouncilContributor {
  name: string;
  dept: string;
  answer: string;
}
interface MergeCouncilSnapshot {
  verdict: string;
  escalate: boolean;
  contributors: MergeCouncilContributor[];
  conflicts: string[];
}

function parseMergeCouncil(result: Record<string, unknown> | null | undefined): MergeCouncilSnapshot | null {
  const merge = result && isRecord(result.merge) ? result.merge : null;
  if (!merge) return null;
  const contributors = (Array.isArray(merge.contributors) ? merge.contributors : [])
    .filter(isRecord)
    .map((c) => ({
      name: readText(c.name) ?? readText(c.dept) ?? '某部',
      dept: readText(c.dept) ?? '',
      answer: readText(c.answer) ?? '',
    }))
    .filter((c) => c.answer);
  if (contributors.length === 0) return null;
  const conflicts = (Array.isArray(merge.conflicts) ? merge.conflicts : [])
    .filter(isRecord)
    .map((c) => readText(c.detail) ?? '')
    .filter(Boolean)
    .slice(0, 3);
  return { verdict: readText(merge.verdict) ?? '', escalate: merge.escalateToBoss === true, contributors, conflicts };
}

function pickTaskRecord(detail: Record<string, unknown>): Record<string, unknown> {
  return isRecord(detail.task) ? detail.task : detail;
}

function pickTaskResult(detail: Record<string, unknown>, taskRecord: Record<string, unknown>): Record<string, unknown> | null {
  if (isRecord(taskRecord.result)) return taskRecord.result;
  if (isRecord(detail.result)) return detail.result;
  return null;
}

function unifiedSignalTone(signal?: string): string {
  if (signal === 'GREEN') return '#3DD68C';
  if (signal === 'RED') return '#F58B8B';
  if (signal === 'YELLOW') return '#F0C66A';
  return '#8F9BB2';
}

function departmentReviewLabel(id: string): string {
  if (id === 'finance') return '户部';
  if (id === 'justice') return '刑部';
  if (id === 'ritual') return '礼部';
  if (id === 'war') return '兵部';
  if (id === 'personnel') return '吏部';
  if (id === 'jinyiwei') return '锦衣卫';
  return id;
}

function buildCommandCenterMinistryBrief(input: {
  taskId: string | null;
  taskIntent?: string | null;
  taskSummary: TaskSummary | null;
  ministers: MinisterRow[];
  risks: RiskBanner[];
  councilSummary?: string;
  shangshufangStatus: ShangshufangTaskStatusResponse | null;
}): CommandCenterMinistryBrief | null {
  const { taskId, taskIntent, taskSummary, ministers, risks, councilSummary, shangshufangStatus } = input;
  if (!taskId && !taskIntent?.trim()) return null;

  const localTaskId = taskId ?? `local_${Array.from(taskIntent ?? '').reduce((acc, char) => (acc * 33 + char.charCodeAt(0)) >>> 0, 5381).toString(36)}`;
  const shangTask = shangshufangStatus?.task;
  const shangMemorial = shangshufangStatus?.review?.memorial ?? null;
  const backendSwarmBrief = shangMemorial?.swarm_brief_for_junjichu;
  const streamEvidence = [
    ...ministers.map((item) => `${item.name}:${item.opinion || item.status}`),
    ...risks.map((item) => `${item.level}:${item.label}`),
  ];
  const originalQuestion =
    shangTask?.raw_question ||
    taskSummary?.rawCommand ||
    taskSummary?.intent ||
    taskSummary?.title ||
    taskIntent ||
    councilSummary ||
    localTaskId;
  const refinedIntent =
    shangTask?.draft_edict?.refined_edict ||
    shangMemorial?.summary ||
    councilSummary ||
    taskSummary?.intent ||
    originalQuestion;
  const evidenceSummary = [
    ...(shangTask?.known_facts ?? []),
    ...(shangTask?.unknown_gaps ?? []),
    ...(shangTask?.risk_flags ?? []),
    ...(shangMemorial?.evidence_gaps ?? []),
    ...(shangMemorial?.risk_flags ?? []),
    ...(backendSwarmBrief?.missing_evidence ?? []),
    ...(backendSwarmBrief?.risk_register ?? []).map((item) => JSON.stringify(item)),
    ...(backendSwarmBrief?.conflict_summary ?? []).map((item) =>
      typeof item === 'string' ? item : item.summary ?? JSON.stringify(item),
    ),
    ...streamEvidence,
  ].join('\n');
  // 诚实纪律(铁律13.2.3 · 禁假冒):无真来源标时,只有绑定了真案(taskId)才算 MIXED(真案但标注未全);
  // 没绑真案而仅有大臣/风险 = 关键词触发的罐头演示,必须老实标 DEMO,不得用 MIXED 谎称"半真"。
  // (与本页 hasTask→DEMO 判据一致,见 derivePanelMode。)
  const sourceLabel = (backendSwarmBrief?.source_label ?? shangTask?.source_label ?? (taskId ? 'MIXED' : 'DEMO')) as SourceLabel;
  // 断点B(一案穿堂)：户部若参审，其会审卡由真户部引擎 evaluateProject 直算，替掉通用 synth。
  // 与户部页手动算走同一个 evaluateProject(两入口一脑，见 hubu-ministry-card.nodetest.ts)。
  // 只传覆盖，是否真显示由 selectMinistries 决定；非预算类案不选户部则此卡被丢弃，无害。
  const review = runMinistryReview({
    taskId: localTaskId,
    originalQuestion,
    refinedIntent,
    evidenceSummary,
    sourceLabel,
    cardOverrides: {
      finance: hubuEngineCard(localTaskId, originalQuestion, sourceLabel),
      works: gongbuEngineCard(localTaskId, originalQuestion, sourceLabel),
    },
  });
  const audit = runYushitaiAudit({
    review,
    draftVerdict: shangMemorial?.verdict,
    draftSourceLabel: sourceLabel,
  });
  const report = synthesizeImperialReport({
    review,
    audit,
    evidence: shangTask?.known_facts ?? streamEvidence,
  });
  const unifiedResult = runCourtUnifiedDecisionLoop({
    taskId: localTaskId,
    rawQuestion: originalQuestion,
    sourceLabel,
  });
  const unified = buildUnifiedLoopViewModel(unifiedResult);
  if (backendSwarmBrief?.recommended_next_action) {
    report.nextAction = backendSwarmBrief.recommended_next_action;
  }
  if (backendSwarmBrief?.missing_evidence?.length) {
    report.missingEvidence = [...new Set([...report.missingEvidence, ...backendSwarmBrief.missing_evidence])];
  }
  report.missingEvidence = [...new Set([...report.missingEvidence, ...unified.evidenceGaps])];
  report.risks = [...new Set([...report.risks, ...unified.risks])];
  if (unified.qualityGateStatus === 'blocked' && audit.passed) {
    audit.passed = false;
    audit.blockingIssues = [...new Set([...audit.blockingIssues, '统一质门阻断：缺证、高风险或不可信来源未消解'])];
  }
  return {
    review,
    audit,
    report,
    unified,
    source: shangshufangStatus ? 'shangshufang' : ministers.length || risks.length ? 'stream' : 'demo',
  };
}

function isBusinessDecisionIntent(intent: string | null): boolean {
  return Boolean(intent?.trim()) && /客户|销售|报价|正式报价|合同|ROI|预算|竞品|交期|渠道/.test(intent ?? '');
}

function resolveBuildDraft(taskKey: string | null, intent: string | null, context: BuildDraftContext) {
  const buildTask = taskKey ? DEPARTMENT_BUILD_TASKS.find((item) => item.id === taskKey) ?? null : null;
  if (!buildTask && !intent) return null;
  return {
    buildTask,
    command: buildTask?.commandDraft ?? intent ?? '',
    dispatchCommand: commandWithContext(buildTask?.commandDraft ?? intent ?? '', context),
    title: buildTask?.title ?? '工部建设案',
    context,
  };
}

function BuildDraftPanel({
  buildTask,
  command,
  context,
  title,
  onDispatch,
  dispatching,
  error,
}: {
  buildTask: DepartmentBuildTask | null;
  command: string;
  context: BuildDraftContext;
  title: string;
  onDispatch: () => void;
  dispatching: boolean;
  error: string | null;
}) {
  return (
    <div
      aria-label="工部建设案草稿"
      style={{
        position: 'absolute',
        left: '23%',
        top: '8%',
        width: '52%',
        zIndex: 24,
        pointerEvents: 'auto',
        background: 'rgba(4,6,14,0.90)',
        border: '1px solid rgba(107,160,255,0.32)',
        borderRadius: 10,
        padding: 16,
        boxShadow: '0 18px 70px rgba(0,0,0,0.45)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 10, color: '#6BA0FF', letterSpacing: '0.24em', fontFamily: 'var(--font-serif)', textTransform: 'uppercase' }}>
            Gongbu Build Draft · 工部建设案
          </div>
          <h2 style={{ marginTop: 6, color: '#F5E9C9', fontSize: 20, lineHeight: 1.45, fontFamily: 'var(--font-serif)' }}>
            {title}
          </h2>
          <p style={{ marginTop: 8, color: '#B6BDD5', fontSize: 12, lineHeight: 1.8 }}>
            {command}
          </p>
        </div>
        {buildTask && (
          <span style={{
            flexShrink: 0,
            border: '1px solid rgba(240,198,106,0.35)',
            background: 'rgba(240,198,106,0.08)',
            color: '#F0C66A',
            borderRadius: 4,
            padding: '4px 8px',
            fontSize: 10,
          }}>
            {buildTask.priority} · {BUILD_STATUS_LABEL[buildTask.status]}
          </span>
        )}
      </div>

      {buildTask && (
        <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.035)', borderRadius: 6, padding: 10 }}>
            <div style={{ color: '#F5E9C9', fontSize: 12, fontWeight: 600 }}>验收标准</div>
            <ul style={{ margin: '8px 0 0', padding: 0, listStyle: 'none', display: 'grid', gap: 5 }}>
              {buildTask.acceptanceCriteria.slice(0, 4).map((item) => (
                <li key={item} style={{ color: '#9AA3C4', fontSize: 11, lineHeight: 1.55 }}>· {item}</li>
              ))}
            </ul>
          </div>
          <div style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.035)', borderRadius: 6, padding: 10 }}>
            <div style={{ color: '#F5E9C9', fontSize: 12, fontWeight: 600 }}>工部交付物</div>
            <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {buildTask.requiredPanels.slice(0, 6).map((panel) => (
                <span key={panel} style={{
                  border: '1px solid rgba(107,160,255,0.28)',
                  background: 'rgba(107,160,255,0.08)',
                  color: '#9FC1FF',
                  borderRadius: 4,
                  padding: '4px 7px',
                  fontSize: 10,
                }}>
                  {panel}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {contextLines(context).length > 0 && (
        <div style={{ marginTop: 12, border: '1px solid rgba(61,214,140,0.20)', background: 'rgba(61,214,140,0.055)', borderRadius: 6, padding: 10 }}>
          <div style={{ color: '#B9F6D2', fontSize: 12, fontWeight: 600 }}>上书房立项上下文</div>
          <ul style={{ margin: '8px 0 0', padding: 0, listStyle: 'none', display: 'grid', gap: 5 }}>
            {contextLines(context).slice(0, 6).map((item) => (
              <li key={item} style={{ color: '#B8C5CF', fontSize: 11, lineHeight: 1.55 }}>· {item}</li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <div style={{ marginTop: 10, color: '#F58B8B', fontSize: 11 }}>
          {error}
        </div>
      )}

      <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button
          type="button"
          onClick={onDispatch}
          disabled={dispatching || !command.trim()}
          style={{
            border: '1px solid rgba(240,198,106,0.48)',
            background: dispatching ? 'rgba(240,198,106,0.06)' : 'rgba(240,198,106,0.14)',
            color: '#F0C66A',
            borderRadius: 6,
            padding: '8px 12px',
            fontSize: 12,
            cursor: dispatching ? 'default' : 'pointer',
            opacity: dispatching ? 0.7 : 1,
          }}
        >
          {dispatching ? '立项中…' : '正式下旨立项'}
        </button>
        <Link href="/departments" style={{ border: '1px solid rgba(107,160,255,0.35)', color: '#9FC1FF', borderRadius: 6, padding: '8px 12px', fontSize: 12 }}>
          回工部
        </Link>
        <Link href="/departments" style={{ border: '1px solid rgba(240,198,106,0.28)', color: '#F0C66A', borderRadius: 6, padding: '8px 12px', fontSize: 12 }}>
          户部预算
        </Link>
        <Link href={buildTask?.archiveHref ?? '/archive'} style={{ border: '1px solid rgba(255,255,255,0.12)', color: '#C8CDD8', borderRadius: 6, padding: '8px 12px', fontSize: 12 }}>
          史馆归档
        </Link>
      </div>
    </div>
  );
}

function CommandPanel({
  title,
  children,
  style,
  compact,
  badge,
}: {
  title: string;
  children: ReactNode;
  style: CSSProperties;
  compact?: boolean;
  badge?: ReactNode;
}) {
  return (
    <section
      style={{
        position: 'relative',
        zIndex: 12,
        pointerEvents: 'auto',
        border: `1px solid ${PANEL_BORDER}`,
        borderRadius: 8,
        background: PANEL_BG,
        boxShadow: PANEL_SHADOW,
        backdropFilter: 'blur(9px)',
        overflowX: 'hidden',
        overflowY: 'auto',
        ...style,
      }}
    >
      <div style={{ padding: compact ? '9px 11px 8px' : '12px 14px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <h2
            style={{
              margin: 0,
              color: '#F0C66A',
              fontFamily: 'var(--font-serif)',
              fontSize: compact ? 15 : 19,
              lineHeight: 1.2,
              fontWeight: 700,
              letterSpacing: '0.08em',
            }}
          >
            {title}
          </h2>
          {badge !== undefined ? badge : <span style={{ color: '#66738D', fontSize: compact ? 10 : 12 }}>ⓘ</span>}
        </div>
        {children}
      </div>
    </section>
  );
}

/** 面板真链路四态判据见 ./panel-mode.ts（resolvePanelMode）；此处仅是各态的视觉样式。 */
const PANEL_MODE_STYLE: Record<PanelMode, { label: string; border: string; bg: string; color: string }> = {
  LIVE: { label: 'LIVE', border: 'rgba(61,214,140,0.34)', bg: 'rgba(61,214,140,0.10)', color: '#8BE4B4' },
  FALLBACK: { label: 'FALLBACK', border: 'rgba(245,139,139,0.32)', bg: 'rgba(245,139,139,0.09)', color: '#F0A98B' },
  PENDING: { label: '待回写', border: 'rgba(240,198,106,0.32)', bg: 'rgba(240,198,106,0.09)', color: '#F0C66A' },
  DEMO: { label: 'DEMO', border: 'rgba(143,155,178,0.34)', bg: 'rgba(143,155,178,0.10)', color: '#9AA3C4' },
};

function PanelModeBadge({ mode }: { mode: PanelMode }) {
  const s = PANEL_MODE_STYLE[mode] ?? PANEL_MODE_STYLE.PENDING;
  return (
    <span
      style={{
        border: `1px solid ${s.border}`,
        background: s.bg,
        color: s.color,
        borderRadius: 999,
        padding: '3px 8px',
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}
    >
      {s.label}
    </span>
  );
}

function panelModeBadge(mode: PanelMode): ReactNode {
  return mode === 'DEMO' ? null : <PanelModeBadge mode={mode} />;
}

/** PENDING 态统一占位：诚实说明「已接案，作战流尚未回写本面板」 */
function PendingHint({ text }: { text: string }) {
  return (
    <div
      style={{
        marginTop: 10,
        borderRadius: 7,
        border: '1px dashed rgba(240,198,106,0.26)',
        background: 'rgba(240,198,106,0.035)',
        padding: '11px 13px',
        color: '#B6AB8C',
        fontSize: 16,
        lineHeight: 1.65,
      }}
    >
      {text}
    </div>
  );
}

function DecreePanel({ taskSummary, hasTask }: { taskSummary: TaskSummary | null; hasTask: boolean }) {
  const realDecree = taskSummary?.rawCommand?.trim() || taskSummary?.intent?.trim() || '';
  const mode = resolvePanelMode(hasTask, Boolean(realDecree));
  const DEMO_DECREE = '建设西南新城，贯通商路，开拓三省商贸相通，三年内以农牧、务农民安坤兴、战役储备。';
  
  return (
    <CommandPanel 
      title="圣旨原文" 
      style={{ position: 'relative', height: 'auto', flex: '0 0 auto' }} 
      badge={panelModeBadge(mode)}
    >
      {mode === 'PENDING' ? (
        <PendingHint text="已接案，正在加载圣旨原文…" />
      ) : (
        <div style={{ marginTop: 10, borderRadius: 7, background: 'rgba(2,12,18,0.28)', border: '1px solid rgba(255,255,255,0.04)', padding: '11px 13px' }}>
          <p style={{ margin: 0, color: '#C8D0D8', fontFamily: 'var(--font-serif)', fontSize: 14, lineHeight: 1.85 }}>
            {mode === 'LIVE' ? realDecree : DEMO_DECREE}
          </p>
          {mode === 'LIVE' ? (
            <p style={{ margin: '12px 0 0', color: '#A99562', fontFamily: 'var(--font-serif)', fontSize: 12, textAlign: 'right' }}>
              — taskId {taskSummary?.id ?? ''}
            </p>
          ) : (
            <p style={{ margin: '12px 0 0', color: '#A99562', fontFamily: 'var(--font-serif)', fontSize: 12, textAlign: 'right' }}>
              — 甲辰年五月初八 · 御笔钦定（演示）
            </p>
          )}
        </div>
      )}
    </CommandPanel>
  );
}

/** 单条蜂群泳道（待命/执行中/阻塞/已交付）— 真链路从 groups/risks 推导 */
interface SwarmLane {
  name: string;
  desc: string;
  count: number;
  color: string;
  progress: number;
  agents: string[];
  evidence: string;
  evidenceTone: 'live' | 'pending' | 'demo' | 'empty';
}

/**
 * 改名消歧义(2026-07-03)：此前与 features/shared/components/swarm-dispatch-panel.tsx 撞名，
 * 曾被误判为"两套派发实现重复"。核实后二者不是一回事——本组件是**纯展示**面板(props 全来自
 * 父级 SSE 已解析状态，本文件内 grep fetch/dispatchDeptToSwarm/api/court 零命中，不触发任何派发)，
 * 只显示"已在跑的任务"的泳道进度(待命/执行中/阻塞/已交付)；共享组件是**主动触发新派发**的钩子。
 * 改名避免未来有人再被同名误导成"重复实现"去动它。
 */
function SwarmLaneBoard({
  taskId,
  taskSummary,
  groups,
  risks,
  ministers,
}: {
  taskId: string | null;
  taskSummary: TaskSummary | null;
  groups: GroupCard[];
  risks: RiskBanner[];
  ministers: MinisterRow[];
}) {
  const hasTask = Boolean(taskId);
  const hasData = groups.length > 0 || risks.length > 0;
  // 残留(会审 2026-07-03)：本面板作用域内无 ministryBrief.report.sourceLabel 可透传，
  // 泳道数据全来自 SSE 实时解析(有即真、无任务即 DEMO)，故暂按二参 LIVE-when-hasData。
  // 若将来注入演示泳道或需区分回退源，需从父级把真 sourceLabel 线接进来(见 dev/notes 执行清单)。
  const mode = resolvePanelMode(hasTask, hasData);

  // 真链路：泳道计数全部来自 SSE 解析的 groups / risks
  const dispatching = groups.filter((g) => g.status === 'dispatching');
  const running = groups.filter((g) => g.status === 'running');
  const aggregated = groups.filter((g) => g.status === 'aggregated');
  const blockers = risks.filter((r) => r.level === 'high' || r.level === 'critical');
  const groupName = (g: GroupCard) => g.name || g.groupId;

  const liveLanes: SwarmLane[] = [
    { name: '待命', desc: '已派遣待启动', count: dispatching.length, color: '#8AA4FF', progress: dispatching.length ? 30 : 0, agents: dispatching.map(groupName), evidence: dispatching.length ? 'group.dispatch' : '无派遣事件', evidenceTone: dispatching.length ? 'live' : 'empty' },
    { name: '执行中', desc: '蜂群处理中', count: running.length, color: '#F0C66A', progress: running.length ? 60 : 0, agents: running.map(groupName), evidence: running.length ? 'subagent.step' : '无执行事件', evidenceTone: running.length ? 'live' : 'empty' },
    { name: '阻塞', desc: '高危风险待处理', count: blockers.length, color: blockers.length ? '#F5A524' : '#3DD68C', progress: 0, agents: blockers.map((r) => r.label), evidence: blockers.length ? 'risk.flagged' : '无风险事件', evidenceTone: blockers.length ? 'live' : 'empty' },
    { name: '已交付', desc: '已汇总结果', count: aggregated.length, color: '#3DD68C', progress: aggregated.length ? 100 : 0, agents: aggregated.map(groupName), evidence: aggregated.length ? 'group.aggregated' : '无交付事件', evidenceTone: aggregated.length ? 'live' : 'empty' },
  ];

  const demoLanes: SwarmLane[] = [
    { name: '待命', desc: '演示队列', count: 4, color: '#8AA4FF', progress: 72, agents: ['情报', '资源', '评估', '执行'], evidence: 'DEMO · 无实时事件', evidenceTone: 'demo' },
    { name: '执行中', desc: '实时接入后更新', count: 0, color: '#F0C66A', progress: 18, agents: ['等待作战流'], evidence: 'DEMO · 无实时事件', evidenceTone: 'demo' },
    { name: '阻塞', desc: '风险事件回显', count: 0, color: '#3DD68C', progress: 0, agents: [], evidence: 'DEMO · 无实时事件', evidenceTone: 'demo' },
    { name: '已交付', desc: '汇总后点亮', count: 0, color: '#9AA3C4', progress: 0, agents: [], evidence: 'DEMO · 无实时事件', evidenceTone: 'demo' },
  ];

  const pendingLanes: SwarmLane[] = [
    { name: '待命', desc: '已接案 · 待派遣', count: 1, color: '#8AA4FF', progress: 36, agents: [taskSummary?.title ?? taskSummary?.intent ?? '当前真案'], evidence: 'taskDetail · 已接案', evidenceTone: 'pending' },
    { name: '执行中', desc: '等待蜂群回传', count: 0, color: '#F0C66A', progress: 10, agents: ['作战流连接中'], evidence: '等待 group.dispatch', evidenceTone: 'pending' },
    { name: '阻塞', desc: '风险事件回显', count: 0, color: '#3DD68C', progress: 0, agents: [], evidence: '无风险事件', evidenceTone: 'empty' },
    { name: '已交付', desc: '汇总后点亮', count: 0, color: '#9AA3C4', progress: 0, agents: [], evidence: '等待 group.aggregated', evidenceTone: 'pending' },
  ];

  const lanes = mode === 'LIVE' ? liveLanes : mode === 'PENDING' ? pendingLanes : demoLanes;
  const swarmHref = '/manors';

  return (
    <CommandPanel
      title="Agent 工作图"
      style={{ position: 'relative', height: 'auto', flex: '1 1 auto', minHeight: 0 }}
      compact
      badge={panelModeBadge(mode)}
    >
      <div style={{ marginTop: 7, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <Link
          href={swarmHref}
          style={{
            border: '1px solid rgba(240,198,106,0.22)',
            borderRadius: 999,
            background: 'rgba(240,198,106,0.070)',
            color: '#F0C66A',
            fontSize: 11,
            lineHeight: 1,
            padding: '5px 8px',
            textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          庄园蜂群主页
        </Link>
        <span style={{ color: '#8F9BB2', fontSize: 11 }}>
          状态 · {mode === 'DEMO' ? '待接案' : taskSummary?.status ?? 'streaming'}
        </span>
      </div>
      <div style={{ marginTop: 7, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 5 }}>
        {lanes.map((lane) => (
          <div key={`cell-${lane.name}`} style={{ border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.035)', borderRadius: 5, padding: '5px 3px', textAlign: 'center' }}>
            <div style={{ color: '#6A7299', fontSize: 10, letterSpacing: '0.08em' }}>{lane.name}</div>
            <div style={{ marginTop: 2, color: lane.name === '阻塞' && lane.count > 0 ? '#F5A524' : '#F0C66A', fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{lane.count}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 7, display: 'grid', gap: 4, maxHeight: '240px', overflowY: 'auto' }}>
        {lanes.map(({ name, desc, count, color, progress, agents, evidence, evidenceTone }) => (
          <div key={name} style={{ borderRadius: 6, border: '1px solid rgba(255,255,255,0.055)', background: 'rgba(255,255,255,0.026)', padding: '5px 7px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 20, height: 20, borderRadius: 5, display: 'grid', placeItems: 'center', color: '#DCEAFF', background: 'rgba(107,160,255,0.09)', border: '1px solid rgba(107,160,255,0.16)', fontSize: 12 }}>▦</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', color: '#F4E8C7', fontFamily: 'var(--font-serif)', fontSize: 12 }}>{name}</span>
                <span style={{ display: 'block', marginTop: 1, color: '#8E9AB5', fontSize: 10 }}>{desc}</span>
              </span>
              <span style={{ color, fontSize: 11 }}>{count} 路</span>
            </div>
            <div style={{ marginTop: 4, height: 2, borderRadius: 999, overflow: 'hidden', background: 'rgba(255,255,255,0.08)' }}>
              <span style={{ display: 'block', height: '100%', width: `${progress}%`, borderRadius: 999, background: color }} />
            </div>
            <div style={{ marginTop: 4, minHeight: 16, color: '#6A7299', fontSize: 10, lineHeight: 1.35, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {agents.length > 0 ? agents.join(' · ') : '暂无对象'}
            </div>
            <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, minWidth: 0 }}>
              <span style={{ color: '#59637B', fontSize: 9, whiteSpace: 'nowrap' }}>最近证据</span>
              <span
                title={evidence}
                style={{
                  minWidth: 0,
                  maxWidth: '70%',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  borderRadius: 999,
                  border: `1px solid ${evidenceTone === 'live' ? 'rgba(61,214,140,0.28)' : evidenceTone === 'pending' ? 'rgba(240,198,106,0.24)' : evidenceTone === 'demo' ? 'rgba(138,164,255,0.22)' : 'rgba(143,155,178,0.16)'}`,
                  background: evidenceTone === 'live' ? 'rgba(61,214,140,0.08)' : evidenceTone === 'pending' ? 'rgba(240,198,106,0.07)' : evidenceTone === 'demo' ? 'rgba(138,164,255,0.07)' : 'rgba(143,155,178,0.05)',
                  color: evidenceTone === 'live' ? '#7AE0A7' : evidenceTone === 'pending' ? '#F0C66A' : evidenceTone === 'demo' ? '#9FB4FF' : '#7D88A4',
                  fontSize: 9,
                  lineHeight: 1,
                  padding: '3px 5px',
                }}
              >
                {evidence}
              </span>
            </div>
          </div>
        ))}
      </div>
      {mode === 'LIVE' ? (
        <div style={{ marginTop: 7, borderTop: '1px solid rgba(240,198,106,0.14)', paddingTop: 6, color: '#9AA3C4', fontSize: 10, lineHeight: 1.45 }}>
          taskId: {taskId} · 大臣 {ministers.length} 位 · source: {taskSummary?.source ?? 'court-stream'}
        </div>
      ) : (
        <div style={{ marginTop: 7, borderTop: '1px solid rgba(143,155,178,0.16)', paddingTop: 6, color: '#7D88A4', fontSize: 10, lineHeight: 1.45 }}>
          {mode === 'PENDING' ? '已接案，演示队列等待真实蜂群事件接管。' : '演示队列仅作骨架；立真案后与蜂群实时状态关联。'}
        </div>
      )}
    </CommandPanel>
  );
}

function CouncilPanel({
  taskId,
  ministers,
  risks,
  councilSummary,
  ministryBrief,
}: {
  taskId: string | null;
  ministers: MinisterRow[];
  risks: RiskBanner[];
  councilSummary?: string;
  ministryBrief: CommandCenterMinistryBrief | null;
}) {
  const hasTask = Boolean(taskId);
  const hasData = ministers.length > 0 || risks.length > 0 || Boolean(councilSummary) || Boolean(ministryBrief);
  const mode = resolvePanelMode(hasTask, hasData, ministryBrief?.report.sourceLabel);

  // 真链路：SSE 不携带「支持/谨慎/反对」立场枚举，故不臆造；只呈现可证实的指标
  const completed = ministers.filter((m) => m.status === 'completed').length;
  const running = ministers.length - completed;
  const liveCells: Array<[string, number, string, string]> = [
    ['参审', ministryBrief?.review.selectedMinistries.length ?? ministers.length, '#8AA4FF', '六部/大臣'],
    ['红灯', ministryBrief?.review.vetoes.length ?? risks.length, ministryBrief?.review.vetoes.length || risks.length ? '#F5A524' : '#3DD68C', ministryBrief?.review.vetoes.length ? '需人工确认' : running > 0 ? `${running} 位审议中` : '暂无'],
    ['冲突', ministryBrief?.review.conflicts.length ?? risks.length, ministryBrief?.review.conflicts.length || risks.length ? '#F5A524' : '#8F9BB2', ministryBrief?.review.conflicts.length ? '不得平均' : '暂无'],
  ];
  const cells = liveCells;
  const quoteBrief = ministryBrief?.unified.formalQuoteDecisionBrief;

  return (
    <CommandPanel
      title="大臣会审"
      style={{ position: 'relative', height: 'auto', flex: '0 0 auto' }}
      compact
      badge={panelModeBadge(mode)}
    >
      {mode !== 'LIVE' ? (
        <PendingHint text={mode === 'DEMO' ? '当前没有真案。立案后，大臣会审会根据后端作战流实时展示参审、表态、风险与跨组汇总。' : '已接案，等待大臣会审。每位大臣的意见将随作战流实时回写。'} />
      ) : (
        <>
          {quoteBrief ? (
            <div style={{ marginTop: 9, border: '1px solid rgba(245,139,139,0.32)', background: 'rgba(122,36,30,0.16)', borderRadius: 7, padding: 9 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                <span style={{ color: '#F5E9C9', fontFamily: 'var(--font-serif)', fontSize: 13, fontWeight: 900 }}>正式报价决策</span>
                <span style={{ color: '#F58B8B', border: '1px solid rgba(245,139,139,0.38)', borderRadius: 999, padding: '3px 7px', fontSize: 10, fontWeight: 900 }}>
                  {quoteBrief.riskLevel}
                </span>
              </div>
              <p style={{ margin: '7px 0 0', color: '#F5C0B8', fontSize: 12, lineHeight: 1.55, fontWeight: 800 }}>
                {quoteBrief.decision}
              </p>
              <p style={{ margin: '5px 0 0', color: '#D7B3A6', fontSize: 11, lineHeight: 1.55 }}>
                {quoteBrief.primaryAction}
              </p>
              <div style={{ marginTop: 7, display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {quoteBrief.materialActions.map((action) => (
                  <span key={action} style={{ border: '1px solid rgba(240,198,106,0.24)', background: 'rgba(240,198,106,0.07)', color: '#F0C66A', borderRadius: 999, padding: '3px 7px', fontSize: 9 }}>
                    {action}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
          <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {cells.map(([label, value, color, hint]) => (
              <div key={label} style={{ border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.028)', borderRadius: 6, padding: '7px 6px', textAlign: 'center' }}>
                <div style={{ color: '#7D88A4', fontSize: 10 }}>{label}</div>
                <div style={{ marginTop: 3, color, fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 800 }}>{value}</div>
                <div style={{ marginTop: 2, color: '#8F9BB2', fontSize: 9 }}>{hint}</div>
              </div>
            ))}
          </div>
          {ministryBrief && (
            <div style={{ marginTop: 9, display: 'grid', gap: 7 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                {ministryBrief.review.cards.slice(0, 6).map((card) => {
                  const ministry = MINISTRY_REGISTRY[card.ministryId].nameCn;
                  const color =
                    card.signal === 'GREEN' ? '#3DD68C' : card.signal === 'RED' ? '#F58B8B' : card.signal === 'YELLOW' ? '#F0C66A' : '#8F9BB2';
                  return (
                    <div
                      key={card.ministryId}
                      style={{
                        border: `1px solid ${color}44`,
                        background: `${color}12`,
                        borderRadius: 6,
                        padding: '6px 7px',
                        minWidth: 0,
                      }}
                    >
                      <div style={{ color: '#F5E9C9', fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-serif)' }}>{ministry}</div>
                      <div style={{ marginTop: 2, color, fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 800 }}>{card.signal}</div>
                    </div>
                  );
                })}
              </div>
              <div style={{ border: '1px solid rgba(240,198,106,0.16)', background: 'rgba(240,198,106,0.035)', borderRadius: 6, padding: 8 }}>
                <div style={{ color: '#F5E9C9', fontFamily: 'var(--font-serif)', fontSize: 12, fontWeight: 700 }}>红蓝对抗</div>
                <div style={{ marginTop: 5, display: 'grid', gap: 5 }}>
                  {ministryBrief.review.cards.slice(0, 2).map((card) => {
                    const ministry = MINISTRY_REGISTRY[card.ministryId].nameCn;
                    return (
                      <p key={card.ministryId} style={{ margin: 0, color: '#AAB4C4', fontSize: 11, lineHeight: 1.55 }}>
                        <span style={{ color: '#F0C66A' }}>{ministry}</span>：{card.mainThesis}；{card.deputyChallenge}
                      </p>
                    );
                  })}
                </div>
              </div>
              {ministryBrief.review.conflicts.length > 0 && (
                <div style={{ border: '1px solid rgba(245,139,139,0.22)', background: 'rgba(245,139,139,0.055)', borderRadius: 6, padding: 8 }}>
                  <div style={{ color: '#F58B8B', fontFamily: 'var(--font-serif)', fontSize: 12, fontWeight: 700 }}>部门冲突</div>
                  <p style={{ margin: '5px 0 0', color: '#D7B3A6', fontSize: 11, lineHeight: 1.55 }}>
                    {ministryBrief.review.conflicts.slice(0, 2).map((item) => item.summary).join('\n')}
                  </p>
                </div>
              )}
              {ministryBrief.unified.worksDeliveryBrief ? (
                <div style={{ border: `1px solid ${unifiedSignalTone(ministryBrief.unified.worksDeliveryBrief.signal)}44`, background: `${unifiedSignalTone(ministryBrief.unified.worksDeliveryBrief.signal)}10`, borderRadius: 6, padding: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                    <span style={{ color: '#F5E9C9', fontFamily: 'var(--font-serif)', fontSize: 12, fontWeight: 800 }}>工部交付质门</span>
                    <span style={{ color: unifiedSignalTone(ministryBrief.unified.worksDeliveryBrief.signal), fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 900 }}>
                      {ministryBrief.unified.worksDeliveryBrief.signal}
                    </span>
                  </div>
                  <p style={{ margin: '5px 0 0', color: '#AAB4C4', fontSize: 11, lineHeight: 1.55, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {ministryBrief.unified.worksDeliveryBrief.nextAction}
                  </p>
                  {ministryBrief.unified.worksDeliveryBrief.crossDepartmentReviews.length > 0 ? (
                    <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      {ministryBrief.unified.worksDeliveryBrief.crossDepartmentReviews.slice(0, 4).map((dept) => (
                        <span key={dept} style={{ border: '1px solid rgba(255,255,255,0.10)', color: '#C8CDD8', borderRadius: 999, padding: '3px 6px', fontSize: 9 }}>
                          联动 {departmentReviewLabel(dept)}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}
          {mode === 'LIVE' ? (
            <>
              {ministers.length > 0 && (
                <div style={{ marginTop: 9, display: 'grid', gap: 6, maxHeight: '180px', overflowY: 'auto' }}>
                  {ministers.slice(0, 3).map((minister) => (
                    <div key={minister.agentCode} style={{ border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.026)', borderRadius: 6, padding: '7px 9px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <span style={{ color: '#F5E9C9', fontFamily: 'var(--font-serif)', fontSize: 12, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {minister.name}
                        </span>
                        <span style={{ color: minister.status === 'completed' ? '#3DD68C' : '#F0C66A', fontSize: 10, whiteSpace: 'nowrap' }}>
                          {minister.status === 'completed' ? '已表态' : '审议中'}
                        </span>
                      </div>
                      <p style={{ margin: '4px 0 0', color: '#AAB4C4', fontSize: 11, lineHeight: 1.55, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {minister.opinion || '等待后端意见回写'}
                      </p>
                    </div>
                  ))}
                </div>
              )}
              {councilSummary ? (
                <div style={{ marginTop: 9, border: '1px solid rgba(240,198,106,0.14)', background: 'rgba(240,198,106,0.040)', borderRadius: 6, padding: 9 }}>
                  <div style={{ color: '#F5E9C9', fontFamily: 'var(--font-serif)', fontSize: 12, fontWeight: 700 }}>跨组汇总</div>
                  <p style={{ margin: '5px 0 0', color: '#AAB4C4', fontSize: 11, lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {councilSummary}
                  </p>
                </div>
              ) : (
                <div style={{ marginTop: 9, color: '#8F9BB2', fontSize: 11, textAlign: 'center' }}>会审进行中，结论待汇总…</div>
              )}
            </>
          ) : null}
        </>
      )}
    </CommandPanel>
  );
}

function FinalMemorialPanel({
  taskId,
  memorial,
  councilSummary,
  risks,
  ministryBrief,
}: {
  taskId: string | null;
  memorial: MemorialSnapshot | null;
  councilSummary?: string;
  risks: RiskBanner[];
  ministryBrief: CommandCenterMinistryBrief | null;
}) {
  const hasTask = Boolean(taskId);
  const hasMemorial = Boolean(memorial?.memorialId || ministryBrief);
  const mode = resolvePanelMode(hasTask, hasMemorial, ministryBrief?.report.sourceLabel);
  const isError = memorial?.streamStatus === 'error';
  const sourceLabel = ministryBrief?.report.sourceLabel;
  const sourceColor = sourceLabel ? commandCenterSourceTone(sourceLabel) : '#8F9BB2';
  const isBlocked = Boolean(ministryBrief && (!ministryBrief.audit.passed || ministryBrief.review.overallSignal === 'RED'));
  const archiveLabel = ministryBrief?.report.needsHumanConfirmation ? '人工确认后归档' : '呈报皇上';
  const quoteBrief = ministryBrief?.unified.formalQuoteDecisionBrief;
  const scroll = ministryBrief?.unified.memorialScroll;

  const panelStyle: CSSProperties = { position: 'relative', height: 'auto', flex: '1 1 auto', minHeight: 0, paddingBottom: '56px' };
  const throneHref = taskId
    ? `/throne/brief/${encodeURIComponent(taskId)}${memorial?.memorialId ? `?memorialId=${encodeURIComponent(memorial.memorialId)}` : ''}`
    : '/throne/pulse';

  // PENDING / DEMO / 进行中：诚实标作战流尚未生成奏折，但保留呈报按钮位置
  if (mode !== 'LIVE') {
    return (
      <CommandPanel title="最终奏折" style={panelStyle} badge={panelModeBadge(isError ? 'PENDING' : mode)}>
        <div style={{ paddingBottom: 10 }}>
          <PendingHint
            text={mode === 'DEMO' ? '当前没有真案。立案后，最终奏折会根据后端作战流生成，并开放呈报皇上。' : isError ? '作战流异常终止，未生成奏折。可回上书房重立真案。' : '作战流进行中 · 奏折待生成。完成会审与蜂群执行后，奏折将自动起草。'}
          />
        </div>
        <div
          aria-disabled="true"
          style={{
            position: 'absolute',
            left: 14,
            right: 14,
            bottom: 12,
            display: 'block',
            textAlign: 'center',
            border: '1px solid rgba(255,224,154,0.28)',
            borderRadius: 8,
            background: 'linear-gradient(180deg, rgba(240,198,106,0.18), rgba(201,149,71,0.10))',
            color: 'rgba(245,233,201,0.48)',
            fontFamily: 'var(--font-serif)',
            fontSize: 13,
            fontWeight: 800,
            letterSpacing: '0.16em',
            padding: '8px 12px',
            cursor: 'not-allowed',
          }}
        >
          呈报皇上
        </div>
      </CommandPanel>
    );
  }

  // LIVE：真奏折快照（质量评分 + 六部灯号 + 御史台质门 + 风险/补证）
  if (mode === 'LIVE') {
    return (
      <CommandPanel title="最终奏折" style={panelStyle} badge={panelModeBadge(mode)}>
        <div style={{ marginTop: 12, paddingBottom: 10, maxHeight: 'calc(100% - 60px)', overflowY: 'auto' }}>
          <h3 style={{ margin: 0, color: '#F3D08C', fontFamily: 'var(--font-serif)', fontSize: 14, lineHeight: 1.4 }}>
            {scroll?.seal === '機密' || isBlocked ? '機密奏折 · 待人工圣裁' : '奏折已生成'}
          </h3>
          {ministryBrief && (
            <div style={{ marginTop: 8, border: `1px solid ${sourceColor}33`, background: `${sourceColor}10`, borderRadius: 7, padding: '7px 9px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                <span style={{ color: '#F5E9C9', fontFamily: 'var(--font-serif)', fontSize: 12, fontWeight: 800 }}>
                  {scroll ? `${scroll.verdict} · ${scroll.oneSentence}` : ministryBrief.report.oneSentence}
                </span>
                <span style={{ flexShrink: 0, color: sourceColor, border: `1px solid ${sourceColor}55`, borderRadius: 999, padding: '3px 7px', fontSize: 9, fontWeight: 800 }}>
                  {sourceLabel}
                </span>
              </div>
            </div>
          )}
          {quoteBrief ? (
            <div style={{ marginTop: 9, border: '1px solid rgba(245,139,139,0.30)', background: 'rgba(122,36,30,0.13)', borderRadius: 7, padding: 9 }}>
              <div style={{ color: '#F5E9C9', fontFamily: 'var(--font-serif)', fontSize: 11, fontWeight: 900 }}>第一屏裁决</div>
              <p style={{ margin: '5px 0 0', color: '#F5C0B8', fontSize: 11, lineHeight: 1.55, fontWeight: 800 }}>
                {quoteBrief.decision} {quoteBrief.primaryAction}
              </p>
              <p style={{ margin: '6px 0 0', color: '#C8B98D', fontSize: 10, lineHeight: 1.55 }}>
                缺证：{quoteBrief.missingEvidence.slice(0, 4).join('、')}
              </p>
              <div style={{ marginTop: 7, border: '1px solid rgba(138,164,255,0.18)', background: 'rgba(138,164,255,0.055)', borderRadius: 6, padding: 7 }}>
                <div style={{ color: '#9FC1FF', fontSize: 10, fontWeight: 800 }}>客户安全回复草稿 · 不自动发送</div>
                <p style={{ margin: '4px 0 0', color: '#B8C5CF', fontSize: 10, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {quoteBrief.safeReplyDraft}
                </p>
              </div>
            </div>
          ) : null}
          {scroll ? (
            <div style={{ marginTop: 9, display: 'grid', gap: 7 }}>
              <div style={{ border: '1px solid rgba(240,198,106,0.16)', background: 'rgba(240,198,106,0.035)', borderRadius: 6, padding: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                  <span style={{ color: '#F5E9C9', fontFamily: 'var(--font-serif)', fontSize: 11, fontWeight: 900 }}>六部灯号</span>
                  <span style={{ color: scroll.needsHumanConfirmation ? '#F58B8B' : '#3DD68C', fontSize: 9, fontWeight: 900 }}>
                    {scroll.needsHumanConfirmation ? '人工确认' : '可裁决'}
                  </span>
                </div>
                <div style={{ marginTop: 7, display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 5 }}>
                  {scroll.ministrySignals.slice(0, 8).map((item) => {
                    const color = unifiedSignalTone(item.signal);
                    return (
                      <div key={item.id} title={item.summary} style={{ border: `1px solid ${color}40`, background: `${color}10`, borderRadius: 6, padding: '5px 6px', minWidth: 0 }}>
                        <div style={{ color: '#EDE1BE', fontSize: 9, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
                        <div style={{ marginTop: 2, color, fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 900 }}>{item.signal}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ border: '1px solid rgba(138,164,255,0.18)', background: 'rgba(138,164,255,0.045)', borderRadius: 6, padding: 8 }}>
                <div style={{ color: '#9FC1FF', fontFamily: 'var(--font-serif)', fontSize: 11, fontWeight: 900 }}>红蓝对抗</div>
                <div style={{ marginTop: 5, display: 'grid', gap: 5 }}>
                  {scroll.redBlueHighlights.slice(0, 2).map((item) => (
                    <p key={item.department} style={{ margin: 0, color: '#B8C5CF', fontSize: 10, lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      <span style={{ color: '#F0C66A' }}>{item.department}</span>：{item.main} / {item.deputy}
                    </p>
                  ))}
                </div>
              </div>

              {scroll.conflicts.length > 0 ? (
                <div style={{ border: '1px solid rgba(245,139,139,0.24)', background: 'rgba(245,139,139,0.055)', borderRadius: 6, padding: 8 }}>
                  <div style={{ color: '#F58B8B', fontFamily: 'var(--font-serif)', fontSize: 11, fontWeight: 900 }}>部门冲突 · 不平均</div>
                  <p style={{ margin: '5px 0 0', color: '#D7B3A6', fontSize: 10, lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {scroll.conflicts.slice(0, 2).join('；')}
                  </p>
                </div>
              ) : null}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
                <div style={{ border: '1px solid rgba(61,214,140,0.16)', background: 'rgba(61,214,140,0.035)', borderRadius: 6, padding: 8 }}>
                  <div style={{ color: '#7AE0A7', fontFamily: 'var(--font-serif)', fontSize: 10, fontWeight: 900 }}>证据</div>
                  <p style={{ margin: '5px 0 0', color: '#B8C5CF', fontSize: 9, lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {scroll.evidence.slice(0, 3).join('、') || '暂无可归档证据'}
                  </p>
                </div>
                <div style={{ border: '1px solid rgba(240,198,106,0.20)', background: 'rgba(240,198,106,0.045)', borderRadius: 6, padding: 8 }}>
                  <div style={{ color: '#F0C66A', fontFamily: 'var(--font-serif)', fontSize: 10, fontWeight: 900 }}>缺证</div>
                  <p style={{ margin: '5px 0 0', color: '#C8B98D', fontSize: 9, lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {scroll.missingEvidence.slice(0, 3).join('、') || '暂无'}
                  </p>
                </div>
              </div>

              <div style={{ border: `1px solid ${scroll.qualityGate.status === '阻断' ? 'rgba(245,139,139,0.28)' : 'rgba(61,214,140,0.18)'}`, background: scroll.qualityGate.status === '阻断' ? 'rgba(245,139,139,0.055)' : 'rgba(61,214,140,0.035)', borderRadius: 6, padding: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ color: scroll.qualityGate.status === '阻断' ? '#F58B8B' : '#7AE0A7', fontFamily: 'var(--font-serif)', fontSize: 11, fontWeight: 900 }}>
                    质门 · {scroll.qualityGate.status}
                  </span>
                  <span style={{ color: sourceColor, fontSize: 9, fontWeight: 900 }}>来源 {scroll.sourceLabel}</span>
                </div>
                <p style={{ margin: '5px 0 0', color: '#B8C5CF', fontSize: 10, lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {[...scroll.qualityGate.blockingIssues, ...scroll.qualityGate.warnings].slice(0, 3).join('、') || '冲突、证据、来源和人工确认已检查。'}
                </p>
              </div>
            </div>
          ) : null}
          <div style={{ marginTop: 9, display: 'grid', gap: 7 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '52px 1fr', gap: 8, border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.028)', borderRadius: 6, padding: '7px 9px' }}>
              <span style={{ color: '#F0C66A', fontSize: 11, fontWeight: 700 }}>质量分</span>
              <span style={{ color: '#B8C5CF', fontSize: 11, lineHeight: 1.55, fontFamily: 'var(--font-mono)' }}>
                {memorial?.qualityScore !== undefined ? memorial.qualityScore : ministryBrief ? ministryBrief.review.overallSignal : '待评分'}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '52px 1fr', gap: 8, border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.028)', borderRadius: 6, padding: '7px 9px' }}>
              <span style={{ color: '#F0C66A', fontSize: 11, fontWeight: 700 }}>后令</span>
              <span style={{ color: '#B8C5CF', fontSize: 11, lineHeight: 1.55, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {ministryBrief?.report.nextAction || councilSummary || '见作战流跨组汇总。'}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '52px 1fr', gap: 8, border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.028)', borderRadius: 6, padding: '7px 9px' }}>
              <span style={{ color: '#F0C66A', fontSize: 11, fontWeight: 700 }}>御史台</span>
              <span style={{ color: '#B8C5CF', fontSize: 11, lineHeight: 1.55 }}>
                {ministryBrief
                  ? ministryBrief.audit.passed
                    ? '通过 · 冲突与缺证已展示'
                    : `阻断 · ${ministryBrief.audit.blockingIssues.slice(0, 2).join('、') || '需人工确认'}`
                  : memorial?.streamStatus === 'done' ? '作战流完成，待呈报与归档。' : '奏折已起草，作战流仍在收尾。'}
              </span>
            </div>
          </div>
          {ministryBrief?.report.missingEvidence.length ? (
            <div style={{ marginTop: 9, border: '1px solid rgba(240,198,106,0.24)', background: 'rgba(240,198,106,0.045)', borderRadius: 6, padding: 8 }}>
              <div style={{ color: '#F0C66A', fontFamily: 'var(--font-serif)', fontSize: 11, fontWeight: 800 }}>缺证清单</div>
              <p style={{ margin: '5px 0 0', color: '#C8B98D', fontSize: 10, lineHeight: 1.55 }}>
                {ministryBrief.report.missingEvidence.slice(0, 5).join('、')}
              </p>
            </div>
          ) : null}
          {ministryBrief?.unified.worksDeliveryBrief ? (
            <div style={{ marginTop: 9, border: `1px solid ${unifiedSignalTone(ministryBrief.unified.worksDeliveryBrief.signal)}3D`, background: `${unifiedSignalTone(ministryBrief.unified.worksDeliveryBrief.signal)}0E`, borderRadius: 6, padding: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                <span style={{ color: '#F5E9C9', fontFamily: 'var(--font-serif)', fontSize: 11, fontWeight: 800 }}>工部交付边界</span>
                {ministryBrief.unified.worksDeliveryBrief.needsHumanConfirmation ? (
                  <span style={{ color: '#F58B8B', border: '1px solid rgba(245,139,139,0.35)', borderRadius: 999, padding: '2px 6px', fontSize: 9, fontWeight: 800 }}>
                    人工确认
                  </span>
                ) : null}
              </div>
              {ministryBrief.unified.worksDeliveryBrief.forbiddenCommitments.length > 0 ? (
                <p style={{ margin: '5px 0 0', color: '#D7B3A6', fontSize: 10, lineHeight: 1.55, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  不可承诺：{ministryBrief.unified.worksDeliveryBrief.forbiddenCommitments.slice(0, 3).join('、')}
                </p>
              ) : (
                <p style={{ margin: '5px 0 0', color: '#AAB4C4', fontSize: 10, lineHeight: 1.55, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {ministryBrief.unified.worksDeliveryBrief.nextAction}
                </p>
              )}
            </div>
          ) : null}
          {risks.length > 0 && (
            <div style={{ marginTop: 9, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {risks.slice(0, 3).map((r, i) => (
                <span key={`${r.label}-${i}`} style={{ border: '1px solid rgba(245,165,36,0.28)', color: '#F0C66A', borderRadius: 999, padding: '4px 7px', fontSize: 10 }}>
                  待复核 · {r.label}
                </span>
              ))}
            </div>
          )}
          {scroll ? (
            <div style={{ marginTop: 9, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {scroll.decisionActions.map((action) => (
                <span key={action} style={{ border: action.includes('人工') || action.includes('驳回') ? '1px solid rgba(245,139,139,0.28)' : '1px solid rgba(240,198,106,0.22)', color: action.includes('人工') || action.includes('驳回') ? '#F5C0B8' : '#F0C66A', borderRadius: 999, padding: '4px 7px', fontSize: 9, fontWeight: 800 }}>
                  {action}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <Link
          href={throneHref}
          style={{
            position: 'absolute',
            left: 14,
            right: 14,
            bottom: 12,
            display: 'block',
            textAlign: 'center',
            border: isBlocked ? '1px solid rgba(245,139,139,0.52)' : '1px solid rgba(255,224,154,0.66)',
            borderRadius: 8,
            background: isBlocked ? 'linear-gradient(180deg, rgba(122,36,30,0.74), rgba(77,18,16,0.72))' : 'linear-gradient(180deg, #F0C66A, #C99547)',
            color: isBlocked ? '#F5E9C9' : '#211404',
            fontFamily: 'var(--font-serif)',
            fontSize: 13,
            fontWeight: 800,
            letterSpacing: '0.16em',
            padding: '8px 12px',
          }}
        >
          {archiveLabel}
        </Link>
      </CommandPanel>
    );
  }

  return null;
}

type CommandQuickLinkTone = 'gold' | 'blue' | 'green' | 'red' | 'plain';

interface CommandQuickLink {
  label: string;
  href: string;
  tone: CommandQuickLinkTone;
}

const COMMAND_DEPARTMENT_LINKS: Record<MinistryId, CommandQuickLink> = {
  personnel: { label: '吏部', href: '/liubu/libu', tone: 'blue' },
  finance: { label: '户部', href: '/liubu/hubu', tone: 'gold' },
  ritual: { label: '礼部', href: '/departments/market', tone: 'plain' },
  war: { label: '兵部', href: '/liubu/bingbu', tone: 'green' },
  justice: { label: '刑部', href: '/liubu/xingbu', tone: 'red' },
  works: { label: '工部', href: '/liubu/gongbu', tone: 'green' },
};

function linkToneStyle(tone: CommandQuickLinkTone): CSSProperties {
  if (tone === 'gold') return { borderColor: 'rgba(240,198,106,0.30)', background: 'rgba(240,198,106,0.075)', color: '#F0C66A' };
  if (tone === 'blue') return { borderColor: 'rgba(138,164,255,0.28)', background: 'rgba(138,164,255,0.070)', color: '#AFC0FF' };
  if (tone === 'green') return { borderColor: 'rgba(61,214,140,0.26)', background: 'rgba(61,214,140,0.060)', color: '#8BE4B4' };
  if (tone === 'red') return { borderColor: 'rgba(245,139,139,0.28)', background: 'rgba(245,139,139,0.060)', color: '#F5B0AA' };
  return { borderColor: 'rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.038)', color: '#C8CDD8' };
}

function commandQuickLinks(ministryBrief: CommandCenterMinistryBrief | null, groups: GroupCard[] = []): CommandQuickLink[] {
  const ministryIds = new Set<MinistryId>(ministryBrief?.review.selectedMinistries ?? []);
  if (ministryIds.size === 0) {
    ministryIds.add('finance');
    ministryIds.add('war');
    ministryIds.add('works');
    ministryIds.add('justice');
  }
  const links = Array.from(ministryIds).map((id) => COMMAND_DEPARTMENT_LINKS[id]);
  links.push({ label: groups.length > 0 ? '蜂群执行' : '庄园蜂群', href: '/manors', tone: 'green' });
  links.push({ label: '锦衣卫', href: '/intel', tone: 'blue' });
  return links;
}

function CommandLinkRail({ links, label = '直达' }: { links: CommandQuickLink[]; label?: string }) {
  return (
    <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
      <span style={{ color: '#6F7894', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{label}</span>
      {links.map((link) => (
        <Link
          key={`${link.label}-${link.href}`}
          href={link.href}
          style={{
            ...linkToneStyle(link.tone),
            borderWidth: 1,
            borderStyle: 'solid',
            borderRadius: 999,
            padding: '4px 8px',
            fontSize: 10,
            lineHeight: 1,
            textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          {link.label}
        </Link>
      ))}
    </div>
  );
}

function CommandMetric({
  label,
  value,
  note,
  tone = '#F0C66A',
}: {
  label: string;
  value: string | number;
  note: string;
  tone?: string;
}) {
  return (
    <div style={{ border: `1px solid ${tone}33`, background: `${tone}0F`, borderRadius: 8, padding: '9px 10px', minWidth: 0 }}>
      <div style={{ color: '#7D88A4', fontSize: 10 }}>{label}</div>
      <div style={{ marginTop: 3, color: tone, fontFamily: 'var(--font-mono)', fontSize: 20, lineHeight: 1.05, fontWeight: 900 }}>{value}</div>
      <div style={{ marginTop: 4, color: '#9AA3C4', fontSize: 10, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{note}</div>
    </div>
  );
}

function commandTeamLabels(ministryBrief: CommandCenterMinistryBrief | null, ministers: MinisterRow[], groups: GroupCard[]) {
  const labels = new Set<string>();
  ministryBrief?.review.selectedMinistries.forEach((id) => labels.add(MINISTRY_REGISTRY[id].nameCn));
  ministers.slice(0, 4).forEach((minister) => labels.add(minister.name));
  groups.slice(0, 3).forEach((group) => labels.add(group.name || group.groupId));
  if (labels.size === 0) {
    ['户部', '兵部', '工部', '刑部', '庄园蜂群'].forEach((item) => labels.add(item));
  }
  return Array.from(labels).slice(0, 8);
}

function ProgressTeamsPanel({
  taskId,
  taskSummary,
  ministers,
  groups,
  memorial,
  ministryBrief,
}: {
  taskId: string | null;
  taskSummary: TaskSummary | null;
  ministers: MinisterRow[];
  groups: GroupCard[];
  memorial: MemorialSnapshot | null;
  ministryBrief: CommandCenterMinistryBrief | null;
}) {
  const hasTask = Boolean(taskId);
  const mode = resolvePanelMode(hasTask, Boolean(taskSummary || ministers.length || groups.length || ministryBrief), ministryBrief?.report.sourceLabel);
  const title = taskSummary?.title ?? taskSummary?.intent ?? taskSummary?.rawCommand ?? (hasTask ? '军机处已接案' : '今日重点项目排班');
  const stage = memorial?.memorialId
    ? '奏折成稿'
    : groups.some((group) => group.status === 'running' || group.status === 'aggregated')
      ? '蜂群执行'
      : ministers.length
        ? '会审同步'
        : hasTask
          ? '已接案'
          : '演示排班';
  const completedMinisters = ministers.filter((minister) => minister.status === 'completed').length;
  const teamLabels = commandTeamLabels(ministryBrief, ministers, groups);

  return (
    <CommandPanel
      title="提升执行速度 · 今日项目与团队"
      style={{ position: 'relative', flex: '1.05 1 0', minHeight: 250 }}
      compact
      badge={panelModeBadge(mode)}
    >
      <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1.35fr 0.65fr', gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: '#8F835F', fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase' }}>PROJECT</div>
          <h3 style={{ margin: '5px 0 0', color: '#F5E9C9', fontFamily: 'var(--font-serif)', fontSize: 17, lineHeight: 1.35, fontWeight: 800 }}>
            {title}
          </h3>
          <p style={{ margin: '7px 0 0', color: '#9AA3C4', fontSize: 11.5, lineHeight: 1.6 }}>
            {hasTask ? `任务号 ${taskId}` : '无真案时展示推进骨架；上书房立案后，把事项自动拆成团队、泳道与下一步。'}
          </p>
        </div>
        <div style={{ border: '1px solid rgba(240,198,106,0.20)', background: 'rgba(240,198,106,0.055)', borderRadius: 8, padding: '9px 10px' }}>
          <div style={{ color: '#8F835F', fontSize: 10 }}>当前阶段</div>
          <div style={{ marginTop: 4, color: '#F0C66A', fontFamily: 'var(--font-serif)', fontSize: 17, fontWeight: 900 }}>{stage}</div>
          <div style={{ marginTop: 5, color: '#B6AB8C', fontSize: 10.5 }}>{taskSummary?.status ?? (hasTask ? 'streaming' : 'demo')}</div>
        </div>
      </div>

      <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
        <CommandMetric label="协同提速" value={ministryBrief?.review.selectedMinistries.length ?? ministers.length} note={ministers.length ? `${completedMinisters} 位已表态` : '拉齐会审'} tone="#8AA4FF" />
        <CommandMetric label="执行增量" value={groups.length} note={groups.length ? '蜂群增援' : '待派遣'} tone="#3DD68C" />
        <CommandMetric label="返工降低" value={ministryBrief?.audit.blockingIssues.length ?? 0} note={ministryBrief?.audit.passed === false ? '需补证/纠错' : '质门观察'} tone={ministryBrief?.audit.passed === false ? '#F58B8B' : '#F0C66A'} />
      </div>

      <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {teamLabels.map((label) => (
          <span key={label} style={{ border: '1px solid rgba(255,255,255,0.10)', background: 'rgba(255,255,255,0.038)', color: '#D8CEAE', borderRadius: 999, padding: '5px 8px', fontSize: 10 }}>
            {label}
          </span>
        ))}
      </div>

      <div style={{ marginTop: 11 }}>
        <ExecutionPathContent taskId={taskId} ministers={ministers} groups={groups} memorial={memorial} />
      </div>
      <CommandLinkRail links={commandQuickLinks(ministryBrief, groups)} />
    </CommandPanel>
  );
}

function ConflictResolutionPanel({
  taskId,
  risks,
  ministryBrief,
}: {
  taskId: string | null;
  risks: RiskBanner[];
  ministryBrief: CommandCenterMinistryBrief | null;
}) {
  type ConflictDecisionAction = 'adopt' | 'request_evidence' | 'reject';
  const [submittingAction, setSubmittingAction] = useState<string | null>(null);
  const [decisionFeedback, setDecisionFeedback] = useState<Record<string, { tone: 'ok' | 'error'; text: string }>>({});
  const hasTask = Boolean(taskId);
  const canWriteDecision = Boolean(taskId && !taskId.startsWith('local_'));
  const mode = resolvePanelMode(hasTask, Boolean(ministryBrief || risks.length), ministryBrief?.report.sourceLabel);
  const conflictRows = ministryBrief?.review.conflicts.length
    ? ministryBrief.review.conflicts.slice(0, 3).map((conflict) => ({
        title: conflict.between.map((id) => MINISTRY_REGISTRY[id].nameCn).join(' × '),
        body: conflict.summary,
        fix: '不做平均结论，拆成可裁决选项交老板拍板。',
      }))
    : ministryBrief?.review.cards.slice(0, 3).map((card) => ({
        title: MINISTRY_REGISTRY[card.ministryId].nameCn,
        body: card.disputeFocus || card.deputyChallenge,
        fix: card.conditionsToProceed[0] ?? card.missingEvidence[0] ?? card.ruling,
      })) ?? [
        { title: '户部 × 工部', body: '预算、交期、产能口径不一致，先把缺证列清。', fix: '限定预算上限，拆阶段验收，降低返工和超支。' },
        { title: '兵部 × 刑部', body: '外部承诺速度与合同责任边界冲突。', fix: '先出安全回复，降低合同责任和客户误期风险。' },
      ];
  const actionRows: Array<{ label: string; action: ConflictDecisionAction; tone: CommandQuickLinkTone; note: string }> = [
    { label: '准', action: 'adopt', tone: 'gold', note: '采纳改进方式' },
    { label: '补证', action: 'request_evidence', tone: 'blue', note: '写入补证待办' },
    { label: '驳回', action: 'reject', tone: 'red', note: '保留驳回理由' },
  ];

  async function submitConflictDecision(row: { title: string; body: string; fix: string }, action: ConflictDecisionAction, label: string) {
    if (!taskId || !canWriteDecision) return;
    const key = `${row.title}-${row.body}`;
    const submitKey = `${key}-${action}`;
    const reason = `军机处分歧裁决：${row.title}｜${label}。分歧：${row.body}。改进方式：${row.fix}`;
    setSubmittingAction(submitKey);
    setDecisionFeedback((current) => ({ ...current, [key]: { tone: 'ok', text: '正在写入同一任务时间线…' } }));
    try {
      await shangshufangTaskDecision(taskId, action, reason, action === 'adopt' ? { human_confirmation_note: reason } : {});
      setDecisionFeedback((current) => ({ ...current, [key]: { tone: 'ok', text: `已写入时间线：${label}` } }));
    } catch (error) {
      setDecisionFeedback((current) => ({
        ...current,
        [key]: {
          tone: 'error',
          text: error instanceof Error ? error.message : '裁决提交失败',
        },
      }));
    } finally {
      setSubmittingAction(null);
    }
  }

  return (
    <CommandPanel
      title="降低内耗 · 分歧裁决与改进"
      style={{ position: 'relative', flex: '0.95 1 0', minHeight: 250 }}
      compact
      badge={panelModeBadge(mode)}
    >
      <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
        {conflictRows.map((row) => {
          const rowKey = `${row.title}-${row.body}`;
          const feedback = decisionFeedback[rowKey];
          return (
            <div key={rowKey} style={{ border: '1px solid rgba(245,139,139,0.18)', background: 'rgba(245,139,139,0.040)', borderRadius: 8, padding: '9px 10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                <span style={{ color: '#F5E9C9', fontFamily: 'var(--font-serif)', fontSize: 12, fontWeight: 900 }}>{row.title}</span>
                <span style={{ color: '#F58B8B', border: '1px solid rgba(245,139,139,0.26)', borderRadius: 999, padding: '3px 7px', fontSize: 9 }}>分歧</span>
              </div>
              <p style={{ margin: '6px 0 0', color: '#D7B3A6', fontSize: 11, lineHeight: 1.55 }}>{row.body}</p>
              <p style={{ margin: '6px 0 0', color: '#C8B98D', fontSize: 11, lineHeight: 1.55 }}>
                <span style={{ color: '#F0C66A' }}>改进方式：</span>{row.fix}
              </p>
              <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6 }}>
                {actionRows.map((item) => {
                  const submitKey = `${rowKey}-${item.action}`;
                  const pending = submittingAction === submitKey;
                  const disabled = !canWriteDecision || Boolean(submittingAction);
                  return (
                    <button
                      key={item.action}
                      type="button"
                      disabled={disabled}
                      onClick={() => void submitConflictDecision(row, item.action, item.label)}
                      style={{
                        ...linkToneStyle(item.tone),
                        borderWidth: 1,
                        borderStyle: 'solid',
                        borderRadius: 7,
                        padding: '7px 6px',
                        cursor: disabled ? 'not-allowed' : 'pointer',
                        opacity: disabled ? 0.62 : 1,
                        textAlign: 'center',
                      }}
                      title={canWriteDecision ? item.note : '需要真实任务后才能写入时间线'}
                    >
                      <span style={{ display: 'block', fontFamily: 'var(--font-serif)', fontSize: 12, fontWeight: 900 }}>
                        {pending ? '写入中' : item.label}
                      </span>
                      <span style={{ display: 'block', marginTop: 3, color: '#8F9BB2', fontSize: 9 }}>
                        {canWriteDecision ? item.note : '待真案'}
                      </span>
                    </button>
                  );
                })}
              </div>
              {feedback ? (
                <div
                  style={{
                    marginTop: 7,
                    border: `1px solid ${feedback.tone === 'ok' ? 'rgba(61,214,140,0.24)' : 'rgba(245,139,139,0.28)'}`,
                    background: feedback.tone === 'ok' ? 'rgba(61,214,140,0.055)' : 'rgba(245,139,139,0.060)',
                    color: feedback.tone === 'ok' ? '#8BE4B4' : '#F5B0AA',
                    borderRadius: 7,
                    padding: '6px 8px',
                    fontSize: 10,
                    lineHeight: 1.45,
                  }}
                >
                  {feedback.text}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      {risks.length > 0 ? (
        <div style={{ marginTop: 9, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {risks.slice(0, 4).map((risk, index) => (
            <span key={`${risk.label}-${index}`} style={{ border: '1px solid rgba(245,165,36,0.25)', background: 'rgba(245,165,36,0.055)', color: '#F0C66A', borderRadius: 999, padding: '4px 7px', fontSize: 10 }}>
              {risk.level} · {risk.label}
            </span>
          ))}
        </div>
      ) : null}
      <CommandLinkRail links={commandQuickLinks(ministryBrief)} />
    </CommandPanel>
  );
}

function ChancellorLoopPanel({
  taskId,
  councilSummary,
  ministryBrief,
}: {
  taskId: string | null;
  councilSummary?: string;
  ministryBrief: CommandCenterMinistryBrief | null;
}) {
  const hasTask = Boolean(taskId);
  const mode = resolvePanelMode(hasTask, Boolean(ministryBrief || councilSummary), ministryBrief?.report.sourceLabel);
  const nextAction = ministryBrief?.report.nextAction ?? councilSummary ?? (hasTask ? '等待丞相汇总六部意见。' : '先从上书房立一条真案，军机处生成丞相建议。');
  const blocking = ministryBrief?.audit.blockingIssues ?? [];
  const required = ministryBrief?.audit.requiredActions ?? [];
  const qualityTone = ministryBrief?.audit.passed === false ? '#F58B8B' : ministryBrief ? '#3DD68C' : '#F0C66A';

  return (
    <CommandPanel
      title="提升闭环率 · 丞相建议与追责"
      style={{ position: 'relative', flex: '1 1 0', minHeight: 258 }}
      compact
      badge={panelModeBadge(mode)}
    >
      <div style={{ marginTop: 10, border: `1px solid ${qualityTone}32`, background: `${qualityTone}0F`, borderRadius: 8, padding: '10px 11px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
          <span style={{ color: '#F5E9C9', fontFamily: 'var(--font-serif)', fontSize: 13, fontWeight: 900 }}>推进价值</span>
          <span style={{ color: qualityTone, fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 900 }}>
            {ministryBrief?.audit.passed === false ? '需纠错' : ministryBrief ? '可闭环' : '待接案'}
          </span>
        </div>
        <p style={{ margin: '7px 0 0', color: '#C8CDD8', fontSize: 12, lineHeight: 1.65 }}>
          {nextAction}
        </p>
      </div>

      <div style={{ marginTop: 9, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div style={{ border: '1px solid rgba(240,198,106,0.16)', background: 'rgba(240,198,106,0.035)', borderRadius: 8, padding: '8px 9px' }}>
          <div style={{ color: '#F0C66A', fontSize: 10, fontWeight: 900 }}>可纠错项</div>
          <p style={{ margin: '5px 0 0', color: '#C8B98D', fontSize: 10.5, lineHeight: 1.55 }}>
            {blocking.slice(0, 3).join('、') || '暂无阻断项；继续观察证据和来源。'}
          </p>
        </div>
        <div style={{ border: '1px solid rgba(138,164,255,0.16)', background: 'rgba(138,164,255,0.040)', borderRadius: 8, padding: '8px 9px' }}>
          <div style={{ color: '#AFC0FF', fontSize: 10, fontWeight: 900 }}>补充信息</div>
          <p style={{ margin: '5px 0 0', color: '#B8C5CF', fontSize: 10.5, lineHeight: 1.55 }}>
            {required.slice(0, 3).join('、') || ministryBrief?.report.missingEvidence.slice(0, 3).join('、') || '暂无明确补证清单。'}
          </p>
        </div>
      </div>

      <div style={{ marginTop: 9, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 7 }}>
        {[
          ['纠错', '重开分歧点'],
          ['补证', '要求部门补材料'],
          ['闭环', '确定执行责任'],
        ].map(([label, note]) => (
          <Link
            key={label}
            href={taskId ? `/court-briefing?taskId=${encodeURIComponent(taskId)}` : '/court-briefing'}
            style={{
              border: '1px solid rgba(255,255,255,0.10)',
              background: 'rgba(255,255,255,0.034)',
              borderRadius: 8,
              padding: '8px 6px',
              textAlign: 'center',
              textDecoration: 'none',
            }}
          >
            <span style={{ display: 'block', color: '#F5E9C9', fontFamily: 'var(--font-serif)', fontSize: 12, fontWeight: 900 }}>{label}</span>
            <span style={{ display: 'block', marginTop: 3, color: '#8F9BB2', fontSize: 9 }}>{note}</span>
          </Link>
        ))}
      </div>

      <div className="command-center-workflow-wrapper" style={{ marginTop: 10 }}>
        <DepartmentWorkflowChip deptLabel="军机处" deptCode="command" />
      </div>
      <CommandLinkRail links={commandQuickLinks(ministryBrief)} label="联动" />
    </CommandPanel>
  );
}

function BossDecisionPanel({
  taskId,
  memorial,
  councilSummary,
  risks,
  ministryBrief,
}: {
  taskId: string | null;
  memorial: MemorialSnapshot | null;
  councilSummary?: string;
  risks: RiskBanner[];
  ministryBrief: CommandCenterMinistryBrief | null;
}) {
  const hasTask = Boolean(taskId);
  const hasMemorial = Boolean(memorial?.memorialId || ministryBrief);
  const sourceLabel = ministryBrief?.report.sourceLabel;
  const mode = resolvePanelMode(hasTask, hasMemorial, sourceLabel);
  const sourceColor = sourceLabel ? commandCenterSourceTone(sourceLabel) : '#8F9BB2';
  const isBlocked = Boolean(ministryBrief && (!ministryBrief.audit.passed || ministryBrief.review.overallSignal === 'RED'));
  const throneHref = taskId
    ? `/throne/brief/${encodeURIComponent(taskId)}${memorial?.memorialId ? `?memorialId=${encodeURIComponent(memorial.memorialId)}` : ''}`
    : '/throne/pulse';
  const scroll = ministryBrief?.unified.memorialScroll;
  const decisionActions = scroll?.decisionActions ?? (isBlocked ? ['补证', '人工确认', '驳回风险承诺'] : ['准奏', '补证', '复核']);

  return (
    <CommandPanel
      title="压缩决策成本 · 老板裁决项"
      style={{ position: 'relative', flex: '1.1 1 0', minHeight: 270, paddingBottom: 58 }}
      compact
      badge={panelModeBadge(mode)}
    >
      {mode !== 'LIVE' ? (
        <PendingHint text={mode === 'DEMO' ? '当前没有真案。立案后这里只放能提升速度、降低风险、需要老板亲裁的事项。' : '已接案，等待奏折或丞相建议生成可裁决项。'} />
      ) : (
        <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
          <div style={{ border: `1px solid ${sourceColor}33`, background: `${sourceColor}10`, borderRadius: 8, padding: '9px 10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
              <span style={{ color: '#F5E9C9', fontFamily: 'var(--font-serif)', fontSize: 13, fontWeight: 900 }}>
                {scroll ? `${scroll.verdict} · ${scroll.oneSentence}` : ministryBrief?.report.oneSentence ?? '奏折待定'}
              </span>
              <span style={{ flexShrink: 0, color: sourceColor, border: `1px solid ${sourceColor}55`, borderRadius: 999, padding: '3px 7px', fontSize: 9, fontWeight: 900 }}>
                {sourceLabel ?? memorial?.streamStatus ?? 'PENDING'}
              </span>
            </div>
            <p style={{ margin: '6px 0 0', color: '#B8C5CF', fontSize: 11.5, lineHeight: 1.6 }}>
              {ministryBrief?.report.nextAction || councilSummary || '等待作战流跨组汇总。'}
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 7 }}>
            <CommandMetric label="质门" value={isBlocked ? '阻断' : '通过'} note={isBlocked ? '需人工确认' : '可进入裁决'} tone={isBlocked ? '#F58B8B' : '#3DD68C'} />
            <CommandMetric label="缺证" value={ministryBrief?.report.missingEvidence.length ?? 0} note="裁决前补齐" tone="#F0C66A" />
            <CommandMetric label="风险" value={risks.length + (ministryBrief?.report.risks.length ?? 0)} note="不可静默承诺" tone="#F58B8B" />
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {decisionActions.map((action) => (
              <span key={action} style={{ border: action.includes('人工') || action.includes('驳回') ? '1px solid rgba(245,139,139,0.30)' : '1px solid rgba(240,198,106,0.24)', color: action.includes('人工') || action.includes('驳回') ? '#F5B0AA' : '#F0C66A', background: 'rgba(255,255,255,0.030)', borderRadius: 999, padding: '5px 8px', fontSize: 10, fontWeight: 800 }}>
                {action}
              </span>
            ))}
          </div>
        </div>
      )}

      <Link
        href={throneHref}
        style={{
          position: 'absolute',
          left: 14,
          right: 14,
          bottom: 12,
          display: 'block',
          textAlign: 'center',
          border: isBlocked ? '1px solid rgba(245,139,139,0.52)' : '1px solid rgba(255,224,154,0.66)',
          borderRadius: 8,
          background: isBlocked ? 'linear-gradient(180deg, rgba(122,36,30,0.74), rgba(77,18,16,0.72))' : 'linear-gradient(180deg, #F0C66A, #C99547)',
          color: isBlocked ? '#F5E9C9' : '#211404',
          fontFamily: 'var(--font-serif)',
          fontSize: 13,
          fontWeight: 800,
          letterSpacing: '0.16em',
          padding: '8px 12px',
          textDecoration: 'none',
        }}
      >
        {isBlocked ? '转御座人工确认' : '呈报皇上裁决'}
      </Link>
    </CommandPanel>
  );
}

interface HexagonAssessmentAxis {
  key: string;
  label: string;
  score: number;
  valueLine: string;
  evidence: string;
  improvement: string;
  tone: string;
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function assessmentLevel(score: number): { label: string; tone: string } {
  if (score >= 82) return { label: '推进强', tone: '#3DD68C' };
  if (score >= 64) return { label: '可推进', tone: '#F0C66A' };
  if (score >= 46) return { label: '需补强', tone: '#F5A524' };
  return { label: '高风险', tone: '#F58B8B' };
}

function buildHexagonAssessment(input: {
  taskId: string | null;
  ministers: MinisterRow[];
  risks: RiskBanner[];
  groups: GroupCard[];
  memorial: MemorialSnapshot | null;
  ministryBrief: CommandCenterMinistryBrief | null;
  conflicts: string[];
  missingEvidence: string[];
}): HexagonAssessmentAxis[] {
  const { taskId, ministers, risks, groups, memorial, ministryBrief, conflicts, missingEvidence } = input;
  const completedMinisters = ministers.filter((minister) => minister.status === 'completed').length;
  const selectedMinistries = ministryBrief?.review.selectedMinistries.length ?? ministers.length;
  const blockingIssues = ministryBrief?.audit.blockingIssues.length ?? 0;
  const sourceLabel = ministryBrief?.report.sourceLabel ?? (taskId ? 'MIXED' : 'DEMO');
  const liveSourceBonus = sourceLabel === 'LIVE' || sourceLabel === 'LIVE_SWARM' ? 18 : sourceLabel === 'MIXED' ? 8 : 0;
  const hasBossDecision = Boolean(ministryBrief?.report.oneSentence || ministryBrief?.unified.memorialScroll?.oneSentence || memorial?.memorialId);

  return [
    {
      key: 'speed',
      label: '执行速度',
      score: clampScore(42 + groups.length * 12 + (memorial?.memorialId ? 18 : 0) + (taskId ? 10 : 0)),
      valueLine: groups.length ? `已调动 ${groups.length} 条蜂群/泳道推进。` : '尚未形成真实执行泳道。',
      evidence: groups.length ? groups.slice(0, 3).map((group) => group.name || group.groupId).join('、') : '等待作战流派遣蜂群。',
      improvement: groups.length ? '下一步压缩等待：给每条泳道绑定责任人和回奏时间。' : '先把项目拆成 1-3 条可派发泳道，提升启动速度。',
      tone: '#8AA4FF',
    },
    {
      key: 'coordination',
      label: '协同清晰',
      score: clampScore(40 + selectedMinistries * 8 + completedMinisters * 6 - conflicts.length * 10),
      valueLine: selectedMinistries ? `${selectedMinistries} 个部门进入同一判断面。` : '部门协同尚未成形。',
      evidence: conflicts.length ? `存在 ${conflicts.length} 条跨部门内耗。` : '当前未暴露硬分歧。',
      improvement: conflicts.length ? '把分歧拆成准/补证/驳回三个裁决项，减少反复会商。' : '继续保持部门口径同屏，防止后续各说各话。',
      tone: '#F0C66A',
    },
    {
      key: 'evidence',
      label: '证据完整',
      score: clampScore(72 + liveSourceBonus - missingEvidence.length * 12),
      valueLine: missingEvidence.length ? `还有 ${missingEvidence.length} 项关键证据待补。` : '关键证据暂未暴露缺口。',
      evidence: missingEvidence.slice(0, 3).join('、') || `来源标记 ${sourceLabel}`,
      improvement: missingEvidence.length ? '先补最影响报价/交期/责任的证据，提升裁决可信度。' : '把已用证据固化进史馆，便于下次复用。',
      tone: '#3DD68C',
    },
    {
      key: 'risk',
      label: '风险压降',
      score: clampScore(86 - risks.length * 9 - blockingIssues * 14 + (ministryBrief?.audit.passed ? 8 : 0)),
      valueLine: risks.length || blockingIssues ? `识别 ${risks.length + blockingIssues} 个风险/阻断点。` : '当前未见红色阻断。',
      evidence: [...risks.map((risk) => risk.label), ...(ministryBrief?.audit.blockingIssues ?? [])].slice(0, 3).join('、') || '御史台暂未阻断。',
      improvement: risks.length || blockingIssues ? '红色项必须短句压顶，先降责任外溢、现金和客户承诺风险。' : '继续保持风险显性化，防止普通事项伪装成安全事项。',
      tone: '#F58B8B',
    },
    {
      key: 'decision',
      label: '老板裁决',
      score: clampScore(38 + (hasBossDecision ? 32 : 0) + (missingEvidence.length === 0 ? 15 : 0) - blockingIssues * 8),
      valueLine: hasBossDecision ? '已形成老板可裁的一句话。' : '老板裁决项尚未提纯。',
      evidence: ministryBrief?.report.oneSentence ?? ministryBrief?.unified.memorialScroll?.oneSentence ?? '等待价值纪要提炼。',
      improvement: hasBossDecision ? '把裁决压成一个取舍：准、补证、驳回，不让老板读部门过程。' : '先生成“老板裁哪一刀”，压缩老板判断成本。',
      tone: '#F0C66A',
    },
    {
      key: 'loop',
      label: '闭环追责',
      score: clampScore(36 + (taskId ? 18 : 0) + (memorial?.memorialId ? 22 : 0) + (ministryBrief ? 12 : 0) - missingEvidence.length * 4),
      valueLine: taskId ? '已绑定任务链路，可承接裁决与归档。' : '尚未绑定真任务链路。',
      evidence: memorial?.memorialId ? `奏折 ${memorial.memorialId}` : taskId ? `任务 ${taskId}` : '演示态不写入闭环。',
      improvement: taskId ? '下一步给每个价值句绑定责任人、截止时间和史馆回收指标。' : '先从上书房立真案，避免价值纪要停留在演示态。',
      tone: '#AFC0FF',
    },
  ];
}

function HexagonAssessmentPanel({ axes }: { axes: HexagonAssessmentAxis[] }) {
  const [open, setOpen] = useState(false);
  const avg = Math.round(axes.reduce((sum, item) => sum + item.score, 0) / axes.length);
  const level = assessmentLevel(avg);
  const center = 78;
  const maxRadius = 62;
  const chartPoints = axes
    .map((axis, index) => {
      const angle = -Math.PI / 2 + (index * Math.PI * 2) / axes.length;
      const radius = (axis.score / 100) * maxRadius;
      return `${center + Math.cos(angle) * radius},${center + Math.sin(angle) * radius}`;
    })
    .join(' ');
  const outerPoints = axes
    .map((_, index) => {
      const angle = -Math.PI / 2 + (index * Math.PI * 2) / axes.length;
      return `${center + Math.cos(angle) * maxRadius},${center + Math.sin(angle) * maxRadius}`;
    })
    .join(' ');

  return (
    <div style={{ marginTop: 16, border: '1px solid rgba(240,198,106,0.20)', background: 'rgba(240,198,106,0.045)', borderRadius: 10, padding: 12 }}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          border: 0,
          background: 'transparent',
          padding: 0,
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span>
          <span style={{ display: 'block', color: '#F5E9C9', fontFamily: 'var(--font-serif)', fontSize: 14, fontWeight: 900 }}>
            六边形项目评估
          </span>
          <span style={{ display: 'block', marginTop: 4, color: '#9AA3C4', fontSize: 10.5 }}>
            打开看执行、协同、证据、风险、裁决、闭环六项详细分析
          </span>
        </span>
        <span style={{ flexShrink: 0, border: `1px solid ${level.tone}55`, background: `${level.tone}12`, color: level.tone, borderRadius: 999, padding: '5px 9px', fontSize: 10, fontWeight: 900 }}>
          {avg} · {level.label}
        </span>
      </button>

      <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '156px minmax(0, 1fr)', gap: 12, alignItems: 'center' }}>
        <svg viewBox="0 0 156 156" width="156" height="156" role="img" aria-label={`六边形项目评分 ${avg}`}>
          <polygon points={outerPoints} fill="rgba(240,198,106,0.035)" stroke="rgba(240,198,106,0.22)" strokeWidth="1" />
          {[0.66, 0.33].map((scale) => (
            <polygon
              key={scale}
              points={axes
                .map((_, index) => {
                  const angle = -Math.PI / 2 + (index * Math.PI * 2) / axes.length;
                  const radius = maxRadius * scale;
                  return `${center + Math.cos(angle) * radius},${center + Math.sin(angle) * radius}`;
                })
                .join(' ')}
              fill="none"
              stroke="rgba(240,198,106,0.10)"
              strokeWidth="1"
            />
          ))}
          {axes.map((axis, index) => {
            const angle = -Math.PI / 2 + (index * Math.PI * 2) / axes.length;
            const x = center + Math.cos(angle) * maxRadius;
            const y = center + Math.sin(angle) * maxRadius;
            return <line key={axis.key} x1={center} y1={center} x2={x} y2={y} stroke="rgba(240,198,106,0.10)" strokeWidth="1" />;
          })}
          <polygon points={chartPoints} fill="rgba(240,198,106,0.22)" stroke="#F0C66A" strokeWidth="2" />
          <circle cx={center} cy={center} r="4" fill="#F0C66A" />
        </svg>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 7 }}>
          {axes.map((axis) => (
            <div key={axis.key} style={{ border: `1px solid ${axis.tone}26`, background: `${axis.tone}0A`, borderRadius: 8, padding: '7px 8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                <span style={{ color: '#D8CEAE', fontSize: 10, fontWeight: 800 }}>{axis.label}</span>
                <span style={{ color: axis.tone, fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 900 }}>{axis.score}</span>
              </div>
              <div style={{ marginTop: 4, height: 3, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                <span style={{ display: 'block', width: `${axis.score}%`, height: '100%', background: axis.tone }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {open ? (
        <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
          {axes.map((axis) => (
            <article key={`${axis.key}-detail`} style={{ border: `1px solid ${axis.tone}28`, background: `${axis.tone}0A`, borderRadius: 9, padding: '9px 10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                <span style={{ color: axis.tone, fontFamily: 'var(--font-serif)', fontSize: 12, fontWeight: 900 }}>
                  {axis.label} · {axis.score}
                </span>
                <span style={{ color: '#8F9BB2', fontSize: 9 }}>价值分析</span>
              </div>
              <p style={{ margin: '6px 0 0', color: '#D8CEAE', fontSize: 11, lineHeight: 1.55 }}>{axis.valueLine}</p>
              <p style={{ margin: '5px 0 0', color: '#9AA3C4', fontSize: 10.5, lineHeight: 1.5 }}>证据：{axis.evidence}</p>
              <p style={{ margin: '5px 0 0', color: '#C8B98D', fontSize: 10.5, lineHeight: 1.5 }}>提升动作：{axis.improvement}</p>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}

const DEPT_EVIDENCE_LABELS: Record<string, string> = {
  finance: '户部',
  ops: '兵部',
  legal: '刑部',
  works: '工部',
  market: '礼部',
  guard: '锦衣卫',
  physician: '太医院',
};

function shortEvidenceId(value?: string | null): string {
  if (!value) return '待回写';
  if (value.length <= 22) return value;
  return `${value.slice(0, 12)}…${value.slice(-6)}`;
}

function IntegrationEvidencePanel({ taskId, taskSummary }: { taskId: string | null; taskSummary: TaskSummary | null }) {
  const swarm = taskSummary?.jiqunSwarm ?? null;
  const coverage = taskSummary?.coverage ?? null;
  const courtTaskId = taskSummary?.id ?? taskId;
  const sessionId = swarm?.sessionId ?? null;
  const entrySwarm = swarm?.entrySwarm ?? null;
  const realExpected = coverage?.realExpected ?? 4;
  const realResponded = coverage?.realResponded ?? 0;
  const ratio = realExpected > 0 ? Math.min(100, Math.round((realResponded / realExpected) * 100)) : 0;
  const live = Boolean(courtTaskId && sessionId && entrySwarm && coverage);
  const statusTone = live && realResponded >= realExpected ? '#3DD68C' : live ? '#F0C66A' : '#8AA4FF';
  const statusLabel = live
    ? realResponded >= realExpected
      ? '真链已闭合'
      : '真链待补齐'
    : taskId
      ? '等待后端证据'
      : '待立真案';
  const responded = coverage?.responded ?? [];
  const absent = coverage?.absent ?? [];
  const evidenceCells = [
    { label: '主库任务', value: shortEvidenceId(courtTaskId), note: courtTaskId ? '前端任务总线已接案' : '从上书房立案后生成', tone: '#F0C66A' },
    { label: '后端会话', value: shortEvidenceId(sessionId), note: sessionId ? 'jiqun 蜂群已受理' : '等待 jiqun session_id', tone: '#8AA4FF' },
    { label: '入口蜂群', value: entrySwarm ?? '待路由', note: entrySwarm ? '已选执行主蜂群' : '等待后端路由', tone: '#AFC0FF' },
    { label: '真司覆盖', value: `${realResponded}/${realExpected}`, note: realResponded >= realExpected ? '四个真司全部回话' : '仍有真司待回话', tone: statusTone },
  ];

  return (
    <section
      style={{
        marginTop: 16,
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 12,
        border: `1px solid ${statusTone}3F`,
        background:
          'radial-gradient(circle at 16% 16%, rgba(240,198,106,0.16), transparent 32%), linear-gradient(135deg, rgba(240,198,106,0.115), rgba(9,15,20,0.76) 42%, rgba(28,18,8,0.62))',
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.08), 0 14px 32px rgba(0,0,0,0.25), 0 0 28px ${statusTone}14`,
        padding: 14,
      }}
    >
      <div aria-hidden style={{ position: 'absolute', right: -42, top: -48, width: 128, height: 128, borderRadius: '50%', border: '1px solid rgba(240,198,106,0.18)' }} />
      <div aria-hidden style={{ position: 'absolute', right: 18, top: 18, width: 46, height: 46, borderRadius: '50%', border: `1px solid ${statusTone}55`, display: 'grid', placeItems: 'center', color: statusTone, fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 900, background: `${statusTone}12` }}>
        印
      </div>
      <div style={{ position: 'relative', paddingRight: 58 }}>
        <div style={{ color: '#8F835F', fontSize: 9.5, letterSpacing: '0.22em', textTransform: 'uppercase' }}>FRONTEND × JIQUN EVIDENCE</div>
        <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <h3 style={{ margin: 0, color: '#F5E9C9', fontFamily: 'var(--font-serif)', fontSize: 16, lineHeight: 1.2, fontWeight: 900 }}>
            前后端拉通证据
          </h3>
          <span style={{ flexShrink: 0, color: statusTone, border: `1px solid ${statusTone}55`, background: `${statusTone}12`, borderRadius: 999, padding: '4px 8px', fontSize: 10, fontWeight: 900 }}>
            {statusLabel}
          </span>
        </div>
        <p style={{ margin: '8px 0 0', color: '#B9AE8C', fontSize: 11.5, lineHeight: 1.65 }}>
          把“前端任务总线、后端蜂群会话、入口蜂群、真司覆盖”钉在同一张证据卡里，提升老板对项目是否真跑起来的判断速度。
        </p>
      </div>

      <div style={{ position: 'relative', marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
        {evidenceCells.map((cell) => (
          <div key={cell.label} style={{ minWidth: 0, border: `1px solid ${cell.tone}2E`, background: `${cell.tone}0D`, borderRadius: 9, padding: '9px 9px 8px' }}>
            <div style={{ color: '#8F9BB2', fontSize: 9.5, fontWeight: 800 }}>{cell.label}</div>
            <div style={{ marginTop: 5, color: cell.tone, fontFamily: 'var(--font-mono)', fontSize: 11.5, fontWeight: 900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={String(cell.value)}>
              {cell.value}
            </div>
            <div style={{ marginTop: 5, color: '#AFA486', fontSize: 9.5, lineHeight: 1.35 }}>{cell.note}</div>
          </div>
        ))}
      </div>

      <div style={{ position: 'relative', marginTop: 12, border: '1px solid rgba(240,198,106,0.15)', borderRadius: 9, padding: '9px 10px', background: 'rgba(4,8,12,0.34)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, color: '#D8CEAE', fontSize: 10.5, fontWeight: 800 }}>
          <span>真司回话覆盖</span>
          <span style={{ color: statusTone }}>{ratio}%</span>
        </div>
        <div style={{ marginTop: 7, height: 5, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
          <span style={{ display: 'block', width: `${ratio}%`, height: '100%', borderRadius: 999, background: `linear-gradient(90deg, ${statusTone}, #F0C66A)` }} />
        </div>
        <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {(responded.length ? responded : ['finance', 'ops', 'legal', 'works']).map((dept) => (
            <span key={dept} style={{ border: '1px solid rgba(61,214,140,0.28)', background: 'rgba(61,214,140,0.08)', color: '#9BE7B9', borderRadius: 999, padding: '4px 7px', fontSize: 9.5, fontWeight: 800 }}>
              {DEPT_EVIDENCE_LABELS[dept] ?? dept}
            </span>
          ))}
          {absent.slice(0, 3).map((item) => (
            <span key={`${item.dept}-${item.status}-${item.kind}`} style={{ border: '1px solid rgba(245,139,139,0.24)', background: 'rgba(245,139,139,0.07)', color: '#F5B0AA', borderRadius: 999, padding: '4px 7px', fontSize: 9.5, fontWeight: 800 }}>
              {DEPT_EVIDENCE_LABELS[item.dept] ?? item.dept} · {item.kind}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function CoreMemoScroll({
  taskId,
  taskSummary,
  ministers,
  risks,
  groups,
  councilSummary,
  memorial,
  ministryBrief,
}: {
  taskId: string | null;
  taskSummary: TaskSummary | null;
  ministers: MinisterRow[];
  risks: RiskBanner[];
  groups: GroupCard[];
  councilSummary?: string;
  memorial: MemorialSnapshot | null;
  ministryBrief: CommandCenterMinistryBrief | null;
}) {
  const title = taskSummary?.title ?? taskSummary?.intent ?? taskSummary?.rawCommand ?? '今日军机处价值纪要';
  const sourceLabel = ministryBrief?.report.sourceLabel ?? (taskId ? 'MIXED' : 'DEMO');
  const sourceColor = commandCenterSourceTone(sourceLabel);
  const conflicts = ministryBrief?.review.conflicts.map((item) => item.summary) ?? [];
  const missingEvidence = ministryBrief?.report.missingEvidence ?? [];
  const hexagonAxes = buildHexagonAssessment({
    taskId,
    ministers,
    risks,
    groups,
    memorial,
    ministryBrief,
    conflicts,
    missingEvidence,
  });
  const nextAction = ministryBrief?.report.nextAction ?? councilSummary ?? (taskId ? '等待六部会审和蜂群回写后形成后令。' : '从上书房下一条真案后，军机处将在此生成价值纪要。');
  const bossDecision = ministryBrief?.unified.memorialScroll?.oneSentence ?? ministryBrief?.report.oneSentence ?? (taskId ? '待形成能压缩判断成本的老板裁决项。' : '暂无真案，先显示价值纪要骨架。');
  const stage = memorial?.memorialId
    ? '已成奏折'
    : groups.length
      ? '蜂群执行'
      : ministers.length
        ? '六部会审'
        : taskId
          ? '已接案'
          : '待接案';
  const memoRows = [
    {
      label: '一 · 提升什么',
      body: title,
      meta: `${stage} · 大臣 ${ministers.length} · 蜂群 ${groups.length}`,
      tone: '#F0C66A',
    },
    {
      label: '二 · 降低什么',
      body: conflicts[0] ?? ministryBrief?.review.cards[0]?.disputeFocus ?? '暂无真实分歧回写；先按户部、兵部、工部、刑部四方口径排查，降低返工、误判和责任外溢。',
      meta: conflicts.length ? `${conflicts.length} 条内耗` : '内耗待识别',
      tone: conflicts.length ? '#F58B8B' : '#8AA4FF',
    },
    {
      label: '三 · 推进路径',
      body: nextAction,
      meta: ministryBrief?.audit.passed === false ? '需纠错/补证' : '可继续推进',
      tone: ministryBrief?.audit.passed === false ? '#F58B8B' : '#3DD68C',
    },
    {
      label: '四 · 老板裁哪一刀',
      body: bossDecision,
      meta: missingEvidence.length ? `缺证 ${missingEvidence.length}` : '等待圣裁',
      tone: missingEvidence.length ? '#F0C66A' : '#3DD68C',
    },
  ];

  return (
    <section
      className="command-center-core-scroll"
      style={{
        minHeight: 0,
        height: '100%',
        position: 'relative',
        borderRadius: 10,
        border: '1px solid rgba(240,198,106,0.28)',
        background:
          'linear-gradient(180deg, rgba(42,29,12,0.80), rgba(14,15,19,0.72) 18%, rgba(10,12,16,0.82) 82%, rgba(42,29,12,0.76))',
        boxShadow: '0 20px 54px rgba(0,0,0,0.38), inset 0 0 0 1px rgba(255,255,255,0.055)',
        overflow: 'hidden',
      }}
    >
      <div aria-hidden style={{ position: 'absolute', left: 18, right: 18, top: 14, height: 12, borderRadius: 999, background: 'linear-gradient(90deg, rgba(91,58,22,0.4), rgba(240,198,106,0.58), rgba(91,58,22,0.4))' }} />
      <div aria-hidden style={{ position: 'absolute', left: 18, right: 18, bottom: 14, height: 12, borderRadius: 999, background: 'linear-gradient(90deg, rgba(91,58,22,0.4), rgba(240,198,106,0.46), rgba(91,58,22,0.4))' }} />
      <div
        style={{
          position: 'absolute',
          inset: '30px 18px',
          borderRadius: 8,
          border: '1px solid rgba(240,198,106,0.18)',
          background:
            'linear-gradient(180deg, rgba(248,225,159,0.125), rgba(14,16,20,0.52) 14%, rgba(7,10,14,0.58) 86%, rgba(248,225,159,0.10))',
        }}
      />
      <div style={{ position: 'relative', height: '100%', padding: '48px 30px 48px', overflowY: 'auto' }} className="thin-scroll">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ color: '#8F835F', fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase' }}>JUNJICHU MEMORIAL</div>
            <h2 style={{ margin: '7px 0 0', color: '#F5E9C9', fontFamily: 'var(--font-serif)', fontSize: 24, lineHeight: 1.18, fontWeight: 900, letterSpacing: '0.04em' }}>
              军机处价值纪要卷轴
            </h2>
          </div>
          <span style={{ flexShrink: 0, border: `1px solid ${sourceColor}55`, background: `${sourceColor}12`, color: sourceColor, borderRadius: 999, padding: '5px 9px', fontSize: 10, fontWeight: 900 }}>
            {sourceLabel}
          </span>
        </div>

        <div style={{ marginTop: 16, borderTop: '1px solid rgba(240,198,106,0.16)', borderBottom: '1px solid rgba(240,198,106,0.10)', padding: '12px 0' }}>
          <p style={{ margin: 0, color: '#D9C99C', fontFamily: 'var(--font-serif)', fontSize: 15, lineHeight: 1.85 }}>
            {title}
          </p>
          <p style={{ margin: '8px 0 0', color: '#8F9BB2', fontSize: 11.5, lineHeight: 1.65 }}>
            {taskId ? `案号 ${taskId}` : '演示态 · 立真案后纪要自动汇总提升目标、内耗来源、推进路径和老板裁决项'}
          </p>
        </div>

        <div style={{ marginTop: 16, display: 'grid', gap: 11 }}>
          {memoRows.map((row) => (
            <article key={row.label} style={{ border: `1px solid ${row.tone}2E`, background: `${row.tone}0C`, borderRadius: 9, padding: '12px 13px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ color: row.tone, fontFamily: 'var(--font-serif)', fontSize: 13, fontWeight: 900 }}>{row.label}</span>
                <span style={{ color: '#8F9BB2', fontSize: 10 }}>{row.meta}</span>
              </div>
              <p style={{ margin: '8px 0 0', color: '#D8CEAE', fontSize: 12.5, lineHeight: 1.75 }}>
                {row.body}
              </p>
            </article>
          ))}
        </div>

        <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
          <CommandMetric label="协同提升" value={ministers.length || ministryBrief?.review.selectedMinistries.length || 0} note="六部意见" tone="#8AA4FF" />
          <CommandMetric label="判断提纯" value={missingEvidence.length} note="补齐后裁" tone="#F0C66A" />
          <CommandMetric label="风险压降" value={risks.length + (ministryBrief?.report.risks.length ?? 0)} note="不可静默" tone="#F58B8B" />
        </div>

        <IntegrationEvidencePanel taskId={taskId} taskSummary={taskSummary} />

        <HexagonAssessmentPanel axes={hexagonAxes} />

        <CommandLinkRail links={commandQuickLinks(ministryBrief, groups)} label="卷内直达" />
      </div>
    </section>
  );
}

/** 左侧面板：任务概览 + 圣旨原文 + Agent 工作图 + 执行路径 + 工部建设案 */
function LeftSidePanel({
  taskId,
  taskSummary,
  groups,
  risks,
  ministers,
  memorial,
}: {
  taskId: string | null;
  taskSummary: TaskSummary | null;
  groups: GroupCard[];
  risks: RiskBanner[];
  ministers: MinisterRow[];
  memorial: MemorialSnapshot | null;
}) {
  const hasTask = Boolean(taskId);
  const mode = resolvePanelMode(hasTask, Boolean(taskSummary));
  
  return (
    <div className="h-full space-y-3 overflow-auto thin-scroll">
      {/* 任务概览卡片 */}
      <CommandPanel
        title="任务概览"
        style={{ position: 'relative', height: 'auto' }}
        compact
        badge={panelModeBadge(mode)}
      >
        <div style={{ marginTop: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ color: '#F0C66A', fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
                TASK ID
              </div>
              <div style={{ marginTop: 3, color: '#F5E9C9', fontSize: 13, fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>
                {taskId ?? 'demo-no-task'}
              </div>
            </div>
            <span style={{
              border: '1px solid rgba(240,198,106,0.22)',
              background: 'rgba(240,198,106,0.08)',
              color: '#F0C66A',
              borderRadius: 999,
              padding: '4px 8px',
              fontSize: 10,
              whiteSpace: 'nowrap',
            }}>
              {taskSummary?.status ?? 'demo'}
            </span>
          </div>
          <div style={{ marginTop: 10, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 10 }}>
            <div style={{ color: '#8F9BB2', fontSize: 10 }}>来源</div>
            <div style={{ marginTop: 2, color: '#C8CDD8', fontSize: 12 }}>
              {taskSummary?.source ?? 'demo-source'}
            </div>
          </div>
          <div style={{ marginTop: 8, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 10 }}>
            <div style={{ color: '#8F9BB2', fontSize: 10 }}>更新时间</div>
            <div style={{ marginTop: 2, color: '#C8CDD8', fontSize: 12 }}>
              {taskSummary?.updatedAt ?? '等待首次更新'}
            </div>
          </div>
        </div>
      </CommandPanel>

      {/* 圣旨原文 */}
      <DecreePanel taskSummary={taskSummary} hasTask={hasTask} />

      {/* Agent 工作图 */}
      <SwarmLaneBoard
        taskId={taskId}
        taskSummary={taskSummary}
        groups={groups}
        risks={risks}
        ministers={ministers}
      />

      {/* 执行路径 */}
      <CommandPanel
        title="执行路径"
        style={{ position: 'relative', height: 'auto' }}
        compact
        badge={panelModeBadge(mode)}
      >
        <ExecutionPathContent
          taskId={taskId}
          ministers={ministers}
          groups={groups}
          memorial={memorial}
        />
      </CommandPanel>

      {/* 工部建设台账已迁至工部办公厅右栏(2026-06-29 军机处理顺·见 JUNJICHU-REFACTOR-PLAN)。
          军机处回归御前合议:只留圣旨/会审/奏折/执行路径,建设进度归工部。 */}
    </div>
  );
}

/** 右侧面板：大臣会审 + 最终奏折 + 今日三令 */
function RightSidePanel({
  taskId,
  taskSummary,
  ministers,
  risks,
  councilSummary,
  memorial,
  ministryBrief,
}: {
  taskId: string | null;
  taskSummary: TaskSummary | null;
  ministers: MinisterRow[];
  risks: RiskBanner[];
  councilSummary?: string;
  memorial: MemorialSnapshot | null;
  ministryBrief: CommandCenterMinistryBrief | null;
}) {
  return (
    <div className="h-full space-y-3 overflow-auto thin-scroll">
      {/* 大臣会审面板 */}
      <CouncilPanel
        taskId={taskId}
        ministers={ministers}
        risks={risks}
        councilSummary={councilSummary}
        ministryBrief={ministryBrief}
      />

      {/* 最终奏折面板 */}
      <FinalMemorialPanel
        taskId={taskId}
        memorial={memorial}
        councilSummary={councilSummary}
        risks={risks}
        ministryBrief={ministryBrief}
      />

      {/* 今日三令 */}
      <div 
        className="command-center-workflow-wrapper"
        style={{ 
          marginTop: 12, 
          width: '100%',
          position: 'relative'
        }}
      >
        <DepartmentWorkflowChip deptLabel="军机处" deptCode="command" />
      </div>
    </div>
  );
}

/** 执行路径内容组件（军机处实际渲染的执行路径；旧 ExecutionPathPanel 死壳已删 2026-06-29） */
function ExecutionPathContent({
  taskId,
  ministers,
  groups,
  memorial,
}: {
  taskId: string | null;
  ministers: MinisterRow[];
  groups: GroupCard[];
  memorial: MemorialSnapshot | null;
}) {
  const hasTask = Boolean(taskId);
  const mode: PanelMode = hasTask ? 'LIVE' : 'DEMO';

  if (mode === 'LIVE') {
    const reached = [
      true,
      ministers.length > 0,
      groups.length > 0,
      Boolean(memorial?.memorialId),
      memorial?.streamStatus === 'done',
    ];
    const lastReached = reached.lastIndexOf(true);
    const stages = [
      ['决策理解', '丞相已接案'],
      ['大臣会审', ministers.length ? `${ministers.length} 位参审` : '待召'],
      ['蜂群执行', groups.length ? `${groups.length} 组派遣` : '待派'],
      ['奏折生成', memorial?.qualityScore !== undefined ? `质量 ${memorial.qualityScore}` : '待起草'],
      ['完成归档', memorial?.streamStatus === 'done' ? '已完成' : '待收口'],
    ];

    return (
      <div style={{ marginTop: 9, position: 'relative', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
        <span
          aria-hidden
          style={{
            position: 'absolute',
            left: '2%',
            right: '14%',
            bottom: 8,
            height: 2,
            borderRadius: 999,
            background: 'linear-gradient(90deg, rgba(61,214,140,0.42), rgba(240,198,106,0.66))',
          }}
        />
        {stages.map(([title, note], idx) => {
          const isDone = idx < lastReached;
          const isActive = idx === lastReached;
          const dotColor = isDone ? '#3DD68C' : isActive ? '#F0C66A' : 'rgba(143,155,178,0.45)';
          return (
            <div
              key={title}
              style={{
                position: 'relative',
                minHeight: 44,
                borderRadius: 6,
                border: `1px solid ${isActive ? 'rgba(240,198,106,0.30)' : 'rgba(255,255,255,0.055)'}`,
                background: isActive ? 'rgba(240,198,106,0.05)' : 'rgba(255,255,255,0.024)',
                padding: '6px 8px 16px',
                opacity: idx > lastReached ? 0.55 : 1,
              }}
            >
              <div style={{ color: '#F4E8C7', fontFamily: 'var(--font-serif)', fontSize: 11 }}>{title}</div>
              <div
                style={{
                  marginTop: 2,
                  color: '#8F9BB2',
                  fontSize: 9,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {note}
              </div>
              <span
                style={{
                  position: 'absolute',
                  left: 9,
                  bottom: 4,
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  background: dotColor,
                  boxShadow: isActive || isDone ? '0 0 8px rgba(240,198,106,0.36)' : 'none',
                }}
              />
            </div>
          );
        })}
      </div>
    );
  }

  // DEMO 态
  const steps = [
    ['决策定案', '已完成'],
    ['资源筹备', '演示阶段'],
    ['基建启动', '待立案'],
    ['商路贯通', '待立案'],
    ['成效验收', '待立案'],
  ];

  return (
    <div style={{ marginTop: 9, position: 'relative', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
      <span
        aria-hidden
        style={{
          position: 'absolute',
          left: '2%',
          right: '14%',
          bottom: 8,
          height: 2,
          borderRadius: 999,
          background: 'linear-gradient(90deg, rgba(61,214,140,0.42), rgba(240,198,106,0.66))',
        }}
      />
      {steps.map(([title, date], idx) => (
        <div
          key={title}
          style={{
            position: 'relative',
            minHeight: 44,
            borderRadius: 6,
            border: '1px solid rgba(255,255,255,0.055)',
            background: 'rgba(255,255,255,0.024)',
            padding: '6px 8px 16px',
          }}
        >
          <div style={{ color: '#F4E8C7', fontFamily: 'var(--font-serif)', fontSize: 11 }}>{title}</div>
          <div
            style={{
              marginTop: 2,
              color: '#8F9BB2',
              fontSize: 9,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {date}
          </div>
          <span
            style={{
              position: 'absolute',
              left: 9,
              bottom: 4,
              width: 8,
              height: 8,
              borderRadius: 999,
              background: idx === 0 ? '#3DD68C' : '#F0C66A',
              boxShadow: '0 0 8px rgba(240,198,106,0.36)',
            }}
          />
        </div>
      ))}
    </div>
  );
}

/** 丞相·辅政 浮层正文 —— 当前议题的判断与分歧 */
function ChancellorBody({
  taskSummary,
  ministers,
  risks,
  councilSummary,
  hasTask,
}: {
  taskSummary: TaskSummary | null;
  ministers: MinisterRow[];
  risks: RiskBanner[];
  councilSummary?: string;
  hasTask: boolean;
}) {
  const rowStyle: CSSProperties = { border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.026)', borderRadius: 7, padding: '8px 10px' };
  const labelStyle: CSSProperties = { color: '#F0C66A', fontSize: 10, letterSpacing: '0.08em', fontWeight: 700 };
  const valueStyle: CSSProperties = { color: '#C6BB9D', fontSize: 12, lineHeight: 1.6, marginTop: 3 };
  if (!hasTask) {
    return (
      <div style={{ display: 'grid', gap: 9 }}>
        <div style={rowStyle}><div style={labelStyle}>辅政待命</div><div style={valueStyle}>当前没有真案。先从上书房立一条可执行军令，丞相即在此辅政：拆解议题、汇总六部分歧、标注风险。</div></div>
        <Link href="/court-briefing" style={{ ...rowStyle, display: 'block', textAlign: 'center', color: '#F5E9C9', fontFamily: 'var(--font-serif)', fontWeight: 700, textDecoration: 'none' }}>回上书房立真案 →</Link>
      </div>
    );
  }
  return (
    <div style={{ display: 'grid', gap: 9 }}>
      <div style={rowStyle}>
        <div style={labelStyle}>当前议题</div>
        <div style={valueStyle}>{taskSummary?.intent ?? taskSummary?.title ?? taskSummary?.rawCommand ?? '军机处已接案'}</div>
      </div>
      <div style={rowStyle}>
        <div style={labelStyle}>大臣分歧</div>
        <div style={valueStyle}>{ministers.length ? `${ministers.length} 部门已表态，${ministers.filter((m) => m.status === 'completed').length} 位完成审议` : '会审待召，尚无大臣表态'}</div>
      </div>
      <div style={rowStyle}>
        <div style={labelStyle}>风险标注</div>
        <div style={valueStyle}>{risks.length ? risks.slice(0, 3).map((r) => r.label).join('；') : '暂无真风险回写'}</div>
      </div>
      {councilSummary && (
        <div style={rowStyle}><div style={labelStyle}>跨组汇总</div><div style={valueStyle}>{councilSummary}</div></div>
      )}
    </div>
  );
}

/** 钦天监·训诲 —— 常驻一句候星辞（去新手教程，对齐上书房人物翼克制范式，F3/PRD 2026-07-05） */
function AstrologerBody({ hasTask }: { hasTask: boolean }) {
  const line = hasTask
    ? '候星在侧。中央卷轴随作战流回写会审结论、蜂群进度与风险；奏折成稿即转史馆归档，反哺次日上书房。'
    : '候星在侧，可推演时机、风险、大势与反事实。先从上书房立一条真案，钦天监即随案指导。';
  return (
    <div style={{ border: '1px solid rgba(138,164,255,0.16)', background: 'rgba(138,164,255,0.04)', borderRadius: 7, padding: '9px 11px' }}>
      <div style={{ color: '#9AA3C4', fontSize: 12, lineHeight: 1.75 }}>{line}</div>
    </div>
  );
}


function CommandCenterInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const view = searchParams.get('view');
  const taskId = searchParams.get('taskId') ?? null;
  const fromVerdict = searchParams.get('from') === 'verdict';
  const verdictMode = searchParams.get('mode');
  const buildTaskKey = searchParams.get('task') ?? null;
  const buildIntent = searchParams.get('intent') ?? null;
  const decisionIntent = !taskId && !buildTaskKey && isBusinessDecisionIntent(buildIntent) ? buildIntent : null;
  const activeTaskId = taskId ?? (decisionIntent ? `local_${Array.from(decisionIntent).reduce((acc, char) => (acc * 33 + char.charCodeAt(0)) >>> 0, 5381).toString(36)}` : null);
  const buildContext: BuildDraftContext = {
    origin: searchParams.get('origin'),
    source: searchParams.get('source'),
    suggestion: searchParams.get('suggestion'),
    evidence: parseListParam(searchParams.get('evidence'), '\n'),
    ministers: parseListParam(searchParams.get('ministers'), ','),
  };
  const buildDraft = decisionIntent ? null : resolveBuildDraft(buildTaskKey, buildIntent, buildContext);

  const [taskSummary, setTaskSummary] = useState<TaskSummary | null>(null);
  // 建设台账显示侧已迁工部(2026-06-29 军机处理顺);此处只留建设案派发(create侧·写 SSOT→工部展示)。
  const [dispatchingBuild, setDispatchingBuild] = useState(false);
  const [dispatchError, setDispatchError] = useState<string | null>(null);
  // P0(张小龙·先给动效再给数据):下旨后 jiqun 同步跑蜂群 ~1-2 分钟,期间给即时"集结中"反馈,
  // 而非死冻按钮/89秒沉默(用户会以为卡死)。dispatch 返回真 taskId 即跳军机处。
  const [dispatching, setDispatching] = useState(false);

  // ── 真链路：复用 BattleStream 解析的同一条 SSE，喂给左右栏热区面板（不开第二条连接） ──
  const [liveMinisters, setLiveMinisters] = useState<MinisterRow[]>([]);
  const [liveRisks, setLiveRisks] = useState<RiskBanner[]>([]);
  const [liveGroups, setLiveGroups] = useState<GroupCard[]>([]);
  const [liveCouncilSummary, setLiveCouncilSummary] = useState<string | undefined>(undefined);
  const [liveMemorial, setLiveMemorial] = useState<MemorialSnapshot | null>(null);
  const [shangshufangStatus, setShangshufangStatus] = useState<ShangshufangTaskStatusResponse | null>(null);
  // 后端 result.merge 快照(真六部合议):SSE 未流但任务已跑完(report_ready)时,军机处也能显真会审,
  // 而非只兜底 FALLBACK。上书房早已消费 result.merge,军机处此前完全没读——这是"后端有前端对不上"的真根。
  const [mergeCouncil, setMergeCouncil] = useState<MergeCouncilSnapshot | null>(null);

  // taskId 变化（含切回演示态）时清空上一案的实时数据，避免脏数据冒充新案
  useEffect(() => {
    setLiveMinisters([]);
    setLiveRisks([]);
    setLiveGroups([]);
    setLiveCouncilSummary(undefined);
    setLiveMemorial(null);
    setShangshufangStatus(null);
    setMergeCouncil(null);
  }, [taskId]);

  const handleDispatchBuild = useCallback(async () => {
    if (!buildDraft?.command.trim()) return;
    setDispatchingBuild(true);
    setDispatchError(null);
    try {
      const draft = await chaotang.decreeDraft(buildDraft.dispatchCommand);
      const cats = draft.recommendedCategories ?? [];
      const selectedCategories: CategorySelection[] = cats.slice(0, 1).map((c) => ({
        taskType: c.taskType,
        ministers: c.ministers,
        groups: c.groups,
        label: c.label,
      }));
      const result = await chaotang.decreeDispatch({
        rawCommand: buildDraft.dispatchCommand,
        intent: draft.intent ?? buildDraft.command,
        selectedCategories,
      });
      const ledgerEntry = {
        id: `ledger-${result.taskId}`,
        taskId: result.taskId,
        title: buildDraft.title,
        command: buildDraft.dispatchCommand,
        source: buildDraft.context.source,
        suggestion: buildDraft.context.suggestion,
        evidence: buildDraft.context.evidence,
        ministers: buildDraft.context.ministers,
        createdAt: new Date().toISOString(),
        status: 'dispatched',
      } as const;
      saveBuildLedgerEntry(ledgerEntry);
      void persistBuildLedgerEntry(ledgerEntry).catch(() => {});
      router.push(`/command-center?taskId=${encodeURIComponent(result.taskId)}`);
    } catch {
      setDispatchError('立项失败：请检查登录状态或后端服务，再重试。');
    } finally {
      setDispatchingBuild(false);
    }
  }, [buildDraft?.command, buildDraft?.dispatchCommand, router]);

  // 有 taskId 时加载任务简要信息（圣旨原文/意图）供热区标注
  useEffect(() => {
    if (!taskId) { setTaskSummary(null); return; }
    let cancelled = false;
    chaotang.taskDetail(taskId).then((detail) => {
      if (!cancelled) {
        const detailRecord = isRecord(detail) ? detail : {};
        const taskRecord = pickTaskRecord(detailRecord);
        const resultRecord = pickTaskResult(detailRecord, taskRecord);
        const jiqunSwarm = parseIntegrationSwarm(resultRecord?.jiqunSwarm ?? taskRecord.jiqunSwarm ?? detailRecord.jiqunSwarm);
        const coverage = parseIntegrationCoverage(resultRecord?.coverage ?? taskRecord.coverage ?? detailRecord.coverage);
        setMergeCouncil(parseMergeCouncil(resultRecord)); // 后端已跑完(report_ready)则拿真六部合议快照

        setTaskSummary({
          id: taskId,
          rawCommand: readText(taskRecord.rawCommand) ?? readText(taskRecord.raw_command) ?? readText(taskRecord.description),
          intent: readText(taskRecord.intent) ?? readText(resultRecord?.promptGuidance),
          status: readText(taskRecord.status),
          title: readText(taskRecord.title),
          runId: readText(detailRecord.runId) ?? readText(detailRecord.run_id) ?? readText(taskRecord.runId) ?? readText(taskRecord.run_id),
          source: readText(taskRecord.source) ?? readText(taskRecord.sourceMode) ?? readText(taskRecord.source_mode),
          updatedAt: readText(taskRecord.updatedAt) ?? readText(taskRecord.updated_at),
          decisionId: resultRecord?.decisionId as string | number | null | undefined,
          jiqunSwarm,
          coverage,
        });
      }
    }).catch(() => { /* 静默降级，若是上书房 task_ 会由 jiqun 状态接管 */ });
    return () => { cancelled = true; };
  }, [taskId]);

  useEffect(() => {
    if (!taskId || !taskId.startsWith('task_')) return;
    let cancelled = false;
    shangshufangTaskStatus(taskId)
      .then((status) => {
        if (cancelled) return;
        setShangshufangStatus(status);
        setTaskSummary((current) => ({
          id: taskId,
          rawCommand: status.task.raw_question,
          intent: status.task.draft_edict?.refined_edict ?? current?.intent,
          status: status.task.status,
          title: status.review?.memorial?.title ?? current?.title ?? '上书房军机处会审',
          runId: status.review?.review_id ?? current?.runId,
          source: status.task.source_label,
          updatedAt: status.task.updated_at,
        }));
      })
      .catch(() => {
        if (!cancelled) setShangshufangStatus(null);
      });
    return () => { cancelled = true; };
  }, [taskId]);

  const handleDecreeFromBar = useCallback(async (draft: string) => {
    const command = draft.trim();
    if (!command) { router.push('/court-briefing'); return; }
    setDispatchError(null);
    setDispatching(true); // P0:立刻给"蜂群集结中"反馈,不让用户对着死按钮等 89 秒
    try {
      const drafted = await chaotang.decreeDraft(command);
      const cats = drafted.recommendedCategories ?? [];
      const selectedCategories: CategorySelection[] = cats.slice(0, 1).map((c) => ({
        taskType: c.taskType, ministers: c.ministers, groups: c.groups, label: c.label,
      }));
      const result = await chaotang.decreeDispatch({
        rawCommand: command, intent: drafted.intent ?? command, selectedCategories,
      });
      router.push(`/command-center?taskId=${encodeURIComponent(result.taskId)}`);
    } catch {
      setDispatchError('立案失败：请检查登录状态或后端服务，再重试。');
      setDispatching(false);
    }
  }, [router]);

  // ── 军机处视图切换：收敛自 /grand-council 与 /junjichu/cases ──
  const isCouncilView = view === 'council';
  const isCasesView = view === 'cases';

  if (isCouncilView) {
    return <CouncilViewWithTab />;
  }
  if (isCasesView) {
    return <CasesViewWithTab />;
  }

  // ── 御座室外壳配置 ──
  const syntheticTaskSummary: TaskSummary | null = decisionIntent && activeTaskId
    ? {
        id: activeTaskId,
        rawCommand: decisionIntent,
        intent: decisionIntent,
        status: 'local_decision',
        title: decisionIntent.includes('报价') ? '正式报价决策' : '本地经营决策',
        source: 'MIXED',
      }
    : null;
  const displayTaskSummary = taskSummary ?? syntheticTaskSummary;
  const hasTask = Boolean(activeTaskId);
  const objectTone: 'live' | 'demo' | 'pending' = !hasTask ? 'demo' : taskId && taskSummary ? 'live' : 'pending';
  const objectLabel = hasTask
    ? displayTaskSummary?.title ?? displayTaskSummary?.intent ?? displayTaskSummary?.rawCommand ?? '军机处已接案'
    : '当前没有真案 · 演示态';
  const objectContext = hasTask
    ? `大臣 ${liveMinisters.length || mergeCouncil?.contributors.length || 0} · 蜂群 ${liveGroups.length} · 风险 ${liveRisks.length}`
    : '从上书房立一条可执行军令，军机处即接案作战';
  const ministryBrief = buildCommandCenterMinistryBrief({
    taskId: activeTaskId,
    taskIntent: decisionIntent,
    taskSummary: displayTaskSummary,
    ministers: liveMinisters,
    risks: liveRisks,
    councilSummary: liveCouncilSummary,
    shangshufangStatus,
  });
  const dialogueActions: CourtDialogueAction[] = [
    { key: 'ask', glyph: '策', label: '推进方案', tone: 'plain', onClick: () => router.push('/court-briefing') },
    { key: 'decree', glyph: '旨', label: '发圣旨', tone: 'gold', onClick: (d) => void handleDecreeFromBar(d) },
    { key: 'secret', glyph: '密', label: '密旨', tone: 'danger', onClick: () => router.push('/court-briefing') },
  ];
  const commandCenterEdict = commandCenterToEdict({
    taskId: activeTaskId,
    taskSummary: displayTaskSummary,
    ministers: liveMinisters,
    risks: liveRisks,
    groups: liveGroups,
    councilSummary: liveCouncilSummary,
    memorial: liveMemorial,
    ministryBrief,
  });

  return (
        <ShangshufangLayoutShell
      eyebrow="JUNJICHU · COMMAND CENTER"
      title="军机处"
      subtitle="按上书房布局展示：左侧辅政与训诲，中央会审主卷和作战流，右侧看六部表态、风险、蜂群与奏折回写。"
      accent="#8AA4FF"
      background="/assets/junjichu/junjichu.webp"
      actions={
        <>
          <Link
            href="/command-center?view=council"
            className="rounded-full border border-white/12 bg-white/[0.04] px-3 py-1.5 text-[12px] text-[#9FB0D6] transition hover:border-[#8AA4FF]/45 hover:text-[#AFC0FF]"
          >
            会审室
          </Link>
          <Link
            href="/command-center?view=cases"
            className="rounded-full border border-white/12 bg-white/[0.04] px-3 py-1.5 text-[12px] text-[#9FB0D6] transition hover:border-[#8AA4FF]/45 hover:text-[#AFC0FF]"
          >
            案卷立案
          </Link>
          <span className="mx-0.5 h-4 w-px bg-white/12" aria-hidden />
          <Link
            href="/court-briefing"
            className="rounded-full border border-white/12 bg-white/[0.04] px-3.5 py-1.5 text-[12px] text-[#D7DFF2] transition hover:border-[#F0C66A]/45 hover:text-[#F0C66A]"
          >
            回上书房
          </Link>
          <button
            type="button"
            onClick={() => void handleDecreeFromBar(displayTaskSummary?.rawCommand ?? displayTaskSummary?.intent ?? '')}
            className="rounded-full border border-[#F0C66A]/45 bg-[#F0C66A]/[0.08] px-3.5 py-1.5 text-[12px] text-[#F0C66A] transition hover:bg-[#F0C66A]/15"
          >
            {hasTask ? '重新立案' : '发圣旨'}
          </button>
        </>
      }
      left={
        <ShangshufangRailPanel title="辅政与训诲" subtitle={objectLabel} accent="#F0C66A">
          <div className="space-y-3">
            <section className={COMMAND_CENTER_PANEL_CLASS}>
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#F0C66A]">丞相 · 辅政</div>
              <div className="mt-2">
                <ChancellorBody
                  taskSummary={displayTaskSummary}
                  ministers={liveMinisters}
                  risks={liveRisks}
                  councilSummary={liveCouncilSummary}
                  hasTask={hasTask}
                />
              </div>
            </section>
            <section className={COMMAND_CENTER_PANEL_CLASS}>
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#AFC0FF]">钦天监 · 训诲</div>
              <div className="mt-2">
                <AstrologerBody hasTask={hasTask} />
              </div>
            </section>
          </div>
        </ShangshufangRailPanel>
      }
      center={
        <div className="flex h-full min-h-0 flex-col gap-3">
          <div className="shrink-0">
            <CaseSpine
              caseId={activeTaskId}
              caseTitle={hasTask ? (displayTaskSummary?.title ?? displayTaskSummary?.intent ?? displayTaskSummary?.rawCommand ?? null) : null}
              stage={hasTask ? 'review' : null}
            />
          </div>
          {fromVerdict && (
            <div className={`${COMMAND_CENTER_CARD_CLASS} px-3 py-2 text-[12px] text-[#F5E9C9]`}>
              御前裁决已接收 · 下一步：{verdictMode === 'review' ? '复核争议点' : '督办执行'}
            </div>
          )}
          <div className={`min-h-[380px] flex-1 ${!hasTask ? 'flex justify-center py-3' : ''}`}>
            <div className={!hasTask ? 'h-full w-full max-w-[780px]' : 'h-full w-full'}>
              <EdictStage view={commandCenterEdict} customBodyScroll="styled" />
            </div>
          </div>
          {!activeTaskId && buildDraft && (
            <div className={`shrink-0 ${COMMAND_CENTER_PANEL_CLASS}`}>
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#9FC1FF]">
                Gongbu Build Draft · 工部建设案
              </div>
              <div className="mt-1 text-[15px] font-semibold text-[#F5E9C9]" style={{ fontFamily: 'var(--font-serif)' }}>
                {buildDraft.title}
              </div>
              <p className="mt-2 text-[12px] leading-6 text-[#C6CEE6]">{buildDraft.command}</p>
              {contextLines(buildDraft.context).length > 0 && (
                <div className="mt-2 rounded border border-[#F0C66A]/24 bg-black/24 px-3 py-2">
                  {contextLines(buildDraft.context).slice(0, 4).map((line) => (
                    <div key={line} className="text-[11px] leading-5 text-[#B9F6D2]">· {line}</div>
                  ))}
                </div>
              )}
              {dispatchError && <div className="mt-2 text-[11px] text-[#F58B8B]">{dispatchError}</div>}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void handleDispatchBuild()}
                  disabled={dispatchingBuild || !buildDraft.command.trim()}
                  className="rounded-md border border-[#F0C66A]/45 bg-[#F0C66A]/[0.12] px-3 py-1.5 text-[12px] font-semibold text-[#F0C66A] transition hover:bg-[#F0C66A]/18 disabled:cursor-wait disabled:opacity-60"
                >
                  {dispatchingBuild ? '立项中...' : '正式下旨立项'}
                </button>
                <Link href="/liubu/gongbu" className="rounded-md border border-[#6BA0FF]/35 px-3 py-1.5 text-[12px] text-[#9FC1FF]">
                  回工部
                </Link>
              </div>
            </div>
          )}
          {taskId && (
            <div className={`min-h-[260px] shrink-0 overflow-y-auto ${COMMAND_CENTER_PANEL_CLASS}`}>
              <BattleStream
                taskId={taskId}
                onMinistersChange={setLiveMinisters}
                onRisksChange={setLiveRisks}
                onGroupsChange={setLiveGroups}
                onCouncilSummaryChange={setLiveCouncilSummary}
                onMemorialChange={setLiveMemorial}
              />
            </div>
          )}
        </div>
      }
      right={
        <ShangshufangRailPanel title="会审右批" subtitle={objectContext} accent="#F0C66A">
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {[
                // 大臣数:SSE 未流时认后端 merge 快照的真会审部数,别再显 0 让"内容真/计数假"打架(张小龙)
                ['大臣', liveMinisters.length || mergeCouncil?.contributors.length || 0],
                ['蜂群', liveGroups.length],
                ['风险', liveRisks.length],
              ].map(([label, value]) => (
                <div key={label} className={`${COMMAND_CENTER_CARD_CLASS} px-2 py-2`}>
                  <div className="text-[9px] uppercase tracking-[0.16em] text-[#7C86A6]">{label}</div>
                  <div className="mt-1 text-[18px] font-semibold text-[#F5E9C9]">{value}</div>
                </div>
              ))}
            </div>

            {!hasTask ? (
              <div className={`${COMMAND_CENTER_PANEL_CLASS} text-[11.5px] leading-6 text-[#9AA3C4]`}>
                待接案后于此展开六部会审与风险封询，奏折成稿即在此验收。先从上书房立一条真案。
              </div>
            ) : (
            <>
            <section className={COMMAND_CENTER_PANEL_CLASS}>
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#F0C66A]">六部表态</div>
              <div className="mt-2 space-y-2">
                {liveMinisters.length ? liveMinisters.slice(0, 5).map((minister) => (
                  <div key={minister.agentCode} className="rounded border border-[#F0C66A]/20 bg-black/24 px-2.5 py-2">
                    <div className="text-[12px] font-semibold text-[#F5E9C9]">{minister.name}</div>
                    <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-[#C6CEE6]">{minister.opinion || minister.status}</p>
                  </div>
                )) : mergeCouncil?.contributors.length ? (
                  // 后端 result.merge 真六部合议(report_ready 快照):SSE 未流但任务已跑完时,军机处优先显真会审,
                  // 不再只兜底 FALLBACK(修#1"后端有前端对不上"·照抄上书房早已在用的 merge 消费)。
                  <>
                    {mergeCouncil.escalate && (
                      <div className="rounded border border-[#F58B8B]/32 bg-[#F58B8B]/[0.08] px-2.5 py-2 text-[11px] leading-5 text-[#F5C0B8]">
                        ⚠ 硬冲突 · 伏候圣裁：{mergeCouncil.verdict.slice(0, 96)}
                      </div>
                    )}
                    {mergeCouncil.contributors.slice(0, 6).map((c, i) => (
                      <div key={`${c.dept}-${i}`} className="rounded border border-[#3DD68C]/24 bg-black/24 px-2.5 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[12px] font-semibold text-[#F5E9C9]">{c.name}</span>
                          <span className="rounded-full border border-[#3DD68C]/55 px-1.5 py-px text-[9px] text-[#8AE4B4]">真会审</span>
                        </div>
                        <p className="mt-1 line-clamp-3 text-[11px] leading-5 text-[#C6CEE6]">{c.answer}</p>
                      </div>
                    ))}
                  </>
                ) : ministryBrief?.review.cards.length ? (
                  // 再回落:SSE/后端快照都无时,显前端本地会审卡(ministryBrief)。户部那张由真 evaluateProject 直算(断点B)。
                  ministryBrief.review.cards.slice(0, 6).map((card) => {
                    const tone =
                      card.signal === 'GREEN' ? '#3DD68C' : card.signal === 'RED' ? '#F58B8B' : card.signal === 'GRAY' ? '#8F9BB2' : '#F0C66A';
                    // 溯源点(大神会审·张小龙)：区分"真算卡"(确定性引擎,MIXED)与"synth罐头"(FALLBACK),
                    // 否则户部真数字卡和刑部关键词卡长得一样、被真算标签误导。
                    const prov =
                      card.sourceLabel === 'MIXED'
                        ? { t: '真算', c: '#8AE4B4' }
                        : card.sourceLabel === 'LIVE' || card.sourceLabel === 'LIVE_SWARM'
                          ? { t: '推演', c: '#8AA4FF' }
                          : card.sourceLabel === 'DEMO'
                            ? { t: '示例', c: '#9AA3C4' }
                            : { t: '离线', c: '#B6AB8C' };
                    return (
                      <div key={card.ministryId} className="rounded border bg-black/24 px-2.5 py-2" style={{ borderColor: `${tone}44` }}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-1.5">
                            <span className="text-[12px] font-semibold text-[#F5E9C9]">{MINISTRY_REGISTRY[card.ministryId].nameCn}</span>
                            <span className="rounded-full border px-1.5 py-px text-[9px]" style={{ color: prov.c, borderColor: `${prov.c}55` }}>{prov.t}</span>
                          </span>
                          <span className="text-[10px] font-bold" style={{ color: tone }}>{card.signal}</span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-[#C6CEE6]">{card.mainThesis}</p>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-[11.5px] leading-6 text-[#9AA3C4]">{hasTask ? '会审待召，尚无大臣表态。' : '待接案后显示六部意见。'}</p>
                )}
              </div>
            </section>

            <section className={COMMAND_CENTER_PANEL_CLASS}>
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#F58B8B]">风险封询</div>
              <div className="mt-2 space-y-2">
                {liveRisks.length ? liveRisks.slice(0, 4).map((risk) => (
                  <div key={`${risk.level}-${risk.label}`} className="rounded border border-[#F0C66A]/20 bg-black/24 px-2.5 py-2">
                    <div className="text-[11px] font-semibold text-[#F5E9C9]">{risk.level}</div>
                    <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-[#C6CEE6]">{risk.label}</p>
                  </div>
                )) : (
                  <p className="text-[11.5px] leading-6 text-[#9AA3C4]">暂无真风险回写。</p>
                )}
              </div>
            </section>

            {ministryBrief && (
              <section className={COMMAND_CENTER_PANEL_CLASS}>
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8BE4B4]">奏折验收</div>
                <p className="mt-2 text-[11.5px] leading-6 text-[#D7DFF2]">{ministryBrief.report.verdict}</p>
                <p className="mt-2 text-[11px] leading-5 text-[#B9F6D2]">{ministryBrief.report.nextAction}</p>
              </section>
            )}
            </>
            )}

            {/* 负责人汇报是部门级日报、非本案(taskId)数据；空态折叠避免"误导性满"。
                Open Q #3(dev/notes PRD)：是否移出军机处到全局日报位仍待定，此处先只在接案态显示。 */}
            {hasTask && (
              <div className="command-center-workflow-wrapper">
                <DepartmentWorkflowChip deptLabel="军机处" deptCode="command-center" embedded />
              </div>
            )}
          </div>
        </ShangshufangRailPanel>
      }
      footer={
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <span className="text-[11px] tracking-[0.1em]" style={{ color: '#8a7a52', fontFamily: 'var(--font-serif)' }}>
            {hasTask ? '军机处 · 会审与流转' : '军机处 · 待接案，先立一条真案'}
          </span>
          <div className="flex flex-wrap justify-end gap-2">
            <ImperialButton
              variant="gold"
              size="sm"
              serif
              icon={<ScrollText size={13} />}
              title="回上书房拟一条新圣旨（不改动当前案）"
              onClick={() => router.push('/court-briefing')}
            >
              发圣旨
            </ImperialButton>
            <ImperialButton variant="ghost" size="sm" serif icon={<FilePlus2 size={13} />} onClick={() => router.push('/command-center?view=cases')}>
              案卷立案
            </ImperialButton>
            <ImperialButton variant="ghost" size="sm" serif icon={<Users size={13} />} onClick={() => router.push('/command-center?view=council')}>
              召六部会审
            </ImperialButton>
            <ImperialButton
              variant="ghost"
              size="sm"
              serif
              icon={<Landmark size={13} />}
              disabled={!hasTask}
              title={!hasTask ? '待接案后前往庄园蜂群主页' : '前往庄园蜂群主页（本案深链待接线）'}
              onClick={() => router.push('/manors')}
            >
              派蜂群
            </ImperialButton>
            <ImperialButton
              variant="ghost"
              size="sm"
              serif
              icon={<Archive size={13} />}
              disabled={!hasTask}
              title={!hasTask ? '奏折成稿后可转史馆归档' : undefined}
              onClick={() => router.push(activeTaskId ? `/archive?taskId=${encodeURIComponent(activeTaskId)}` : '/archive')}
            >
              转史馆
            </ImperialButton>
          </div>
        </div>
      }
    >
      {dispatching && (
        <div
          role="status"
          aria-live="polite"
          style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'grid', placeItems: 'center', background: 'rgba(4,6,14,0.82)', backdropFilter: 'blur(6px)' }}
        >
          <div style={{ textAlign: 'center', maxWidth: 440, padding: 24 }}>
            <div className="animate-pulse-glow" style={{ fontSize: 42, marginBottom: 12 }}>⚔️</div>
            <div className="gold-text" style={{ fontFamily: 'var(--font-serif)', fontSize: 22, letterSpacing: '0.1em', fontWeight: 700 }}>
              六部蜂群集结中
            </div>
            <div style={{ marginTop: 10, color: '#C6BB9D', fontSize: 13, lineHeight: 1.85 }}>
              丞相已接旨，正在召六部会审 · 约 1–2 分钟
              <br />
              蜂群回奏后即入军机处主卷，请稍候
            </div>
            <div
              className="animate-shimmer"
              style={{ marginTop: 18, height: 3, borderRadius: 999, background: 'linear-gradient(90deg, transparent, #F0C66A, transparent)' }}
            />
          </div>
        </div>
      )}
      <style dangerouslySetInnerHTML={{__html: `
        @media (max-width: 1280px) {
          .command-center-panels {
            grid-template-columns: minmax(0, 1fr) !important;
            grid-template-rows: auto !important;
            overflow-y: auto !important;
          }
          .command-center-core-scroll {
            order: -1;
            min-height: 640px !important;
          }
        }
        @media (max-width: 640px) {
          .command-center-core-scroll {
            min-height: 620px !important;
          }
        }
        .command-center-workflow-wrapper section {
          position: static !important;
          right: auto !important;
          top: auto !important;
          width: 100% !important;
          max-width: 100% !important;
        }
        .command-center-workflow-wrapper section > div {
          width: 100% !important;
          max-width: 100% !important;
        }
        /* 展开内容适配 */
        .command-center-workflow-wrapper [data-testid="department-workflow-detail"] {
          width: 100% !important;
          max-width: 100% !important;
          max-height: 600px !important;
        }
        /* 展开内容内部网格布局调整为单列 */
        .command-center-workflow-wrapper [data-testid="department-workflow-detail"] > div > div:last-child {
          grid-template-columns: 1fr !important;
        }
        /* 摘要按钮区域调整 */
        .command-center-workflow-wrapper [data-testid="department-workflow-summary"] {
          grid-template-columns: 1fr !important;
        }
        /* 隐藏案卷按钮（空间不够） */
        .command-center-workflow-wrapper button[aria-label="打开部门案卷"] {
          display: none !important;
        }
      `}} />
        </ShangshufangLayoutShell>
  );
}

/* ── 军机处视图 Tab 栏 ────────────────────────────────────────────────
 * 路由收敛后，/command-center 是军机处唯一入口，通过 ?view= 参数切换：
 *   默认       → 作战沙盘（原 command-center 内容）
 *   ?view=council → 会审室（原 /grand-council）
 *   ?view=cases   → 案卷立案（原 /junjichu/cases）
 * ──────────────────────────────────────────────────────────────────── */

type JunjichuView = 'command' | 'council' | 'cases';

const JUNJICHU_TABS: { key: JunjichuView; label: string; sz: string; desc: string }[] = [
  { key: 'command', label: '作战沙盘', sz: '多智能体战略决策中枢', desc: '圣旨、会审、蜂群、奏折四角同步，真实数据实时跳动' },
  { key: 'council', label: '会审室', sz: '丞相与六部讨论、会签、争论并收敛结论', desc: '各部门表态、争议焦点、等待链、事件流' },
  { key: 'cases', label: '案卷立案', sz: '输入一句要办的事，丞相拟出案卷', desc: '自动识别意图、分配主责部门、设置质门' },
];

function JunjichuViewTabBar({ currentView }: { currentView: JunjichuView }) {
  const router = useRouter();
  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        padding: '6px 16px',
        background: 'linear-gradient(180deg, rgba(4,10,16,0.96) 0%, rgba(4,10,16,0.88) 100%)',
        borderBottom: '1px solid rgba(240,198,106,0.18)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <span
        className="gold-text"
        style={{
          fontFamily: 'var(--font-serif)',
          fontSize: 15,
          fontWeight: 700,
          letterSpacing: '0.10em',
          marginRight: 14,
          whiteSpace: 'nowrap',
        }}
      >
        军机处
      </span>
      <div className="flex items-center gap-1" style={{ flex: 1, minWidth: 0 }}>
        {JUNJICHU_TABS.map((tab) => {
          const active = currentView === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              title={tab.desc}
              onClick={() => {
                const params = new URLSearchParams(window.location.search);
                if (tab.key === 'command') {
                  params.delete('view');
                } else {
                  params.set('view', tab.key);
                }
                const qs = params.toString();
                router.push(qs ? `/command-center?${qs}` : '/command-center');
              }}
              style={{
                padding: '5px 12px',
                borderRadius: 6,
                border: active ? '1px solid rgba(240,198,106,0.35)' : '1px solid transparent',
                background: active ? 'rgba(240,198,106,0.10)' : 'transparent',
                color: active ? '#F0C66A' : '#8F98B8',
                fontSize: 12,
                fontWeight: active ? 600 : 400,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => { if (!active) { e.currentTarget.style.color = '#C6BB9D'; e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; } }}
              onMouseLeave={(e) => { if (!active) { e.currentTarget.style.color = '#8F98B8'; e.currentTarget.style.background = 'transparent'; } }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <span style={{ color: '#5A5340', fontSize: 10, letterSpacing: '0.14em', whiteSpace: 'nowrap' }}>
        {JUNJICHU_TABS.find((t) => t.key === currentView)?.sz ?? ''}
      </span>
    </div>
  );
}

/** 会审室视图（含 Tab 栏） */
function CouncilViewWithTab() {
  return (
    <div className="flex h-full flex-col">
      <JunjichuViewTabBar currentView="council" />
      <div className="flex-1 overflow-hidden">
        <CouncilView />
      </div>
    </div>
  );
}

/** 案卷立案视图（含 Tab 栏） */
function CasesViewWithTab() {
  return (
    <div className="flex h-full flex-col">
      <JunjichuViewTabBar currentView="cases" />
      <div className="flex-1 overflow-hidden">
        <CasesView />
      </div>
    </div>
  );
}

export default function CommandCenterPage() {
  return (
    <Suspense fallback={
      <main className="relative h-full w-full overflow-y-scroll bg-[#040A10]" />
    }>
      <CommandCenterInner />
    </Suspense>
  );
}
