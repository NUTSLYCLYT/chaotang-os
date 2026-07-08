export interface HrScenario {
  id: string;
  title: string;
  preview: string;
  fullText: string;
}

export const HR_SCENARIOS: HrScenario[] = [
  {
    id: 'hr-001-a',
    title: '劳动仲裁 · 加班费纠纷',
    preview: '员工以未支付加班费为由提起劳动仲裁，涉及 38 个工作日加班记录缺失',
    fullText:
      '员工以未支付加班费为由提起劳动仲裁，如何应对？需要评估法律风险与内部合规。',
  },
  {
    id: 'hr-001-b',
    title: 'HR · 裁员补偿方案',
    preview: '公司计划裁减 15 名员工，需评估合规裁员流程与赔偿金标准',
    fullText:
      '公司因业务调整计划裁员补偿方案设计：涉及 15 名员工，其中 3 名工龄超 10 年。需要 HR 庄园研判：① N+1 赔偿标准是否适用；② 裁员流程合规要点；③ 规避集体劳动纠纷的最优方案。',
  },
];
