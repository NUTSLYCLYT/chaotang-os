'use client';

/**
 * EdictStage · 中央 · 圣旨展示平台(一个舞台,三路调用)
 * 卷轴外壳(手卷厚轴/玉轴/云龙织锦边/朱砂钤印/展卷·落墨仪式)固定不变;
 * 正文(rows)、钤印(seal)、页脚(footer)按 EdictView 参数化 —— 奏折/丞相/钦天监皆投此台。
 * 正文只展示丞相整理的结果报告(rows 全量直出,含「蜂群回奏」final_output);
 * 原「丞相汇报」过程性六卡片面板与受众三模式(basic/player/geek)已按用户要求移除(2026-06-12)。
 * MemorialScroll 为「奏折」适配器,保持原有调用不变。
 */

import { useEffect, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  Archive,
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  CheckCircle2,
  ClipboardCheck,
  Database,
  Download,
  FileSearch,
  FileText,
  Gavel,
  ListChecks,
  Scale,
  ShieldCheck,
  UsersRound,
  Waypoints,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import type { Memorial } from '../types';
import { EDICT_SCROLL_THEME, EDICT_SEAL, type EdictView } from '../edict-content';
import type { BlastRadius } from '@/features/governance/lib/gate';
import { blastRadiusFromText } from '@/core/courtos/harness/human-approval-gate';
import { ImperialButton } from './atoms';

// 墨色（按 WCAG AA 加深：原 #3a2e1a / #5b4a30 在暗纸区不达标）
const INK = '#2e2410';
const INK_SOFT = '#3f2c12';
const SCROLL_FONT_STACK = '"STKaiti", "KaiTi", var(--font-serif)';
const SERIF_STACK = SCROLL_FONT_STACK;
const DISPLAY_STACK = SCROLL_FONT_STACK;
const BRUSH_STACK = SCROLL_FONT_STACK;
// 奏折正文楷体栈：系统楷体优先(Win/Mac 自带 KaiTi/Kaiti SC → 多数商家可见楷体),
// 回退本仓已加载的宋体 web 字体(Noto Serif SC),保证 100% 有衬线字、不出无字框。零新依赖、不碰冻结字体配置。
const KAI_STACK = SCROLL_FONT_STACK;
const DEFAULT_SCROLL_ACCENT = EDICT_SCROLL_THEME.shangshufang.accent;
const DEFAULT_SCROLL_ACCENT_SOFT = EDICT_SCROLL_THEME.shangshufang.accentSoft;
const BADGE_TONE: Record<'green' | 'amber' | 'red' | 'blue', { color: string; bg: string; border: string }> = {
  green: { color: '#176b45', bg: 'rgba(23,107,69,0.08)', border: 'rgba(23,107,69,0.35)' },
  amber: { color: '#7a4a08', bg: 'rgba(180,111,18,0.10)', border: 'rgba(180,111,18,0.38)' },
  red: { color: '#7a241e', bg: 'rgba(150,40,32,0.09)', border: 'rgba(150,40,32,0.34)' },
  blue: { color: '#274d7a', bg: 'rgba(39,77,122,0.08)', border: 'rgba(39,77,122,0.32)' },
};

function normalizeHexColor(value: string | undefined, fallback: string) {
  if (!value) return fallback;
  const trimmed = value.trim();
  return /^#[0-9a-f]{6}$/i.test(trimmed) ? trimmed : fallback;
}

function hexToRgb(hex: string) {
  const normalized = normalizeHexColor(hex, DEFAULT_SCROLL_ACCENT).slice(1);
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function colorAlpha(hex: string, alpha: number) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

type RowTone = 'decision' | 'evidence' | 'risk' | 'action' | 'quality' | 'plain';

const ROW_PRESENTATION: Record<
  string,
  { icon: LucideIcon; tone: RowTone; title: string }
> = {
  圣裁: { icon: Gavel, tone: 'decision', title: '裁断' },
  需皇上裁决: { icon: Gavel, tone: 'decision', title: '待裁' },
  证据: { icon: FileSearch, tone: 'evidence', title: '证据' },
  风险: { icon: AlertTriangle, tone: 'risk', title: '风险' },
  风险与缺证: { icon: AlertTriangle, tone: 'risk', title: '风险' },
  后令: { icon: ListChecks, tone: 'action', title: '后令' },
  行动建议: { icon: ListChecks, tone: 'action', title: '行动' },
  质门: { icon: ShieldCheck, tone: 'quality', title: '质门' },
  分奏: { icon: Waypoints, tone: 'plain', title: '分奏' },
  各司汇报: { icon: Waypoints, tone: 'plain', title: '各司' },
  军机处总回报: { icon: ClipboardCheck, tone: 'decision', title: '总回报' },
  分派: { icon: Waypoints, tone: 'action', title: '分派' },
  回奏正文: { icon: FileText, tone: 'decision', title: '回奏' },
  为何现在: { icon: FileSearch, tone: 'evidence', title: '为何现在' },
  建议: { icon: ClipboardCheck, tone: 'action', title: '建议' },
  决策建议: { icon: ClipboardCheck, tone: 'action', title: '决策' },
  丞相分析: { icon: Scale, tone: 'decision', title: '分析' },
  事由: { icon: FileText, tone: 'plain', title: '事由' },
  所议: { icon: FileText, tone: 'plain', title: '所议' },
  谨奏: { icon: CheckCircle2, tone: 'plain', title: '谨奏' },
  参审部门: { icon: UsersRound, tone: 'evidence', title: '参审' },
  建议参审: { icon: UsersRound, tone: 'evidence', title: '参审' },
  部门冲突: { icon: Scale, tone: 'risk', title: '冲突' },
  蜂群计划: { icon: Waypoints, tone: 'action', title: '蜂群' },
  案号: { icon: Database, tone: 'quality', title: '案号' },
  TRACE: { icon: Database, tone: 'quality', title: 'TRACE' },
  Trace: { icon: Database, tone: 'quality', title: 'TRACE' },
  已知: { icon: FileSearch, tone: 'evidence', title: '已知' },
  缺口: { icon: AlertTriangle, tone: 'risk', title: '缺口' },
  皇上原问: { icon: FileText, tone: 'plain', title: '原问' },
  决策类型: { icon: ClipboardCheck, tone: 'decision', title: '类型' },
};

const ROW_TONE_STYLE: Record<RowTone, { border: string; bg: string; icon: string; rail: string }> = {
  decision: {
    border: 'rgba(128,72,30,0.34)',
    bg: 'linear-gradient(180deg, rgba(128,72,30,0.11), rgba(128,72,30,0.035))',
    icon: '#6b2f18',
    rail: '#8f3f20',
  },
  evidence: {
    border: 'rgba(41,88,125,0.30)',
    bg: 'linear-gradient(180deg, rgba(41,88,125,0.10), rgba(41,88,125,0.030))',
    icon: '#24537b',
    rail: '#3a6f9a',
  },
  risk: {
    border: 'rgba(142,48,38,0.34)',
    bg: 'linear-gradient(180deg, rgba(142,48,38,0.10), rgba(142,48,38,0.030))',
    icon: '#7a241e',
    rail: '#a33b31',
  },
  action: {
    border: 'rgba(40,98,66,0.32)',
    bg: 'linear-gradient(180deg, rgba(40,98,66,0.10), rgba(40,98,66,0.030))',
    icon: '#176b45',
    rail: '#27764d',
  },
  quality: {
    border: 'rgba(122,74,8,0.35)',
    bg: 'linear-gradient(180deg, rgba(180,111,18,0.12), rgba(180,111,18,0.035))',
    icon: '#7a4a08',
    rail: '#b46f12',
  },
  plain: {
    border: 'rgba(120,90,40,0.28)',
    bg: 'linear-gradient(180deg, rgba(255,248,224,0.18), rgba(120,90,40,0.025))',
    icon: '#4a3417',
    rail: '#8a6426',
  },
};

function compactLabel(label: string) {
  return label.replace(/\s/g, '');
}

const ACCORDION_ROW_LABELS = new Set(['所议', '蜂群回奏', '后端蜂群', '应奏', '合议']);

function shouldUseAccordionRow(label: string) {
  const compact = compactLabel(label);
  return ACCORDION_ROW_LABELS.has(compact) || compact.startsWith('蜂群回奏');
}

function previewLine(lines: string[], fallback: string) {
  const line = (lines[0] || fallback).replace(/\s+/g, ' ').trim();
  return line.length > 96 ? `${line.slice(0, 96)}...` : line;
}

function LabelBox({ label, icon: Icon, tone }: { label: string; icon: LucideIcon; tone: RowTone }) {
  const style = ROW_TONE_STYLE[tone];
  return (
    <div
      className="relative flex h-fit flex-shrink-0 items-center gap-1.5 rounded-md px-2.5 py-2"
      style={{
        minWidth: 68,
        border: `1px solid ${style.border}`,
        background: 'rgba(255,248,224,0.28)',
        color: style.icon,
        fontFamily: SERIF_STACK,
        fontSize: 13,
        fontWeight: 700,
        letterSpacing: 0,
        whiteSpace: 'nowrap',
        boxShadow: 'inset 0 1px 0 rgba(255,248,224,0.42), 0 6px 14px rgba(80,45,12,0.08)',
      }}
    >
      <Icon size={13} strokeWidth={2.1} />
      {label}
    </div>
  );
}

function RowBody({ lines, fallback, rail }: { lines: string[]; fallback: string; rail: string }) {
  return lines.length > 1 ? (
    <ul className="space-y-1.5">
      {lines.map((line, index) => (
        <li key={`${line}-${index}`} className="flex gap-2">
          <span className="mt-[0.82em] h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: rail }} />
          <span className="min-w-0">{line}</span>
        </li>
      ))}
    </ul>
  ) : (
    <p>{lines[0] || fallback}</p>
  );
}

function MemorialRow({
  label,
  children,
  collapsible = false,
  open = false,
  onToggle,
}: {
  label: string;
  children: string;
  collapsible?: boolean;
  open?: boolean;
  onToggle?: () => void;
}) {
  const compact = compactLabel(label);
  const presentation = ROW_PRESENTATION[compact] ?? { icon: FileText, tone: 'plain' as const, title: compact || label };
  const style = ROW_TONE_STYLE[presentation.tone];
  const lines = children
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (collapsible) {
    return (
      <div
        className="group relative shrink-0 overflow-hidden rounded-lg border px-3 py-3 md:px-3.5"
        style={{
          borderColor: style.border,
          background: style.bg,
          boxShadow: 'inset 0 1px 0 rgba(255,248,224,0.26)',
        }}
      >
        <span
          aria-hidden
          className="absolute left-0 top-0 h-full w-[3px]"
          style={{ background: `linear-gradient(180deg, ${style.rail}, transparent)` }}
        />
        <button
          type="button"
          aria-expanded={open}
          onClick={onToggle}
          className="flex w-full min-w-0 items-start gap-2.5 text-left sm:items-center"
          style={{ fontFamily: SERIF_STACK }}
        >
          <LabelBox label={presentation.title} icon={presentation.icon} tone={presentation.tone} />
          <span className="min-w-0 flex-1">
            <span
              className="block truncate text-[13px] font-semibold md:text-[13.5px]"
              style={{ color: INK, textShadow: '0 1px 0 rgba(255,248,224,0.38)' }}
            >
              {previewLine(lines, children)}
            </span>
            <span className="mt-1 block text-[11px]" style={{ color: INK_SOFT }}>
              {lines.length || 1} 行 · {open ? '已展开' : '已收起'}
            </span>
          </span>
          <ChevronDown
            size={16}
            className="mt-2 shrink-0 transition-transform sm:mt-0"
            style={{ color: style.icon, transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
          />
        </button>
        {open && (
          <div
            data-testid="edict-accordion-body"
            className="mt-3 overflow-visible border-t pt-3 pr-2"
            style={{ borderColor: 'rgba(120,90,40,0.24)' }}
          >
            <div
              className="min-w-0 text-[13.5px] leading-[1.95] md:text-[14px]"
              style={{
                color: INK,
                fontFamily: SERIF_STACK,
                letterSpacing: 0,
                textShadow: '0 1px 0 rgba(255,248,224,0.38)',
              }}
            >
              <RowBody lines={lines} fallback={children} rail={style.rail} />
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="group relative shrink-0 overflow-hidden rounded-lg border px-3 py-3 md:px-3.5"
      style={{
        borderColor: style.border,
        background: style.bg,
        boxShadow: 'inset 0 1px 0 rgba(255,248,224,0.26)',
      }}
    >
      <span
        aria-hidden
        className="absolute left-0 top-0 h-full w-[3px]"
        style={{ background: `linear-gradient(180deg, ${style.rail}, transparent)` }}
      />
      <div className="flex flex-col gap-2.5 sm:flex-row sm:gap-3.5">
        <LabelBox label={presentation.title} icon={presentation.icon} tone={presentation.tone} />
        <div
          className="min-w-0 flex-1 text-[13.5px] leading-[1.95] md:text-[14px]"
          style={{
            color: INK,
            fontFamily: SERIF_STACK,
            letterSpacing: 0,
            textShadow: '0 1px 0 rgba(255,248,224,0.38)',
          }}
        >
          <RowBody lines={lines} fallback={children} rail={style.rail} />
        </div>
      </div>
    </div>
  );
}

function findRow(view: EdictView, label: string) {
  return view.rows.find((row) => compactLabel(row.label) === label);
}

function findFirstRow(view: EdictView, labels: string[]) {
  return labels.map((label) => findRow(view, label)).find(Boolean);
}

function bodyLines(body: string): string[] {
  return body
    .split('\n')
    .map((line) => line.replace(/^[-•·]\s*/, '').trim())
    .filter(Boolean);
}

function sentenceLead(text: string, max = 74): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  const stop = normalized.search(/[。；;]/);
  const first = stop > 0 ? normalized.slice(0, stop) : normalized;
  return first.length > max ? `${first.slice(0, max)}...` : first;
}

function rowLead(row: EdictView['rows'][number] | undefined, fallback: string, max = 74): string {
  if (!row) return fallback;
  return sentenceLead(bodyLines(row.body)[0] ?? row.body, max) || fallback;
}

function rowSummary(
  row: EdictView['rows'][number] | undefined,
  fallback: string,
  maxLines = 2,
  max = 128,
): string {
  if (!row) return fallback;
  const lines = bodyLines(row.body)
    .slice(0, maxLines)
    .map((line) => line.replace(/[。；;]+$/g, '').trim())
    .filter(Boolean);
  const summary = (lines.join('；') || row.body).replace(/\s+/g, ' ').trim();
  if (!summary) return fallback;
  return summary.length > max ? `${summary.slice(0, max)}...` : summary;
}

type SourceCredibility = 'LIVE' | 'LIVE_SWARM' | 'MIXED' | 'FALLBACK' | 'DEMO' | '待核';

type SourceDossier = {
  sourceLabel: SourceCredibility;
  sourceText: string;
  sourceTone: 'green' | 'amber' | 'red' | 'blue';
  swarmSource: string;
  traceText: string;
  departments: string[];
  effectiveInfo: string[];
  gaps: string[];
};

type DepartmentEvidence = {
  name: string;
  remit: string;
  evidence: string;
  judgment: string;
  state: 'ready' | 'pending';
  tone: RowTone;
};

const CREDIBILITY_LABELS: SourceCredibility[] = ['LIVE_SWARM', 'LIVE', 'MIXED', 'FALLBACK', 'DEMO'];

const DEPARTMENT_SPECS: Array<{
  name: string;
  remit: string;
  keywords: string[];
  tone: RowTone;
}> = [
  { name: '户部', remit: '钱、成本、毛利、现金流、预算', keywords: ['户部', '成本', '毛利', '现金流', '预算', '报价', '付款', '收入', '费用'], tone: 'quality' },
  { name: '工部', remit: '交付、系统、流程、资源可行性', keywords: ['工部', '交付', '系统', '流程', '资源', '产能', '可行', '工程', '研发', 'PACK'], tone: 'action' },
  { name: '兵部', remit: '市场、客户、销售机会、竞争态势', keywords: ['兵部', '市场', '客户', '销售', '竞争', '机会', '渠道', '竞品'], tone: 'evidence' },
  { name: '刑部/大理寺', remit: '合同、合规、责任边界', keywords: ['刑部', '大理寺', '合同', '合规', '责任', '违约', '法律', '授权', '条款'], tone: 'risk' },
  { name: '锦衣卫', remit: '外部情报、来源、反证、时效', keywords: ['锦衣卫', '情报', '来源', '反证', '时效', '线索', '外部', '信号'], tone: 'evidence' },
  { name: '军机处', remit: '会审调度、跨部门冲突、执行路径', keywords: ['军机处', '会审', '参审', '蜂群', '调度', '冲突', '执行'], tone: 'decision' },
];

function uniqueStrings(values: string[], max = 8): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  values.forEach((value) => {
    const normalized = value.replace(/\s+/g, ' ').trim();
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    out.push(normalized);
  });
  return out.slice(0, max);
}

function normalizeCredibilityLabel(text?: string): SourceCredibility {
  const upper = (text ?? '').toUpperCase();
  const hit = CREDIBILITY_LABELS.find((label) => upper.includes(label));
  if (hit) return hit;
  if (/真实蜂群|JIQUN|后端蜂群|主库|TURSO|PRIMARY|LIVE/.test(upper)) return 'LIVE';
  if (/兜底|降级|骨架|FALLBACK/.test(text ?? '')) return 'FALLBACK';
  if (/演示|DEMO/.test(text ?? '')) return 'DEMO';
  return '待核';
}

function toneForCredibility(label: SourceCredibility): 'green' | 'amber' | 'red' | 'blue' {
  if (label === 'LIVE' || label === 'LIVE_SWARM') return 'green';
  if (label === 'DEMO') return 'blue';
  if (label === 'FALLBACK') return 'red';
  return 'amber';
}

function rowsText(rows: EdictView['rows']): string {
  return rows.map((row) => `${row.label} ${row.body}`).join('\n');
}

function firstRowSummary(view: EdictView, labels: string[], fallback: string, maxLines = 2, max = 96): string {
  return rowSummary(findFirstRow(view, labels), fallback, maxLines, max);
}

function extractDepartmentsFromText(text: string): string[] {
  return uniqueStrings(
    DEPARTMENT_SPECS.flatMap((spec) => {
      if (spec.name === '刑部/大理寺') {
        return /刑部|大理寺|合同|合规|责任|法律|授权|条款/.test(text) ? [spec.name] : [];
      }
      return text.includes(spec.name) || spec.keywords.some((keyword) => text.includes(keyword)) ? [spec.name] : [];
    }),
    6,
  );
}

function extractTraceText(view: EdictView): string {
  const traceRows = view.rows.filter((row) => /^(TRACE|Trace|案\s*号|任务|会话|Session)$/i.test(compactLabel(row.label)));
  const rowRefs = traceRows.map((row) => `${compactLabel(row.label)} ${sentenceLead(row.body, 42)}`);
  const bodyRefs = rowsText(view.rows).match(/\b(?:task|trace|session|sid|jiqun)[-_:/]?[A-Za-z0-9_.:-]{5,}\b/gi) ?? [];
  const refs = uniqueStrings([...rowRefs, ...bodyRefs], 3);
  return refs.length ? refs.join(' · ') : '暂无后端任务 / session / trace id 回传';
}

function buildSourceDossier(view: EdictView): SourceDossier {
  const source = sourceBadge(view);
  const sourceText = source.label || rowLead(findFirstRow(view, ['来源', '来 源', '出处', '出 处']), '来源待核', 72);
  const sourceLabel = normalizeCredibilityLabel(sourceText);
  const allText = `${view.title}\n${view.subtitle ?? ''}\n${sourceText}\n${rowsText(view.rows)}`;
  const departments = extractDepartmentsFromText(allText);
  const swarmSource =
    rowLead(findFirstRow(view, ['后端蜂群', '蜂群调度', '蜂群计划']), '', 72) ||
    (allText.includes('PACK') || allText.includes('研发蜂群') ? 'PACK 研发蜂群' : '') ||
    (allText.includes('军机处') ? '军机处会审' : '') ||
    (allText.includes('蜂群') ? '经营会审蜂群' : '') ||
    `${view.meta?.reporter ?? '丞相'} · 待路由蜂群`;
  const effectiveInfo = uniqueStrings(
    [
      firstRowSummary(view, ['已知', '证据', '事由', '所议', '分奏'], '暂无结构化有效信息回流', 2, 84),
      ...view.rows
        .filter((row) => /毛利|库存|报价|现金流|客户|交付|合同|授权|需求|成本/.test(row.body))
        .map((row) => sentenceLead(row.body, 84)),
    ],
    4,
  );
  const gaps = uniqueStrings(
    [
      firstRowSummary(view, ['缺口', '风险', '质门', '质量门'], '暂无明确缺口；等待部门回传证据包', 2, 84),
      ...view.rows
        .filter((row) => /缺|待|未|风险|FALLBACK|DEMO|人工确认|授权|条款|付款/.test(row.body))
        .map((row) => sentenceLead(row.body, 84)),
    ],
    4,
  );

  return {
    sourceLabel,
    sourceText,
    sourceTone: toneForCredibility(sourceLabel),
    swarmSource,
    traceText: extractTraceText(view),
    departments: departments.length ? departments : ['待路由部门'],
    effectiveInfo,
    gaps,
  };
}

function buildDepartmentEvidence(view: EdictView): DepartmentEvidence[] {
  const allText = rowsText(view.rows);
  const active = DEPARTMENT_SPECS.map((spec) => {
    const matchedRows = view.rows.filter((row) => {
      const text = `${row.label} ${row.body}`;
      return spec.keywords.some((keyword) => text.includes(keyword));
    });
    if (matchedRows.length === 0) {
      return {
        name: spec.name,
        remit: spec.remit,
        evidence: '暂无结构化部门回奏；等待部门回传证据包。',
        judgment: '待补证，不把空白当结论。',
        state: 'pending' as const,
        tone: spec.tone,
      };
    }
    const evidence = matchedRows
      .slice(0, 2)
      .map((row) => `${compactLabel(row.label)}：${rowSummary(row, row.body, 1, 92)}`)
      .join('\n');
    return {
      name: spec.name,
      remit: spec.remit,
      evidence,
      judgment: sentenceLead(matchedRows[0]?.body ?? '', 92) || '已有部门线索，待会审形成明确裁断。',
      state: 'ready' as const,
      tone: spec.tone,
    };
  });

  const ready = active.filter((item) => item.state === 'ready');
  if (ready.length >= 3) return [...ready, ...active.filter((item) => item.state === 'pending')].slice(0, 6);
  if (/户部|工部|兵部|刑部|大理寺|锦衣卫|军机处/.test(allText)) {
    return [...ready, ...active.filter((item) => item.state === 'pending')].slice(0, 6);
  }
  return active.slice(0, 5);
}

function edictStatus(view: EdictView, model: EdictBriefModel | null): string {
  const text = `${view.title} ${view.subtitle ?? ''} ${rowsText(view.rows)}`;
  if (/已归档|归档/.test(text)) return '已归档';
  if (/已驳回|驳回/.test(text)) return '已驳回';
  if (/缺口|需补证|待补|FALLBACK|DEMO/.test(text)) return '需补证';
  if (/执行中|会审中|调度/.test(text)) return '会审中';
  if (model?.verdict && !/待/.test(model.verdict)) return '待裁决';
  return '待裁决';
}

const SOURCE_ROW_LABELS = new Set(['TRACE', '来源', '来 源', '出处', '出 处']);
const QUALITY_ROW_LABELS = new Set(['质门', '质量门', '期望奏折']);
const CHANCELLOR_ROW_LABELS = new Set(['回奏正文', '建议', '决策建议', '丞相分析', '丞相拟旨', '主判', '主 判', '需皇上裁决', '圣裁']);
const QINTIAN_ROW_LABELS = new Set(['风险', '风险与缺证', '红蓝对抗', '为何现在', '何故此时', '缺口', '缺 口']);
const NEXT_ROW_LABELS = new Set(['后令', '后 令', '行动建议', '分派', '建议参审', '蜂群计划']);

function isSourceRow(row: EdictView['rows'][number]) {
  return SOURCE_ROW_LABELS.has(compactLabel(row.label).toUpperCase()) || SOURCE_ROW_LABELS.has(row.label);
}

function isQualityRow(row: EdictView['rows'][number]) {
  return QUALITY_ROW_LABELS.has(compactLabel(row.label)) || QUALITY_ROW_LABELS.has(row.label);
}

function brushRows(view: EdictView) {
  const filtered = view.rows.filter((row) => !isSourceRow(row) && !isQualityRow(row));
  return filtered.length ? filtered.slice(0, 5) : view.rows.slice(0, 5);
}

function rowForLabels(view: EdictView, labels: Set<string>, fallbackLabels: string[]) {
  return (
    view.rows.find((row) => labels.has(compactLabel(row.label)) || labels.has(row.label)) ??
    findFirstRow(view, fallbackLabels)
  );
}

function isSwarmReturnRow(row: EdictView['rows'][number]) {
  return compactLabel(row.label).startsWith('蜂群回奏');
}

function isSwarmReturnView(view: EdictView) {
  return compactLabel(view.title).startsWith('蜂群回奏') || view.rows.some(isSwarmReturnRow);
}

function swarmReturnRows(view: EdictView) {
  const directRows = view.rows.filter(isSwarmReturnRow);
  if (directRows.length > 0) return directRows;

  const fallbackLabels = new Set(['蜂群调度', '后端蜂群']);
  const fallbackRows = view.rows.filter((row) => fallbackLabels.has(compactLabel(row.label)));
  return fallbackRows.length > 0 ? fallbackRows : view.rows;
}

function splitDecision(text: string): { verdict: string; detail: string } {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return { verdict: '待裁决', detail: '请先看红线、回奏精华与后令。' };
  const [head, ...rest] = normalized.split(/\s*[·：:]\s*/);
  return {
    verdict: (head || normalized).slice(0, 12),
    detail: rest.join(' · ') || sentenceLead(normalized, 96),
  };
}

type EdictBriefModel = {
  verdict: string;
  detail: string;
  redline: string;
  essence: string;
  advice: string;
  reportCadence: string;
  sourceLabel?: string;
  sourceTone?: 'green' | 'amber' | 'red' | 'blue';
};

function sourceBadge(view: EdictView): { label?: string; tone?: 'green' | 'amber' | 'red' | 'blue' } {
  return (
    view.meta?.badges?.find((badge) =>
      /^(LIVE|LIVE_SWARM|MIXED|FALLBACK|DEMO|来源|本地|真实|数据源)/.test(badge.label),
    ) ?? {}
  );
}

function buildEdictBriefModel(view: EdictView): EdictBriefModel | null {
  const verdictRow = findFirstRow(view, ['主判', '圣裁', '需皇上裁决']);
  const gateRow = findFirstRow(view, ['质门', '来源']);
  const riskRow = findFirstRow(view, ['红线', '风险']);
  const actionRow = findFirstRow(view, ['行动建议', '后令']);
  const adviceRow = findFirstRow(view, ['决策建议', '丞相分析', '建议', '丞相拟旨']);
  const essenceRow = findFirstRow(view, ['军机处总回报', '回奏正文', '综合回奏', '所议', '各司汇报', '分奏', '事由', '为何现在']);
  const gapRow = findRow(view, '缺口');

  if (!verdictRow && !gateRow && !actionRow && !adviceRow && !riskRow) return null;

  const decision = verdictRow
    ? splitDecision(verdictRow.body)
    : view.seal === 'chancellor'
      ? { verdict: '拟旨待确认', detail: view.subtitle ?? '丞相已拟旨，待皇上确认是否发起会审。' }
      : { verdict: '待裁决', detail: view.subtitle ?? '请先看回奏精华与后令。' };
  const source = sourceBadge(view);

  return {
    verdict: decision.verdict,
    detail: decision.detail,
    redline:
      rowLead(riskRow, '') ||
      rowLead(gateRow, '') ||
      rowLead(gapRow, '红线待军机处/相关部门复核，不在圣旨首屏造结论。'),
    essence:
      rowSummary(essenceRow, '') ||
      rowLead(verdictRow, '') ||
      rowLead(adviceRow, '暂无回奏精华。'),
    advice:
      rowLead(actionRow, '') ||
      rowLead(adviceRow, '') ||
      rowLead(gateRow, '候皇上裁决，必要时转军机处复核。'),
    reportCadence:
      actionRow ? '军机处按后令复奏' : view.seal === 'chancellor' ? '确认后发起会审' : '按任务节点复奏',
    sourceLabel: source.label,
    sourceTone: source.tone,
  };
}

function displayTitleParts(title: string) {
  const normalized = title.trim();
  const colonIndex = normalized.search(/[：:]/);
  if (colonIndex > 0 && colonIndex <= 6) {
    const main = normalized.slice(0, colonIndex).trim();
    const detail = normalized.slice(colonIndex + 1).trim();
    return { main, detail };
  }
  if (normalized.length > 14) {
    return { main: normalized.slice(0, 10), detail: normalized };
  }
  return { main: normalized, detail: '' };
}

type EdictHeaderModel = {
  kicker: string;
  issuer: string;
  kind: string;
};

function documentKindForHeader(view: EdictView) {
  const rawTitle = displayTitleParts(view.title).main || view.title;
  const titleText = `${view.title} ${view.subtitle ?? ''} ${rowsText(view.rows)}`;
  if (view.seal === 'tutorial') return '钦天监';
  if (/奏折/.test(titleText)) return '奏折';
  if (/蜂群回奏|回奏/.test(titleText)) return '回奏';
  if (/钦天监|观星|教学|指导/.test(titleText)) return '钦天监';
  if (view.seal === 'secret') return '密奏';
  if (view.seal === 'chancellor' && rawTitle.length > 6) return '辅政奏议';
  if (view.seal === 'imperial') return '圣旨';
  return rawTitle.length > 8 ? rawTitle.slice(0, 6) : rawTitle;
}

function defaultHeaderKicker(view: EdictView, kind: string) {
  const titleText = `${view.title} ${view.subtitle ?? ''} ${rowsText(view.rows)}`;
  if (view.seal === 'tutorial' || kind === '钦天监') return '钦天候问';
  if (kind === '奏折' || /奏折/.test(titleText)) return '据实奏闻';
  if (kind === '圣旨') return '奉天承运';
  if (view.seal === 'chancellor' || kind === '辅政奏议') return '丞相辅政';
  if (kind === '回奏' || /回奏/.test(titleText)) return '诸司回奏';
  return '奉天承运';
}

function defaultIssuerLine(view: EdictView, kind: string) {
  if (kind === '奏折') return '臣等谨奏';
  if (kind === '圣旨') return '皇帝诏曰';
  if (view.seal === 'tutorial' || kind === '钦天监') return '钦天监启';
  if (view.seal === 'chancellor' || kind === '辅政奏议') return '丞相谨奏';
  if (kind === '回奏') return '诸司谨回';
  return '皇帝诏曰';
}

function buildEdictHeaderModel(view: EdictView): EdictHeaderModel {
  const kind = documentKindForHeader(view);

  return {
    kicker: view.headerKicker ?? defaultHeaderKicker(view, kind),
    issuer: view.issuerLine ?? defaultIssuerLine(view, kind),
    kind,
  };
}

function EdictBriefLine({
  label,
  body,
  icon: Icon,
  tone,
}: {
  label: string;
  body: string;
  icon: LucideIcon;
  tone: RowTone;
}) {
  const style = ROW_TONE_STYLE[tone];
  return (
    <div
      className="grid grid-cols-[88px_minmax(0,1fr)] gap-3 rounded-lg border px-3 py-2.5"
      style={{
        borderColor: style.border,
        background: style.bg,
        boxShadow: 'inset 0 1px 0 rgba(255,248,224,0.28)',
      }}
    >
      <div className="flex items-center gap-1.5 text-[12px] font-bold" style={{ color: style.icon, fontFamily: SERIF_STACK }}>
        <Icon size={13} />
        {label}
      </div>
      <p className="min-w-0 text-[13px] leading-[1.7] md:text-[13.5px]" style={{ color: INK, fontFamily: KAI_STACK }}>
        {body}
      </p>
    </div>
  );
}

function EdictDecisionBrief({ model }: { model: EdictBriefModel | null }) {
  if (!model) return null;

  return (
    <div
      className="mb-3 rounded-xl border p-3 md:p-3.5"
      style={{
        borderColor: 'rgba(126,74,28,0.34)',
        background:
          'linear-gradient(135deg, rgba(255,248,224,0.42), rgba(176,113,37,0.10) 52%, rgba(255,248,224,0.20))',
        boxShadow: 'inset 0 1px 0 rgba(255,250,235,0.50), 0 10px 20px rgba(86,50,16,0.08)',
      }}
      aria-label="圣旨决策摘要"
    >
      <div className="flex flex-col gap-2 border-b pb-3 md:flex-row md:items-start md:justify-between" style={{ borderColor: 'rgba(120,90,40,0.24)' }}>
        <div className="min-w-0">
          <div className="text-[10px] font-bold tracking-[0.22em]" style={{ color: '#7a4a08', fontFamily: SERIF_STACK }}>
            御前摘要
          </div>
          <div
            className="mt-1 text-[25px] font-black leading-[1.05] md:text-[32px]"
            style={{
              color: '#5b1f17',
              fontFamily: SERIF_STACK,
              letterSpacing: model.verdict.length <= 5 ? '0.12em' : 0,
              textShadow: '0 1px 0 rgba(255,248,224,0.55)',
            }}
          >
            {model.verdict}
          </div>
          <p className="mt-1 max-w-[720px] text-[13px] leading-[1.65]" style={{ color: INK_SOFT, fontFamily: KAI_STACK }}>
            {model.detail}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 md:justify-end">
          <span className="rounded-full border px-2.5 py-1 text-[10.5px] font-bold" style={{ borderColor: 'rgba(122,74,8,0.28)', color: '#7a4a08', background: 'rgba(122,74,8,0.055)', fontFamily: SERIF_STACK }}>
            {model.reportCadence}
          </span>
          {model.sourceLabel && <MetaBadge label={model.sourceLabel} tone={model.sourceTone ?? 'amber'} />}
        </div>
      </div>

      <div className="mt-3 grid gap-2">
        <EdictBriefLine label="红线" body={model.redline} icon={AlertTriangle} tone="risk" />
        <EdictBriefLine label="回奏精华" body={model.essence} icon={FileText} tone="plain" />
        <EdictBriefLine label="丞相建议" body={model.advice} icon={ListChecks} tone="action" />
      </div>
    </div>
  );
}

function SourceFact({
  label,
  body,
  icon: Icon,
  tone = 'plain',
}: {
  label: string;
  body: string;
  icon: LucideIcon;
  tone?: RowTone;
}) {
  const style = ROW_TONE_STYLE[tone];
  return (
    <div className="min-w-0 rounded-lg border px-2.5 py-2" style={{ borderColor: style.border, background: style.bg }}>
      <div className="mb-1 flex items-center gap-1.5 text-[10px] font-black tracking-[0.12em]" style={{ color: style.icon, fontFamily: SERIF_STACK }}>
        <Icon size={11} />
        {label}
      </div>
      <p className="line-clamp-2 break-words text-[11px] font-semibold leading-[1.55]" style={{ color: INK, fontFamily: SERIF_STACK }}>
        {body}
      </p>
    </div>
  );
}

function SourceDossierStrip({ view }: { view: EdictView }) {
  const dossier = buildSourceDossier(view);
  return (
    <section
      data-testid="edict-source-dossier"
      aria-label="圣旨来源案牌"
      className="shrink-0 rounded-[18px] border px-3 py-3 md:px-4"
      style={{
        borderColor: 'rgba(86,54,20,0.30)',
        background:
          'linear-gradient(180deg, rgba(255,250,235,0.28), rgba(255,248,224,0.075))',
        boxShadow: 'inset 0 1px 0 rgba(255,250,235,0.34)',
      }}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-black tracking-[0.22em]" style={{ color: '#7a4a08', fontFamily: SERIF_STACK }}>
          来源案牌
        </span>
        <MetaBadge label={dossier.sourceLabel} tone={dossier.sourceTone} />
        <span className="min-w-0 truncate text-[11px] font-semibold" style={{ color: INK_SOFT, fontFamily: SERIF_STACK }}>
          {dossier.sourceText}
        </span>
      </div>
      <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-6">
        <SourceFact label="蜂群来源" body={dossier.swarmSource} icon={Waypoints} tone="decision" />
        <SourceFact label="任务链路" body={dossier.traceText} icon={Database} tone="quality" />
        <SourceFact label="参与部门" body={dossier.departments.join('、')} icon={UsersRound} tone="evidence" />
        <SourceFact label="有效信息" body={dossier.effectiveInfo.join('；')} icon={FileSearch} tone="evidence" />
        <SourceFact label="证据缺口" body={dossier.gaps.join('；')} icon={AlertTriangle} tone="risk" />
        <SourceFact label="可信度" body={`${dossier.sourceLabel} · 不伪装真实数据`} icon={ShieldCheck} tone={dossier.sourceLabel === 'FALLBACK' || dossier.sourceLabel === 'DEMO' ? 'risk' : 'quality'} />
      </div>
    </section>
  );
}

function truncateFileLinkLabel(label: string) {
  const chars = Array.from(label.trim() || '附件');
  return chars.length > 10 ? `${chars.slice(0, 7).join('')}...` : chars.join('');
}

function DownloadAction({
  label,
  icon: Icon,
  href,
  disabledReason,
  onClick,
  download = true,
}: {
  label: string;
  icon: LucideIcon;
  href?: string;
  disabledReason?: string;
  onClick?: () => void;
  download?: boolean;
}) {
  const actionable = Boolean(href || onClick);
  const baseClass =
    'inline-flex items-center justify-center gap-1.5 rounded-full border px-3 py-1.5 text-[11.5px] font-bold transition-all';
  const style = {
    borderColor: actionable ? 'rgba(39,118,77,0.42)' : 'rgba(120,90,40,0.30)',
    color: actionable ? '#176B45' : '#6E5A38',
    background: actionable ? 'rgba(23,107,69,0.09)' : 'rgba(120,90,40,0.045)',
    boxShadow: actionable ? 'inset 0 1px 0 rgba(255,248,224,0.34), 0 0 12px rgba(39,118,77,0.12)' : 'none',
    fontFamily: SERIF_STACK,
  };
  if (href) {
    return (
      <a href={href} onClick={onClick} download={download ? true : undefined} title={label} className={`${baseClass} hover:brightness-95`} style={style}>
        <Icon size={13} />
        {truncateFileLinkLabel(label)}
      </a>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${baseClass} hover:brightness-95`} style={style}>
        <Icon size={13} />
        {truncateFileLinkLabel(label)}
      </button>
    );
  }
  return (
    <button type="button" disabled title={disabledReason} className={`${baseClass} cursor-not-allowed opacity-72`} style={style}>
      <Icon size={13} />
      {truncateFileLinkLabel(label)}
    </button>
  );
}

function EvidenceDownloadDock({
  view,
  compact = false,
  onReport,
  reportHref,
}: {
  view: EdictView;
  compact?: boolean;
  onReport?: () => void;
  reportHref?: string;
}) {
  const downloads = view.meta?.downloads ?? [];
  const attachmentDownloads = downloads.filter((item) => item.kind !== 'evidence_pack' && item.kind !== 'report');
  const reportDownloads = downloads.filter((item) => item.kind === 'report');
  const hasLiveDownload = attachmentDownloads.some((item) => item.href);
  const emptyCopy = hasLiveDownload ? '附件来自真实回传，请按需下载。' : '暂无可下载附件';
  const iconForKind = (kind?: NonNullable<NonNullable<EdictView['meta']>['downloads']>[number]['kind']) => {
    if (kind === 'report') return Archive;
    return Download;
  };

  return (
    <div
      data-testid="edict-download-dock"
      className={`flex flex-col ${compact ? 'gap-1.5 rounded-lg px-2 py-1.5' : 'gap-2 rounded-xl px-3 py-2.5'} border md:flex-row md:items-center md:justify-between`}
      style={{
        borderColor: 'rgba(120,90,40,0.25)',
        background: 'rgba(255,248,224,0.075)',
        boxShadow: 'inset 0 1px 0 rgba(255,248,224,0.22)',
      }}
    >
      <span className={`min-w-0 ${compact ? 'text-[10px] leading-[1.35]' : 'text-[11px] leading-[1.55]'} font-semibold`} style={{ color: INK_SOFT, fontFamily: SERIF_STACK }}>
        {emptyCopy}
      </span>
      <span className="flex flex-wrap items-center gap-2">
        {attachmentDownloads.map((item) => (
          <DownloadAction
            key={`${item.kind ?? 'download'}-${item.label}`}
            label={item.label}
            icon={iconForKind(item.kind)}
            href={item.href}
            disabledReason={item.disabledReason ?? '等待部门回传附件'}
          />
        ))}
        {onReport ? (
          <DownloadAction label="详情" icon={FileSearch} href={reportHref} onClick={onReport} download={false} />
        ) : reportDownloads.length ? reportDownloads.map((item) => (
          <DownloadAction
            key={`report-${item.label}`}
            label={item.label || '详情'}
            icon={iconForKind(item.kind)}
            href={item.href}
            disabledReason={item.disabledReason ?? '暂无可查看的详情'}
          />
        )) : (
          <DownloadAction label="详情" icon={FileSearch} disabledReason="暂无可查看的详情" />
        )}
      </span>
    </div>
  );
}

function DepartmentEvidenceCard({ item }: { item: DepartmentEvidence }) {
  const style = ROW_TONE_STYLE[item.tone];
  const pending = item.state === 'pending';
  return (
    <article
      className="min-w-0 rounded-xl border px-3 py-3"
      style={{
        borderColor: style.border,
        borderStyle: pending ? 'dashed' : 'solid',
        background: pending ? 'rgba(255,248,224,0.055)' : style.bg,
        boxShadow: 'inset 0 1px 0 rgba(255,248,224,0.22)',
      }}
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-[13px] font-black leading-none" style={{ color: style.icon, fontFamily: SERIF_STACK }}>
            {item.name}
          </h3>
          <p className="mt-1 line-clamp-1 text-[10.5px]" style={{ color: INK_SOFT, fontFamily: SERIF_STACK }}>
            {item.remit}
          </p>
        </div>
        <span className="rounded-full border px-2 py-0.5 text-[9.5px] font-bold" style={{ borderColor: style.border, color: style.icon, background: pending ? 'transparent' : 'rgba(255,248,224,0.16)', fontFamily: SERIF_STACK }}>
          {pending ? '待回传' : '有依据'}
        </span>
      </div>
      <div className="space-y-2">
        <div>
          <div className="mb-1 text-[9.5px] font-black tracking-[0.14em]" style={{ color: '#7a4a08', fontFamily: SERIF_STACK }}>
            基于信息
          </div>
          <p className="whitespace-pre-line text-[12px] leading-[1.62]" style={{ color: INK, fontFamily: SERIF_STACK }}>
            {item.evidence}
          </p>
        </div>
        <div>
          <div className="mb-1 text-[9.5px] font-black tracking-[0.14em]" style={{ color: '#7a4a08', fontFamily: SERIF_STACK }}>
            部门判断
          </div>
          <p className="text-[12px] font-semibold leading-[1.62]" style={{ color: INK, fontFamily: SERIF_STACK }}>
            {item.judgment}
          </p>
        </div>
      </div>
    </article>
  );
}

function DepartmentEvidenceLedger({ view }: { view: EdictView }) {
  const items = buildDepartmentEvidence(view);
  const readyCount = items.filter((item) => item.state === 'ready').length;
  return (
    <section
      data-testid="edict-department-evidence"
      aria-label="部门实证"
      className="shrink-0 rounded-[18px] border px-3 py-3 md:px-4"
      style={{
        borderColor: 'rgba(41,88,125,0.24)',
        background: 'linear-gradient(180deg, rgba(255,248,224,0.13), rgba(255,248,224,0.035))',
        boxShadow: 'inset 0 1px 0 rgba(255,250,235,0.20)',
      }}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[10px] font-black tracking-[0.24em]" style={{ color: '#24537b', fontFamily: SERIF_STACK }}>
            部门实证 · 主体
          </div>
          <p className="mt-1 text-[11px] font-semibold" style={{ color: INK_SOFT, fontFamily: SERIF_STACK }}>
            {readyCount} 个部门已有可读依据，其余保持待补证，不让丞相替部门造事实。
          </p>
        </div>
        <span className="rounded-full border px-2.5 py-1 text-[10px] font-bold" style={{ borderColor: 'rgba(41,88,125,0.30)', color: '#24537b', background: 'rgba(41,88,125,0.06)', fontFamily: SERIF_STACK }}>
          约 62% 版面
        </span>
      </div>
      <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <DepartmentEvidenceCard key={item.name} item={item} />
        ))}
      </div>
    </section>
  );
}

function ChancellorJudgementPanel({ view, model }: { view: EdictView; model: EdictBriefModel | null }) {
  const chancellor = rowForLabels(view, CHANCELLOR_ROW_LABELS, ['建议', '圣裁', '需皇上裁决']);
  const conflict = rowForLabels(view, new Set(['部门冲突', '合议', '主判']), ['风险', '缺口']);
  const next = rowForLabels(view, NEXT_ROW_LABELS, ['后令', '建议参审', '分派']);
  return (
    <aside
      data-testid="edict-chancellor-judgement"
      aria-label="丞相总批"
      className="min-h-0 rounded-[18px] border px-3 py-3 md:px-4"
      style={{
        borderColor: 'rgba(128,72,30,0.30)',
        background:
          'linear-gradient(180deg, rgba(128,72,30,0.10), rgba(255,248,224,0.055))',
        boxShadow: 'inset 0 1px 0 rgba(255,250,235,0.22)',
      }}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <div className="text-[10px] font-black tracking-[0.24em]" style={{ color: '#8f3f20', fontFamily: SERIF_STACK }}>
            丞相总批
          </div>
          <p className="mt-1 text-[11px] font-semibold" style={{ color: INK_SOFT, fontFamily: SERIF_STACK }}>
            综合、冲突归纳与裁决建议，默认不超过 38%。
          </p>
        </div>
        <span className="rounded-full border px-2.5 py-1 text-[10px] font-bold" style={{ borderColor: 'rgba(128,72,30,0.30)', color: '#8f3f20', background: 'rgba(128,72,30,0.055)', fontFamily: SERIF_STACK }}>
          ≤38%
        </span>
      </div>
      <div className="space-y-2.5">
        <AuxiliaryLine
          label="裁决建议"
          body={rowSummary(chancellor, model?.advice || '先看部门实证，再选择会审、补证、驳回或裁决。', 2, 150)}
          icon={ClipboardCheck}
          tone="decision"
        />
        <AuxiliaryLine
          label="冲突归纳"
          body={rowSummary(conflict, model?.redline || '暂无明确部门冲突；如涉及付款、合同、报价或客户承诺，仍需人工确认。', 2, 150)}
          icon={Scale}
          tone="risk"
        />
        <AuxiliaryLine
          label="下一步"
          body={rowSummary(next, model?.advice || '优先补齐缺口，再送军机处会审；高风险事项不得静默下发。', 2, 150)}
          icon={ListChecks}
          tone="action"
        />
      </div>
    </aside>
  );
}

function BrushBodyPage({ view }: { view: EdictView }) {
  const rows = brushRows(view);
  return (
    <div
      data-testid="edict-brush-page"
      className="memorial-body-scroll flex min-h-0 flex-1 basis-0 flex-col overflow-y-auto px-1 pb-4 pr-3"
      aria-label="奏折正文"
    >
      <div
        className="mx-auto flex w-full max-w-[840px] flex-1 flex-col justify-center rounded-xl border px-4 py-4 md:px-7 md:py-6"
        style={{
          borderColor: 'rgba(120,90,40,0.22)',
          background:
            'linear-gradient(180deg, rgba(255,248,224,0.12), rgba(255,248,224,0.035))',
          boxShadow: 'inset 0 1px 0 rgba(255,250,235,0.20)',
        }}
      >
        <div className="mb-4 text-center text-[11px] font-bold tracking-[0.28em]" style={{ color: '#7a4a08', fontFamily: SERIF_STACK }}>
          奉天承运 · 奏折正文
        </div>
        <div
          className="space-y-3 text-[14px] font-semibold leading-[1.78] md:text-[15.5px]"
          style={{
            color: '#211406',
            fontFamily: KAI_STACK,
            letterSpacing: '0.01em',
            textShadow: '0 1px 0 rgba(255,250,232,0.52)',
          }}
        >
          {rows.map((row) => (
            <p key={`${row.label}-${row.body.slice(0, 18)}`} className="flex items-start gap-3">
              <span
                className="mt-[0.72em] inline-flex min-w-[52px] shrink-0 justify-center rounded border px-2 py-1 text-[10.5px] font-bold leading-none"
                style={{
                  color: '#7a4a08',
                  borderColor: 'rgba(122,74,8,0.28)',
                  background: 'rgba(122,74,8,0.055)',
                  fontFamily: SERIF_STACK,
                  letterSpacing: '0.06em',
                  boxShadow: 'inset 0 1px 0 rgba(255,248,224,0.42)',
                }}
              >
                {ROW_PRESENTATION[compactLabel(row.label)]?.title ?? compactLabel(row.label)}
              </span>
              <span className="min-w-0 flex-1">{row.body}</span>
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

function AdvisoryCard({
  label,
  body,
  icon: Icon,
  tone,
}: {
  label: string;
  body: string;
  icon: LucideIcon;
  tone: RowTone;
}) {
  const style = ROW_TONE_STYLE[tone];
  return (
    <section
      className="rounded-xl border px-3.5 py-3 md:px-4 md:py-3.5"
      style={{
        borderColor: style.border,
        background: style.bg,
        boxShadow: 'inset 0 1px 0 rgba(255,248,224,0.26)',
      }}
    >
      <div className="mb-2 flex items-center gap-2 text-[13px] font-black" style={{ color: style.icon, fontFamily: SERIF_STACK }}>
        <Icon size={15} />
        {label}
      </div>
      <p
        className="text-[15px] leading-[1.9] md:text-[16px]"
        style={{
          color: INK,
          fontFamily: SERIF_STACK,
          textShadow: '0 1px 0 rgba(255,248,224,0.34)',
        }}
      >
        {body}
      </p>
    </section>
  );
}

function AdvisoryPage({ view, model }: { view: EdictView; model: EdictBriefModel | null }) {
  const chancellor = rowForLabels(view, CHANCELLOR_ROW_LABELS, ['建议', '圣裁', '需皇上裁决']);
  const next = rowForLabels(view, NEXT_ROW_LABELS, ['后令', '建议参审', '分派']);
  const qintian = rowForLabels(view, QINTIAN_ROW_LABELS, ['风险', '缺口', '为何现在']);
  return (
    <div
      data-testid="edict-advisory-page"
      className="memorial-body-scroll grid min-h-0 flex-1 basis-0 gap-3 overflow-y-auto pb-4 pr-3"
      aria-label="丞相与钦天监分析"
    >
      <AdvisoryCard
        label="丞相分析"
        body={rowSummary(chancellor, model?.essence || '丞相已汇总此折主旨，建议先辨清事实、证据与风险边界。', 2, 180)}
        icon={ClipboardCheck}
        tone="decision"
      />
      <AdvisoryCard
        label="下一步决策建议"
        body={rowSummary(next, model?.advice || '可选择准奏、补证、复核或转军机处办理；高风险事项必须人工确认。', 2, 180)}
        icon={ListChecks}
        tone="action"
      />
      <AdvisoryCard
        label="钦天监分析"
        body={rowSummary(qintian, model?.redline || '请从趋势、反事实、90 天后果和关键假设四个角度复核，不把短期热闹误判为长期确定性。', 2, 190)}
        icon={Waypoints}
        tone="evidence"
      />
    </div>
  );
}

function AuxiliaryLine({
  label,
  body,
  icon: Icon,
  tone,
}: {
  label: string;
  body: string;
  icon: LucideIcon;
  tone: RowTone;
}) {
  const style = ROW_TONE_STYLE[tone];
  return (
    <div
      className="rounded-lg border px-3 py-2"
      style={{
        borderColor: style.border,
        background: style.bg,
        boxShadow: 'inset 0 1px 0 rgba(255,248,224,0.22)',
      }}
    >
      <div className="mb-1 flex items-center gap-1.5 text-[11px] font-black" style={{ color: style.icon, fontFamily: SERIF_STACK }}>
        <Icon size={12} />
        {label}
      </div>
      <p
        className="line-clamp-2 text-[12.5px] leading-[1.55] md:text-[13px]"
        style={{
          color: INK,
          fontFamily: SERIF_STACK,
          textShadow: '0 1px 0 rgba(255,248,224,0.30)',
        }}
      >
        {body}
      </p>
    </div>
  );
}

function DecisionSnapCard({
  view,
  model,
  onReport,
  reportHref,
}: {
  view: EdictView;
  model: EdictBriefModel | null;
  onReport?: () => void;
  reportHref?: string;
}) {
  const sourceDept = view.meta?.reporter || view.meta?.petitioner || '上书房';
  const sourceTime = view.sealDate || '时间待核';
  const sourceLine = `${sourceDept} · ${sourceTime}`;
  const sourceDetail =
    model?.sourceLabel ||
    rowLead(findFirstRow(view, ['来源', '来 源', '出处', '出 处']), '来源待核', 72);
  // H2(会审):高 blast 时,AI 的「推荐裁决」呈现要更克制——不让视觉权重替未拍板的高危决策背书。
  const highBlast = view.meta?.blastRadius === 'irreversible' || view.meta?.blastRadius === 'external';

  return (
    <section
      data-testid="edict-decision-snap"
      aria-label="90 秒圣裁卡"
      className="relative flex min-h-0 flex-[2] flex-col overflow-hidden rounded-[20px] border px-4 py-3 md:px-6 md:py-4"
      style={{
        borderColor: 'rgba(128,72,30,0.46)',
        background:
          'linear-gradient(180deg, rgba(255,248,224,0.30), rgba(255,248,224,0.10)), radial-gradient(ellipse at 18% 0%, rgba(150,40,32,0.13), transparent 46%)',
        boxShadow:
          '0 16px 34px rgba(58,33,8,0.20), 0 0 0 1px rgba(240,198,106,0.28), inset 0 1px 0 rgba(255,250,235,0.52)',
      }}
    >
      <div className="relative z-10 flex min-h-0 flex-1 flex-col justify-start">
        <div className="grid min-w-0 gap-2">
          <div
            className="px-0 py-0"
          style={{
            borderColor: 'transparent',
            background: 'transparent',
            ...(highBlast ? { borderStyle: 'dashed' as const } : {}),
          }}
        >
          <div className="mb-1.5 flex flex-wrap items-center gap-2 text-[15px] font-black leading-[1.5] tracking-[0.08em] md:text-[16px]" style={{ color: ROW_TONE_STYLE.decision.icon, fontFamily: SERIF_STACK }}>
            <span>圣旨来源</span>
            {highBlast && (
              <span
                className="rounded-full border px-1.5 py-px text-[8.5px] font-bold tracking-[0.08em]"
                style={{ borderStyle: 'dashed', borderColor: 'rgba(150,40,32,0.55)', color: '#962820', background: 'rgba(150,40,32,0.04)' }}
              >
                AI 建议 · 未经人工确认
              </span>
            )}
          </div>
          <p className="line-clamp-2 text-[14px] font-semibold leading-[1.78] md:text-[15.5px]" style={{ color: INK, fontFamily: SERIF_STACK, letterSpacing: '0.01em' }}>
            {sourceLine}
          </p>
          <p className="mt-1 line-clamp-2 text-[12px] leading-[1.66] md:text-[13px]" style={{ color: INK_SOFT, fontFamily: SERIF_STACK, letterSpacing: 0 }}>
            {sourceDetail}
          </p>
        </div>
        </div>
      </div>
      <div className="relative z-10 mt-2 shrink-0">
        <EvidenceDownloadDock view={view} compact onReport={onReport} reportHref={reportHref} />
      </div>
    </section>
  );
}

/**
 * Hero 裁决条:把「皇上原问·此折所裁的那一句」拎成正文最大的字(技#2)。
 * 羊皮卷上用深墨/朱砂,不用暗轨的浅帝金渐变(低对比)。
 * 裁决责任徽:hero 放大≠已拍板。严厉度读 governance gate 的 blastRadius(SSOT),
 * irreversible/external 才朱砂「高风险·需人工确认」;缺/internal 保持中性「待人工确认」,
 * 绝不从 seal/priority 自造「高风险」——那量的是蜂群卡没卡,不是决策危不危(2026-06-20 会审 H1)。
 */
function HeroQuestionBanner({ question, blastRadius }: { question: string; blastRadius?: BlastRadius }) {
  const highBlast = blastRadius === 'irreversible' || blastRadius === 'external';
  const stakeLabel = highBlast ? '高风险 · 需人工确认 · 未拍板' : '待人工确认 · 未拍板';
  const stakeTone = highBlast
    ? { color: '#962820', border: 'rgba(150,40,32,0.62)', bg: 'rgba(150,40,32,0.05)' }
    : { color: '#7a4a08', border: 'rgba(122,74,8,0.5)', bg: 'rgba(122,74,8,0.05)' };
  return (
    <div className="shrink-0 text-center">
      <div className="mb-1.5 text-[10px] font-black tracking-[0.3em]" style={{ color: '#962820', fontFamily: SERIF_STACK }}>
        皇 上 原 问 · 待 裁
      </div>
      <h3
        className="mx-auto max-w-[720px] break-words text-[24px] font-bold leading-[1.34] [text-wrap:balance] md:text-[32px]"
        style={{
          color: '#1f1708',
          fontFamily: BRUSH_STACK,
          letterSpacing: '0.045em',
          fontVariantEastAsian: 'traditional',
          textShadow:
            '0 1px 0 rgba(255,247,218,0.58), 0 8px 18px rgba(77,44,11,0.14), 0 0 1px rgba(31,23,8,0.35)',
        }}
      >
        {sentenceLead(question, 56)}
      </h3>
      <div className="mt-2 flex justify-center">
        <span
          className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-[9.5px] font-black tracking-[0.14em]"
          style={{ borderStyle: 'dashed', borderColor: stakeTone.border, color: stakeTone.color, background: stakeTone.bg, fontFamily: SERIF_STACK }}
        >
          {stakeLabel}
        </span>
      </div>
      <div className="mt-2 flex items-center justify-center gap-2" aria-hidden>
        <span className="h-px w-10" style={{ background: 'linear-gradient(90deg,transparent,rgba(150,40,32,0.5))' }} />
        <span className="text-[7px]" style={{ color: 'rgba(150,40,32,0.7)' }}>◆</span>
        <span className="h-px w-10" style={{ background: 'linear-gradient(90deg,rgba(150,40,32,0.5),transparent)' }} />
      </div>
    </div>
  );
}

function MainMemorialPage({
  view,
  model,
  onReport,
  reportHref,
}: {
  view: EdictView;
  model: EdictBriefModel | null;
  onReport?: () => void;
  reportHref?: string;
}) {
  // 主圣旨只保留两块:来源台 + 建议。完整案卷和附件明细走详情。
  const advice = rowForLabels(view, CHANCELLOR_ROW_LABELS, ['建议', '后令', '需皇上裁决']);
  const rows = [
    {
      label: '建 议',
      body: rowSummary(advice, model?.advice || model?.verdict || '请先看圣旨来源，再由皇上选择准奏、驳回、会审或批示。', 3, 200),
    },
  ].filter((row) => row.body);

  return (
    <div data-testid="edict-business-dossier" className="flex min-h-0 flex-1 basis-0 flex-col gap-2 overflow-hidden pb-2 pr-3">
      <DecisionSnapCard view={view} model={model} onReport={onReport} reportHref={reportHref} />
      <section
        data-testid="edict-brush-page"
        aria-label="建议"
        className="min-h-0 flex-[1] overflow-hidden rounded-[20px] border px-4 py-3 md:px-6 md:py-4"
        style={{
          borderColor: 'rgba(120,90,40,0.28)',
          background:
            'linear-gradient(180deg, rgba(255,248,224,0.24), rgba(255,248,224,0.06)), radial-gradient(ellipse at 50% 0%, rgba(122,74,8,0.08), transparent 55%)',
          boxShadow: 'inset 0 1px 0 rgba(255,248,224,0.30)',
        }}
      >
        <div className="memorial-rows flex min-h-full flex-col justify-center gap-2">
          {rows.map((row, index) => {
            const title = ROW_PRESENTATION[compactLabel(row.label)]?.title ?? compactLabel(row.label);
            return (
              <article key={`${row.label}-${index}`} className="min-w-0">
                <div
                  className="mb-1.5 text-[15px] font-black leading-[1.5] tracking-[0.08em] md:text-[16px]"
                  style={{ color: '#7a4a08', fontFamily: SERIF_STACK }}
                >
                  {title}
                </div>
                <p
                  className="line-clamp-5 whitespace-pre-wrap break-words text-[14px] font-semibold leading-[1.78] md:text-[15.5px]"
                  style={{
                    color: INK,
                    fontFamily: SERIF_STACK,
                    letterSpacing: '0.01em',
                  }}
                >
                  {row.body}
                </p>
              </article>
            );
          })}
          {view.sealDate && (
            <div
              className="pr-2 pt-1 text-right text-[11.5px] tracking-[0.16em]"
              style={{ color: INK_SOFT, fontFamily: SERIF_STACK }}
            >
              {view.sealDate}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function SwarmReturnPage({ view }: { view: EdictView }) {
  const rows = swarmReturnRows(view);

  return (
    <div
      data-testid="edict-body-scroll"
      className="memorial-body-scroll min-h-0 flex-1 basis-0 overflow-y-auto pb-5 pr-3"
      aria-label="蜂群回奏正文"
    >
      <div className="memorial-rows mx-auto flex w-full max-w-[980px] flex-col gap-5 px-1 py-2 md:px-3 md:py-3">
        {rows.map((row, index) => {
          const rawLines = row.body.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
          const firstLine = rawLines[0]?.trim() ?? '';
          const hasSessionMeta = /^会话\s/.test(firstLine) || /^jiqun_ai\s/.test(firstLine);
          const body = (hasSessionMeta ? rawLines.slice(1).join('\n') : row.body).trim() || row.body;
          const label = compactLabel(row.label);

          return (
            <section
              key={`${row.label}-${index}`}
              className="min-w-0 border-b pb-5 last:border-b-0 last:pb-0"
              style={{ borderColor: 'rgba(120,90,40,0.22)' }}
            >
              {(rows.length > 1 || label !== '蜂群回奏') && (
                <div
                  className="mb-2 text-[10px] font-black tracking-[0.2em]"
                  style={{ color: '#7a4a08', fontFamily: SERIF_STACK }}
                >
                  {row.label}
                </div>
              )}
              {hasSessionMeta && (
                <p
                  className="mb-3 break-words text-[11px] font-semibold leading-[1.65]"
                  style={{ color: INK_SOFT, fontFamily: SERIF_STACK }}
                >
                  {firstLine}
                </p>
              )}
              <div
                data-testid={index === 0 ? 'swarm-return-body' : undefined}
                className="whitespace-pre-wrap break-words text-[14px] font-semibold leading-[1.92] md:text-[15px]"
                style={{
                  color: '#211406',
                  fontFamily: SERIF_STACK,
                  letterSpacing: 0,
                  textShadow: '0 1px 0 rgba(255,250,232,0.42)',
                }}
              >
                {body}
              </div>
            </section>
          );
        })}
        {view.sealDate && (
          <div
            className="pr-2 pt-1 text-right text-[11.5px] tracking-[0.16em]"
            style={{ color: INK_SOFT, fontFamily: SERIF_STACK }}
          >
            {view.sealDate}
          </div>
        )}
      </div>
    </div>
  );
}

function PageTurner({
  page,
  pageCount,
  labels,
  onPage,
}: {
  page: number;
  pageCount: number;
  labels: string[];
  onPage: (page: number) => void;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b pb-3" style={{ borderColor: 'rgba(120,90,40,0.30)' }}>
      <button
        type="button"
        data-testid="edict-prev-page"
        disabled={page === 0}
        onClick={() => onPage(Math.max(0, page - 1))}
        className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-bold transition-all disabled:cursor-not-allowed disabled:opacity-35"
        style={{ borderColor: 'rgba(120,90,40,0.42)', color: INK_SOFT, background: 'rgba(120,90,40,0.055)', fontFamily: SERIF_STACK, scrollMarginBottom: 220 }}
      >
        <ArrowLeft size={13} />
        上一页
      </button>
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        {labels.map((label, index) => (
          <button
            key={label}
            type="button"
            onClick={() => onPage(index)}
            aria-current={index === page ? 'page' : undefined}
            className="rounded-full border px-2.5 py-1 text-[11px] font-bold transition-all"
            style={{
              borderColor: index === page ? 'rgba(122,74,8,0.48)' : 'rgba(120,90,40,0.24)',
              background: index === page ? 'rgba(122,74,8,0.10)' : 'rgba(255,248,224,0.18)',
              color: index === page ? '#7a4a08' : INK_SOFT,
              fontFamily: SERIF_STACK,
            }}
          >
            {index + 1}. {label}
          </button>
        ))}
      </div>
      <button
        type="button"
        data-testid="edict-next-page"
        disabled={page >= pageCount - 1}
        onClick={() => onPage(Math.min(pageCount - 1, page + 1))}
        className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-bold transition-all disabled:cursor-not-allowed disabled:opacity-35"
        style={{ borderColor: 'rgba(120,90,40,0.42)', color: INK_SOFT, background: 'rgba(120,90,40,0.055)', fontFamily: SERIF_STACK, scrollMarginBottom: 220 }}
      >
        下一页
        <ArrowRight size={13} />
      </button>
    </div>
  );
}

function MetaBadge({ label, tone = 'blue' }: { label: string; tone?: 'green' | 'amber' | 'red' | 'blue' }) {
  const t = BADGE_TONE[tone];
  return (
    <span
      className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-[0.08em]"
      style={{
        color: t.color,
        background: t.bg,
        borderColor: t.border,
        fontFamily: SERIF_STACK,
      }}
    >
      {label}
    </span>
  );
}

/** 卷轴两侧厚重轴 —— 手卷形制:缠卷丝绢的圆柱明暗 + 上下凸出玉轴头(一品玉轴)+ 卷口暗影 */
function EdictActionDock({ children }: { children: ReactNode }) {
  return (
    <div
      className="absolute inset-x-6 bottom-5 z-40 max-h-[88px] overflow-y-auto px-3 py-1 md:inset-x-12 md:px-4"
      style={{
        background: 'transparent',
        boxShadow: 'none',
      }}
    >
      {children}
    </div>
  );
}

function SideRoller({ side }: { side: 'left' | 'right' }) {
  const barrel =
    side === 'left'
      ? 'linear-gradient(90deg,#150d04 0%,#33220f 9%,#6f4d22 24%,#b1853c 40%,#f5e2a0 52%,#d3b15c 60%,#946f2c 76%,#4a2d10 91%,#241606 100%)'
      : 'linear-gradient(90deg,#241606 0%,#4a2d10 9%,#946f2c 24%,#d3b15c 40%,#f5e2a0 48%,#b1853c 60%,#6f4d22 76%,#33220f 91%,#150d04 100%)';
  const jade =
    'radial-gradient(circle at 34% 26%, #f8fdf6 0%, #dcefdd 28%, #a9cfb1 56%, #6f9a7d 80%, #34503f 100%)';
  const collar = 'linear-gradient(180deg,#5a3d17,#e7c878 35%,#fff0c0 50%,#c9a55c 62%,#4a2d10)';
  const jadeShadow =
    '0 4px 12px rgba(0,0,0,0.65), inset 0 2px 4px rgba(255,255,255,0.7), inset 0 -4px 8px rgba(38,60,46,0.6)';
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute top-0 bottom-0 z-10 hidden w-[34px] md:block ${side === 'left' ? '-left-4' : '-right-4'}`}
      style={{ background: barrel, borderRadius: 8, boxShadow: '0 0 30px rgba(0,0,0,0.7), 0 6px 14px rgba(0,0,0,0.5)' }}
    >
      <span
        className="absolute inset-y-3 left-0 right-0 opacity-55"
        style={{
          backgroundImage:
            'repeating-linear-gradient(90deg, transparent 0 4px, rgba(38,22,7,0.42) 4px 5px, rgba(255,246,214,0.22) 5px 6px, transparent 6px 11px)',
        }}
      />
      <span
        className="absolute inset-y-2 left-1/2 w-[3px] -translate-x-1/2 rounded-full"
        style={{
          background:
            'linear-gradient(180deg, transparent, rgba(255,252,235,0.7) 12%, rgba(255,250,225,0.9) 50%, rgba(255,252,235,0.7) 88%, transparent)',
          filter: 'blur(0.6px)',
          mixBlendMode: 'screen',
        }}
      />
      <span className="absolute inset-x-0 top-0 h-5 rounded-t-[8px]" style={{ background: 'linear-gradient(180deg, rgba(20,12,4,0.72), transparent)' }} />
      <span className="absolute inset-x-0 bottom-0 h-5 rounded-b-[8px]" style={{ background: 'linear-gradient(0deg, rgba(20,12,4,0.72), transparent)' }} />
      <span className="absolute inset-x-[-1px] top-4 h-[4px]" style={{ background: collar, boxShadow: '0 1px 2px rgba(0,0,0,0.5)' }} />
      <span className="absolute inset-x-[-1px] bottom-4 h-[4px]" style={{ background: collar, boxShadow: '0 1px 2px rgba(0,0,0,0.5)' }} />
      <span className="absolute -top-[18px] left-1/2 h-10 w-10 -translate-x-1/2 rounded-full" style={{ background: jade, boxShadow: jadeShadow }} />
      <span className="absolute -bottom-[18px] left-1/2 h-10 w-10 -translate-x-1/2 rounded-full" style={{ background: jade, boxShadow: jadeShadow }} />
    </div>
  );
}

/** 云龙纹织锦边(真圣旨丝绫龙纹边:金云纹,不含彩带) */
function BrocadeBorder({ edge }: { edge: 'top' | 'bottom' }) {
  const cloud =
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='36' height='15' viewBox='0 0 36 15'%3E%3Cg fill='none' stroke='%23b0863a' stroke-width='1' stroke-opacity='0.7'%3E%3Cpath d='M1 12 q5 -7 9 -1 q4 -6 8 -1 q4 -6 9 -1 q4 -5 8 0'/%3E%3Cpath d='M5 8 q3 -3.5 6 0 M15 7 q3 -3.5 6 0 M25 8 q3 -3.5 6 0'/%3E%3C/g%3E%3C/svg%3E\")";
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute left-[18px] right-[18px] h-[14px] ${edge === 'top' ? 'top-[8px]' : 'bottom-[8px]'}`}
      style={{
        backgroundImage: cloud,
        backgroundRepeat: 'repeat-x',
        backgroundSize: 'auto 14px',
        WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 10%, #000 90%, transparent)',
        maskImage: 'linear-gradient(90deg, transparent, #000 10%, #000 90%, transparent)',
      }}
    />
  );
}

/**
 * 圣旨展示平台:任意调用方把内容适配成 EdictView 投入,共用同一卷轴外壳与展卷·钤印仪式。
 * footer 为可选页脚插槽(如奏折的「查看详情 / 立即裁决」)。
 */
export function EdictStage({
  view,
  footer,
  children,
  hideFooter = false,
  customBodyScroll = 'styled',
  onReport,
  reportHref,
}: {
  view: EdictView;
  footer?: ReactNode;
  children?: ReactNode;
  hideFooter?: boolean;
  customBodyScroll?: 'styled' | 'native';
  onReport?: () => void;
  reportHref?: string;
}) {
  const [openAccordionRow, setOpenAccordionRow] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const seal = EDICT_SEAL[view.seal];
  const sealColor = seal.color; // 朱砂(三印) / 暗血红(機密)
  const isSecret = view.seal === 'secret';
  const scrollAccent = normalizeHexColor(
    view.meta?.accent,
    isSecret ? sealColor : DEFAULT_SCROLL_ACCENT,
  );
  const scrollAccentSoft = normalizeHexColor(view.meta?.accentSoft, DEFAULT_SCROLL_ACCENT_SOFT);
  // 密旨用沉金灰米纸,以肃穆封缄区别于三朱印的暖黄绫纸
  const paperBg = isSecret
    ? `radial-gradient(ellipse at 50% -12%, ${colorAlpha(scrollAccentSoft, 0.30)} 0%, transparent 58%), radial-gradient(ellipse at 50% 112%, ${colorAlpha(scrollAccent, 0.24)} 0%, transparent 58%), radial-gradient(ellipse at 50% -12%, #dccaa4 0%, #c2ab7e 44%, #9a7e50 100%)`
    : `radial-gradient(ellipse at 50% -12%, ${colorAlpha(scrollAccentSoft, 0.30)} 0%, transparent 58%), radial-gradient(ellipse at 50% 112%, ${colorAlpha(scrollAccent, 0.20)} 0%, transparent 58%), radial-gradient(ellipse at 50% -12%, #f6e9c9 0%, #ead6a8 44%, #d3ad6c 100%)`;
  const header = buildEdictHeaderModel(view);
  const titleParts = displayTitleParts(header.kind);
  const titleLetterSpacing = titleParts.main.length <= 4 ? '0.18em' : '0.035em';
  const headerKicker = header.kicker;
  const issuerLine = header.issuer;
  const briefModel = buildEdictBriefModel(view);
  const hasCustomBody = Boolean(children);
  const headerCompact = true;
  const showSwarmReturnOnly = !hasCustomBody && isSwarmReturnView(view);
  const pageLabels = showSwarmReturnOnly ? ['案卷主页', '蜂群回奏'] : ['案卷主页', '原始明细'];
  const pageCount = pageLabels.length;
  const hasFooter = Boolean(footer && !hideFooter);

  useEffect(() => {
    setPage(0);
    setOpenAccordionRow(null);
  }, [view.id]);

  return (
    <div className="memorial-stage relative mx-auto h-full min-h-0 w-full max-w-[920px] 2xl:max-w-[960px]">
      <style>{`
        .memorial-stage {
          perspective: 1200px;
          filter: drop-shadow(0 40px 62px rgba(0,0,0,0.52));
        }
        .memorial-stage::before {
          content: "";
          position: absolute;
          inset: -34px 2%;
          pointer-events: none;
          background:
            radial-gradient(ellipse at 50% 4%, ${colorAlpha(scrollAccentSoft, 0.30)}, transparent 56%),
            radial-gradient(ellipse at 50% 100%, ${colorAlpha(scrollAccent, 0.28)}, transparent 58%);
          filter: blur(10px);
        }
        /* 展卷:纸面在两侧厚轴之间自上而下铺展(clip 揭示) */
        .memorial-paper {
          animation: scroll-unfurl 760ms cubic-bezier(0.22,1,0.3,1) both;
          font-family: ${SCROLL_FONT_STACK};
        }
        .memorial-paper * {
          font-family: ${SCROLL_FONT_STACK} !important;
        }
        .memorial-paper::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          opacity: .42;
          background:
            radial-gradient(circle at 18% 22%, rgba(98,62,20,.14) 0 1px, transparent 1.6px),
            radial-gradient(circle at 76% 62%, rgba(98,62,20,.10) 0 1px, transparent 1.5px),
            linear-gradient(90deg, rgba(75,44,13,.18), transparent 7%, transparent 93%, rgba(75,44,13,.18));
          background-size: 47px 53px, 61px 67px, 100% 100%;
          mix-blend-mode: multiply;
        }
        .memorial-body-scroll {
          min-height: 0;
          overscroll-behavior: contain;
          scrollbar-gutter: stable;
          scrollbar-width: thin;
          scrollbar-color: rgba(85,58,22,0.62) rgba(255,248,224,0.16);
        }
        .memorial-body-scroll::-webkit-scrollbar {
          width: 10px;
        }
        .memorial-body-scroll::-webkit-scrollbar-track {
          background: rgba(255,248,224,0.16);
          border-radius: 999px;
        }
        .memorial-body-scroll::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, rgba(120,82,28,0.72), rgba(73,48,17,0.54));
          border: 2px solid rgba(229,205,149,0.48);
          border-radius: 999px;
        }
        /* 落墨:正文各段依次渗入 */
        .memorial-rows > * { animation: row-rise 460ms cubic-bezier(0.16,1,0.3,1) both; }
        .memorial-rows > *:nth-child(1){ animation-delay: 560ms; }
        .memorial-rows > *:nth-child(2){ animation-delay: 630ms; }
        .memorial-rows > *:nth-child(3){ animation-delay: 700ms; }
        .memorial-rows > *:nth-child(4){ animation-delay: 770ms; }
        .memorial-rows > *:nth-child(5){ animation-delay: 840ms; }
        .memorial-rows > *:nth-child(6){ animation-delay: 910ms; }
        .memorial-rows > *:nth-child(n+7){ animation-delay: 980ms; }
        /* 钤印落定:展卷毕,朱砂印当场盖下(回弹) */
        .edict-seal {
          animation: seal-drop 680ms cubic-bezier(0.2,1.5,0.4,1) both;
          animation-delay: 900ms;
        }
        .edict-seal-ring {
          animation: seal-ring 720ms ease-out both;
          animation-delay: 1080ms;
        }
        @keyframes scroll-unfurl {
          0%   { clip-path: inset(0 0 100% 0 round 18px); opacity: .45; }
          100% { clip-path: inset(0 0 0 0 round 18px); opacity: 1; }
        }
        @keyframes row-rise {
          0%   { opacity: 0; transform: translateY(10px); filter: blur(2px); }
          100% { opacity: 1; transform: translateY(0); filter: blur(0); }
        }
        @keyframes seal-drop {
          0%   { opacity: 0; transform: translate(-50%,-50%) rotate(-30deg) scale(1.5); }
          70%  { opacity: .20; transform: translate(-50%,-50%) rotate(-15deg) scale(.93); }
          100% { opacity: .17; transform: translate(-50%,-50%) rotate(-18deg) scale(1); }
        }
        @keyframes seal-ring {
          0%   { opacity: .5; transform: translate(-50%,-50%) scale(.55); }
          100% { opacity: 0; transform: translate(-50%,-50%) scale(2.3); }
        }
        @media (prefers-reduced-motion: reduce) {
          .memorial-paper { animation: none; clip-path: none; }
          .memorial-rows > * { animation: none; opacity: 1; transform: none; filter: none; }
          .edict-seal { animation: none; opacity: .17; transform: translate(-50%,-50%) rotate(-18deg); }
          .edict-seal-ring { display: none; }
        }
      `}</style>

      {/* keyed wrapper:切换内容(view.id)时重挂载 → 展卷/落墨/钤印 重新上演 */}
      <div key={view.id} className="relative h-full min-h-0">
        <SideRoller side="left" />
        <SideRoller side="right" />

        <section
          data-three-axis-scroll
          className="memorial-paper relative flex h-full min-h-0 flex-col overflow-hidden rounded-[18px]"
          aria-label="圣旨展示面板"
          style={{
            background: paperBg,
            border: `1px solid ${colorAlpha(scrollAccent, isSecret ? 0.62 : 0.54)}`,
            boxShadow:
              `0 28px 80px rgba(0,0,0,0.62), 0 0 60px 6px ${colorAlpha(scrollAccent, 0.13)}, inset 0 0 120px ${colorAlpha(scrollAccent, 0.18)}, inset 0 1px 0 rgba(255,250,235,0.62), inset 0 -22px 44px rgba(90,50,14,0.10)`,
          }}
        >
          {/* 朱砂钤印水印 + 钤印光环(随调用方变字) */}
          <span aria-hidden className="edict-seal-ring pointer-events-none absolute left-1/2 top-1/2 hidden h-[210px] w-[210px] rounded-full md:block" style={{ boxShadow: `0 0 0 2px ${colorAlpha(scrollAccentSoft, 0.35)}` }} />
          <span
            aria-hidden
            className="edict-seal pointer-events-none absolute left-1/2 top-1/2 grid h-[200px] w-[200px] place-items-center rounded-full"
            style={{
              border: `2px solid ${sealColor}`,
              color: sealColor,
              fontFamily: SERIF_STACK,
              fontSize: 50,
              fontWeight: 800,
              letterSpacing: '0.16em',
              mixBlendMode: 'multiply',
              backgroundImage:
                'radial-gradient(circle, rgba(60,10,6,0.22) 0.5px, transparent 0.7px)',
              backgroundSize: '3px 3px',
              WebkitMaskImage:
                'radial-gradient(ellipse 120% 100% at 42% 38%, #000 58%, rgba(0,0,0,0.72) 78%, transparent 93%)',
              maskImage:
                'radial-gradient(ellipse 120% 100% at 42% 38%, #000 58%, rgba(0,0,0,0.72) 78%, transparent 93%)',
            }}
          >
            {seal.glyph}
          </span>
          <span
            aria-hidden
            className="pointer-events-none absolute left-5 top-8 bottom-8 w-px"
            style={{ background: `linear-gradient(180deg, transparent, ${colorAlpha(scrollAccent, 0.34)}, transparent)` }}
          />
          <span
            aria-hidden
            className="pointer-events-none absolute right-5 top-8 bottom-8 w-px"
            style={{ background: `linear-gradient(180deg, transparent, ${colorAlpha(scrollAccent, 0.34)}, transparent)` }}
          />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.6]"
            style={{
              background:
                'repeating-linear-gradient(0deg, rgba(120,90,40,0.045) 0px, rgba(120,90,40,0.045) 1px, transparent 1px, transparent 25px), repeating-linear-gradient(90deg, rgba(255,255,255,0.08) 0px, rgba(255,255,255,0.08) 1px, transparent 1px, transparent 19px), repeating-linear-gradient(26deg, rgba(150,112,43,0.04) 0px, rgba(150,112,43,0.04) 1px, transparent 1px, transparent 5px)',
            }}
          />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-1/3"
            style={{ background: 'linear-gradient(160deg, rgba(255,252,240,0.12) 0%, transparent 34%)' }}
          />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-[10px] rounded-md"
            style={{ border: `1px solid ${colorAlpha(scrollAccent, 0.36)}`, boxShadow: `inset 0 0 0 3px ${colorAlpha(scrollAccentSoft, 0.22)}` }}
          />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{ background: 'radial-gradient(ellipse at 50% 42%, transparent 52%, rgba(92,62,26,0.24) 100%)' }}
          />
          <BrocadeBorder edge="top" />
          <BrocadeBorder edge="bottom" />
          {/* 密旨封缄:上下两端的暗色斜向缄纹,以示机密封存 */}
          {isSecret && (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(45deg, rgba(58,30,24,0.11) 0 2px, transparent 2px 9px)',
                WebkitMaskImage:
                  'linear-gradient(180deg, #000, transparent 38%, transparent 62%, #000)',
                maskImage: 'linear-gradient(180deg, #000, transparent 38%, transparent 62%, #000)',
              }}
            />
          )}

          <div className={`relative z-20 flex min-h-0 flex-1 basis-0 flex-col overflow-hidden px-6 md:px-12 ${
            hasCustomBody
              ? hasFooter ? 'pt-4 pb-[66px] md:pt-5 md:pb-[66px]' : 'py-4 md:py-5'
              : hasFooter ? 'pt-4 pb-[72px] md:pt-5 md:pb-[72px]' : 'py-4 md:py-5'
          }`}>
            {/* 标题区 · 标题 + 角印 */}
            <div className={`${headerCompact ? 'mb-2' : 'mb-3'} text-center`}>
              <div
                className={`${headerCompact ? 'mb-1 text-[10px]' : 'mb-2 text-[11px]'} flex items-center justify-center gap-3 font-bold tracking-[0.32em]`}
                style={{ color: '#7a4a08', fontFamily: SERIF_STACK }}
              >
                <span className="h-px w-10" style={{ background: 'linear-gradient(90deg, transparent, rgba(122,74,8,0.48))' }} aria-hidden />
                {headerKicker}
                <span className="h-px w-10" style={{ background: 'linear-gradient(90deg, rgba(122,74,8,0.48), transparent)' }} aria-hidden />
              </div>
              <div className="flex min-w-0 items-center justify-center gap-3">
                <h2
                  className={`max-w-[min(780px,82vw)] break-words font-semibold leading-[1.12] ${headerCompact ? 'text-[20px] md:text-[26px]' : 'text-[29px] md:text-[40px]'}`}
                  style={{
                    color: '#1f1708',
                    fontFamily: BRUSH_STACK,
                    letterSpacing: titleLetterSpacing,
                    fontVariantEastAsian: 'traditional',
                    textShadow: '0 2px 0 rgba(255,247,218,0.45), 0 8px 18px rgba(77,44,11,0.12)',
                  }}
                >
                  {titleParts.main}
                </h2>
                <span
                  className="flex h-8 w-8 shrink-0 flex-col items-center justify-center rounded-[3px] leading-[1.05]"
                  style={{
                    border: `1.5px solid ${sealColor}cc`,
                    color: sealColor,
                    background: `${sealColor}14`,
                    fontFamily: SERIF_STACK,
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.02em',
                  }}
                  aria-label={`${seal.a}${seal.b}之印`}
                >
                  <span>{seal.a}</span>
                  <span>{seal.b}</span>
                </span>
              </div>
              <div
                className={`${headerCompact ? 'mt-1 text-[10px]' : 'mt-1.5 text-[11px]'} font-bold tracking-[0.28em]`}
                style={{ color: 'rgba(63,44,18,0.72)', fontFamily: SERIF_STACK }}
              >
                {issuerLine}
              </div>
              <div className="mt-1 flex items-center justify-center gap-2" aria-hidden>
                <span className="h-px w-12" style={{ background: 'linear-gradient(90deg,transparent,rgba(120,90,40,0.55))' }} />
                <span className="text-[8px]" style={{ color: 'rgba(120,90,40,0.75)' }}>◆</span>
                <span className="h-px w-12" style={{ background: 'linear-gradient(90deg,rgba(120,90,40,0.55),transparent)' }} />
              </div>
            </div>

            {children ? (
              <>
                <div
                  className={`min-h-0 flex-1 basis-0 overflow-y-auto pb-2 ${
                    customBodyScroll === 'styled' ? 'memorial-body-scroll pr-2' : 'overscroll-contain pr-0'
                  }`}
                >
                  {children}
                </div>
                {footer && !hideFooter && (
                  <EdictActionDock>
                    {footer}
                  </EdictActionDock>
                )}
              </>
            ) : (
              <>
                <>
                  {page === 0 ? (
                    <MainMemorialPage view={view} model={briefModel} onReport={onReport} reportHref={reportHref} />
                  ) : showSwarmReturnOnly ? (
                    <SwarmReturnPage view={view} />
                  ) : (
                      <div
                        data-testid="edict-body-scroll"
                        className="memorial-rows memorial-body-scroll flex min-h-0 flex-1 basis-0 flex-col gap-3 overflow-y-auto pb-5 pr-3"
                        aria-label="附件明细"
                      >
                        <EvidenceDownloadDock view={view} onReport={onReport} reportHref={reportHref} />
                        {briefModel && <EdictDecisionBrief model={briefModel} />}
                        {view.rows.map((row, i) => {
                          const key = `${row.label}-${i}`;
                          const accordionKey = `${view.id}:${key}`;
                          const collapsible = shouldUseAccordionRow(row.label);
                          return (
                            <MemorialRow
                              key={key}
                              label={row.label}
                              collapsible={collapsible}
                              open={collapsible && openAccordionRow === accordionKey}
                              onToggle={
                                collapsible
                                  ? () => setOpenAccordionRow((current) => (current === accordionKey ? null : accordionKey))
                                  : undefined
                              }
                            >
                              {row.body}
                            </MemorialRow>
                          );
                        })}
                        {view.sealDate && (
                          <div
                            className="mt-auto pr-2 pt-1 text-right text-[11.5px] tracking-[0.16em]"
                            style={{ color: INK_SOFT, fontFamily: SERIF_STACK }}
                          >
                            {view.sealDate}
                          </div>
                        )}
                      </div>
                  )}
                </>

                {/* 页脚插槽(调用方自定:奏折=查看详情 / 立即裁决) */}
                {footer && !hideFooter && (
                  <EdictActionDock>
                    {footer}
                  </EdictActionDock>
                )}
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

/** 奏折适配器:把 Memorial 映射成 EdictView 投入 EdictStage,保持原有调用不变。 */
export function MemorialScroll({
  memorial,
  onApprove,
  onReport,
  reportHref,
  onReview,
  onReject,
  onComment,
  actionsDisabled = false,
  hideFooter = false,
}: {
  memorial: Memorial;
  onApprove: () => void | Promise<void>;
  onReport?: () => void;
  reportHref?: string;
  onReview?: () => void | Promise<void>;
  onReject?: () => void | Promise<void>;
  onComment?: () => void | Promise<void>;
  actionsDisabled?: boolean;
  hideFooter?: boolean;
}) {
  const view: EdictView = {
    id: memorial.id,
    title: memorial.title,
    subtitle: memorial.subtitle,
    meta: {
      petitioner: memorial.petitioner,
      reporter: memorial.reporter,
      priority: memorial.priority,
      // 严厉度按 §8.7 高风险 SSOT 从"决策本身"推导(原问/建议/裁决),供责任徽/降级判红;禁自造。
      // 会审:不喂 memorial.risk —— 风险分析散文会描述性提到关键词(如「无证券风险」)造成误报红。
      blastRadius: blastRadiusFromText([memorial.title, memorial.suggestion, memorial.verdict]),
      badges: [
        ...(memorial.focusLabel ? [{ label: memorial.focusLabel, tone: 'red' as const }] : []),
        ...(memorial.sourceMode
          ? [
              {
                label: memorial.sourceLabel ?? '来源待核',
                tone:
                  memorial.sourceMode === 'LIVE'
                    ? ('green' as const)
                    : memorial.sourceMode === 'FALLBACK'
                      ? ('amber' as const)
                      : memorial.sourceMode === 'DEMO'
                        ? ('blue' as const)
                        : ('amber' as const),
              },
            ]
          : []),
        ...(typeof memorial.evidenceCount === 'number'
          ? [{ label: `证据 ${memorial.evidenceCount} 条`, tone: memorial.evidenceCount > 0 ? ('green' as const) : ('amber' as const) }]
          : []),
      ],
    },
    rows: [
      { label: '所议', body: memorial.reason || memorial.subtitle || memorial.title },
      {
        label: '来源',
        body: [
          memorial.sourceLabel,
          memorial.petitioner ? `提请：${memorial.petitioner}` : null,
          memorial.reporter ? `承办：${memorial.reporter}` : null,
          typeof memorial.evidenceCount === 'number' ? `证据 ${memorial.evidenceCount} 条` : null,
        ].filter(Boolean).join('\n') || '上书房奏折',
      },
      { label: '主判', body: memorial.suggestion },
      { label: '红线', body: memorial.risk || '暂无明确红线；仍需按证据边界裁决。' },
      { label: '后令', body: memorial.verdict },
      { label: '追溯', body: [memorial.closing, memorial.loopTraceId].filter(Boolean).join('\n') },
    ],
    sealDate: memorial.sealDate,
    seal: 'imperial',
  };
  const handleReview = onReview ?? (() => undefined);
  const handleReject = onReject ?? (() => undefined);
  const handleComment = onComment ?? (() => undefined);
  const memorialActionClass =
    '!border !border-[#8a6a2a]/55 !bg-[#fff3c9]/90 !text-[#251806] text-[13px] font-bold tracking-[0] shadow-[inset_0_1px_0_rgba(255,250,235,0.76),0_5px_14px_rgba(58,33,8,0.14)] hover:!bg-[#ffe6a3] hover:!text-[#1b1306]';

  return (
    <EdictStage
      view={view}
      hideFooter={hideFooter}
      onReport={onReport}
      reportHref={reportHref}
      footer={
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <span className="text-[11px] tracking-[0.1em]" style={{ color: INK_SOFT, fontFamily: SERIF_STACK }}>
              {actionsDisabled ? '此折已驳回 · 三项圣裁已锁定' : memorial.focusLabel ? `${memorial.focusLabel} · 建议先裁` : '此折需陛下裁决'}
            </span>
            <div className="flex flex-wrap justify-end gap-2">
              <ImperialButton variant="gold" size="sm" onClick={onApprove} disabled={actionsDisabled} serif icon={<Gavel size={13} />} className={memorialActionClass}>
                准奏
              </ImperialButton>
              <ImperialButton variant="gold" size="sm" onClick={handleReject} disabled={actionsDisabled} serif icon={<AlertTriangle size={13} />} className={memorialActionClass}>
                驳回
              </ImperialButton>
              <ImperialButton variant="gold" size="sm" onClick={handleReview} disabled={actionsDisabled} serif icon={<UsersRound size={13} />} className={memorialActionClass}>
                会审
              </ImperialButton>
              <ImperialButton variant="gold" size="sm" onClick={handleComment} disabled={actionsDisabled} serif icon={<ClipboardCheck size={13} />} className={memorialActionClass}>
                批示
              </ImperialButton>
            </div>
          </div>
        </div>
      }
    />
  );
}
