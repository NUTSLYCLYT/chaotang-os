import { BUILD_RETROSPECTIVES, type BuildRetrospective } from './build-retrospective';
import {
  DEPARTMENT_BUILD_TASKS,
  type DepartmentBuildTask,
  type DepartmentBuildTarget,
} from './department-build-workflow';

export type KnowledgeSource =
  | 'daily_brief'
  | 'budget'
  | 'command'
  | 'build_task'
  | 'retrospective'
  | 'external_reference'
  | 'manual';

export type EvidenceBlockType =
  | 'metric'
  | 'decision'
  | 'artifact'
  | 'link'
  | 'screenshot'
  | 'build_result'
  | 'quote'
  | 'risk'
  | 'recommendation';

export type KnowledgeNodeType =
  | 'department'
  | 'project'
  | 'task'
  | 'budget'
  | 'risk'
  | 'decision'
  | 'retrospective'
  | 'playbook'
  | 'external_reference';

export type KnowledgeEdgeType =
  | 'causes'
  | 'depends_on'
  | 'references'
  | 'blocks'
  | 'funds'
  | 'executes'
  | 'archives'
  | 'recommends'
  | 'evolves_into';

export type KnowledgeCaseStatus = 'draft' | 'active' | 'accepted' | 'archived' | 'learning';

export type EvolutionGeneType = 'playbook' | 'checklist' | 'risk_rule' | 'prompt' | 'acceptance_standard';

export interface EvidenceBlock {
  id: string;
  type: EvidenceBlockType;
  source: KnowledgeSource;
  title: string;
  summary: string;
  capturedAt: string;
  confidence: number;
  href?: string;
}

export interface KnowledgeNode {
  id: string;
  type: KnowledgeNodeType;
  label: string;
  summary: string;
  dept?: DepartmentBuildTarget | 'hubu' | 'gongbu' | 'shiguan' | 'command-center';
}

export interface KnowledgeEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  type: KnowledgeEdgeType;
  rationale: string;
}

export interface EvolutionGene {
  id: string;
  type: EvolutionGeneType;
  title: string;
  trigger: string;
  rule: string;
  evidenceIds: string[];
  reusableFor: DepartmentBuildTarget[];
  confidence: number;
}

export interface KnowledgeCase {
  id: string;
  title: string;
  status: KnowledgeCaseStatus;
  source: KnowledgeSource;
  targetDept?: DepartmentBuildTarget;
  businessGoal: string;
  createdAt: string;
  updatedAt: string;
  evidence: EvidenceBlock[];
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  nextSuggestion: string;
  reusableGenes: EvolutionGene[];
}

const TODAY = '2026-06-01';

const toEvidenceId = (caseId: string, index: number) => `${caseId}-evidence-${index + 1}`;

export function buildTaskToKnowledgeCase(task: DepartmentBuildTask): KnowledgeCase {
  const caseId = `knowledge-${task.id}`;
  const evidence = task.acceptanceCriteria.map<EvidenceBlock>((criterion, index) => ({
    id: toEvidenceId(caseId, index),
    type: 'recommendation',
    source: 'build_task',
    title: `验收标准 ${index + 1}`,
    summary: criterion,
    capturedAt: `${TODAY}T09:00:00.000Z`,
    confidence: 0.82,
    href: task.archiveHref,
  }));

  const nodes: KnowledgeNode[] = [
    {
      id: `${caseId}-project`,
      type: 'project',
      label: task.title,
      summary: task.businessGoal,
      dept: task.targetDept,
    },
    {
      id: `${caseId}-gongbu`,
      type: 'department',
      label: '工部',
      summary: '负责把经营需求转成可交付建设任务。',
      dept: 'gongbu',
    },
    {
      id: `${caseId}-budget`,
      type: 'budget',
      label: `${task.budgetLevel} 预算等级`,
      summary: `风险等级 ${task.riskLevel}，需要户部给出资源边界。`,
      dept: 'hubu',
    },
  ];

  return {
    id: caseId,
    title: task.title,
    status: task.status === 'archived' ? 'archived' : task.status === 'accepted' ? 'accepted' : 'active',
    source: 'build_task',
    targetDept: task.targetDept,
    businessGoal: task.businessGoal,
    createdAt: `${TODAY}T09:00:00.000Z`,
    updatedAt: `${TODAY}T09:00:00.000Z`,
    evidence,
    nodes,
    edges: [
      {
        id: `${caseId}-edge-gongbu-project`,
        fromNodeId: `${caseId}-gongbu`,
        toNodeId: `${caseId}-project`,
        type: 'executes',
        rationale: '工部把部门建设目标拆成任务、验收标准和窗口分工。',
      },
      {
        id: `${caseId}-edge-budget-project`,
        fromNodeId: `${caseId}-budget`,
        toNodeId: `${caseId}-project`,
        type: 'funds',
        rationale: '建设任务需要先被户部纳入预算、ROI 和风险测算。',
      },
    ],
    nextSuggestion: task.commandDraft,
    reusableGenes: [
      {
        id: `${caseId}-gene-acceptance`,
        type: 'acceptance_standard',
        title: `${task.title} 验收口径`,
        trigger: `新建 ${task.targetDept} 相关建设任务时`,
        rule: task.acceptanceCriteria.join('；'),
        evidenceIds: evidence.map((item) => item.id),
        reusableFor: [task.targetDept],
        confidence: 0.78,
      },
    ],
  };
}

export function retrospectiveToKnowledgeCase(retrospective: BuildRetrospective): KnowledgeCase {
  const caseId = `knowledge-${retrospective.id}`;
  const evidence = retrospective.evidence.map<EvidenceBlock>((item, index) => ({
    id: toEvidenceId(caseId, index),
    type: 'artifact',
    source: 'retrospective',
    title: `复盘证据 ${index + 1}`,
    summary: item,
    capturedAt: `${retrospective.date}T18:00:00.000Z`,
    confidence: retrospective.score / 100,
    href: `/archive?case=${retrospective.sourceBudgetId}`,
  }));

  const nodes: KnowledgeNode[] = [
    {
      id: `${caseId}-retro`,
      type: 'retrospective',
      label: retrospective.title,
      summary: retrospective.outcome,
      dept: 'shiguan',
    },
    {
      id: `${caseId}-decision`,
      type: 'decision',
      label: `${retrospective.grade} · ${retrospective.score} 分`,
      summary: retrospective.nextSuggestion,
    },
  ];

  return {
    id: caseId,
    title: retrospective.title,
    status: 'learning',
    source: 'retrospective',
    businessGoal: retrospective.outcome,
    createdAt: `${retrospective.date}T18:00:00.000Z`,
    updatedAt: `${retrospective.date}T18:00:00.000Z`,
    evidence,
    nodes,
    edges: [
      {
        id: `${caseId}-edge-retro-decision`,
        fromNodeId: `${caseId}-retro`,
        toNodeId: `${caseId}-decision`,
        type: 'recommends',
        rationale: '史馆复盘结果反哺下一轮上书房建议和工部建设。',
      },
    ],
    nextSuggestion: retrospective.nextSuggestion,
    reusableGenes: [
      {
        id: `${caseId}-gene-retro`,
        type: 'playbook',
        title: `${retrospective.title} 复用打法`,
        trigger: '出现相似部门建设任务或预算审批任务时',
        rule: retrospective.nextSuggestion,
        evidenceIds: evidence.map((item) => item.id),
        reusableFor: ['gongbu', 'hubu', 'shiguan'],
        confidence: retrospective.score / 100,
      },
    ],
  };
}

export function summarizeKnowledgeCases(cases: KnowledgeCase[]) {
  const evidenceCount = cases.reduce((sum, item) => sum + item.evidence.length, 0);
  const geneCount = cases.reduce((sum, item) => sum + item.reusableGenes.length, 0);

  return {
    totalCases: cases.length,
    activeCases: cases.filter((item) => item.status === 'active').length,
    learningCases: cases.filter((item) => item.status === 'learning').length,
    evidenceCount,
    geneCount,
    topSuggestion: cases[0]?.nextSuggestion ?? '',
  };
}

export const OPERATING_KNOWLEDGE_CASES: KnowledgeCase[] = [
  ...DEPARTMENT_BUILD_TASKS.map(buildTaskToKnowledgeCase),
  ...BUILD_RETROSPECTIVES.map(retrospectiveToKnowledgeCase),
];

export const OPERATING_KNOWLEDGE_SUMMARY = summarizeKnowledgeCases(OPERATING_KNOWLEDGE_CASES);
