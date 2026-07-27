export interface OfficeDirectoryEntry {
  slug: string;
  name: string;
  responsibilities: readonly string[];
  actions: readonly string[];
}

export interface DepartmentDirectoryEntry {
  code: "personnel" | "finance" | "market" | "ops" | "legal" | "gongbu";
  name: "吏部" | "户部" | "礼部" | "兵部" | "刑部" | "工部";
  background: string;
  accent: string;
  offices: readonly OfficeDirectoryEntry[];
}

const OFFICE_ACTIONS: Readonly<Record<string, readonly string[]>> = {
  treasury: ["补现金流证明", "交刑部看合同尾款", "交工部补验收证据", "缓付并设置复查日期", "先拦下风险"],
  budget: ["准批预算", "要求补预算说明", "改为分期释放", "移交审计司复核", "先拦下风险"],
  "pricing-cost": ["要求重报", "锁定成本基准", "移交合同审查", "提交价格特批", "先拦下风险"],
  financing: ["发起融资评估", "补还款来源", "移交合同审查", "驳回高风险融资", "先拦下风险"],
  audit: ["要求补票", "冻结支付", "发起复核", "移交刑部或吏部", "先拦下风险"],
  accounting: ["补凭证", "调整科目", "发起月结", "提交审计复核", "先拦下风险"],
  investment: ["要求补尽调", "准入下一轮", "驳回投资", "移交合同审查", "先拦下风险"],
  sales: ["标记推进", "要求补客户证据", "移交合同审查", "放弃低质量商机", "先拦下风险"],
  marketing: ["继续投放", "暂停活动", "交报价司跟进", "要求补复盘", "先拦下风险"],
  channel: ["确认归属", "冻结返佣", "要求补报备", "调整渠道等级", "先拦下风险"],
  customer: ["发起客户关怀", "移交现场处理", "触发续约计划", "升级争议处理", "先拦下风险"],
  "competitive-intel": ["生成竞争话术", "移交产品补能力", "调整报价策略", "记录输单原因", "先拦下风险"],
  growth: ["发起实验", "停止无效实验", "扩大有效实验", "移交产品优化", "先拦下风险"],
  talent: ["推进面试", "发 offer", "驳回候选人", "调整岗位画像", "先拦下风险"],
  "labor-relations": ["补签合同", "发起离职流程", "移交争议处理", "设置续签提醒", "先拦下风险"],
  compensation: ["准批调薪", "要求补绩效依据", "调整方案", "移交预算复核", "先拦下风险"],
  appointment: ["发起晋升评审", "调整岗位", "驳回任命", "补资格材料", "先拦下风险"],
  policy: ["引用制度", "发起制度修订", "申请例外", "移交合规审查", "先拦下风险"],
  coordination: ["指派责任人", "催办", "移交", "升级处理", "先拦下风险"],
  solution: ["通过方案", "要求补需求", "调整优先级", "移交技术评估", "先拦下风险"],
  engineering: ["准入开发", "要求拆分方案", "拒绝高风险实现", "移交质量验证", "先拦下风险"],
  material: ["催交", "换供应商", "发起采购", "移交价格复核", "先拦下风险"],
  schedule: ["调整排期", "催办责任人", "升级风险", "移交现场处理", "先拦下风险"],
  quality: ["准予验收", "要求返工", "补验收证据", "移交争议处理", "先拦下风险"],
  field: ["派单", "补现场证据", "升级处理", "交质量复核", "先拦下风险"],
  commitment: ["确认承诺", "修订承诺", "移交合同审查", "设置兑现计划", "先拦下风险"],
  "contract-review": ["要求改条款", "准许签署", "退回补证", "移交授权核查", "先拦下风险"],
  compliance: ["发起整改", "冻结动作", "移交追责", "申请例外", "先拦下风险"],
  "risk-control": ["准入", "加控制条件", "暂停推进", "移交专项审查", "先拦下风险"],
  authorization: ["补证", "申请授权", "退回发起人", "准入下一步", "先拦下风险"],
  dispute: ["发起和解", "补证", "升级法务", "归档结案", "先拦下风险"],
  ip: ["补授权", "下架内容", "申请登记", "移交合同审查", "先拦下风险"],
  "legal-policy": ["引用规则", "发起整改", "申请豁免", "移交合规", "先拦下风险"],
  brand: ["通过素材", "要求修改", "移交 IP 审查", "沉淀品牌资产", "先拦下风险"],
  pr: ["发布回应", "要求补事实", "升级危机处理", "移交法务审查", "先拦下风险"],
  "customer-comms": ["生成话术", "发送沟通", "转交客户经理", "升级争议", "先拦下风险"],
  content: ["发布", "退回修改", "补事实来源", "移交品牌或 IP 审查", "先拦下风险"],
  "government-enterprise": ["补材料", "发起拜访", "移交合规", "归档记录", "先拦下风险"],
  experience: ["发起优化", "移交产品", "验证修复", "关闭问题", "先拦下风险"],
};

export const DEPARTMENT_ACTIONS: Readonly<
  Record<DepartmentDirectoryEntry["code"], readonly string[]>
> = {
  finance: ["准奏", "补证", "交刑部复核", "归档史馆"],
  gongbu: ["补测试", "缓议", "交兵部更新客户口径", "归档史馆"],
  personnel: ["指定负责人", "补签字链", "招聘真链", "缓议", "归档史馆"],
  market: ["准予发布", "改写", "交刑部复核", "归档史馆"],
  ops: ["生成下一步", "交户部核价", "交工部补证", "归档史馆"],
  legal: ["修改后可签", "要求修改", "禁止", "归档史馆"],
};

const office = (
  slug: string,
  name: string,
  ...responsibilities: string[]
): OfficeDirectoryEntry => ({
  slug,
  name,
  responsibilities,
  actions: OFFICE_ACTIONS[slug] ?? [],
});

export const DEPARTMENT_DIRECTORY: readonly DepartmentDirectoryEntry[] = [
  {
    code: "personnel",
    name: "吏部",
    background: "/assets/six-ministries/libu-officials-bg.webp",
    accent: "#b39ddb",
    offices: [
      office("appointment", "任免司", "任免", "晋升", "职级", "调岗", "职责匹配"),
      office("talent", "招聘司", "招聘需求", "岗位缺口", "候选人匹配", "面试推进"),
      office("labor-relations", "劳关司", "劳动关系", "员工入、离、调、转、续全过程风险"),
      office("compensation", "薪酬司", "薪酬区间", "调薪", "奖金", "预算", "内部公平性"),
      office("policy", "制度司", "人事制度", "流程规则", "适用条款", "例外处理"),
      office("coordination", "协同司", "责任人", "跨司协同链路", "卡点", "逾期", "催办"),
    ],
  },
  {
    code: "finance",
    name: "户部",
    background: "/assets/six-ministries/hubu-bg.webp",
    accent: "#f0c66a",
    offices: [
      office("budget", "预算司", "预算", "预测", "费用控制", "经营分析"),
      office("treasury", "出纳司", "现金安全", "回款", "付款", "账期", "资金安全垫"),
      office("pricing-cost", "盐铁司", "报价", "成本拆解", "毛利底线", "异常价格"),
      office("financing", "融资司", "资金缺口", "融资方案", "资金成本", "还款压力", "融资红线"),
      office("audit", "审计司", "异常报销", "重复付款", "缺证费用", "流程绕行稽核"),
      office("accounting", "会计司", "收入", "成本", "费用", "科目", "项目归集", "税务", "月结"),
      office(
        "investment",
        "投资司",
        "投资评审",
        "收益测算",
        "风险分析",
        "退出路径",
        "证券行情",
        "股票价格",
        "市场数据",
        "估值观察",
      ),
    ],
  },
  {
    code: "market",
    name: "礼部",
    background: "/assets/six-ministries/libu-rites-bg.webp",
    accent: "#d18bdd",
    offices: [
      office("brand", "品牌司", "品牌表达", "视觉资产", "语气一致性", "品牌风险"),
      office("pr", "公关司", "舆情监测", "事实核查", "回应口径", "危机升级"),
      office("customer-comms", "客户沟通司", "客户话术", "沟通目标", "禁用话术", "承诺边界"),
      office("content", "内容司", "内容质量", "事实校验", "发布门禁", "修改建议"),
      office("government-enterprise", "政企司", "政企合作", "材料准备", "合规边界", "跟进计划"),
      office("experience", "体验司", "用户反馈", "体验问题优先级", "优化建议", "结果验证"),
    ],
  },
  {
    code: "ops",
    name: "兵部",
    background: "/assets/six-ministries/bingbu-bg.webp",
    accent: "#86a9f2",
    offices: [
      office("sales", "报价司", "商机推进", "客户阶段", "报价动作", "赢率", "阻塞点"),
      office("marketing", "线索司", "市场活动", "线索质量", "获客成本", "投放复盘"),
      office("channel", "渠道司", "渠道合作", "报备", "成交归属", "返佣", "渠道冲突"),
      office("customer", "客户司", "客户健康", "续约", "投诉", "交付问题", "关键联系人"),
      office("competitive-intel", "竞情司", "竞品对比", "价格战风险", "输赢原因", "竞争策略"),
      office("growth", "增长司", "漏斗转化", "增长瓶颈", "实验队列", "实验优先级"),
    ],
  },
  {
    code: "legal",
    name: "刑部",
    background: "/assets/six-ministries/xingbu-bg.webp",
    accent: "#74b5a1",
    offices: [
      office("contract-review", "合同司", "合同条款", "签署门禁", "缺失条款", "模板偏离"),
      office("compliance", "合规稽查司", "合规规则", "风险等级", "整改要求", "稽查结论"),
      office("risk-control", "风控司", "整体风险评分", "风险趋势", "控制措施", "准入建议"),
      office("authorization", "缺证核查司", "证据完整性", "授权链", "审批状态", "越权检查"),
      office("dispute", "争议处置司", "争议事实链", "双方诉求", "证据强弱", "处置策略"),
      office("ip", "知识产权司", "知识产权归属", "授权", "侵权风险", "保护建议"),
      office("legal-policy", "制度司", "法律制度", "处罚风险", "整改路径", "豁免条件"),
    ],
  },
  {
    code: "gongbu",
    name: "工部",
    background: "/assets/six-ministries/gongbu-bg.webp",
    accent: "#7fc9a8",
    offices: [
      office("solution", "产研司", "需求", "产品方案", "用户价值", "范围边界", "优先级"),
      office("engineering", "技术司", "技术可行性", "架构风险", "研发成本", "依赖", "技术债"),
      office("material", "物料司", "库存", "采购", "供应商", "缺料风险", "替代方案"),
      office("schedule", "进度司", "里程碑", "排期", "延期风险", "卡点责任人", "交付预测"),
      office("quality", "质量司", "质量检查", "缺陷", "验收证据", "返工建议", "质量裁决"),
      office("field", "现场司", "现场事实", "客户反馈", "处理进度", "现场证据"),
      office("commitment", "承诺司", "客户承诺", "兑现状态", "承诺来源", "责任人", "越权风险"),
    ],
  },
] as const;

export function getDepartment(code: string): DepartmentDirectoryEntry | null {
  return DEPARTMENT_DIRECTORY.find((department) => department.code === code) ?? null;
}

export function getOffice(code: string, officeSlug: string): OfficeDirectoryEntry | null {
  return getDepartment(code)?.offices.find((item) => item.slug === officeSlug) ?? null;
}
