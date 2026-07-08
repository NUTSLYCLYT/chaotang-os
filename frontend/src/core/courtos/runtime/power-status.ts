/**
 * 通电仪表盘 · 部门真实状态图（2026-06-29）
 *
 * 方法论操作化（本轮会话反思沉淀）：
 *   ② 真相探针：probeLive() 发真请求看 LIVE/FALLBACK，不靠"我以为"。
 *   ③ 诚实标签即仪表盘：sourceLabel 既对用户诚实，又是后端运维信号。
 *   ④ 真进度按"通电数"算，不按"引擎数"——110个绿引擎 + 0通电 = 进度0。
 *
 * liveStatus 语义（铁律9 边界可视化）：
 *   live   = 端到端真通(后端flow真返回结果)
 *   local  = 本地纯咨询真转(真数据真算,不需后端;户部价格/吏部HR/钦天监等) ← 这是GREEN,真working
 *   half   = 接了但被挡(鉴权/部分)
 *   missing= 需后端但没接(缺证)
 */

export type LiveStatus = 'live' | 'local' | 'half' | 'missing';

export const LIVE_STATUS_CN: Record<LiveStatus, string> = {
  live: '🟢 端到端真通',
  local: '🟢 本地咨询真转',
  half: '🟡 半通·被挡',
  missing: '🔴 缺证·需接后端',
};

export interface DeptPowerStatus {
  code: string;
  name: string;
  hasEngine: boolean;
  hasRealData: boolean;
  liveStatus: LiveStatus;
  /** 缺什么——精确指向下一根要接的线（不是泛泛"待办"）。 */
  blocker: string | null;
  /** 对应后端 jiqun flow（产线侧才需要）。 */
  jiqunFlow: string | null;
}

/** 诚实现状（本轮会话实测沉淀；产线侧需后端，咨询侧本地真转）。 */
export const DEPT_POWER_STATUS: DeptPowerStatus[] = [
  { code: 'finance', name: '户部', hasEngine: true, hasRealData: true, liveStatus: 'local', blocker: '真报价/真产线需接 flow_finance/flow_quotation', jiqunFlow: 'flow_finance' },
  { code: 'ops', name: '兵部', hasEngine: true, hasRealData: true, liveStatus: 'local', blocker: '真报价需接 flow_quotation', jiqunFlow: 'flow_quotation' },
  { code: 'gongbu', name: '工部', hasEngine: true, hasRealData: true, liveStatus: 'live', blocker: null, jiqunFlow: 'flow_pack_rd' },
  { code: 'legal', name: '刑部', hasEngine: true, hasRealData: true, liveStatus: 'missing', blocker: '鉴权 + flow_legal 未接', jiqunFlow: 'flow_legal' },
  { code: 'personnel', name: '吏部', hasEngine: true, hasRealData: true, liveStatus: 'local', blocker: null, jiqunFlow: null },
  { code: 'market', name: '礼部', hasEngine: true, hasRealData: true, liveStatus: 'local', blocker: 'flow_xiaohongshu 未接(可选)', jiqunFlow: 'flow_xiaohongshu' },
  { code: 'qintian', name: '钦天监', hasEngine: true, hasRealData: true, liveStatus: 'local', blocker: null, jiqunFlow: 'flow_evaluate' },
  { code: 'jinyiwei', name: '锦衣卫', hasEngine: true, hasRealData: true, liveStatus: 'local', blocker: '竞品实时价需外部源;但市场分析/竞品(安克/极盾)/招标报告已在H盘,待结构化核实', jiqunFlow: null },
];

export interface PowerSummary {
  total: number;
  workingCount: number; // live + local（真在工作的）
  liveCount: number; // 仅端到端后端真通
  localCount: number; // 本地咨询真转
  blockedCount: number; // half + missing
  /** 真北极星：真在工作的部门 / 总数。 */
  workingScore: string;
  note: string;
}

export function powerSummary(statuses: DeptPowerStatus[] = DEPT_POWER_STATUS): PowerSummary {
  const live = statuses.filter((s) => s.liveStatus === 'live').length;
  const local = statuses.filter((s) => s.liveStatus === 'local').length;
  const working = live + local;
  const blocked = statuses.filter((s) => s.liveStatus === 'half' || s.liveStatus === 'missing').length;
  return {
    total: statuses.length,
    workingCount: working,
    liveCount: live,
    localCount: local,
    blockedCount: blocked,
    workingScore: `${working}/${statuses.length}`,
    note: `真在工作 ${working}/${statuses.length}（端到端 ${live} + 本地咨询 ${local}）· 待接后端 ${blocked}`,
  };
}
