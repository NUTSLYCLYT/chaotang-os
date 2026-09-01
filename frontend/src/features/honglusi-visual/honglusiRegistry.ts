export const HONGLUSI_CATEGORIES = [
  "模型智囊",
  "MCP 使团",
  "自动化行署",
  "合作方服务",
] as const;

export type HonglusiCategory = (typeof HONGLUSI_CATEGORIES)[number];
export type HonglusiAdmissionStatus = "待审" | "沙箱" | "只读" | "阻断";
export type HonglusiRiskLevel = "低" | "中" | "高";

export interface HonglusiCapability {
  readonly id: string;
  readonly mode: "DEMO";
  readonly name: string;
  readonly category: HonglusiCategory;
  readonly source: string;
  readonly summary: string;
  readonly status: HonglusiAdmissionStatus;
  readonly dataClass: string;
  readonly permissions: readonly string[];
  readonly risk: {
    readonly level: HonglusiRiskLevel;
    readonly reason: string;
  };
  readonly impact: readonly string[];
  readonly nextAction: string;
  readonly lastVerifiedLabel: string;
}

const DEMO_TRUTH_LABEL = "演示基线 · 待接入真实事实源";

export const HONGLUSI_CAPABILITIES: readonly HonglusiCapability[] = [
  {
    id: "frontier-reasoner",
    mode: "DEMO",
    name: "前沿推演智囊",
    category: "模型智囊",
    source: "朝堂示例目录",
    summary: "用于复杂议题拆解、反方推演与备选方案比较。",
    status: "待审",
    dataClass: "公开示例资料",
    permissions: ["只读接收问题摘要", "不得外发朝堂正文"],
    risk: { level: "中", reason: "结论仍需证据核验与人工裁决。" },
    impact: ["战略研判速度", "方案比较质量"],
    nextAction: "先在沙箱验证引用完整度与稳定性。",
    lastVerifiedLabel: DEMO_TRUTH_LABEL,
  },
  {
    id: "multimodal-scout",
    mode: "DEMO",
    name: "多模态巡览使",
    category: "模型智囊",
    source: "朝堂示例目录",
    summary: "辅助识别图像、表格与长文材料中的结构线索。",
    status: "沙箱",
    dataClass: "脱敏演示材料",
    permissions: ["只读处理脱敏副本", "不得保存原始材料"],
    risk: { level: "中", reason: "视觉识别可能遗漏细节或误判上下文。" },
    impact: ["材料整理效率", "跨媒介检索"],
    nextAction: "补齐错漏样本后再评估只读准入。",
    lastVerifiedLabel: DEMO_TRUTH_LABEL,
  },
  {
    id: "evidence-bridge",
    mode: "DEMO",
    name: "证据检索使团",
    category: "MCP 使团",
    source: "朝堂示例目录",
    summary: "以受控只读方式提供可引用的外部资料线索。",
    status: "只读",
    dataClass: "公开索引",
    permissions: ["只读查询", "不得提交或修改外部内容"],
    risk: { level: "低", reason: "主要风险是来源过期与证据覆盖不足。" },
    impact: ["事实核验速度", "引用可追溯性"],
    nextAction: "接入真实事实源后复核来源时效。",
    lastVerifiedLabel: DEMO_TRUTH_LABEL,
  },
  {
    id: "browser-envoy",
    mode: "DEMO",
    name: "网页代办行人",
    category: "MCP 使团",
    source: "朝堂示例目录",
    summary: "拟用于没有稳定接口的外部页面交互。",
    status: "阻断",
    dataClass: "未定义",
    permissions: ["当前无可用权限"],
    risk: { level: "高", reason: "可能产生不可逆外部操作与账号风险。" },
    impact: ["外部操作安全", "账号与业务连续性"],
    nextAction: "保持阻断，另立安全与撤销机制评审。",
    lastVerifiedLabel: DEMO_TRUTH_LABEL,
  },
  {
    id: "workflow-caravan",
    mode: "DEMO",
    name: "标准流程驿队",
    category: "自动化行署",
    source: "朝堂示例目录",
    summary: "把重复的资料整理与检查步骤编排为可复用流程。",
    status: "沙箱",
    dataClass: "合成任务数据",
    permissions: ["仅在本地演示环境运行", "不得调用真实业务账号"],
    risk: { level: "中", reason: "流程边界变化可能造成错误分支。" },
    impact: ["重复任务成本", "交付一致性"],
    nextAction: "冻结输入输出合同并补齐失败回退测试。",
    lastVerifiedLabel: DEMO_TRUTH_LABEL,
  },
  {
    id: "industry-partner",
    mode: "DEMO",
    name: "产业合作使节",
    category: "合作方服务",
    source: "朝堂示例目录",
    summary: "用于表达认证、物流、渠道等合作方能力护照。",
    status: "待审",
    dataClass: "合作方公开资料",
    permissions: ["只读查看能力说明", "不得代表用户签约"],
    risk: { level: "中", reason: "服务范围、责任与时效尚未形成证据。" },
    impact: ["供应链协同", "商业履约风险"],
    nextAction: "要求合作方补齐服务边界与责任证明。",
    lastVerifiedLabel: DEMO_TRUTH_LABEL,
  },
] as const;

export function getHonglusiCapability(id: string): HonglusiCapability | null {
  return HONGLUSI_CAPABILITIES.find((capability) => capability.id === id) ?? null;
}
