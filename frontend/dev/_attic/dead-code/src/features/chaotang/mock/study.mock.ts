/**
 * 上书房 · 御案智能奏折台 — 演示数据 (mock)
 *
 * 所有文案集中于此，组件不得在 JSX 写死数据。
 * 每个数据集都带 source:'demo'，UI 显示"演示数据"角标（尚未接入真实企业系统）。
 *
 * 后端就绪后，把各 *Mock 换成 SWR 拉取的真实契约即可，组件层无需改动。
 */

export const STUDY_SOURCE = 'demo' as const;

/* ── 部门色板（取自 design-tokens 的 agentColors，避免杂色）──────────── */
export const DEPT_COLOR = {
  户部: '#3DD68C', // 翠绿 · 财政
  兵部: '#F5A524', // 烈金 · 军务/市场
  刑部: '#8B5CF6', // 紫黛 · 法务风控
  礼部: '#F43F5E', // 朱红 · 礼制/品牌
  工部: '#60A5FA', // 靛蓝 · 工程/产研
  锦衣卫: '#EF4444', // 锦红 · 情报
} as const;
export type DeptName = keyof typeof DEPT_COLOR;

export type Priority = 'high' | 'mid' | 'low';
export const PRIORITY_META: Record<Priority, { label: string; color: string }> = {
  high: { label: '高', color: '#F43F5E' },
  mid: { label: '中', color: '#F5A524' },
  low: { label: '低', color: '#3DD68C' },
};

/* ── 1. 今日御览（含 今日朝报 4 指标 + 御览要点）────────────────────── */
export interface CourtMetric {
  key: string;
  label: string;
  value: number;
  deltaLabel: string;
  deltaTone: 'up' | 'down' | 'flat';
}
export interface BriefingItem {
  id: string;
  dept: DeptName;
  title: string;
  tag: string;
  priority: Priority;
  time: string;
}
export const todayImperialBriefingsMock = {
  source: STUDY_SOURCE,
  updatedLabel: '更新于 辰时三刻',
  metrics: [
    { key: 'total', label: '奏折总数', value: 36, deltaLabel: '较昨日 +12', deltaTone: 'up' },
    { key: 'events', label: '重要事件', value: 8, deltaLabel: '较昨日 +2', deltaTone: 'up' },
    { key: 'pending', label: '待裁决事项', value: 17, deltaLabel: '较昨日 -3', deltaTone: 'down' },
    { key: 'done', label: '已处理事项', value: 23, deltaLabel: '较昨日 +7', deltaTone: 'up' },
  ] as CourtMetric[],
  items: [
    { id: 'br-1', dept: '户部', title: '江南赈灾银两追加请求', tag: '需裁决', priority: 'high', time: '辰时一刻' },
    { id: 'br-2', dept: '兵部', title: '北境边报粮草调拨', tag: '需裁决', priority: 'high', time: '辰时二刻' },
    { id: 'br-3', dept: '刑部', title: '京城盗贼案重大进展', tag: '需关注', priority: 'mid', time: '辰时二刻' },
    { id: 'br-4', dept: '礼部', title: '祭祀典礼方案请示', tag: '需决策', priority: 'mid', time: '辰时三刻' },
    { id: 'br-5', dept: '工部', title: '皇城修缮工程进度', tag: '需阅览', priority: 'low', time: '辰时四刻' },
  ] as BriefingItem[],
};

/* ── 2. 待朱批事项 ──────────────────────────────────────────────── */
export interface VerdictItem {
  id: string;
  dept: DeptName;
  urgency: '紧急' | '重要' | '常规';
  title: string;
  summary: string;
  reportId: string | null; // 对应奏折 id；null = 暂无奏折
}
export const pendingImperialVerdictsMock: VerdictItem[] = [
  {
    id: 'pv-1',
    dept: '户部',
    urgency: '紧急',
    title: '江南赈灾银两追加请求',
    summary: '需拨出 50 万两白银，赈济江南三州水患灾民，户部已核实账册。',
    reportId: 'rpt-jiangnan-relief',
  },
  {
    id: 'pv-2',
    dept: '兵部',
    urgency: '紧急',
    title: '北境边报粮草调拨',
    summary: '需调拨粮草 30 万石，支援北境九镇换防，逾期恐误军机。',
    reportId: 'rpt-beijing-supply',
  },
  {
    id: 'pv-3',
    dept: '刑部',
    urgency: '重要',
    title: '京城盗贼案重大进展',
    summary: '缉捕主谋，已获关键证据，请旨定夺后续审理与株连范围。',
    reportId: null,
  },
];

/* ── 3. 重要风险 / 重要事件 ─────────────────────────────────────── */
export interface CriticalEvent {
  id: string;
  dept: DeptName;
  level: Priority;
  title: string;
  desc: string;
  time: string;
}
export const criticalEventsMock: CriticalEvent[] = [
  { id: 'ce-1', dept: '户部', level: 'high', title: '财政开支异常 · 超预算 18%', desc: '本月运营开支较预算超出 18%，集中在采购与差旅，建议立即核查。', time: '辰时一刻' },
  { id: 'ce-2', dept: '刑部', level: 'high', title: '供应商合同对赌条款风险', desc: '一处对赌条款触发概率偏高，恐造成现金流缺口，已标红呈上。', time: '辰时二刻' },
  { id: 'ce-3', dept: '锦衣卫', level: 'mid', title: '竞品本周三条动向', desc: '主要竞品调价并推出新政策包，建议评估对华东市场冲击。', time: '巳时一刻' },
  { id: 'ce-4', dept: '工部', level: 'low', title: '皇城修缮工程进度滞后', desc: '工程进度较计划落后两日，不影响主线，建议知会工部督办。', time: '巳时二刻' },
];

/* ── 4. 进行中任务 ─────────────────────────────────────────────── */
export interface ActiveTask {
  id: string;
  title: string;
  done: number;
  total: number;
  owner: string;
}
export const activeTasksMock: ActiveTask[] = [
  { id: 'at-1', title: '批阅奏折', done: 8, total: 12, owner: '丞相府' },
  { id: 'at-2', title: '处理重要事件', done: 3, total: 5, owner: '六部' },
  { id: 'at-3', title: '下达旨意', done: 6, total: 8, owner: '御前' },
  { id: 'at-4', title: '查看部门报告', done: 2, total: 4, owner: '史馆' },
  { id: 'at-5', title: 'AI 复盘', done: 1, total: 1, owner: '翰林院' },
];

/* ── 5. 最近奏折 ───────────────────────────────────────────────── */
export interface RecentMemorial {
  id: string;
  dept: DeptName;
  title: string;
  time: string;
  status: '已呈' | '已批' | '待批';
  reportId: string | null;
}
export const recentMemorialsMock: RecentMemorial[] = [
  { id: 'rm-1', dept: '户部', title: '江南赈灾银两追加请求', time: '辰时一刻', status: '待批', reportId: 'rpt-jiangnan-relief' },
  { id: 'rm-2', dept: '兵部', title: '北境边报粮草调拨', time: '辰时二刻', status: '待批', reportId: 'rpt-beijing-supply' },
  { id: 'rm-3', dept: '刑部', title: '京城盗贼案重大进展', time: '辰时二刻', status: '已呈', reportId: null },
  { id: 'rm-4', dept: '礼部', title: '祭祀典礼方案请示', time: '辰时三刻', status: '已呈', reportId: 'rpt-rites-ceremony' },
  { id: 'rm-5', dept: '工部', title: '皇城修缮工程进度', time: '辰时四刻', status: '已批', reportId: 'rpt-palace-repair' },
];

/* ── 6. 丞相今日判断 ───────────────────────────────────────────── */
export const chancellorDailyJudgementMock = {
  source: STUDY_SOURCE,
  name: '丞相',
  role: '中枢调度 · 今日总判断',
  statusTag: '朝局清明',
  statusTone: 'normal' as 'normal' | 'warning' | 'critical',
  headline: '今日宜先定赈灾、再议边备',
  analysis:
    '今日待裁 17 件，其中两件紧急（江南赈灾、北境粮草）牵动民心与军机，建议优先定夺；财政超支 18% 为今日最大隐忧，宜责成户部三日内出整改。',
  points: [
    '先处理 3 件紧急事项，今日有 3 件紧急待处理',
    '关注 户部财政异常，开支超预算 18%',
    '审批 5 件可一键通过，多为例行事务',
  ],
  recommendation: '建议先准江南赈灾，稳民心；北境粮草责兵部限期调拨；财政异常交刑部会审。',
};

/* ── 7. 钦天监即时汇报 ─────────────────────────────────────────── */
export const wangGonggongStudyGuideMock = {
  source: STUDY_SOURCE,
  name: '钦天监',
  role: '您的 AI 智能助理',
  greeting: '皇上早安，今日朝政已准备就绪，请定夺。',
  pending: 3,
  briefs: [
    { id: 'wg-1', icon: '🔥', title: '先处理 3 件紧急事项', desc: '今日有 3 件紧急待处理' },
    { id: 'wg-2', icon: '💰', title: '关注 户部财政异常', desc: '开支超预算 18%' },
    { id: 'wg-3', icon: '✅', title: '审批 5 件可一键通过', desc: '多为例行事务' },
  ],
  lesson: { title: '御下之道 · 恩威并施', body: '为君者，恩威并行，方能服众。恩所以结人心，威所以整法度。' },
};

/* ── 御笔下旨区 · 快捷指令 ──────────────────────────────────────── */
export const quickCommandsMock = [
  '追问风险细节',
  '要求应对方案',
  '加急处理',
  '冻结相关预算',
  '启动应急预案',
  '召集军机处会审',
] as const;

/* ── 状态文案（loading / empty / error / mock）──────────────────── */
export const STUDY_COPY = {
  loading: '陛下，今日奏折正在展开，请稍候。',
  empty: '陛下，今日暂无待朱批事项。可直接下旨创建新任务。',
  error: '陛下，上书房奏折读取失败。可先查看演示数据，或稍后重试。',
  mock: '当前为演示数据，尚未接入真实企业系统。',
} as const;

/* ── 顶部导航项（StudyCourtHeader）── 对齐参考图殿宇分区，href 指真实路由 ─── */
export const STUDY_NAV = [
  { label: '大殿', href: '/overview', active: false },
  { label: '上书房', href: '/study', active: true },
  { label: '军机处', href: '/grand-council', active: false },
  { label: '锦衣卫', href: '/intel', active: false },
  { label: '庄园', href: '/manors', active: false },
  { label: '史馆', href: '/shiguan', active: false },
] as const;

/* 聚合：一次性返回整桌奏折（模拟一个 API 响应）*/
export function loadStudyDeskMock() {
  return {
    source: STUDY_SOURCE,
    today: todayImperialBriefingsMock,
    verdicts: pendingImperialVerdictsMock,
    critical: criticalEventsMock,
    tasks: activeTasksMock,
    memorials: recentMemorialsMock,
    chancellor: chancellorDailyJudgementMock,
    wangGonggong: wangGonggongStudyGuideMock,
  };
}
export type StudyDesk = ReturnType<typeof loadStudyDeskMock>;
