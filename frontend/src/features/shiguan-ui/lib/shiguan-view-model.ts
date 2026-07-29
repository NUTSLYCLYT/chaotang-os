import type { ArchiveRecord, ArchiveStats, CaseOutcome } from '@/lib/contracts/archive';
import { normalizeSourceLabel, type ShiguanSourceLabel } from './shiguan-source';

export type ShiguanArchiveType = 'memorial' | 'decision' | 'task' | 'knowledge' | 'promo' | 'release_gate';
export type ShiguanRetrospectiveStatus = 'pending' | 'achieved' | 'failed' | 'partial' | 'watching';

export interface ShiguanStatsView {
  totalArchives: number;
  memorials: number;
  decisions: number;
  knowledge: number;
  reviewed: number;
  pendingReview: number;
  successRate: number;
  sourceLabel: ShiguanSourceLabel;
}

export interface ShiguanArchiveListItem {
  id: string;
  title: string;
  type: ShiguanArchiveType;
  department?: string;
  status: string;
  sourceLabel: ShiguanSourceLabel;
  updatedAt?: string;
  retrospectiveStatus?: ShiguanRetrospectiveStatus;
  summary?: string;
}

export interface ShiguanDecisionStep {
  id: string;
  title: string;
  actor: string;
  status: string;
  at?: string;
  sourceLabel: ShiguanSourceLabel;
}

export interface ShiguanEvidenceItem {
  id: string;
  title: string;
  detail: string;
  sourceLabel: ShiguanSourceLabel;
}

export interface ShiguanArchiveDownload {
  label: string;
  href: string;
}

export interface ShiguanLesson {
  id: string;
  title: string;
  detail: string;
  sourceLabel: ShiguanSourceLabel;
}

export interface ShiguanArchiveDetail {
  id: string;
  title: string;
  type: ShiguanArchiveType;
  sourceLabel: ShiguanSourceLabel;
  summary: string;
  conclusion: string;
  decisionChain: ShiguanDecisionStep[];
  evidence: ShiguanEvidenceItem[];
  downloads?: ShiguanArchiveDownload[];
  lessons: ShiguanLesson[];
  retrospectiveStatus: ShiguanRetrospectiveStatus;
  updatedAt?: string;
}

export interface ImaKnowledgeDocumentLike {
  id: string;
  title?: string;
  filename?: string;
  status?: string;
  contentExcerpt?: string;
  updatedAt?: string;
  sourceLabel?: string;
}

export interface PromoArchiveLike {
  source?: string;
  sourceLabel?: string;
  curatedCount?: number;
  curated?: Array<{ title: string; category?: string; ext?: string }>;
}

export interface ScribeLessonLike {
  billId: string;
  billTitle: string;
  extractedAt?: string;
  lessons?: Array<{ id: string; text: string; severity?: string }>;
  summary?: string;
}

function archiveTypeFor(record: ArchiveRecord): ShiguanArchiveType {
  if (record.isGovernance) return 'decision';
  if (record.type.includes('任务')) return 'task';
  return 'memorial';
}

function statusForOutcome(outcome: CaseOutcome): string {
  if (outcome === 'success') return '已归档';
  if (outcome === 'blocked') return '阻断';
  if (outcome === 'failed') return '失败';
  return '待归档';
}

function retrospectiveStatus(value: string | undefined, outcome?: CaseOutcome): ShiguanRetrospectiveStatus {
  if (value === '达成') return 'achieved';
  if (value === '未达成') return 'failed';
  if (value === '部分') return 'partial';
  if (value && value !== 'not_started') return 'watching';
  if (outcome === 'success') return 'pending';
  return 'pending';
}

export function buildShiguanStatsView(params: {
  stats?: ArchiveStats | null;
  records: ArchiveRecord[];
  knowledgeCount: number;
  sourceLabel?: ShiguanSourceLabel;
}): ShiguanStatsView {
  const memorials = params.records.filter((record) => !record.isGovernance).length;
  const decisions = params.records.filter((record) => record.isGovernance).length;
  const reviewed = params.records.filter((record) => record.retrospectiveStatus && record.retrospectiveStatus !== 'not_started').length;
  return {
    totalArchives: params.stats?.totalTasks ?? params.records.length,
    memorials,
    decisions: params.stats?.totalCases ?? decisions,
    knowledge: params.knowledgeCount,
    reviewed,
    pendingReview: Math.max(0, params.records.length - reviewed),
    successRate: params.stats?.successRate ?? 0,
    sourceLabel: params.sourceLabel ?? (params.records.length > 0 ? 'MIXED' : 'FALLBACK'),
  };
}

export function recordsToArchiveItems(records: ArchiveRecord[]): ShiguanArchiveListItem[] {
  return records.map((record) => ({
    id: record.id,
    title: record.title,
    type: archiveTypeFor(record),
    department: record.department,
    status: statusForOutcome(record.outcome),
    sourceLabel: 'MIXED',
    updatedAt: record.date,
    retrospectiveStatus: retrospectiveStatus(record.retrospectiveStatus, record.outcome),
    summary: record.reportId ? `关联案号：${record.reportId}` : undefined,
  }));
}

export function knowledgeToArchiveItems(docs: ImaKnowledgeDocumentLike[]): ShiguanArchiveListItem[] {
  return docs.map((doc) => ({
    id: `knowledge:${doc.id}`,
    title: doc.title || doc.filename || doc.id,
    type: 'knowledge',
    status: doc.status === 'archived' ? '已归档' : '知识条目',
    sourceLabel: normalizeSourceLabel(doc.sourceLabel),
    updatedAt: doc.updatedAt,
    summary: doc.contentExcerpt,
  }));
}

export function promoToArchiveItems(payload: PromoArchiveLike | null): ShiguanArchiveListItem[] {
  const curated = Array.isArray(payload?.curated) ? payload.curated : [];
  const sourceLabel = normalizeSourceLabel(payload?.sourceLabel);
  return curated.map((item, index) => ({
    id: `promo:${index}:${item.title}`,
    title: item.title,
    type: 'promo',
    status: '宣传归档',
    sourceLabel,
    department: item.category,
    summary: item.ext ? `扩展名：${item.ext}` : undefined,
  }));
}

export function lessonsToView(lessons: ScribeLessonLike[]): ShiguanLesson[] {
  return lessons.flatMap((entry) =>
    (entry.lessons ?? []).map((lesson) => ({
      id: lesson.id,
      title: entry.billTitle || entry.billId,
      detail: lesson.text,
      sourceLabel: 'MIXED' as ShiguanSourceLabel,
    })),
  );
}

export function buildArchiveDetail(
  item: ShiguanArchiveListItem | null,
  allLessons: ShiguanLesson[],
): ShiguanArchiveDetail | null {
  if (!item) return null;
  const lessons = allLessons.filter((lesson) => lesson.title === item.title || lesson.id.includes(item.id)).slice(0, 5);
  return {
    id: item.id,
    title: item.title,
    type: item.type,
    sourceLabel: item.sourceLabel,
    summary: item.summary || '该案卷已有索引，等待后端案卷详情接口补齐完整事实摘要。',
    conclusion: item.sourceLabel === 'FALLBACK'
      ? '仅作降级空态，不得作为真实归档结论。'
      : '可作为史馆索引案卷，后续需要绑定完整证据链与复盘结论。',
    retrospectiveStatus: item.retrospectiveStatus ?? 'pending',
    updatedAt: item.updatedAt,
    decisionChain: [
      {
        id: `${item.id}:source`,
        title: '进入史馆索引',
        actor: item.department || '史馆',
        status: item.status,
        at: item.updatedAt,
        sourceLabel: item.sourceLabel,
      },
      {
        id: `${item.id}:review`,
        title: '等待复盘判定',
        actor: '太史令',
        status: item.retrospectiveStatus === 'achieved' ? '已复盘' : '待复盘',
        sourceLabel: item.sourceLabel,
      },
    ],
    evidence: [
      {
        id: `${item.id}:evidence`,
        title: '案卷索引记录',
        detail: item.summary || '当前仅有索引层数据，未取得完整案卷详情。',
        sourceLabel: item.sourceLabel,
      },
    ],
    lessons,
  };
}
