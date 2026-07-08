import {
  getSixDepartmentScrollTheme,
  isSixDepartmentCode,
  SIX_DEPARTMENTS,
  type SixDepartmentCode,
} from '@/features/departments/lib/six-departments-content';
import { getV1LiubuByCanonicalCode } from '@/config/chaotang-v1-modules';
import { getBureauPageSpecs } from '@/features/bureaus/lib/bureau-page-specs';
import type { BureauDepartmentCode } from '@/lib/contracts/bureau-page-view';
import type {
  DepartmentDataIntegrity,
  DepartmentPageCanonicalCode,
  DepartmentPageCode,
  DepartmentPageView,
  DepartmentRailSection,
} from '@/lib/contracts/department-page-view';
import type { DeptOverview } from '@/lib/contracts/dept';
import type { EdictView } from '@/features/shangshufang/edict-content';
import type { HubuOverview, HubuProject } from '@/lib/contracts/hubu';
import type { LegalCase, LegalOverview } from '@/lib/contracts/xingbu';
import type { BingbuSalesItem, BingbuSalesOverview } from '@/lib/contracts/bingbu-sales';
import type { DepartmentActionTrueChainPlan } from '@/features/departments/lib/department-actions';

export interface LibuPromoOverview {
  source: string;
  count: number;
  highValueCount: number;
  byCategory: Record<string, number>;
  items: Array<{
    title: string;
    category: string;
    kind: string;
    ext: string;
    tier: string;
  }>;
}

export interface DepartmentTaskInsight {
  id: string;
  title: string;
  command: string;
  status: string;
  updatedAt: string;
  reason: string;
  sourceDepartment?: DepartmentPageCanonicalCode;
  targetDepartment?: DepartmentPageCanonicalCode;
  verdict?: string;
  evidence?: string[];
  nextSteps?: string[];
  relatedDepartments?: string[];
  trueChainPlan?: DepartmentActionTrueChainPlan;
  tone?: 'green' | 'amber' | 'red' | 'blue' | 'neutral';
}

export function normalizeDepartmentPageCode(code: string): DepartmentPageCanonicalCode | null {
  if (code === 'works') return 'gongbu';
  if (isSixDepartmentCode(code)) return code;
  return null;
}

function sealFor(code: DepartmentPageCanonicalCode): EdictView['seal'] {
  return code === 'legal' ? 'secret' : 'imperial';
}

function statusFromOverview(overview?: DeptOverview | null): DepartmentPageView['header']['status'] {
  if (!overview) return { label: '待命', tone: 'idle' };
  const map: Record<string, DepartmentPageView['header']['status']> = {
    idle: { label: '待命', tone: 'idle' },
    processing: { label: '处理中', tone: 'processing' },
    risk: { label: '风险', tone: 'risk' },
    pending_review: { label: '待审', tone: 'pending_review' },
    done: { label: '已完成', tone: 'done' },
  };
  return map[overview.status] ?? { label: '待命', tone: 'idle' };
}

function metricRailFromOverview(overview?: DeptOverview | null): DepartmentRailSection | null {
  if (!overview?.keyMetrics?.length) return null;
  return {
    id: 'live-metrics',
    title: '当前状态',
    subtitle: '来自后端的最新部门状态。',
    kind: 'metric_strip',
    items: overview.keyMetrics.slice(0, 5).map((metric, index) => ({
      id: `metric-${index}`,
      label: metric.label,
      value: metric.unit ? `${metric.value}${metric.unit}` : metric.value,
      tone: index === 0 ? 'amber' : 'neutral',
    })),
  };
}

function riskRailFromOverview(overview?: DeptOverview | null): DepartmentRailSection | null {
  if (!overview?.risks?.length) return null;
  return {
    id: 'live-risks',
    title: '风险提示',
    subtitle: '后端当前已识别的风险项。',
    kind: 'risk_list',
    items: overview.risks.slice(0, 5).map((risk, index) => ({
      id: `risk-${index}`,
      label: risk.label,
      body: risk.level,
      tone: risk.level === 'critical' || risk.level === 'high' ? 'red' : risk.level === 'medium' ? 'amber' : 'green',
    })),
  };
}

function activeTasksRail(overview?: DeptOverview | null): DepartmentRailSection | null {
  if (!overview?.activeTasks?.length) return null;
  return {
    id: 'active-tasks',
    title: '正在处理',
    subtitle: '需要继续推进的部门事项。',
    kind: 'decision_list',
    items: overview.activeTasks.slice(0, 5).map((task) => ({
      id: task.taskId,
      label: task.title,
      value: `${task.progressPct}%`,
      tone: task.progressPct >= 80 ? 'green' : task.progressPct >= 40 ? 'amber' : 'blue',
      actionId: 'continue',
    })),
  };
}

function bureauEntrancesRail(code: DepartmentPageCanonicalCode): DepartmentRailSection | null {
  if (code === 'market') return null;
  const v1Department = getV1LiubuByCanonicalCode(code);
  const bureaus = v1Department?.offices ?? getBureauPageSpecs(code as BureauDepartmentCode);
  if (!bureaus.length) return null;

  return {
    id: 'bureau-entrances',
    title: '各司入口',
    subtitle: '按问题进入下属专司。',
    kind: 'decision_list',
    items: bureaus.map((bureau, index) => ({
      id: `bureau-${index + 1}`,
      label: bureau.name,
      value: bureau.role,
      body: bureau.scope,
      tone: index === 0 ? 'amber' : 'blue',
      href: v1Department ? `/liubu/${v1Department.code}/${bureau.slug}` : `/liubu/${code}/bureau-${index + 1}`,
    })),
  };
}

const TASK_DEPARTMENT_LABELS: Record<DepartmentPageCanonicalCode, string> = {
  finance: '户部',
  gongbu: '工部',
  personnel: '吏部',
  market: '礼部',
  ops: '兵部',
  legal: '刑部',
};

function compactDisplayText(value: string, max = 34): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 1)}…`;
}

function extractCouncilSubject(value: string): string | null {
  const match = /围绕“([^”]+)(?:”|组织会审|$)/.exec(value);
  if (!match?.[1]) return null;
  return match[1].replace(/\.\.\.$|…$/g, '').replace(/[。；;，,]\s*$/, '').trim();
}

function cleanPromptPrefix(value: string): string {
  return value
    .trim()
    .replace(/^请军机处围绕“?/, '')
    .replace(/^请基于/, '基于')
    .replace(/^请/, '')
    .replace(/”组织会审.*$/, '')
    .replace(/[。；;，,]\s*$/, '')
    .trim();
}

function actionLabelFromText(value: string): string | null {
  const normalized = value.trim();
  const direct = /^(finance|gongbu|personnel|market|ops|legal)\s*·\s*(.+)$/i.exec(normalized);
  if (direct?.[2]) return direct[2].trim();
  const command = /department page action:\s*(.+)$/i.exec(normalized);
  if (command?.[1]) return command[1].trim();
  return null;
}

function transferLabelFromReason(reason?: string): string | null {
  if (!reason) return null;
  const transfer = /^(finance|gongbu|personnel|market|ops|legal)\s*->\s*(finance|gongbu|personnel|market|ops|legal)\s*·\s*(.+)$/i.exec(reason);
  if (!transfer?.[1] || !transfer[3]) return null;
  const source = transfer[1] as DepartmentPageCanonicalCode;
  return `${TASK_DEPARTMENT_LABELS[source]}移交：${transfer[3].trim()}`;
}

function displayTaskTitle(item: DepartmentTaskInsight): string {
  const transfer = transferLabelFromReason(item.reason);
  if (transfer) return compactDisplayText(transfer);

  const action = actionLabelFromText(item.title) || actionLabelFromText(item.command);
  if (action) return compactDisplayText(action);

  const subject = extractCouncilSubject(item.title) || extractCouncilSubject(item.command);
  if (subject) return compactDisplayText(cleanPromptPrefix(subject));

  return compactDisplayText(cleanPromptPrefix(item.title || item.command || '待处理事项'));
}

function displayTaskBody(item: DepartmentTaskInsight): string {
  const commandAction = actionLabelFromText(item.command);
  const subject = extractCouncilSubject(item.command) || extractCouncilSubject(item.title);
  const primary = commandAction ? `页面动作：${commandAction}` : subject || item.command || item.reason;
  return [primary, ...(item.nextSteps ?? []).slice(0, 2)].filter(Boolean).join('\n');
}

function displayTaskValue(item: DepartmentTaskInsight): string {
  if (item.verdict) {
    const chain = /(入职责任链|离职责任链|晋升责任链|责任链)/.exec(item.verdict);
    if (chain?.[1]) return chain[1];
    const clean = actionLabelFromText(item.verdict)
      || (extractCouncilSubject(item.verdict) ? cleanPromptPrefix(extractCouncilSubject(item.verdict) ?? '') : '')
      || item.verdict.replace(/^(finance|gongbu|personnel|market|ops|legal)\s*·\s*/i, '');
    return compactDisplayText(cleanPromptPrefix(clean), 20);
  }
  const statusMap: Record<string, string> = {
    report_ready: '待处理',
    submitted: '已提交',
    running: '处理中',
    reviewed: '已复核',
    archived: '已归档',
    done: '已完成',
    failed: '失败',
  };
  return statusMap[item.status] ?? item.status;
}

function taskInsightRail(insights?: DepartmentTaskInsight[] | null): DepartmentRailSection | null {
  if (!insights?.length) return null;
  const seen = new Set<string>();
  const items = insights.flatMap((item) => {
    const label = displayTaskTitle(item);
    const value = displayTaskValue(item);
    const key = `${label}::${value}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [{
      id: item.id,
      label,
      body: displayTaskBody(item),
      value,
      meta: `${item.reason} · ${item.updatedAt || '待核'}`,
      tone: item.tone ?? 'blue',
      actionId: 'continue',
    }];
  }).slice(0, 6);

  return {
    id: 'primary-task-insights',
    title: '当前待办',
    subtitle: '和本部门有关、现在需要继续处理的事项。',
    kind: 'decision_list',
    items,
  };
}

function taskInsightTrueChainRail(insights?: DepartmentTaskInsight[] | null): DepartmentRailSection | null {
  if (!insights?.length) return null;
  const trueChainPlans = insights.flatMap((item) => item.trueChainPlan ? [{ insight: item, plan: item.trueChainPlan }] : []);
  if (!trueChainPlans.length) return null;
  return {
    id: 'primary-task-true-chain',
    title: '待确认执行',
    subtitle: '这些动作需要你明确确认后才会执行。',
    kind: 'handoff_list',
    items: trueChainPlans.slice(0, 4).map(({ insight, plan }) => ({
      id: `true-chain-${insight.id}`,
      label: plan.label,
      value: '待确认',
      body: plan.note,
      meta: insight.reason,
      tone: 'blue',
      details: [
        { label: '触发', value: '需要你确认，不会自动执行' },
        { label: '结果', value: plan.resultEndpoint ? '执行后等待结果回传' : '执行后写入任务回执' },
        { label: '材料', value: Object.keys(plan.payload).length ? '已准备办事材料' : '等待补充材料' },
      ],
    })),
  };
}

function taskInsightEvidenceRail(insights?: DepartmentTaskInsight[] | null): DepartmentRailSection | null {
  if (!insights?.length) return null;
  const evidence = insights.flatMap((item) => item.evidence ?? []);
  if (evidence.length) {
    return {
      id: 'primary-task-source',
      title: '依据与缺口',
      subtitle: '当前判断依据，以及继续推进前还缺什么。',
      kind: 'evidence_list',
      items: evidence.slice(0, 6).map((body, index) => ({
        id: `primary-task-evidence-${index}`,
        label: index === 0 ? '已识别证据' : '补充证据',
        body,
        tone: index === 0 ? 'green' : 'blue',
      })),
    };
  }
  return {
    id: 'primary-task-source',
    title: '依据与缺口',
    subtitle: '只读取已经存在的真实任务，不自动触发执行。',
    kind: 'evidence_list',
    items: [
      {
        id: 'primary-task-count',
        label: '已匹配任务',
        value: `${insights.length} 项`,
        body: '这些事项来自 primary tasks，可作为部门页待处理上下文。',
        tone: 'green',
      },
    ],
  };
}

function hubuMetricRail(overview?: HubuOverview | null): DepartmentRailSection | null {
  if (!overview) return null;
  const summary = overview.summary;
  return {
    id: 'hubu-money-health',
    title: '真金透视',
    subtitle: `预算司 · ${summary.recommendation || '成本、预算与现金余量真算'}`,
    kind: 'metric_strip',
    items: [
      { id: 'total-requested', label: '总申请预算', value: summary.total_requested || '待核', tone: 'amber' },
      { id: 'approved-week', label: '本周已准', value: summary.approved_this_week || '待核', tone: 'green' },
      { id: 'pending', label: '待批事项', value: `${summary.pending_count ?? 0} 项`, tone: summary.pending_count ? 'amber' : 'green' },
      { id: 'avg-roi', label: '平均 ROI', value: summary.avg_roi || '待核', tone: 'blue' },
      { id: 'cash', label: '现金余量', value: summary.cash_reserve || '待核', tone: summary.cash_reserve === '—' ? 'amber' : 'green' },
    ],
  };
}

function hubuDecisionRail(projects: HubuProject[]): DepartmentRailSection | null {
  if (!projects.length) return null;
  return {
    id: 'hubu-pending-projects',
    title: '当前待办 · 待你拍板',
    subtitle: '预算司 · 来自户部真实项目派生',
    kind: 'decision_list',
    items: projects.slice(0, 5).map((project) => ({
      id: project.id,
      label: project.title,
      value: project.requested_budget || '待核',
      body: project.recommendation || project.command || '待户部复核。',
      tone: project.risk_level === 'critical' || project.risk_level === 'high' ? 'red' : project.status === 'approved' ? 'green' : 'amber',
      actionId: project.status === 'approved' ? 'archive' : 'request_evidence',
    })),
  };
}

function hubuRiskRail(projects: HubuProject[]): DepartmentRailSection | null {
  const risky = projects.filter((project) => project.risk_level === 'high' || project.risk_level === 'critical');
  if (!risky.length) return null;
  return {
    id: 'hubu-risk-projects',
    title: '现金流压测',
    subtitle: '资产司 · 现金、回款与账期压力',
    kind: 'risk_list',
    items: risky.slice(0, 5).map((project) => ({
      id: `risk-${project.id}`,
      label: project.title,
      value: project.risk_level,
      body: project.cash_flow_pressure || project.recommendation,
      tone: project.risk_level === 'critical' ? 'red' : 'amber',
    })),
  };
}

function legalMetricRail(overview?: LegalOverview | null): DepartmentRailSection | null {
  if (!overview) return null;
  const summary = overview.summary;
  return {
    id: 'legal-risk-docket',
    title: '风险案卷',
    subtitle: summary.recommendation || '刑部司法实况。',
    kind: 'metric_strip',
    items: [
      { id: 'total-cases', label: '在办案件', value: `${summary.totalCases ?? 0} 件`, tone: 'blue' },
      { id: 'pending', label: '待审案件', value: `${summary.pendingCount ?? 0} 件`, tone: summary.pendingCount ? 'amber' : 'green' },
      { id: 'closed-week', label: '本周结案', value: String(summary.closedThisWeek ?? '0'), tone: 'green' },
      { id: 'backlog', label: '合规积压', value: `${summary.complianceBacklog ?? 0} 项`, tone: summary.complianceBacklog ? 'red' : 'green' },
      { id: 'closure', label: '结案率', value: summary.closureRate || '待核', tone: 'blue' },
    ],
  };
}

function legalCaseRail(cases: LegalCase[]): DepartmentRailSection | null {
  if (!cases.length) return null;
  return {
    id: 'legal-cases',
    title: '待审合同与案件',
    subtitle: '来自刑部案件总览。',
    kind: 'decision_list',
    items: cases.slice(0, 5).map((item) => ({
      id: item.id,
      label: item.title,
      value: item.priority,
      body: item.summary,
      meta: `${item.caseNumber} · ${item.judge}`,
      tone: item.riskLevel === 'critical' || item.riskLevel === 'high' ? 'red' : item.riskLevel === 'medium' ? 'amber' : 'green',
      actionId: item.status === 'closed' ? 'archive' : 'request_revision',
    })),
  };
}

function legalRiskRail(overview?: LegalOverview | null): DepartmentRailSection | null {
  if (!overview) return null;
  const risks = [
    ...overview.cases
      .filter((item) => item.riskLevel === 'critical' || item.riskLevel === 'high')
      .map((item) => ({ id: item.id, label: item.title, body: item.summary, level: item.riskLevel })),
    ...overview.complianceItems
      .filter((item) => item.riskLevel === 'critical' || item.riskLevel === 'high' || item.status === 'failed')
      .map((item) => ({ id: item.id, label: item.title, body: `${item.checklistPassed}/${item.checklistTotal} 已通过`, level: item.riskLevel })),
  ];
  if (!risks.length) return null;
  return {
    id: 'legal-live-risks',
    title: '红线风险',
    subtitle: '高风险案件和未通过合规项。',
    kind: 'risk_list',
    items: risks.slice(0, 6).map((item) => ({
      id: `legal-risk-${item.id}`,
      label: item.label,
      body: item.body,
      value: item.level,
      tone: item.level === 'critical' || item.level === 'high' ? 'red' : 'amber',
    })),
  };
}

function bingbuMetricRail(overview?: BingbuSalesOverview | null): DepartmentRailSection | null {
  if (!overview) return null;
  const summary = overview.summary;
  return {
    id: 'bingbu-battlefield',
    title: '今日战场',
    subtitle: summary.recommendation || '兵部销售战情总览。',
    kind: 'metric_strip',
    items: [
      { id: 'total', label: '销售事项', value: `${summary.total_items ?? 0} 项`, tone: 'blue' },
      { id: 'pending', label: '待决事项', value: `${summary.pending_count ?? 0} 项`, tone: summary.pending_count ? 'amber' : 'green' },
      { id: 'high-risk', label: '高危商机', value: `${summary.high_risk_count ?? 0} 项`, tone: summary.high_risk_count ? 'red' : 'green' },
      { id: 'source', label: '数据来源', value: summary.source, tone: summary.source === 'fallback' ? 'amber' : 'green' },
    ],
  };
}

function bingbuDecisionRail(items: BingbuSalesItem[]): DepartmentRailSection | null {
  if (!items.length) return null;
  return {
    id: 'bingbu-sales-items',
    title: '待推进客户',
    subtitle: '来自兵部销售决策队列。',
    kind: 'decision_list',
    items: items.slice(0, 5).map((item) => ({
      id: item.id,
      label: item.title,
      value: item.amount || item.stage || '待核',
      body: item.recommendation || item.command || '待兵部形成推进动作。',
      meta: `${item.counterparty || '客户待核'} · ${item.stage || '阶段待核'} · 已问 ${item.asked_count ?? 1} 次`,
      tone: item.risk_level === 'critical' || item.risk_level === 'high' ? 'red' : item.status === 'closed' ? 'green' : 'amber',
      actionId: item.status === 'closed' ? 'archive' : 'next_action',
    })),
  };
}

function bingbuRiskRail(items: BingbuSalesItem[]): DepartmentRailSection | null {
  const risky = items.filter((item) => item.risk_level === 'critical' || item.risk_level === 'high');
  if (!risky.length) return null;
  return {
    id: 'bingbu-live-risks',
    title: '战场风险',
    subtitle: '高风险商机、报价和承诺事项。',
    kind: 'risk_list',
    items: risky.slice(0, 5).map((item) => ({
      id: `bingbu-risk-${item.id}`,
      label: item.title,
      value: item.risk_level,
      body: item.terms.length ? item.terms.join('、') : item.recommendation,
      tone: item.risk_level === 'critical' ? 'red' : 'amber',
    })),
  };
}

function libuPromoMetricRail(overview?: LibuPromoOverview | null): DepartmentRailSection | null {
  if (!overview) return null;
  return {
    id: 'libu-promo-assets',
    title: '宣传资料库',
    subtitle: `来源：${overview.source || '待核'}`,
    kind: 'metric_strip',
    items: [
      { id: 'count', label: '可用素材', value: `${overview.count ?? 0} 份`, tone: overview.count ? 'green' : 'amber' },
      { id: 'high-value', label: '高价值素材', value: `${overview.highValueCount ?? 0} 份`, tone: overview.highValueCount ? 'green' : 'amber' },
      { id: 'categories', label: '素材分类', value: `${Object.keys(overview.byCategory ?? {}).length} 类`, tone: 'blue' },
      { id: 'source', label: '数据源', value: overview.source || '待核', tone: overview.count ? 'green' : 'amber' },
    ],
  };
}

function libuPromoDecisionRail(overview?: LibuPromoOverview | null): DepartmentRailSection | null {
  if (!overview?.items?.length) return null;
  return {
    id: 'libu-promo-items',
    title: '可用对外素材',
    subtitle: '来自礼部宣传资料库，只展示元数据。',
    kind: 'evidence_list',
    items: overview.items.slice(0, 6).map((item, index) => ({
      id: `promo-${index}`,
      label: item.title,
      value: item.tier,
      body: `${item.category} · ${item.kind} · ${item.ext}`,
      tone: item.tier === 'high' ? 'green' : 'neutral',
    })),
  };
}

function libuPromoRiskRail(overview?: LibuPromoOverview | null): DepartmentRailSection | null {
  if (!overview) return null;
  const missing = overview.count <= 0;
  return {
    id: 'libu-promo-integrity',
    title: '发布证据',
    subtitle: '礼部只把有来源的素材纳入话术依据。',
    kind: 'evidence_list',
    items: [
      {
        id: 'promo-source',
        label: missing ? '素材待补' : '素材可用',
        body: missing ? '暂无可用宣传素材，不能支撑强营销承诺。' : `已读取 ${overview.count} 份素材，可作为对外表达证据。`,
        tone: missing ? 'amber' : 'green',
      },
    ],
  };
}

function buildHubuRows(overview: HubuOverview): EdictView['rows'] {
  const primary = overview.projects[0];
  if (!primary) {
    return [
      { label: '裁决', body: '暂无真实待裁财务事项，户部保持待命。' },
      { label: '关键数字', body: `现金余量：${overview.summary.cash_reserve || '待核'}；待批事项：${overview.summary.pending_count ?? 0} 项。` },
      { label: '证据来源', body: `来源：${overview.summary.source}；生成时间：${overview.summary.generated_at}` },
      { label: '禁止动作', body: '不得把空态或预览结论当成真实付款。' },
      { label: '后令', body: '可以发起预算、报价、付款或现金流问题，让户部形成裁决。' },
    ];
  }
  return [
    { label: '裁决', body: primary.recommendation || '待户部复核后裁决。' },
    { label: '关键数字', body: `预算：${primary.requested_budget || '待核'}；ROI：${primary.estimated_roi || '待核'}；回收期：${primary.payback_window || '待核'}。` },
    { label: '证据来源', body: `项目：${primary.title}；来源：${overview.summary.source}；更新时间：${primary.updated_at || overview.summary.generated_at}` },
    { label: '缺口', body: primary.acceptance_criteria.length ? primary.acceptance_criteria.join('\n') : '验收、合同、现金流缓冲等证据需按事项补齐。' },
    { label: '禁止动作', body: '付款和预算放行必须人工确认，不允许页面自动执行资金动作。' },
    { label: '后令', body: primary.risk_level === 'high' || primary.risk_level === 'critical' ? '先补证，并视情况交刑部或工部复核。' : '可按准奏、补证、缓议、归档流程继续处理。' },
  ];
}

function buildLegalRows(overview: LegalOverview): EdictView['rows'] {
  const primary = overview.cases.find((item) => item.riskLevel === 'critical' || item.riskLevel === 'high') ?? overview.cases[0];
  if (!primary) {
    return [
      { label: '判决', body: '暂无待审合同或红线案件，刑部保持巡查。' },
      { label: '红线条款', body: `合规积压：${overview.summary.complianceBacklog ?? 0} 项。` },
      { label: '修改意见', body: '如有合同、承诺或授权问题，可提交刑部生成判决书。' },
      { label: '禁止动作', body: '重大合同和高风险承诺仍需人工法务复核。' },
      { label: '后令', body: `来源：${overview.summary.source}；生成时间：${overview.summary.generatedAt}` },
    ];
  }
  return [
    { label: '判决', body: `${primary.riskLevel === 'critical' || primary.riskLevel === 'high' ? '暂缓，需修改或人工复核。' : '可继续审理，保留证据链。'}${primary.summary}` },
    { label: '红线条款', body: primary.legalReferences.length ? primary.legalReferences.join('\n') : '待补充合同或法规引用。' },
    { label: '修改意见', body: '围绕付款、验收、违约、授权、数据和对外承诺逐条改写。' },
    { label: '禁止动作', body: '不得在红线条款未修正前签署、付款、对外发送或归档为通过。' },
    { label: '豁免条件', body: '如需豁免，必须记录风险承受人、签字链和证据依据。' },
    { label: '后令', body: `承办法官：${primary.judge}；案号：${primary.caseNumber}；来源：${overview.summary.source}` },
  ];
}

function buildBingbuRows(overview: BingbuSalesOverview): EdictView['rows'] {
  const primary = overview.items.find((item) => item.risk_level === 'critical' || item.risk_level === 'high') ?? overview.items[0];
  if (!primary) {
    return [
      { label: '战场判断', body: '暂无真实销售待决事项，兵部保持巡防。' },
      { label: '客户异议', body: `待决事项：${overview.summary.pending_count ?? 0} 项；高危事项：${overview.summary.high_risk_count ?? 0} 项。` },
      { label: '打法', body: '可以录入报价、谈判、客户、商机、渠道或续约问题。' },
      { label: '竞品信号', body: '暂无真实竞品攻防信号。' },
      { label: '后令', body: `来源：${overview.summary.source}；生成时间：${overview.summary.generated_at}` },
    ];
  }
  return [
    { label: '战场判断', body: primary.recommendation || '待兵部形成推进判断。' },
    { label: '客户异议', body: `客户/对手：${primary.counterparty || '待核'}；阶段：${primary.stage || '待核'}；金额：${primary.amount || '待核'}。` },
    { label: '打法', body: `优先级：${primary.priority}；交期：${primary.delivery || '待核'}；预付款：${primary.prepayment || '待核'}。` },
    { label: '竞品信号', body: primary.terms.length ? primary.terms.join('\n') : '未抽取到明确竞品、独家或违约条款。' },
    { label: '下一步', body: primary.risk_level === 'critical' || primary.risk_level === 'high' ? '先交户部核价、工部补交付证据、刑部复核承诺。' : '生成下一步跟进动作，并把可复用经验归档。' },
    { label: '后令', body: `来源：${overview.summary.source}；原始命令：${primary.command || '待核'}` },
  ];
}

function buildLibuPromoRows(overview: LibuPromoOverview): EdictView['rows'] {
  const top = overview.items[0];
  if (!top) {
    return [
      { label: '可发版本', body: '暂无真实宣传素材可支撑对外表达，礼部保持待命。' },
      { label: '建议改写', body: '对外话术应先补案例、数字来源或公开素材。' },
      { label: '禁用承诺', body: '无证据数字、保证结果和合同承诺不得发布。' },
      { label: '适用场景', body: '待补素材后再区分客户、销售、官网、公关和内部版本。' },
      { label: '后令', body: `来源：${overview.source || '待核'}；素材数：${overview.count ?? 0}` },
    ];
  }
  const categorySummary = Object.entries(overview.byCategory ?? {})
    .slice(0, 5)
    .map(([category, count]) => `${category}: ${count}`)
    .join('\n') || '分类待核';
  return [
    { label: '可发版本', body: `可围绕《${top.title}》生成对外表达，但必须保留素材边界。` },
    { label: '建议改写', body: '把强承诺改成“基于已公开素材/已验证场景”的条件式表达。' },
    { label: '禁用承诺', body: '不得把宣传素材扩写成合同承诺、监管承诺或无证据数字。' },
    { label: '素材依据', body: categorySummary },
    { label: '需复核项', body: '涉及合同、价格、交期、合规和安全表述时交刑部或对应部门复核。' },
    { label: '后令', body: `来源：${overview.source}; 可用素材 ${overview.count} 份，高价值素材 ${overview.highValueCount} 份。` },
  ];
}

function buildTaskInsightRows(
  code: DepartmentPageCanonicalCode,
  insights: DepartmentTaskInsight[],
  fallback: EdictView['rows'],
): EdictView['rows'] {
  const first = insights[0];
  if (!first) return fallback;
  if (code === 'finance') {
    const evidence = first.evidence?.length ? first.evidence.join('\n') : first.command || first.reason;
    const nextSteps = first.nextSteps?.length ? first.nextSteps.join('\n') : '先核预算归属、现金影响、付款依据和验收边界；付款或预算放行仍需用户显式确认。';
    const relatedDepartments = first.relatedDepartments?.length ? first.relatedDepartments.join(' / ') : '待核';
    return [
      { label: '当前待办', body: `${displayTaskTitle(first)}。${first.verdict ? `当前判断：${displayTaskValue(first)}。` : ''}` },
      { label: '案件编号', body: `案号：${first.id}；状态：${displayTaskValue(first)}；更新时间：${first.updatedAt || '待核'}。` },
      { label: '事项原文', body: displayTaskBody(first) },
      { label: '证据与缺口', body: evidence },
      { label: '下一步', body: nextSteps },
      { label: '协同部门', body: `来源/原因：${first.reason}；相关部门：${relatedDepartments}。` },
    ];
  }
  if (code === 'gongbu') {
    const evidence = first.evidence?.length ? first.evidence.join('\n') : first.command || first.reason;
    const nextSteps = first.nextSteps?.length ? first.nextSteps.join('\n') : '需要测试、构建、验收边界、回滚或供应证据时，应通过工部真链点火后轮询结果。';
    return [
      { label: '验收结论', body: `已从真实任务中匹配到工部相关事项：${first.title}。${first.verdict ? `当前门禁：${first.verdict}。` : ''}当前只读展示，不自动触发 feasibility 或 PACK 蜂群。` },
      { label: '当前证据', body: evidence },
      { label: '阻断项', body: nextSteps },
      { label: '交付边界', body: `任务状态：${first.status}；更新时间：${first.updatedAt || '待核'}。` },
      { label: '后令', body: '先把该任务作为工部待验收上下文；如要产出 PACK/可行性结果，再由用户显式触发。' },
    ];
  }
  if (code === 'personnel') {
    const evidence = first.evidence?.length ? first.evidence.join('\n') : first.command || first.reason;
    const nextSteps = first.nextSteps?.length ? first.nextSteps.join('\n') : '责任、权限、签字和招聘判断需要真实组织数据或招聘真链补强。';
    return [
      { label: '主责人', body: `已从真实任务中匹配到吏部相关事项：${first.title}。${first.verdict ? `当前责任链：${first.verdict}。` : ''}` },
      { label: '签字链', body: evidence },
      { label: '权限缺口', body: nextSteps },
      { label: '执行节奏', body: `任务状态：${first.status}；更新时间：${first.updatedAt || '待核'}。` },
      { label: '后令', body: '先把该任务作为责任链上下文；招聘或任免裁决必须由用户显式触发真链。' },
    ];
  }
  return fallback;
}

type DepartmentSpec = {
  title: string;
  subtitle: string;
  primaryQuestion: string;
  sourceLabel: string;
  leftTitle: string;
  leftItems: Array<{ id: string; label: string; value?: string; body?: string; tone?: 'green' | 'amber' | 'red' | 'blue' | 'neutral' }>;
  edictSubtitle: string;
  edictQuestion: string;
  edictRows: EdictView['rows'];
  rightSections: DepartmentRailSection[];
  commands: DepartmentPageView['commandBar'];
  emptyState: DepartmentPageView['emptyState'];
  missing?: DepartmentDataIntegrity['missing'];
  disclaimer: string;
};

const SPECS: Record<DepartmentPageCanonicalCode, DepartmentSpec> = {
  finance: {
    title: '户部奏报',
    subtitle: '替你守住现金、预算、报价和 ROI',
    primaryQuestion: '这笔钱现在能不能动？',
    sourceLabel: '户部付款、预算与财报聚合视图',
    leftTitle: '今日钱袋子',
    leftItems: [
      { id: 'cash', label: '可用现金', value: '待核', tone: 'amber' },
      { id: 'payments', label: '待批付款', value: '待同步', tone: 'amber' },
      { id: 'quote', label: '待审报价', value: '待同步', tone: 'blue' },
      { id: 'risk-spend', label: '高风险支出', value: '待核', tone: 'red' },
    ],
    edictSubtitle: '付款、预算、报价和现金流裁决视图',
    edictQuestion: '当前最需要老板拍板的钱相关事项是什么？',
    edictRows: [
      { label: '裁决', body: '优先展示准奏、补证、缓议或驳回；没有真实事项时保持待命。' },
      { label: '关键数字', body: '展示可用现金、待批付款、报价毛利、预算余额；无来源则标待核。' },
      { label: '证据来源', body: '每个数字都必须能追溯到付款、预算、财报或项目记录。' },
      { label: '禁止动作', body: '不得把预览结论当成真实付款；付款必须人工确认。' },
      { label: '后令', body: '缺合同或验收证据时，交刑部或工部复核后再裁。' },
    ],
    rightSections: [
      {
        id: 'blocked-value',
        title: '户部为你挡了什么',
        kind: 'blocked_value',
        items: [
          {
            id: 'blocked-payment',
            label: '拦下无证付款',
            body: '缺现金流缓冲、合同验收或审批链时，只能生成裁决预览，不能自动付款。',
            tone: 'red',
          },
        ],
      },
      {
        id: 'handoff',
        title: '跨部复核',
        kind: 'handoff_list',
        items: [
          { id: 'to-legal', label: '合同尾款', body: '付款条款不清时交刑部复核。', tone: 'amber' },
          { id: 'to-gongbu', label: '验收证据', body: '交付是否完成交工部验收。', tone: 'blue' },
        ],
      },
      {
        id: 'price-radar',
        title: '涨跌雷达',
        kind: 'risk_list',
        items: [
          { id: 'material-price', label: '碳酸锂 / 电芯 料价预警', body: '采购司 · 锦衣卫补料价情报后，此处显真实涨跌与锁价提醒。', tone: 'amber' },
        ],
      },
      {
        id: 'hubu-trophy',
        title: '户部战果',
        kind: 'metric_strip',
        items: [
          { id: 'blocked-loss', label: '本月拦下亏本单', value: '待接飞轮', tone: 'amber' },
          { id: 'margin-saved', label: '守住毛利线', value: '待接飞轮', tone: 'amber' },
        ],
      },
    ],
    commands: [
      { id: 'approve', label: '准奏', tone: 'green' },
      { id: 'request_evidence', label: '补证', tone: 'amber' },
      { id: 'handoff_legal', label: '交刑部复核', tone: 'red', targetDepartment: 'legal' },
      { id: 'archive', label: '归档史馆', tone: 'blue' },
    ],
    emptyState: { title: '暂无待裁付款', body: '可以发起一条预算、报价或现金流问题。', actionLabel: '追问户部' },
    missing: [{ field: 'finance_live_numbers', label: '真实财务数字', severity: 'medium' }],
    disclaimer: '当前页面展示财务裁决视图，不执行真实付款。',
  },
  gongbu: {
    title: '工部验收',
    subtitle: '替你确认能不能做、能不能交、凭什么验收',
    primaryQuestion: '这件事现在能不能交付？',
    sourceLabel: '工部验收、POC 与发布门禁聚合视图',
    leftTitle: '交付健康',
    leftItems: [
      { id: 'requirements', label: '需求清晰', value: '待核', tone: 'amber' },
      { id: 'poc', label: 'POC', value: '待核', tone: 'blue' },
      { id: 'tests', label: '测试证据', value: '待补', tone: 'red' },
      { id: 'release', label: '发布门禁', value: '未放行', tone: 'red' },
    ],
    edictSubtitle: '工程可行性、测试证据和交付边界',
    edictQuestion: '当前交付是否具备验收证据？',
    edictRows: [
      { label: '验收结论', body: '用可交、补测后交、延期或驳回来表达，不用进度百分比替代验收。' },
      { label: '当前证据', body: '展示 POC、构建、测试、截图、代码审查和供应证据。' },
      { label: '阻断项', body: '缺测试、缺回滚、缺验收边界或缺供应证据时必须列明。' },
      { label: '交付边界', body: '明确 demo、试点、正式发布的边界，不允许混写。' },
      { label: '后令', body: '需要补测、补截图、补验收标准后再对外承诺交期。' },
    ],
    rightSections: [
      {
        id: 'blocked-value',
        title: '工部为你挡了什么',
        kind: 'blocked_value',
        items: [
          {
            id: 'blocked-demo',
            label: '拦下空口交付',
            body: '只有 demo 或口头进度时，不允许写成正式可交付。',
            tone: 'red',
          },
        ],
      },
      {
        id: 'evidence',
        title: '验收证据',
        kind: 'evidence_list',
        items: [
          { id: 'build', label: '构建结果', value: '待接入', tone: 'amber' },
          { id: 'tests', label: '测试记录', value: '待接入', tone: 'amber' },
          { id: 'rollback', label: '回滚方案', value: '待核', tone: 'amber' },
        ],
      },
    ],
    commands: [
      { id: 'request_tests', label: '补测试', tone: 'amber' },
      { id: 'hold', label: '缓议', tone: 'neutral' },
      { id: 'handoff_ops', label: '交兵部更新客户口径', tone: 'blue', targetDepartment: 'ops' },
      { id: 'archive', label: '归档史馆', tone: 'blue' },
    ],
    emptyState: { title: '暂无待验收事项', body: '可以让工部审一个需求是否能交。', actionLabel: '追问工部' },
    missing: [{ field: 'delivery_evidence', label: '真实构建和测试证据', severity: 'high' }],
    disclaimer: '工部页面只展示验收判断，不能代替发布审批。',
  },
  personnel: {
    title: '吏部任免',
    subtitle: '替你讲清责任、权限、签字和执行节奏',
    primaryQuestion: '这件事现在谁负责、谁签字？',
    sourceLabel: '吏部责任链与组织执行聚合视图',
    leftTitle: '责任缺口',
    leftItems: [
      { id: 'dri', label: '缺 DRI', value: '待核', tone: 'amber' },
      { id: 'authority', label: '权限异常', value: '待核', tone: 'red' },
      { id: 'overload', label: '过载岗位', value: '待同步', tone: 'amber' },
      { id: 'signoff', label: '待签字', value: '待同步', tone: 'blue' },
    ],
    edictSubtitle: '负责人、签字链和 7/30/90 天执行节奏',
    edictQuestion: '当前事项的责任链是否成立？',
    edictRows: [
      { label: '主责人', body: '展示 DRI；未指定时明确缺负责人，不自动冒充任命。' },
      { label: '签字链', body: '展示最终签字人、协同方、被咨询方和被告知方。' },
      { label: '权限缺口', body: '越权动作、缺授权和职责冲突必须标红。' },
      { label: '执行节奏', body: '用 7 天、30 天、90 天说明交付和复盘口径。' },
      { label: '后令', body: '责任链不成立时，先补 DRI 和签字关系再执行。' },
    ],
    rightSections: [
      {
        id: 'blocked-value',
        title: '吏部为你挡了什么',
        kind: 'blocked_value',
        items: [
          { id: 'blocked-ownerless', label: '拦下无人负责', body: '没有 DRI 和签字链的事项不应自动派发。', tone: 'red' },
        ],
      },
      {
        id: 'timeline',
        title: '执行节奏',
        kind: 'timeline',
        items: [
          { id: 'd7', label: '7 天', body: '确定负责人和交付物。', tone: 'blue' },
          { id: 'd30', label: '30 天', body: '形成阶段结果。', tone: 'amber' },
          { id: 'd90', label: '90 天', body: '复盘和验收。', tone: 'green' },
        ],
      },
    ],
    commands: [
      { id: 'appoint_dri', label: '指定负责人', tone: 'amber' },
      { id: 'request_signoff', label: '补签字链', tone: 'blue' },
      { id: 'recruit_review', label: '招聘真链', tone: 'blue' },
      { id: 'hold', label: '缓议', tone: 'neutral' },
      { id: 'archive', label: '归档史馆', tone: 'blue' },
    ],
    emptyState: { title: '暂无待任命事项', body: '可以让吏部梳理一个项目的责任链。', actionLabel: '追问吏部' },
    missing: [{ field: 'org_live_data', label: '真实组织与权限数据', severity: 'medium' }],
    disclaimer: '吏部建议不等于真实人事任免，关键动作需要人工确认。',
  },
  market: {
    title: '礼部策案',
    subtitle: '替你把对外表达改到能说、可信、不踩雷',
    primaryQuestion: '这句话现在能不能对外说？',
    sourceLabel: '礼部话术、内容和发布门禁聚合视图',
    leftTitle: '待审表达',
    leftItems: [
      { id: 'copy', label: '待审话术', value: '待同步', tone: 'amber' },
      { id: 'publish', label: '待发布内容', value: '待同步', tone: 'blue' },
      { id: 'materials', label: '素材缺口', value: '待核', tone: 'amber' },
      { id: 'legal-review', label: '需刑部复核', value: '待核', tone: 'red' },
    ],
    edictSubtitle: '可发版本、禁用承诺和发布检查',
    edictQuestion: '当前对外表达是否有证据边界？',
    edictRows: [
      { label: '可发版本', body: '只展示有证据、有边界、不过度承诺的表达。' },
      { label: '建议改写', body: '把强承诺改成条件式、场景式、可证明的话。' },
      { label: '禁用承诺', body: '无证据数字、保证结果、监管敏感和合同承诺必须标红。' },
      { label: '适用场景', body: '区分客户、销售、官网、公关和内部同步版本。' },
      { label: '后令', body: '涉及合同、监管、安全和合规承诺时交刑部复核。' },
    ],
    rightSections: [
      {
        id: 'blocked-value',
        title: '礼部为你挡了什么',
        kind: 'blocked_value',
        items: [
          { id: 'blocked-claim', label: '拦下无证承诺', body: '把夸大营销语改成有证据边界的表达。', tone: 'red' },
        ],
      },
      {
        id: 'speech-gate',
        title: '能说和不能说',
        kind: 'risk_list',
        items: [
          { id: 'ok', label: '可直接说', body: '有证据、有边界。', tone: 'green' },
          { id: 'rewrite', label: '建议改写', body: '方向可用，措辞降承诺。', tone: 'amber' },
          { id: 'blocked', label: '禁止发布', body: '无证据或踩红线。', tone: 'red' },
        ],
      },
    ],
    commands: [
      { id: 'approve_publish', label: '准予发布', tone: 'green' },
      { id: 'rewrite', label: '改写', tone: 'amber' },
      { id: 'handoff_legal', label: '交刑部复核', tone: 'red', targetDepartment: 'legal' },
      { id: 'archive', label: '归档史馆', tone: 'blue' },
    ],
    emptyState: { title: '暂无待审话术', body: '可以粘贴一段对外文案。', actionLabel: '追问礼部' },
    missing: [{ field: 'publishing_pipeline', label: '真实发布和素材数据', severity: 'medium' }],
    disclaimer: '礼部建议不代表高风险承诺已通过法务审核。',
  },
  ops: {
    title: '兵部战报',
    subtitle: '替你把客户异议、竞品攻防和售后问题变成下一步',
    primaryQuestion: '这个客户今天怎么推进？',
    sourceLabel: '兵部战情、commercial-loop 与销售售后聚合视图',
    leftTitle: '今日战场',
    leftItems: [
      { id: 'customers', label: '重点客户', value: '待同步', tone: 'blue' },
      { id: 'deals', label: '高风险商机', value: '待核', tone: 'red' },
      { id: 'aftercare', label: '售后火点', value: '待同步', tone: 'amber' },
      { id: 'competitors', label: '竞品警报', value: '待同步', tone: 'amber' },
    ],
    edictSubtitle: '客户推进、异议打法和竞品信号',
    edictQuestion: '当前战场下一步应该谁去做、说什么？',
    edictRows: [
      { label: '战场判断', body: '展示可推进、先补需求、暂停或移交复核。' },
      { label: '客户异议', body: '把表层异议和真实原因拆开，避免只给泛泛建议。' },
      { label: '打法', body: '说明谁去回应、用什么案例、什么时候跟进。' },
      { label: '竞品信号', body: '标记价格战、交付质疑、品牌攻击和售后风险。' },
      { label: '后令', body: '报价交户部，承诺交刑部，交付证据交工部。' },
    ],
    rightSections: [
      {
        id: 'blocked-value',
        title: '兵部为你挡了什么',
        kind: 'blocked_value',
        items: [
          { id: 'blocked-discount', label: '拦下盲目降价', body: '客户真实异议可能是交付可信度，不是价格。', tone: 'red' },
        ],
      },
      {
        id: 'handoff',
        title: '跨部求援',
        kind: 'handoff_list',
        items: [
          { id: 'to-finance', label: '报价边界', body: '降价前交户部核毛利。', tone: 'amber' },
          { id: 'to-gongbu', label: '交付证据', body: '客户质疑交付时请工部补验收。', tone: 'blue' },
          { id: 'to-legal', label: '合同承诺', body: '承诺条款交刑部复核。', tone: 'red' },
        ],
      },
    ],
    commands: [
      { id: 'next_action', label: '生成下一步', tone: 'blue' },
      { id: 'handoff_finance', label: '交户部核价', tone: 'amber', targetDepartment: 'finance' },
      { id: 'handoff_gongbu', label: '交工部补证', tone: 'blue', targetDepartment: 'gongbu' },
      { id: 'archive', label: '归档史馆', tone: 'blue' },
    ],
    emptyState: { title: '暂无紧急战情', body: '可以录入一个客户异议或商机。', actionLabel: '追问兵部' },
    missing: [{ field: 'crm_live_data', label: '真实客户和商机数据', severity: 'medium' }],
    disclaimer: '兵部战报不单独决定报价、合同和交付承诺。',
  },
  legal: {
    title: '刑部判决',
    subtitle: '替你守住合同、合规、安全和授权红线',
    primaryQuestion: '这份合同或承诺现在能不能签？',
    sourceLabel: '刑部法务、合同和红线聚合视图',
    leftTitle: '风险案卷',
    leftItems: [
      { id: 'contracts', label: '待审合同', value: '待同步', tone: 'amber' },
      { id: 'high-risk', label: '高风险案件', value: '待核', tone: 'red' },
      { id: 'blacklight', label: '黑灯事项', value: '待同步', tone: 'red' },
      { id: 'authority', label: '授权缺口', value: '待核', tone: 'amber' },
    ],
    edictSubtitle: '合同、合规、安全和授权判决',
    edictQuestion: '当前动作是否触碰法律、合规或授权红线？',
    edictRows: [
      { label: '判决', body: '明确可签、修改后可签、暂缓、禁止或需人工法务复核。' },
      { label: '红线条款', body: '必须改的条款不改不能签，且要说明原因。' },
      { label: '修改意见', body: '给出用户能转给对方的改法，而不是只给风险等级。' },
      { label: '禁止动作', body: '不能签、不能发、不能自动付款、不能对外承诺时必须列出。' },
      { label: '后令', body: '重大事项保留人工法务复核，并归档史馆留痕。' },
    ],
    rightSections: [
      {
        id: 'blocked-value',
        title: '刑部为你挡了什么',
        kind: 'blocked_value',
        items: [
          { id: 'blocked-contract', label: '拦下红线签署', body: '付款、验收、违约、授权不对等时禁止进入签署。', tone: 'red' },
        ],
      },
      {
        id: 'risk-gate',
        title: '红黄绿条款',
        kind: 'risk_list',
        items: [
          { id: 'red', label: '红色', body: '必须改，不改不能签。', tone: 'red' },
          { id: 'yellow', label: '黄色', body: '建议改，需确认风险承受。', tone: 'amber' },
          { id: 'green', label: '绿色', body: '可接受并留痕。', tone: 'green' },
        ],
      },
    ],
    commands: [
      { id: 'approve_after_revision', label: '修改后可签', tone: 'green' },
      { id: 'request_revision', label: '要求修改', tone: 'amber' },
      { id: 'reject', label: '禁止', tone: 'red' },
      { id: 'archive', label: '归档史馆', tone: 'blue' },
    ],
    emptyState: { title: '暂无红线案件', body: '可以上传合同或粘贴高风险承诺。', actionLabel: '追问刑部' },
    missing: [{ field: 'legal_case_detail', label: '具体合同或案件文本', severity: 'medium' }],
    disclaimer: '刑部 AI 判决不替代重大事项的人工法律意见。',
  },
};

export function buildDepartmentPageView(input: {
  code: DepartmentPageCode | string;
  generatedAt?: string;
  overview?: DeptOverview | null;
  hubuOverview?: HubuOverview | null;
  legalOverview?: LegalOverview | null;
  bingbuOverview?: BingbuSalesOverview | null;
  libuPromoOverview?: LibuPromoOverview | null;
  taskInsights?: DepartmentTaskInsight[] | null;
}): DepartmentPageView | null {
  const canonical = normalizeDepartmentPageCode(input.code);
  if (!canonical) return null;

  const department = SIX_DEPARTMENTS[canonical as SixDepartmentCode];
  const spec = SPECS[canonical];
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const scrollTheme = getSixDepartmentScrollTheme(canonical as SixDepartmentCode);
  const liveMetricRail = metricRailFromOverview(input.overview);
  const liveTaskRail = activeTasksRail(input.overview);
  const liveRiskRail = riskRailFromOverview(input.overview);
  const overviewStatus = statusFromOverview(input.overview);
  const hasSpecializedLive =
    (canonical === 'finance' && Boolean(input.hubuOverview)) ||
    (canonical === 'legal' && Boolean(input.legalOverview)) ||
    (canonical === 'ops' && Boolean(input.bingbuOverview)) ||
    (canonical === 'market' && Boolean(input.libuPromoOverview));
  const hasTaskInsights = Boolean(input.taskInsights?.length);
  const hasLive = Boolean(input.overview) || hasSpecializedLive || hasTaskInsights;
  const specializedMetricRail = canonical === 'finance'
    ? hubuMetricRail(input.hubuOverview)
    : canonical === 'legal'
      ? legalMetricRail(input.legalOverview)
      : canonical === 'ops'
        ? bingbuMetricRail(input.bingbuOverview)
        : canonical === 'market'
          ? libuPromoMetricRail(input.libuPromoOverview)
      : null;
  const specializedDecisionRail = canonical === 'finance'
    ? hubuDecisionRail(input.hubuOverview?.projects ?? [])
    : canonical === 'legal'
      ? legalCaseRail(input.legalOverview?.cases ?? [])
      : canonical === 'ops'
        ? bingbuDecisionRail(input.bingbuOverview?.items ?? [])
        : canonical === 'market'
          ? libuPromoDecisionRail(input.libuPromoOverview)
      : null;
  const specializedRiskRail = canonical === 'finance'
    ? hubuRiskRail(input.hubuOverview?.projects ?? [])
    : canonical === 'legal'
      ? legalRiskRail(input.legalOverview)
      : canonical === 'ops'
        ? bingbuRiskRail(input.bingbuOverview?.items ?? [])
        : canonical === 'market'
          ? libuPromoRiskRail(input.libuPromoOverview)
      : null;
  const taskRail = taskInsightRail(input.taskInsights);
  const taskTrueChainRail = taskInsightTrueChainRail(input.taskInsights);
  const taskEvidenceRail = taskInsightEvidenceRail(input.taskInsights);
  const bureauRail = bureauEntrancesRail(canonical);
  const baseLeftRail: DepartmentRailSection[] = [
    ...(bureauRail ? [bureauRail] : []),
    {
      id: 'capabilities',
      title: '可办理事项',
      subtitle: '本部门可以继续帮你处理的方向。',
      kind: 'decision_list',
      items: department.capabilities.slice(0, 5).map((item, index) => ({
        id: `capability-${index}`,
        label: item.split('：')[0] || item,
        body: item,
        tone: index === 0 ? 'amber' : 'neutral',
      })),
    },
  ];

  const integrityRail: DepartmentRailSection = {
    id: 'integrity',
    title: '数据来源与缺口',
    subtitle: hasLive ? '当前已接入的数据，以及仍需补齐的信息。' : '暂无实时部门数据，先展示可执行页面骨架。',
    kind: 'evidence_list',
    items: [
      {
        id: 'source',
        label: hasLive ? '部分真实' : '待接真链',
        body: spec.sourceLabel,
        tone: hasLive ? 'green' : 'amber',
      },
      ...((spec.missing ?? []).map((item) => ({
        id: item.field,
        label: item.label,
        body: item.severity === 'high' ? '高优先级补齐' : '待补齐',
        tone: item.severity === 'high' ? 'red' as const : 'amber' as const,
      }))),
    ],
  };

  const focusRail: DepartmentRailSection = specializedMetricRail ?? {
    id: 'department-focus',
    title: spec.leftTitle,
    subtitle: spec.primaryQuestion,
    kind: 'metric_strip',
    items: spec.leftItems,
  };

  const rightRailSections: DepartmentRailSection[] = [
    focusRail,
    ...(liveMetricRail ? [liveMetricRail] : []),
    ...(taskRail ? [taskRail] : []),
    ...(specializedDecisionRail ? [specializedDecisionRail] : []),
    ...(liveTaskRail ? [liveTaskRail] : []),
    ...spec.rightSections.filter((section) => section.kind === 'blocked_value'),
    ...(specializedRiskRail ? [specializedRiskRail] : []),
    ...(liveRiskRail ? [liveRiskRail] : []),
    ...(taskEvidenceRail ? [taskEvidenceRail] : []),
    ...spec.rightSections.filter((section) => section.kind !== 'blocked_value'),
    ...(taskTrueChainRail ? [taskTrueChainRail] : []),
    integrityRail,
  ];
  const leftRail = [...rightRailSections.slice(0, 2), ...baseLeftRail];
  const rightRail = rightRailSections.slice(2);

  const mainEdict: EdictView = {
    id: `department-page:${canonical}`,
    title: spec.title,
    subtitle: spec.edictSubtitle,
    headerKicker: `${department.titleEn.toUpperCase()} · DEPARTMENT VIEW`,
    issuerLine: `${department.name}奏`,
    question: spec.edictQuestion,
    seal: sealFor(canonical),
    sealDate: generatedAt.slice(0, 10),
    meta: {
      reporter: department.name,
      priority: canonical === 'finance' || canonical === 'legal' ? 'high' : 'medium',
      accent: scrollTheme.accent,
      accentSoft: scrollTheme.accentSoft,
      badges: [
        { label: department.name, tone: 'blue' },
        { label: overviewStatus.label, tone: overviewStatus.tone === 'risk' ? 'red' : overviewStatus.tone === 'pending_review' ? 'amber' : 'green' },
        { label: hasLive ? '部分真实' : '待接真链', tone: hasLive ? 'green' : 'amber' },
      ],
    },
    rows: canonical === 'finance' && input.taskInsights?.length
      ? buildTaskInsightRows(canonical, input.taskInsights, input.hubuOverview ? buildHubuRows(input.hubuOverview) : spec.edictRows)
      : canonical === 'finance' && input.hubuOverview
        ? buildHubuRows(input.hubuOverview)
      : canonical === 'legal' && input.legalOverview
        ? buildLegalRows(input.legalOverview)
        : canonical === 'ops' && input.bingbuOverview
          ? buildBingbuRows(input.bingbuOverview)
          : canonical === 'market' && input.libuPromoOverview
            ? buildLibuPromoRows(input.libuPromoOverview)
            : (canonical === 'gongbu' || canonical === 'personnel') && input.taskInsights?.length
              ? buildTaskInsightRows(canonical, input.taskInsights, spec.edictRows)
        : spec.edictRows,
  };

  return {
    viewId: `dept-page:${canonical}:${generatedAt}`,
    generatedAt,
    department: {
      code: canonical,
      requestCode: input.code as DepartmentPageCode,
      name: department.name,
      title: spec.title,
      titleEn: department.titleEn,
      accent: department.accent,
      accentSoft: scrollTheme.accentSoft,
      background: department.background,
      seal: sealFor(canonical),
    },
    header: {
      eyebrow: `${department.titleEn.toUpperCase()} · ${canonical}`,
      title: spec.title,
      subtitle: spec.subtitle,
      primaryQuestion: spec.primaryQuestion,
      status: overviewStatus,
    },
    leftRail,
    mainEdict,
    rightRail,
    commandBar: spec.commands,
    emptyState: spec.emptyState,
    integrity: {
      mode: hasSpecializedLive ? 'live' : hasLive ? 'partial' : 'fallback',
      sourceLabel: spec.sourceLabel,
      missing: spec.missing ?? [],
      disclaimers: [spec.disclaimer],
    },
  };
}
