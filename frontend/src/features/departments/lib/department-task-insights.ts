import { listPrimaryTasks } from '@/lib/db/primary-store';
import type {
  DepartmentPageCanonicalCode,
} from '@/lib/contracts/department-page-view';
import type { DepartmentTaskInsight } from '@/features/departments/lib/department-page-view-builder';
import type { DepartmentActionTrueChainPlan } from '@/features/departments/lib/department-actions';
import { evaluateTask, type GongbuTask } from '@/features/gongbu/lib/gongbu-engines';
import { buildExecutionChain, type ChainKind } from '@/features/libu/lib/execution-chain';

type PrimaryTaskLike = {
  id?: unknown;
  title?: unknown;
  rawCommand?: unknown;
  raw_command?: unknown;
  status?: unknown;
  updatedAt?: unknown;
  updated_at?: unknown;
  result?: unknown;
};

const DEPARTMENT_MATCHERS: Record<DepartmentPageCanonicalCode, { text: RegExp; result: RegExp; reason: string }> = {
  finance: {
    text: /预算|成本|报价|付款|采购|投资|现金|资金|财务|利润|ROI|expense|budget|payment|finance/i,
    result: /finance|hubu|hu_bu/i,
    reason: 'finance keyword or routing hit',
  },
  gongbu: {
    text: /工部|交付|验收|测试|构建|发布|需求|POC|代码|研发|PACK|BOM|供应|质量|build|test|delivery|release|engineering/i,
    result: /gongbu|gong_bu|works|product|sdlc|pack_rd|gongbu_review/i,
    reason: 'works delivery keyword or routing hit',
  },
  personnel: {
    text: /吏部|负责人|责任|权限|签字|任命|招聘|绩效|岗位|组织|协同|DRI|RACI|owner|signoff|hiring|recruit|personnel|hr/i,
    result: /personnel|libu_personnel|li_bu|hr|recruit/i,
    reason: 'personnel accountability keyword or routing hit',
  },
  market: {
    text: /礼部|品牌|公关|宣传|话术|发布|内容|客户沟通|素材|舆情|文案|marketing|brand|copy|publish|promo/i,
    result: /market|libu|li_bu_rites|rites|promo|xiaohongshu|opc/i,
    reason: 'rites communication keyword or routing hit',
  },
  ops: {
    text: /兵部|销售|报价|谈判|压价|客户|商机|成交|订单|线索|渠道|续约|复购|竞品|投标|sales|customer|deal|competitor/i,
    result: /ops|bingbu|war|bing_bu|sales|commercial/i,
    reason: 'ops sales keyword or routing hit',
  },
  legal: {
    text: /刑部|合同|合规|法务|授权|红线|安全|争议|违约|签署|legal|contract|compliance|risk|security/i,
    result: /legal|xingbu|xing_bu|risk|compliance/i,
    reason: 'legal risk keyword or routing hit',
  },
};

function readString(value: unknown): string {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

function taskText(task: PrimaryTaskLike): string {
  return `${readString(task.title)} ${readString(task.rawCommand)} ${readString(task.raw_command)}`;
}

function resultText(task: PrimaryTaskLike): string {
  try {
    return JSON.stringify(task.result ?? {});
  } catch {
    return '';
  }
}

function resultRecord(task: PrimaryTaskLike): Record<string, unknown> | null {
  return task.result && typeof task.result === 'object' && !Array.isArray(task.result)
    ? task.result as Record<string, unknown>
    : null;
}

function readDepartmentCode(value: unknown): DepartmentPageCanonicalCode | undefined {
  return value === 'finance' || value === 'gongbu' || value === 'personnel' || value === 'market' || value === 'ops' || value === 'legal'
    ? value
    : undefined;
}

function readTrueChainPlan(value: unknown): DepartmentActionTrueChainPlan | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const plan = value as Record<string, unknown>;
  const method = plan.method === 'POST' ? 'POST' : null;
  if (!method) return undefined;
  const id = readString(plan.id);
  const label = readString(plan.label);
  const endpoint = readString(plan.endpoint);
  if (!id || !label || !endpoint) return undefined;
  const resultEndpoint = readString(plan.resultEndpoint);
  const payload = plan.payload && typeof plan.payload === 'object' && !Array.isArray(plan.payload)
    ? plan.payload as Record<string, unknown>
    : {};
  return {
    id,
    label,
    method,
    endpoint,
    resultEndpoint: resultEndpoint || undefined,
    payload,
    note: readString(plan.note),
  };
}

function reasonForMatch(
  code: DepartmentPageCanonicalCode,
  task: PrimaryTaskLike,
  matchedResult: boolean,
  fallbackReason: string,
): {
  reason: string;
  sourceDepartment?: DepartmentPageCanonicalCode;
  targetDepartment?: DepartmentPageCanonicalCode;
} {
  const result = resultRecord(task);
  const sourceDepartment = readDepartmentCode(result?.department);
  const targetDepartment = readDepartmentCode(result?.targetDepartment);
  const actionLabel = readString(result?.actionLabel);

  if (targetDepartment === code && sourceDepartment && sourceDepartment !== code) {
    return {
      reason: `${sourceDepartment} -> ${code}${actionLabel ? ` · ${actionLabel}` : ''}`,
      sourceDepartment,
      targetDepartment,
    };
  }

  if (sourceDepartment === code && actionLabel) {
    return {
      reason: `${code} page action · ${actionLabel}`,
      sourceDepartment,
      targetDepartment,
    };
  }

  return {
    reason: matchedResult ? fallbackReason : 'keyword hit in task text',
    sourceDepartment,
    targetDepartment,
  };
}

function toneForStatus(status: string): DepartmentTaskInsight['tone'] {
  if (status === 'failed') return 'red';
  if (status === 'archived' || status === 'reviewed' || status === 'done') return 'green';
  if (status === 'running' || status === 'report_ready') return 'amber';
  return 'blue';
}

function personnelChainKind(text: string): ChainKind {
  if (/离职|解除|裁员|offboarding|termination/i.test(text)) return 'offboarding';
  if (/晋升|调薪|任命|promotion/i.test(text)) return 'promotion';
  return 'onboarding';
}

function enrichTaskInsight(
  code: DepartmentPageCanonicalCode,
  task: PrimaryTaskLike,
  base: DepartmentTaskInsight,
): DepartmentTaskInsight {
  const text = `${base.title} ${base.command}`;

  if (code === 'gongbu') {
    const evaluation = evaluateTask({
      id: base.id,
      taskId: base.id,
      title: base.title,
      rawCommand: base.command,
      status: base.status,
      progressPct: 0,
      updatedAt: readString(task.updatedAt) || readString(task.updated_at),
    } satisfies GongbuTask);

    return {
      ...base,
      verdict: evaluation.verdictCn,
      evidence: [
        evaluation.explain.type,
        evaluation.explain.verdict,
        evaluation.explain.locks,
        ...evaluation.missing,
      ].filter(Boolean),
      nextSteps: evaluation.missing.slice(0, 3),
      relatedDepartments: evaluation.cross.map((item) => item.cn),
    };
  }

  if (code === 'personnel') {
    const chain = buildExecutionChain(personnelChainKind(text), base.title);
    return {
      ...base,
      verdict: chain.title,
      evidence: [chain.note, ...chain.steps.slice(0, 3).map((step) => `${step.task} · ${step.raci}`)],
      nextSteps: chain.steps.slice(0, 3).map((step) => `${step.dueDays} 天内：${step.task}（DRI：${step.dri}）`),
      relatedDepartments: ['吏部'],
    };
  }

  return base;
}

export async function loadDepartmentTaskInsights(
  code: DepartmentPageCanonicalCode,
  limit = 100,
  tenantId?: string,
): Promise<DepartmentTaskInsight[]> {
  // 会审后修复(2026-07-04·guard:tenant同款盲区)：此前调listPrimaryTasks不传tenantId，
  // 任意登录用户浏览任意部门页面都能看到最多8条其它人真实任务的command/title原文
  // (按部门关键词匹配全表任务，无租户过滤)。现在按primary-store.ts既有的
  // tenantId OR NULL兜底口径过滤。
  const matcher = DEPARTMENT_MATCHERS[code];
  const rows = (await listPrimaryTasks({ limit, tenantId })) as PrimaryTaskLike[];
  const insights: DepartmentTaskInsight[] = [];

  for (const task of rows) {
    const text = taskText(task);
    const resultJson = resultText(task);
    const matchedText = matcher.text.test(text);
    const matchedResult = matcher.result.test(resultJson);
    if (!matchedText && !matchedResult) continue;

    const id = readString(task.id);
    if (!id) continue;

    const title = readString(task.title) || readString(task.rawCommand) || id;
    const status = readString(task.status) || 'submitted';
    const resultData = resultRecord(task);
    const resultSourceDepartment = readDepartmentCode(resultData?.department);
    const resultTargetDepartment = readDepartmentCode(resultData?.targetDepartment);
    if (resultSourceDepartment && resultSourceDepartment !== code && resultTargetDepartment !== code) continue;

    const routing = reasonForMatch(code, task, matchedResult, matcher.reason);
    const base: DepartmentTaskInsight = {
      id,
      title,
      command: readString(task.rawCommand) || readString(task.raw_command) || title,
      status,
      updatedAt: readString(task.updatedAt) || readString(task.updated_at),
      reason: routing.reason,
      sourceDepartment: routing.sourceDepartment,
      targetDepartment: routing.targetDepartment,
      trueChainPlan: readTrueChainPlan(resultData?.trueChainPlan),
      tone: toneForStatus(status),
    };
    insights.push(enrichTaskInsight(code, task, base));

    if (insights.length >= 8) break;
  }

  return insights;
}
