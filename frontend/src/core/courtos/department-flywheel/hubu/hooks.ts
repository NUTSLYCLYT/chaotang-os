// src/core/courtos/department-flywheel/hubu/hooks.ts
import { evaluateProject, parseWan } from '@/features/hubu/lib/hubu-engines';
import type { HubuProject, FinanceRiskLevel } from '@/lib/contracts/hubu';
import type { DeptHooks, RaiseDraft, SourceTask } from '../types';
import { HUBU_KEYWORDS, HUBU_MIN_BUDGET_YUAN } from './config';

function extractBudget(text: string): string {
  return text.match(/([\d.]+\s*万)/)?.[1] ?? '—';
}
function extractRoi(text: string): string {
  return text.match(/([\d.]+\s*x)/i)?.[1] ?? text.match(/([\d.]+\s*%)/)?.[1] ?? '—';
}
function extractRisk(text: string): FinanceRiskLevel {
  if (/紧急|critical/i.test(text)) return 'critical';
  if (/风险高|高风险|high/i.test(text)) return 'high';
  if (/风险中|medium/i.test(text)) return 'medium';
  return 'low';
}

export function taskToHubuProject(task: SourceTask): HubuProject {
  return {
    title: task.title,
    command: task.command,
    requested_budget: extractBudget(task.command),
    estimated_roi: extractRoi(task.command),
    risk_level: extractRisk(task.command),
    cash_flow_pressure: '—',
  } as HubuProject;
}

export const hubuHooks: DeptHooks = {
  dept: 'hubu',
  selectCandidates: (tasks) =>
    tasks.filter((t) => HUBU_KEYWORDS.some((k) => `${t.title} ${t.command}`.includes(k))),
  passesThreshold: (task) => {
    const budget = parseWan(extractBudget(task.command));
    if (budget !== null && budget >= HUBU_MIN_BUDGET_YUAN) return true;
    return false;
  },
  derive: (task): RaiseDraft | null => {
    const evalr = evaluateProject(taskToHubuProject(task));
    return {
      sourceTaskId: task.id,
      command: `户部呈报待决:${task.title} — 三引擎裁决【${evalr.verdictCn}】(评分${evalr.score ?? '—'}/敞口${evalr.exposure ?? '—'})。原由:${task.command}`,
      title: `户部·${task.title}`,
      priority: evalr.score,
      reality: 'real',
      meta: { verdict: evalr.verdict, verdictCn: evalr.verdictCn, score: evalr.score, exposure: evalr.exposure, missing: evalr.missing, oneWay: evalr.oneWayDoor.oneWay },
    };
  },
};
