import { EdictStage } from '@/features/shangshufang/components/MemorialScroll';
import type { EdictView } from '@/features/shangshufang/edict-content';
import { ShiguanEmptyState } from './ShiguanEmptyState';
import type { ShiguanArchiveDetail, ShiguanStatsView } from '../lib/shiguan-view-model';

export function ShiguanScrollPanel({
  detail,
  stats,
}: {
  detail: ShiguanArchiveDetail | null;
  stats: ShiguanStatsView;
}) {
  const view = detail ? detailToEdictView(detail) : overviewToEdictView(stats);

  return (
    <div className="h-full min-h-0">
      {stats.totalArchives === 0 && !detail ? (
        <div className="grid h-full min-h-0 grid-rows-[1fr_auto] gap-3">
          <EdictStage view={view} hideFooter />
          <ShiguanEmptyState
            title="暂无真实归档"
            body="当前展示的是系统卷轴空态；新的圣裁、会审结果或执行产物完成后，会进入史馆形成真实案卷。"
            sourceLabel={stats.sourceLabel}
          />
        </div>
      ) : (
        <EdictStage view={view} hideFooter />
      )}
    </div>
  );
}

function overviewToEdictView(stats: ShiguanStatsView): EdictView {
  return {
    id: `shiguan-overview:${stats.totalArchives}:${stats.knowledge}:${stats.pendingReview}`,
    title: '史馆案卷总览',
    subtitle: '归档、复盘、旧案召回、可信留痕',
    headerKicker: 'ARCHIVE SCROLL',
    issuerLine: '太史令 · 史馆中卷',
    question: '史馆当前收录的组织记忆与可复用旧案。',
    seal: 'imperial',
    meta: {
      reporter: '太史令',
      priority: 'medium',
      accent: '#3DD68C',
      accentSoft: '#F0C66A',
      badges: [
        { label: `案卷 ${stats.totalArchives}`, tone: stats.totalArchives > 0 ? 'green' : 'amber' },
        { label: `知识 ${stats.knowledge}`, tone: 'blue' },
        { label: `待复盘 ${stats.pendingReview}`, tone: stats.pendingReview > 0 ? 'amber' : 'green' },
        { label: stats.sourceLabel, tone: stats.sourceLabel === 'FALLBACK' ? 'amber' : 'green' },
      ],
    },
    rows: [
      {
        label: '史馆职责',
        body: '史馆负责把已发生的任务、奏折、裁决、执行结果、证据和复盘沉淀成可再次调用的组织记忆。',
      },
      {
        label: '当前案卷',
        body: `可索引案卷 ${stats.totalArchives} 件，奏折 ${stats.memorials} 件，决策 ${stats.decisions} 条，知识 ${stats.knowledge} 条。`,
      },
      {
        label: '复盘状态',
        body: `已复盘 ${stats.reviewed} 件，待复盘 ${stats.pendingReview} 件，综合成功率 ${stats.successRate}%。`,
      },
      {
        label: '后令',
        body: stats.totalArchives > 0
          ? '先从左侧选择案卷；史馆会展示事实链、证据链、判词与可复用教训。'
          : '暂无真实归档时，只展示系统卷轴空态，不伪造旧案。',
      },
    ],
  };
}

function detailToEdictView(detail: ShiguanArchiveDetail): EdictView {
  const decisionChain = detail.decisionChain
    .map((step, index) => `${index + 1}. ${step.title} / ${step.actor} / ${step.status}${step.at ? ` / ${formatDate(step.at)}` : ''}`)
    .join('\n');
  const evidence = detail.evidence
    .map((item, index) => `${index + 1}. ${item.title}: ${item.detail} [${item.sourceLabel}]`)
    .join('\n');
  const lessons = detail.lessons.length
    ? detail.lessons.map((item, index) => `${index + 1}. ${item.detail}`).join('\n')
    : '暂无绑定 lessons；待后端把复盘教训与案卷 ID 绑定。';

  return {
    id: `shiguan-detail:${detail.id}:${detail.retrospectiveStatus}`,
    title: detail.title,
    subtitle: '史馆案卷',
    headerKicker: 'ARCHIVE CASE',
    issuerLine: '太史令 · 史馆判读',
    question: detail.summary,
    seal: 'imperial',
    sealDate: detail.updatedAt,
    meta: {
      reporter: '太史令',
      priority: 'medium',
      accent: '#3DD68C',
      accentSoft: '#F0C66A',
      badges: [
        { label: archiveTypeLabel(detail.type), tone: 'blue' },
        { label: detail.retrospectiveStatus, tone: detail.retrospectiveStatus === 'pending' ? 'amber' : 'green' },
        { label: detail.sourceLabel, tone: detail.sourceLabel === 'FALLBACK' ? 'amber' : 'green' },
      ],
    },
    rows: [
      { label: '事实摘要', body: detail.summary },
      { label: '决策链', body: decisionChain || '暂无决策链。' },
      { label: '证据链', body: evidence || '暂无证据链。' },
      { label: '史馆判词', body: detail.conclusion },
      { label: '可复用教训', body: lessons },
    ],
  };
}

function archiveTypeLabel(type: ShiguanArchiveDetail['type']) {
  if (type === 'memorial') return '奏折';
  if (type === 'decision') return '决策';
  if (type === 'task') return '任务';
  if (type === 'knowledge') return '知识';
  if (type === 'promo') return '宣传';
  return '门禁';
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', { hour12: false });
}
