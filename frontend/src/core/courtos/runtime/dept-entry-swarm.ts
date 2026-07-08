/**
 * 部门码 → entry_swarm 权威映射(SSOT · P2 · 2026-07-01)
 *
 * 单列成无依赖小文件:client 组件(SwarmDispatchPanel 能力发现)可安全 import,
 * 不会把整条 dispatch/adapter 链拉进客户端 bundle。dept-swarm-dispatch 从此处 re-export。
 * 只登记后端已有对应蜂群的部;未登记的部走 adapter 关键词兜底(entrySwarm undefined)。
 */
export const DEPT_ENTRY_SWARM: Record<string, string> = {
  hu_bu: 'finance',     // 户部 · 财务/预算/现金流
  gong_bu: 'pack_rd',   // 工部 · PACK 研发/可行性
  xing_bu: 'legal',     // 刑部 · 法务合规
  li_bu: 'libu',        // 吏部 · 招聘/人事
  bing_bu: 'quotation', // 兵部 · 报价/成本核算
};
