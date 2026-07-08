import {
  getSixDepartmentScrollTheme,
  SIX_DEPARTMENTS,
  type SixDepartmentCode,
} from '@/features/departments/lib/six-departments-content';
import {
  getBureauPageSpecs,
  getBureauSpecBySlug,
  type BureauPageSpec,
} from '@/features/bureaus/lib/bureau-page-specs';
import type {
  BureauAction,
  BureauActionIntent,
  BureauDataMode,
  BureauDepartmentCode,
  BureauPageView,
} from '@/lib/contracts/bureau-page-view';
import type {
  DepartmentPageCanonicalCode,
  DepartmentRailItem,
  DepartmentRailSection,
  DepartmentRailTone,
} from '@/lib/contracts/department-page-view';
import type { DepartmentPageViewSources } from '@/features/departments/lib/department-page-view-loader';
import type { EdictView } from '@/features/shangshufang/edict-content';

export function normalizeBureauDepartmentCode(code: string): BureauDepartmentCode | null {
  if (code === 'works') return 'gongbu';
  if (code === 'finance' || code === 'ops' || code === 'personnel' || code === 'gongbu' || code === 'legal' || code === 'market') {
    return code;
  }
  return null;
}

export function listBureauPageSpecs(department: BureauDepartmentCode) {
  return getBureauPageSpecs(department);
}

export function resolveBureauPageSpec(department: BureauDepartmentCode, bureau: string): BureauPageSpec | null {
  return getBureauSpecBySlug(department, bureau);
}

function sealFor(code: BureauDepartmentCode): EdictView['seal'] {
  return code === 'legal' ? 'secret' : 'imperial';
}

function sourceMode(sources?: DepartmentPageViewSources | null): BureauDataMode {
  if (!sources) return 'skeleton';
  if (sources.hubuOverview || sources.legalOverview || sources.bingbuOverview || sources.libuPromoOverview) return 'partial';
  if (sources.overview || sources.taskInsights.length) return 'partial';
  return 'skeleton';
}

function item(label: string, body: string, tone: DepartmentRailTone, id: string): DepartmentRailItem {
  return { id, label, body, tone };
}

function metricValue(label: string, index: number) {
  const presets = ['待确认', '看证据', '待处理', '需补材料'];
  return label.includes('风险') || label.includes('缺') || label.includes('异常') ? '需先处理' : presets[index % presets.length];
}

function metricsRail(spec: BureauPageSpec): DepartmentRailSection {
  const labels = spec.pageDisplay.slice(0, 4);
  return {
    id: 'bureau-metrics',
    title: '现在能不能办',
    subtitle: spec.verdict,
    kind: 'metric_strip',
    items: labels.map((label, index) => ({
      id: `metric-${index + 1}`,
      label,
      value: metricValue(label, index),
      tone: index === 0 ? spec.verdictTone : index === 3 ? 'amber' : 'blue',
    })),
  };
}

function currentMatterRail(spec: BureauPageSpec): DepartmentRailSection {
  return {
    id: 'current-matters',
    title: '用户会看到什么',
    subtitle: spec.userConcern,
    kind: 'decision_list',
    items: spec.pageDisplay.map((label, index) => ({
      id: `display-${index + 1}`,
      label,
      body: spec.backendSupply[index] ? `判断依据：${spec.backendSupply[index]}` : '依据齐全后，页面给出明确判断。',
      tone: index === 0 ? spec.verdictTone : 'neutral',
      actionId: index === 0 ? 'bureau-action-1' : undefined,
    })),
  };
}

function capabilityRail(spec: BureauPageSpec): DepartmentRailSection {
  return {
    id: 'bureau-capability',
    title: '下一步怎么做',
    subtitle: '这些是用户看完判断后可以直接发起的动作。',
    kind: 'decision_list',
    items: [
      item(spec.role, spec.scope, 'blue', 'role'),
      ...spec.userActions.map((action, index) => ({
        id: `user-action-${index + 1}`,
        label: action,
        body: '点击后形成司级回执，并进入后续处理。',
        tone: index === 0 ? 'green' as const : 'neutral' as const,
        actionId: `bureau-action-${index + 1}`,
      })),
    ],
  };
}

function evidenceRail(spec: BureauPageSpec): DepartmentRailSection {
  return {
    id: 'evidence',
    title: '证据与缺口',
    subtitle: '判断依据必须可追溯，缺什么就展示什么。',
    kind: 'evidence_list',
    items: spec.evidence.map((label, index) => item(label, index === 0 ? '缺这个材料时，页面只给保守建议。' : '用于支撑本司判断。', index === 0 ? 'amber' : 'blue', `evidence-${index + 1}`)),
  };
}

function riskRail(spec: BureauPageSpec): DepartmentRailSection {
  return {
    id: 'risks',
    title: '风险与禁令',
    subtitle: spec.avoidIllusion,
    kind: 'risk_list',
    items: spec.risks.map((label, index) => item(label, '这个风险未处理前，页面会建议暂停或移交。', index === 0 ? 'red' : 'amber', `risk-${index + 1}`)),
  };
}

function handoffRail(spec: BureauPageSpec): DepartmentRailSection {
  return {
    id: 'handoff',
    title: '要交给谁一起看',
    subtitle: '跨司流转必须说明条件和原因。',
    kind: 'handoff_list',
    items: spec.handoffs.map((handoff, index) => ({
      id: `handoff-${index + 1}`,
      label: handoff.label,
      value: handoff.target,
      body: handoff.reason,
      tone: index === 0 ? 'blue' : 'neutral',
      actionId: `handoff-${index + 1}`,
    })),
  };
}

function blockedValueRail(spec: BureauPageSpec): DepartmentRailSection {
  return {
    id: 'blocked-value',
    title: '这个司替你挡了什么',
    subtitle: '把价值讲成用户能感知的风险拦截。',
    kind: 'blocked_value',
    items: [
      {
        id: 'blocked-value-main',
        label: spec.blockedValue,
        body: spec.avoidIllusion,
        tone: spec.verdictTone === 'red' ? 'red' : 'amber',
        actionId: 'bureau-action-block',
      },
    ],
  };
}

function integrityRail(mode: BureauDataMode, spec: BureauPageSpec): DepartmentRailSection {
  const labelByMode: Record<BureauDataMode, string> = {
    live: '已接入实时数据',
    partial: '部分数据已接入',
    fallback: '使用兜底判断',
    skeleton: '能力待接入',
  };
  return {
    id: 'integrity',
    title: '可信度',
    subtitle: '数据不够时，只给保守判断。',
    kind: 'evidence_list',
    items: [
      item(
        labelByMode[mode],
        mode === 'skeleton' ? '当前先展示能办什么、要补什么、下一步找谁。' : '当前已有部分业务数据，可给出判断，同时保留缺口提醒。',
        mode === 'skeleton' ? 'amber' : 'green',
        'mode',
      ),
      item('判断口径', `本页只回答用户问题：「${spec.userConcern}」`, 'blue', 'source-language'),
    ],
  };
}

function rowsForSpec(spec: BureauPageSpec): EdictView['rows'] {
  return [
    { label: '当前判断', body: spec.verdict },
    { label: '用户关心', body: spec.userConcern },
    { label: '本司能办', body: `${spec.role}\n${spec.scope}` },
    { label: '页面展示', body: spec.pageDisplay.join('\n') },
    { label: '判断依据', body: spec.backendSupply.join('\n') },
    { label: '还缺什么', body: spec.evidence.join('\n') },
    { label: '不能做什么', body: spec.risks.join('\n') },
    { label: '要找谁会签', body: spec.handoffs.map((handoff) => `${handoff.target}：${handoff.reason}`).join('\n') },
    { label: '替你挡险', body: spec.blockedValue },
    { label: '不要误会', body: spec.avoidIllusion },
  ];
}

function intentForUserAction(action: string, index: number): BureauActionIntent {
  if (/补|材料|证明|依据|票|授权|尽调/.test(action)) return 'request_evidence';
  if (/移交|交|转交|升级/.test(action)) return 'handoff';
  if (/冻结|拦|驳回|拒绝|暂停|下架|停止|退回|放弃/.test(action)) return 'block';
  if (/复查|提醒|验证|复核|修订|调整|设置/.test(action)) return 'recheck';
  if (/归档|关闭|结案|记录|沉淀/.test(action)) return 'archive';
  if (/准|通过|确认|发布|发起|推进|继续|锁定|扩大/.test(action)) return 'approve';
  return index === 0 ? 'request_evidence' : index === 1 ? 'approve' : index === 2 ? 'handoff' : 'recheck';
}

function toneForIntent(intent: BureauActionIntent): BureauAction['tone'] {
  if (intent === 'approve') return 'green';
  if (intent === 'block') return 'red';
  if (intent === 'handoff') return 'blue';
  if (intent === 'request_evidence') return 'amber';
  return 'neutral';
}

function actionsForSpec(spec: BureauPageSpec): BureauAction[] {
  const actions = spec.userActions.slice(0, 4).map((label, index) => {
    const intent = intentForUserAction(label, index);
    return {
      id: `bureau-action-${index + 1}`,
      label,
      intent,
      tone: toneForIntent(intent),
      evidenceRequired: intent === 'request_evidence' ? spec.evidence.slice(0, 3) : undefined,
    };
  });
  return [
    ...actions,
    {
      id: 'bureau-action-block',
      label: '先拦下风险',
      intent: 'block',
      tone: 'red',
    },
  ];
}

export function buildBureauPageView(input: {
  department: DepartmentPageCanonicalCode | string;
  bureau: string;
  generatedAt?: string;
  sources?: DepartmentPageViewSources | null;
}): BureauPageView | null {
  const departmentCode = normalizeBureauDepartmentCode(input.department);
  if (!departmentCode) return null;
  const spec = resolveBureauPageSpec(departmentCode, input.bureau);
  if (!spec) return null;

  const department = SIX_DEPARTMENTS[departmentCode as SixDepartmentCode];
  const theme = getSixDepartmentScrollTheme(departmentCode as SixDepartmentCode);
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const mode = sourceMode(input.sources);

  const mainEdict: EdictView = {
    id: `bureau-page:${departmentCode}:${spec.slug}`,
    title: `${spec.name}裁决书`,
    subtitle: spec.role,
    headerKicker: `${department.name} · 司级办事台`,
    issuerLine: `${department.name} · ${spec.name}`,
    question: spec.userConcern,
    seal: sealFor(departmentCode),
    sealDate: generatedAt.slice(0, 10),
    meta: {
      reporter: spec.name,
      priority: spec.verdictTone === 'red' ? 'high' : 'medium',
      accent: theme.accent,
      accentSoft: theme.accentSoft,
      badges: [
        { label: department.name, tone: 'blue' },
        { label: spec.name, tone: 'amber' },
        { label: mode === 'skeleton' ? '保守判断' : '有据可查', tone: mode === 'skeleton' ? 'amber' : 'green' },
      ],
    },
    rows: rowsForSpec(spec),
  };

  return {
    viewId: `bureau-page:${departmentCode}:${spec.slug}:${generatedAt}`,
    generatedAt,
    bureau: {
      department: departmentCode,
      bureau: spec.slug,
      name: spec.name,
      alias: spec.alias,
      role: spec.role,
      scope: spec.scope,
      accent: department.accent,
      accentSoft: theme.accentSoft,
      background: department.background,
      seal: sealFor(departmentCode),
    },
    header: {
      title: `${department.name} · ${spec.name}`,
      subtitle: spec.role,
      userQuestion: spec.userConcern,
      verdict: spec.verdict,
      verdictTone: spec.verdictTone,
      blockedValue: spec.blockedValue,
    },
    dataMode: mode,
    leftRail: [metricsRail(spec), currentMatterRail(spec), capabilityRail(spec)],
    mainEdict,
    rightRail: [evidenceRail(spec), riskRail(spec), handoffRail(spec), blockedValueRail(spec), integrityRail(mode, spec)],
    actions: actionsForSpec(spec),
    integrity: {
      mode,
      sourceLabel: mode === 'skeleton' ? '当前为保守判断：先展示能办什么、缺什么证据。' : '当前已有部分业务数据：可以给出判断，但仍提示缺口。',
      missing: [
        { field: 'live_queue', label: '真实承办队列', severity: mode === 'skeleton' ? 'high' : 'medium' },
        { field: 'evidence_source', label: '证据来源更新时间', severity: 'medium' },
      ],
      disclaimers: [
        '页面只展示司级裁决视图，不直接执行真实付款、签约、发布或人事动作。',
        spec.avoidIllusion,
      ],
    },
  };
}
