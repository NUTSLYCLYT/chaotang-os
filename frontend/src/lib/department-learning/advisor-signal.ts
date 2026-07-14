import type { AgentCode } from '@/lib/contracts/agent';
import { resolveDepartmentAgentCode } from '@/lib/contracts/dept';
import type {
  DepartmentLearningAdvisorSignal,
  DepartmentLearningRecord,
  DepartmentLearningVerdict,
} from '@/lib/contracts/department-learning';
import { ALL_DEPARTMENT_AGENT_CODES, buildDepartmentLearningRecord } from './loop';
import { loadLearningRecords } from './store';

const VERDICT_WEIGHT: Record<DepartmentLearningVerdict, number> = {
  confirmed: 1.15,
  observing: 1,
  unknown: 0.72,
  refuted: 0.5,
};

export async function loadDepartmentLearningRecords(): Promise<DepartmentLearningRecord[]> {
  return loadLearningRecords();
}

function cautionFor(record: DepartmentLearningRecord): string {
  if (record.verdict === 'confirmed') return '近期判断已被结果证实，可保持直接建议。';
  if (record.verdict === 'refuted') return '近期判断被证伪，必须降权并要求反证。';
  if (record.verdict === 'unknown') return '结果源未接入或证据不足，建议必须标注补证边界。';
  return '仍在观察窗口内，不要过度自信。';
}

export function recordToAdvisorSignal(record: DepartmentLearningRecord): DepartmentLearningAdvisorSignal {
  return {
    agentCode: record.agentCode,
    agentName: record.agentName,
    weight: VERDICT_WEIGHT[record.verdict],
    caution: cautionFor(record),
    nudge: record.nextLesson,
    verdict: record.verdict,
    sourceLabel: record.sourceLabel,
    metricName: record.metricName,
    updatedAt: record.updatedAt,
  };
}

export async function loadAdvisorSignals(now = new Date()): Promise<DepartmentLearningAdvisorSignal[]> {
  const persisted = await loadDepartmentLearningRecords();
  const byAgent = new Map(persisted.map((record) => [record.agentCode, record]));
  const complete = ALL_DEPARTMENT_AGENT_CODES.map((agentCode) => (
    byAgent.get(agentCode) ?? buildDepartmentLearningRecord(agentCode, now)
  ));

  return complete.map(recordToAdvisorSignal);
}

export function agentCodeForDept(dept: string): AgentCode | null {
  return resolveDepartmentAgentCode(dept);
}

export function orderDepartmentsByAdvisorSignal(
  departments: string[],
  signals: DepartmentLearningAdvisorSignal[],
): string[] {
  const signalByAgent = new Map(signals.map((signal) => [signal.agentCode, signal]));
  return [...departments].sort((a, b) => {
    const aAgent = agentCodeForDept(a);
    const bAgent = agentCodeForDept(b);
    const aWeight = aAgent ? signalByAgent.get(aAgent)?.weight ?? 1 : 1;
    const bWeight = bAgent ? signalByAgent.get(bAgent)?.weight ?? 1 : 1;
    if (aWeight === bWeight) return departments.indexOf(a) - departments.indexOf(b);
    return bWeight - aWeight;
  });
}

export function advisorSignalsForDepartments(
  departments: string[],
  signals: DepartmentLearningAdvisorSignal[],
): DepartmentLearningAdvisorSignal[] {
  const requested = new Set(departments.map(agentCodeForDept).filter(Boolean) as AgentCode[]);
  return signals.filter((signal) => requested.has(signal.agentCode));
}
