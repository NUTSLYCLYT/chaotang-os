export type DepartmentOfficeDemo = {
  code: string;
  name: string;
  duty: string;
  focus: string;
};

export type DepartmentDemo = {
  code: string;
  name: string;
  titleEn: string;
  accent: string;
  background: string;
  summary: string;
  demoLabel: "演示展示";
  offices: readonly DepartmentOfficeDemo[];
  demoTasks: readonly string[];
};

export const DEPARTMENT_DEMOS: readonly DepartmentDemo[] = [
  {
    code: "personnel", name: "吏部", titleEn: "Personnel Office", accent: "#b39ddb",
    background: "/assets/six-ministries/libu-officials-bg.webp", demoLabel: "演示展示",
    summary: "组织、任免与人才培养的部门工作场景。",
    offices: [
      { code: "appointment", name: "任免司", duty: "梳理岗位与责任边界。", focus: "展示岗位任命流程" },
      { code: "talent", name: "人才司", duty: "规划人才培养与组织能力。", focus: "展示人才盘点卡片" },
    ],
    demoTasks: ["干部梯队盘点", "关键岗位责任梳理", "人才培养方案"],
  },
  {
    code: "finance", name: "户部", titleEn: "Revenue Office", accent: "#f0c66a",
    background: "/assets/six-ministries/hubu-bg.webp", demoLabel: "演示展示",
    summary: "预算、资金与经营分析的部门工作场景。",
    offices: [
      { code: "budget", name: "预算司", duty: "汇总预算口径与资源安排。", focus: "展示预算评审卡片" },
      { code: "treasury", name: "度支司", duty: "梳理资金节奏与收支安排。", focus: "展示资金计划卡片" },
    ],
    demoTasks: ["季度预算评审", "资金节奏复核", "经营分析摘要"],
  },
  {
    code: "market", name: "礼部", titleEn: "Rites Office", accent: "#d18bdd",
    background: "/assets/six-ministries/libu-rites-bg.webp", demoLabel: "演示展示",
    summary: "品牌、沟通与体验编排的部门工作场景。",
    offices: [
      { code: "brand", name: "品牌司", duty: "统一对外表达与品牌体验。", focus: "展示品牌议题卡片" },
      { code: "communication", name: "通礼司", duty: "规划沟通节奏与重要活动。", focus: "展示沟通编排卡片" },
    ],
    demoTasks: ["品牌叙事梳理", "重要活动编排", "对外沟通校对"],
  },
  {
    code: "ops", name: "兵部", titleEn: "Operations Office", accent: "#86a9f2",
    background: "/assets/six-ministries/bingbu-bg.webp", demoLabel: "演示展示",
    summary: "客户、渠道与经营协同的部门工作场景。",
    offices: [
      { code: "strategy", name: "谋略司", duty: "识别经营机会与行动重点。", focus: "展示策略研判卡片" },
      { code: "campaign", name: "行营司", duty: "协调渠道、项目与推进节奏。", focus: "展示行动编排卡片" },
    ],
    demoTasks: ["重点机会研判", "渠道协同安排", "项目推进复盘"],
  },
  {
    code: "legal", name: "刑部", titleEn: "Justice Office", accent: "#74b5a1",
    background: "/assets/six-ministries/xingbu-bg.webp", demoLabel: "演示展示",
    summary: "合规、授权与风险审视的部门工作场景。",
    offices: [
      { code: "compliance", name: "审议司", duty: "审视合规边界与风险提示。", focus: "展示合规审议卡片" },
      { code: "contract", name: "契约司", duty: "整理契约要点与授权依据。", focus: "展示契约复核卡片" },
    ],
    demoTasks: ["授权边界复核", "合规议题审视", "契约条款校验"],
  },
  {
    code: "gongbu", name: "工部", titleEn: "Works Office", accent: "#7fc9a8",
    background: "/assets/six-ministries/gongbu-bg.webp", demoLabel: "演示展示",
    summary: "产品、技术与交付协同的部门工作场景。",
    offices: [
      { code: "delivery", name: "营造司", duty: "组织交付节奏与质量门。", focus: "展示交付推进卡片" },
      { code: "quality", name: "工衡司", duty: "梳理质量标准与验收要点。", focus: "展示质量校验卡片" },
    ],
    demoTasks: ["交付节奏校准", "质量门检查", "建设事项排期"],
  },
];

export function getDepartmentDemo(code: string): DepartmentDemo | undefined {
  return DEPARTMENT_DEMOS.find((department) => department.code === code);
}

export function getDepartmentOfficeDemo(code: string, office: string): DepartmentOfficeDemo | undefined {
  return getDepartmentDemo(code)?.offices.find((item) => item.code === office);
}
