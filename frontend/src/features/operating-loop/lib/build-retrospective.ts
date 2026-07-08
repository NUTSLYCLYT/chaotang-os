import { DEPARTMENT_BUILD_BUDGETS } from './build-budget';

export type BuildRetrospectiveGrade = '优' | '良' | '中';

export interface BuildRetrospective {
  id: string;
  title: string;
  date: string;
  score: number;
  grade: BuildRetrospectiveGrade;
  sourceBudgetId: string;
  outcome: string;
  evidence: string[];
  nextSuggestion: string;
}

const hubuBudget = DEPARTMENT_BUILD_BUDGETS.find((item) => item.id === 'build-hubu-v1');
const gongbuBudget = DEPARTMENT_BUILD_BUDGETS.find((item) => item.id === 'build-gongbu-workflow');
const shiguanBudget = DEPARTMENT_BUILD_BUDGETS.find((item) => item.id === 'build-shiguan-review');

export const BUILD_RETROSPECTIVES: BuildRetrospective[] = [
  {
    id: 'retro-build-hubu-v1',
    title: `${hubuBudget?.title ?? '户部经营预算中台'}复盘`,
    date: '2026-06-01',
    score: 91,
    grade: '优',
    sourceBudgetId: 'build-hubu-v1',
    outcome: '户部已能展示建设预算、待批项目、ROI、风险、现金余量，并可跳转军机处立项。',
    evidence: [
      '/departments 已出现建设预算面板',
      '预算任务包含验收标准与窗口分工',
      '军机立项链接携带 task 与 intent',
    ],
    nextSuggestion: '下一步让军机处执行流回写史馆，形成任务完成后的自动复盘。',
  },
  {
    id: 'retro-build-gongbu-workflow',
    title: `${gongbuBudget?.title ?? '工部 Workflow 中台'}复盘`,
    date: '2026-06-01',
    score: 88,
    grade: '优',
    sourceBudgetId: 'build-gongbu-workflow',
    outcome: '工部已从普通部门页升级为建设其他部门的工程中台雏形。',
    evidence: [
      '工部页面已出现开发助手台和标准开发闭环',
      'department-build-workflow 定义了建设任务状态机',
      '军机处能读取建设案草稿',
    ],
    nextSuggestion: '继续补建设任务池的筛选、预算状态和归档入口。',
  },
  {
    id: 'retro-build-shiguan-review',
    title: `${shiguanBudget?.title ?? '史馆复盘归档模板'}复盘`,
    date: '2026-06-01',
    score: 82,
    grade: '良',
    sourceBudgetId: 'build-shiguan-review',
    outcome: '史馆开始记录建设预算和部门建设过程，但仍需接入真实 taskId 与执行结果。',
    evidence: [
      '经营复盘数据已与 operating-loop 契约打通',
      '复盘记录可反哺上书房每日建议',
      '缺少真实后端归档写入',
    ],
    nextSuggestion: '建设 /archive/[taskId] 或复盘详情抽屉，沉淀目标、过程、结果、证据、风险和下次建议。',
  },
];

export const BUILD_RETROSPECTIVE_SUMMARY = {
  total: BUILD_RETROSPECTIVES.length,
  avgScore: Math.round(
    BUILD_RETROSPECTIVES.reduce((sum, item) => sum + item.score, 0) / BUILD_RETROSPECTIVES.length,
  ),
  nextSuggestion: BUILD_RETROSPECTIVES[0]?.nextSuggestion ?? '',
};
