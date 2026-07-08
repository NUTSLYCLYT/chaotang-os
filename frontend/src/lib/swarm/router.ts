/**
 * router —— 丞相的【确定性路由】（会审：丞相不是会思考的御座，是一个吐 typed 调度计划的 router）。
 *
 * Karpathy：路由是 CLASSIFICATION 问题，先上确定性版（关键词匹配），把真实(问题→召哪些部门)
 * 日志攒成数据集，200 条真问题后再决定要不要升级 LLM router。别建"真 planner"（premature abstraction）。
 * 产出 source:'rule'，留好和未来 LLM router 同一 schema、同一评估集的接口。
 */

// 仅路由到已配置的 live 部门（户部/兵部/刑部）；其余部门暂不参与编排。
const KEYWORDS: Record<string, string[]> = {
  finance: ['预算', '现金', '资金', 'ROI', '投资', '成本', '营收', '利润', '收购', '估值', '毛利', '回收', '钱', '财务', '拨付', '采购'],
  ops: ['运营', '竞品', '战略', '市场', '份额', '出海', '产能', '调度', '执行', '风险处置', '跟价', '获客', '渠道', '战备', '粮草', '兵'],
  legal: ['合规', '法务', '合同', '契约', '诉讼', '违规', '监管', '审查', '时效', '专营', '反垄断', '补偿', '裁员', '证据', '律'],
  works: ['工部', '营造', '建设', '建造', '蜂群', '部署', '上线', '排期', '技术债', '空壳', '该建', '建哪'],
  hr: ['人和', '人事', '离职', '编制', '组织', '倦怠', '岗位', '目标对齐', '晋升', '人才', '团队', '绩效'],
};

export interface RouteResult {
  departments: string[]; // 召哪些部门（live 子集）
  source: 'rule'; // 确定性规则路由（未来 LLM 路由产同一 schema）
  matched: Record<string, string[]>; // 命中关键词（可解释/可 git-diff）
}

const DEFAULT_DEPT = 'finance';

/** 关键词匹配 问题 → 部门子集。命中 0 个时兜底到 finance。 */
export function routeDepartments(question: string): RouteResult {
  const q = String(question ?? '');
  const matched: Record<string, string[]> = {};
  for (const [dept, kws] of Object.entries(KEYWORDS)) {
    const hits = kws.filter((k) => q.includes(k));
    if (hits.length) matched[dept] = hits;
  }
  const departments = Object.keys(matched);
  return {
    departments: departments.length ? departments : [DEFAULT_DEPT],
    source: 'rule',
    matched,
  };
}
