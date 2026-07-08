/**
 * 朝堂全貌 · 板块上线状态 SSOT（2026-06-28）
 *
 * Deming 天才建议落地：「能上线」不靠拍脑袋，靠数字。
 * 一个板块要进「已点亮」区(status:'live')，必须：
 *   ① realDataSource 写明真数据源（不是空话）；
 *   ② verifiedReal=true（已用 guard:realdata 确认真接 API 无 mock）；
 *   ③ ahaVerified=true（已确认商家点进去有真价值/aha）—— 缺则 guard:pilot 警示。
 * 由 `scripts/guard-pilot.mjs`(pnpm guard:pilot) 强制：live 缺 realDataSource/verifiedReal → 阻断。
 * 点亮一个新板块 = 一次有证据的声明，不是一时兴起。
 */
export type PilotStatus = 'live' | 'coming';

export interface PilotTile {
  key: string;
  name: string;
  sub: string;
  status: PilotStatus;
  href?: string;
  /** live 必填：真数据源（guard:pilot 检查存在）。 */
  realDataSource?: string;
  /** live 必填：已用 guard:realdata 确认真接 API 无 mock。 */
  verifiedReal?: boolean;
  /** live 推荐：已确认商家点进去有真价值/aha（缺则 guard:pilot 警示，不阻断）。 */
  ahaVerified?: boolean;
}

export interface PilotGroup {
  title: string;
  tiles: PilotTile[];
}

export const PILOT_GROUPS: PilotGroup[] = [
  {
    title: '已点亮 · 现在就能用',
    tiles: [
      {
        key: 'jinyiwei',
        name: '锦衣卫 · 情报',
        sub: '盯竞品/舆情异动，入库前把可信度',
        status: 'live',
        href: '/intel',
        realDataSource: 'GET /api/court/intel/signals → Turso intel_signals 表',
        verifiedReal: true,
        ahaVerified: true, // 实测:打开即 23 条真情报 + 可信度分级
      },
      {
        key: 'hubu-invest',
        name: '户部 · 投资决策',
        sub: '这笔钱该不该投：ROI + 风险 + 单向门',
        status: 'live',
        href: '/departments/finance',
        realDataSource: 'GET /api/court/hubu/overview(Turso) + hubu-engines(纯函数真算) + 录入真决策',
        verifiedReal: true,
        ahaVerified: true, // 实测:录入真决策→当场准奏/缓议+评分+风险(无缺证)
      },
      {
        key: 'bingbu-acq',
        name: '兵部 · 销售决策',
        sub: '签约/报价/谈判该不该接，CRO 裁决 + 风险把关',
        status: 'live',
        href: '/departments/ops',
        // 文案对齐真实:驾驶舱是"成交/签约/报价/谈判把关"(不止获客);8司含商机/布阵(获客)+价策/渠道(成交)。
        realDataSource: 'GET /api/court/bingbu/overview(主库 tasks 销售语义) → CRO 引擎 evaluateSalesItem 真裁决(质门/缺证/跨审/钦天监死法地图)',
        verifiedReal: true,
        ahaVerified: true, // 实测:驾驶舱3件真销售决策,每件兵部裁决+缺证+跨审+死法地图一票否决+唯一下一步(浏览即aha,如锦衣卫)
      },
    ],
  },
  {
    title: '六部 · 陆续上线',
    tiles: [
      { key: 'gongbu', name: '工部 · 产品技术', sub: '能不能造，交付与质量门', status: 'coming' },
      { key: 'xingbu', name: '刑部 · 风控合规', sub: '合同 / 合规 / 法律风险', status: 'coming' },
      { key: 'libu-rites', name: '礼部 · 品牌营销', sub: '内容 / 品牌 / 呈现', status: 'coming' },
      { key: 'libu', name: '吏部 · 人事', sub: '招聘 / 组织 / 考核', status: 'coming' },
    ],
  },
  {
    title: '诸司 · 陆续上线',
    tiles: [
      { key: 'qintian', name: '钦天监 · 预测', sub: '未来推演 / 情景模拟', status: 'coming' },
      { key: 'taiyi', name: '太医院 · 健康', sub: '系统/经营健康（不诊断）', status: 'coming' },
    ],
  },
  {
    title: '中枢 · 架构已搭，功能陆续上线',
    tiles: [
      { key: 'study', name: '上书房', sub: '每日要务批阅入口', status: 'coming' },
      { key: 'junji', name: '军机处', sub: '任务执行 / 群臣会审', status: 'coming' },
      { key: 'shiguan', name: '史馆', sub: '归档 / 复盘 / 旧案引用', status: 'coming' },
      { key: 'swarm', name: '蜂群', sub: 'AI 产线 / 执行', status: 'coming' },
    ],
  },
];
