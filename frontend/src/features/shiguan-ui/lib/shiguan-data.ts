// 朝堂 OS · 史馆页面 mock 数据与类型定义
import {
  BUILD_RETROSPECTIVE_SUMMARY,
  BUILD_RETROSPECTIVES,
} from "@/features/operating-loop/lib/build-retrospective";

export interface NavItem {
  key: string;
  label: string;
}

export const navItems: NavItem[] = [
  { key: "shangshufang", label: "上书房" },
  { key: "dadian", label: "大殿" },
  { key: "hubu", label: "户部" },
  { key: "bingbu", label: "兵部" },
  { key: "taiyi", label: "太医" },
  { key: "junjichu", label: "军机处" },
  { key: "jinyiwei", label: "锦衣卫" },
  { key: "shiguan", label: "史馆" },
  { key: "zhuangyuan", label: "庄园" },
];

export const activeNavKey = "shiguan";

// ---- 顶部 4 个入口卡 ----
export interface StatCard {
  key: string;
  title: string;
  image: string;
  count: string;
  delta: string;
  glyph: string;
}

export const statCards: StatCard[] = [
  {
    key: "memorial",
    title: "奏折库",
    image: "/assets/shiguan/shiguan.webp",
    count: "36,258",
    delta: "新增 226 件",
    glyph: "卷",
  },
  {
    key: "decision",
    title: "决策档案",
    image: "/assets/shiguan/shiguan.webp",
    count: "8,726",
    delta: "新增 18 件",
    glyph: "玺",
  },
  {
    key: "task",
    title: "任务履历",
    image: "/assets/shiguan/shiguan.webp",
    count: "21,309",
    delta: "新增 342 件",
    glyph: "册",
  },
  {
    key: "knowledge",
    title: "知识库",
    image: "/assets/shiguan/shiguan.webp",
    count: "128,643",
    delta: "新增 1,289 条",
    glyph: "典",
  },
];

// ---- 搜索与追问 ----
export const searchSuggestions: string[] = [
  "近三月决策绩效如何？",
  "边境战事的历史规律？",
  "税收改革的历史经验？",
  "朱苑政策的执行偏差原因？",
];

// ---- 左侧 时间轴视图 ----
export type TimelineTag = "决策" | "奏折" | "任务" | "事件";

export interface TimelineEntry {
  date: string;
  today?: boolean;
  title: string;
  tag: TimelineTag;
}

export const timelineFilters = ["全部", "奏折", "决策", "任务", "事件"] as const;

export const timelineEntries: TimelineEntry[] = [
  { date: "五月初八", today: true, title: "发布《屯田新政令》", tag: "决策" },
  { date: "五月初六", title: "完成《漕运改革方案》", tag: "决策" },
  { date: "五月初三", title: "边境增援已抵达雁门关", tag: "奏折" },
  { date: "四月廿八", title: "完成粮道修缮工程验收", tag: "任务" },
  { date: "四月廿四", title: "户部钱粮季度核账完毕", tag: "奏折" },
];

// ---- 数据概览 ----
export interface OverviewCell {
  label: string;
  value: string;
  unit: string;
  glyph: string;
}

export const overviewCells: OverviewCell[] = [
  { label: "奏折总数", value: "36,258", unit: "件", glyph: "卷" },
  { label: "决策记录", value: "8,726", unit: "件", glyph: "玺" },
  { label: "任务履历", value: "21,309", unit: "件", glyph: "册" },
  { label: "知识条目", value: "128,643", unit: "条", glyph: "典" },
  { label: "建设复盘", value: String(BUILD_RETROSPECTIVE_SUMMARY.total), unit: "次", glyph: "镜" },
  { label: "经验沉淀", value: "4,892", unit: "条", glyph: "鉴" },
];

// ---- 右侧 决策时间线 ----
export type DecisionStatus = "执行中" | "已完成";

export interface DecisionRecord {
  date: string;
  title: string;
  status: DecisionStatus;
}

export const decisionFilters = ["全部", "重大决策", "政策制定", "人事任免"] as const;

export const decisionRecords: DecisionRecord[] = [
  { date: "2026-05-08", title: "屯田新政令", status: "执行中" },
  { date: "2026-04-28", title: "漕运改革方案", status: "执行中" },
  { date: "2026-04-15", title: "户部税制调整", status: "已完成" },
  { date: "2026-03-30", title: "边境防御加强令", status: "已完成" },
  { date: "2026-03-12", title: "学宫扩建计划", status: "已完成" },
];

// ---- 知识库结构 ----
export interface KnowledgeCategory {
  label: string;
  value: string;
  color: string;
}

export const knowledgeCategories: KnowledgeCategory[] = [
  { label: "治国方略", value: "18,932", color: "#dcb456" },
  { label: "军政要略", value: "16,204", color: "#7fb3d5" },
  { label: "经济民生", value: "15,673", color: "#82c09a" },
  { label: "文教礼制", value: "12,418", color: "#c79bd6" },
  { label: "边防军事", value: "9,706", color: "#e0915f" },
  { label: "刑名律法", value: "30,861", color: "#b6c2d4" },
];

export interface GraphNode {
  label: string;
  cx: number;
  cy: number;
  r: number;
  color: string;
}

// 极简知识图谱节点（SVG viewBox 0 0 200 160）
export const graphNodes: GraphNode[] = [
  { label: "治国", cx: 100, cy: 80, r: 16, color: "#dcb456" },
  { label: "军政", cx: 150, cy: 46, r: 9, color: "#7fb3d5" },
  { label: "民生", cx: 158, cy: 104, r: 8, color: "#82c09a" },
  { label: "文教", cx: 108, cy: 132, r: 7, color: "#c79bd6" },
  { label: "边防", cx: 48, cy: 116, r: 8, color: "#e0915f" },
  { label: "律法", cx: 42, cy: 48, r: 10, color: "#b6c2d4" },
];

// ---- 反哺定制 ----
export interface FeedbackStat {
  label: string;
  value: string;
  unit: string;
}

export const feedbackStats: FeedbackStat[] = [
  { label: "可复用经验", value: "326", unit: "条" },
  { label: "待优化建议", value: "18", unit: "条" },
];

export const feedbackDesc =
  "将历史经验提炼为可复用范式，反哺丞相、六部与智能体蜂群，让决策有迹可循。";

// ---- 底部 复盘系统 ----
export type ReviewGrade = "优" | "良" | "中";

export interface ReviewRecord {
  title: string;
  date: string;
  score: number;
  grade: ReviewGrade;
}

export const reviewFilters = ["全部", "决策复盘", "任务复盘", "事件复盘"] as const;

export const reviewRecords: ReviewRecord[] = [
  ...BUILD_RETROSPECTIVES.map((item) => ({
    title: item.title,
    date: item.date,
    score: item.score,
    grade: item.grade,
  })),
  { title: "漕运改革方案复盘", date: "2026-04-28", score: 92, grade: "优" },
  { title: "户部税制调整复盘", date: "2026-04-15", score: 78, grade: "良" },
  { title: "边境防御策略复盘", date: "2026-03-30", score: 88, grade: "优" },
  { title: "学宫扩建计划复盘", date: "2026-03-12", score: 86, grade: "优" },
];

// ---- 底部 版本记录 ----
export interface VersionRecord {
  title: string;
  version: string;
  date: string;
}

export const versionFilters = ["全部", "文档版本", "政策版本", "方案版本"] as const;

export const versionRecords: VersionRecord[] = [
  { title: "屯田新政令", version: "v2.3", date: "2026-05-08" },
  { title: "漕运改革方案", version: "v1.8", date: "2026-04-28" },
  { title: "户部税制调整", version: "v1.4", date: "2026-04-15" },
  { title: "边境防御令", version: "v2.1", date: "2026-03-30" },
];

// ---- 8 个核心操作按钮 ----
export type ActionId =
  | "today-brief"
  | "decision-archive"
  | "meeting-record"
  | "task-trace"
  | "ops-review"
  | "knowledge-intake"
  | "generate-chronicle"
  | "submit-memorial";

export interface QuickAction {
  id: ActionId;
  label: string;
  glyph: string;
  primary?: boolean;
  // 关联页面区块 id；点击时滚动并高亮，无则打开抽屉
  target?: string;
}

export const quickActions: QuickAction[] = [
  { id: "today-brief", label: "今日纪要", glyph: "纪", target: "panel-timeline" },
  { id: "decision-archive", label: "决策档案", glyph: "策", target: "panel-decision" },
  { id: "meeting-record", label: "会议记录", glyph: "会", target: "panel-timeline" },
  { id: "task-trace", label: "任务留痕", glyph: "痕", target: "panel-overview" },
  { id: "ops-review", label: "经营复盘", glyph: "盘", target: "panel-review" },
  { id: "knowledge-intake", label: "知识入库", glyph: "藏", target: "panel-knowledge" },
  { id: "generate-chronicle", label: "生成史册", glyph: "册", primary: true },
  { id: "submit-memorial", label: "提交奏折", glyph: "奏" },
];

// ---- 生成史册 抽屉内容 ----
export const chronicleTypes = ["日史", "周史", "月史", "专题史"] as const;
export type ChronicleType = (typeof chronicleTypes)[number];

export const drawerEvents: string[] = [
  "户部经营预算中台接入军机处立项链路",
  "工部 Workflow 中台开始沉淀部门建设模板",
  "史馆复盘归档模板纳入经营闭环 Harness",
  "发布《屯田新政令》，七郡同步施行",
  "雁门关增援抵达，边境防务巩固",
  "户部钱粮季度核账完毕，盈余可观",
];

export const drawerDecisions: { title: string; status: DecisionStatus }[] = [
  { title: "屯田新政令", status: "执行中" },
  { title: "漕运改革方案", status: "执行中" },
];

export const drawerAISummary =
  `本日主线已转向经营闭环建设：工部负责复制部门建设能力，户部负责预算、ROI 与风险约束，史馆沉淀复盘。当前建设复盘均分 ${BUILD_RETROSPECTIVE_SUMMARY.avgScore}，建议下一步让军机处执行流自动回写史馆。`;

export const drawerKnowledge: string[] = [
  "部门建设必须先过户部预算和 ROI 约束",
  "工部 Workflow 是复制其他部门的基础工法",
  "史馆复盘需要沉淀目标、过程、结果、证据、风险和下次建议",
  "屯田制在七郡的推行节奏与阻力图谱",
  "边境快速增援的调度路径优化",
  "钱粮季度核账的标准化流程",
];

// 右侧栏顶部小标签（决策时间线上方提示）
export const courtDate = "2026年 甲辰年 五月初八 已时";
