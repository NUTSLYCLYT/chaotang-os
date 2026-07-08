import type { DepartmentPageCanonicalCode } from '@/lib/contracts/department-page-view';

export type DepartmentActionBody = {
  viewId?: string;
  itemId?: string;
  action?: string;
  reason?: string;
  targetDepartment?: string;
};

export type DepartmentActionTrueChainPlan = {
  id: string;
  label: string;
  method: 'POST';
  endpoint: string;
  resultEndpoint?: string;
  payload: Record<string, unknown>;
  note: string;
};

export const DEPARTMENT_ACTION_LABEL: Record<string, string> = {
  approve: '准奏',
  request_evidence: '补证',
  request_tests: '补测试',
  handoff_legal: '交刑部复核',
  handoff_finance: '交户部核价',
  handoff_gongbu: '交工部补证',
  handoff_ops: '交兵部更新口径',
  approve_publish: '准予发布',
  approve_after_revision: '修改后可签',
  request_revision: '要求修改',
  appoint_dri: '指定负责人',
  request_signoff: '补签字链',
  recruit_review: '招聘真链',
  next_action: '生成下一步',
  hold: '缓议',
  reject: '驳回',
  archive: '归档史馆',
};

const DEPARTMENT_ACTION_TARGET: Record<string, DepartmentPageCanonicalCode> = {
  handoff_legal: 'legal',
  handoff_finance: 'finance',
  handoff_gongbu: 'gongbu',
  handoff_ops: 'ops',
};

export function normalizeDepartmentActionTarget(value: unknown): DepartmentPageCanonicalCode | null {
  return value === 'finance' || value === 'gongbu' || value === 'personnel' || value === 'market' || value === 'ops' || value === 'legal'
    ? value
    : null;
}

export function departmentActionLabel(action?: string): string {
  return action ? DEPARTMENT_ACTION_LABEL[action] ?? action : 'unknown';
}

export function resolveDepartmentActionTarget(body: DepartmentActionBody): DepartmentPageCanonicalCode | null {
  return normalizeDepartmentActionTarget(body.targetDepartment) ?? DEPARTMENT_ACTION_TARGET[body.action ?? ''] ?? null;
}

export function buildDepartmentActionTrueChainPlan(
  department: DepartmentPageCanonicalCode,
  body: DepartmentActionBody,
): DepartmentActionTrueChainPlan | null {
  const action = body.action ?? '';
  const taskInput = body.reason?.trim() || body.itemId?.trim() || body.viewId?.trim() || `${department} ${departmentActionLabel(action)}`;

  if (department === 'gongbu' && action === 'request_tests') {
    return {
      id: 'gongbu-feasibility',
      label: '工部 PACK 可行性真链',
      method: 'POST',
      endpoint: '/api/court/dept/gong-bu/feasibility',
      resultEndpoint: '/api/court/dept/gong-bu/feasibility/result?sid={session_id}',
      payload: { task_input: taskInput },
      note: '显式点火后才调用 PACK 研发蜂群；页面加载不自动触发，产线资产字段仍由结果接口剥离。',
    };
  }

  if (department === 'personnel' && action === 'recruit_review') {
    return {
      id: 'libu-recruit',
      label: '吏部招聘真链',
      method: 'POST',
      endpoint: '/api/court/dept/li-bu/recruit',
      resultEndpoint: '/api/court/dept/li-bu/recruit/result?sid={session_id}',
      payload: { task_input: taskInput },
      note: '显式点火后才调用吏部人才蜂群；未验真或未完成时结果接口不会冒充完整产出。',
    };
  }

  return null;
}
