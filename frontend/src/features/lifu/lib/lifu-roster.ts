/**
 * 礼部 · 对外增长部编制 8 司花名册（纯函数 · 2026-06-29）
 *
 * 礼部本命=对外增长(对外关系 + 营销流量),非确定性计算部——它是朝堂的「诚实出口/增长层」。
 * 两个真数据底座:关系台账(对外关系)+ 流量数据(渠道ROI/CAC/转化)。本命引擎=ROI决策 + 防失真门
 * (对外表达忠于内部真相,守 sourceLabel 不洗白)。营销/品牌偏定性的司,无真数据前诚实标骨架(铁律5)。
 * domain 码=market(SixDepartmentCode)。诚实标真/骨架,不冒充。
 */

export type LifuOfficeId =
  | 'chief'
  | 'relationship_ledger'
  | 'traffic_growth'
  | 'new_media'
  | 'commitment_gate'
  | 'pr_crisis'
  | 'engagement'
  | 'brand_culture';

export interface LifuOfficeRole {
  id: LifuOfficeId;
  name: string;
  role: string;
  duty: string;
  /** 能力/skill 配置(运行态本命方法+数据源)。 */
  skill: string;
  /** 复用的已建件(为空=待建)。 */
  reuses: string[];
  /** 是否已接真引擎(诚实:false=骨架待建)。 */
  engine: boolean;
}

export const LIFU_OFFICE_ORDER: LifuOfficeId[] = [
  'chief',
  'relationship_ledger',
  'traffic_growth',
  'new_media',
  'commitment_gate',
  'pr_crisis',
  'engagement',
  'brand_culture',
];

/** 礼部主题色(取自 agent.ts li_bu_rites,单一真相源)。 */
export const ACCENT = '#C070D0';

export const LIFU_ROSTER: Record<LifuOfficeId, LifuOfficeRole> = {
  chief: { id: 'chief', name: '礼部尚书', role: '对外增长总负责', duty: '统筹对外关系与营销增长,守对外表达诚实克制', skill: '统筹 + 对外承诺高危一票否决', reuses: ['governance/gate'], engine: false },
  relationship_ledger: { id: 'relationship_ledger', name: '关系台账司', role: '对外关系/BD', duty: '政府/合作方/媒体/客户高层关系图谱:阶段+历史+下一步(复利资产)', skill: '关系阶段模型 + 下一步推进(CRM底座)', reuses: ['lifu-relationship'], engine: true },
  traffic_growth: { id: 'traffic_growth', name: '流量增长司', role: '增长/投放', duty: '渠道ROI/CAC/转化决策——把预算投到真带客户的渠道', skill: '多触点归因 + CAC/LTV + ROI排序(看真数据投)', reuses: ['lifu-growth'], engine: true },
  new_media: { id: 'new_media', name: '新媒体运营司', role: '内容/社媒', duty: '短视频/公众号内容创作(LLM)+ 看真转化数据迭代', skill: '内容创作(LLM呈现)+ 表现数据回流飞轮', reuses: ['lifu-growth', 'deliverable'], engine: false },
  commitment_gate: { id: 'commitment_gate', name: '对外承诺可逆司', role: '承诺管控', duty: '对外承诺台账 + 可逆性闸(政府/独家/公开承诺过人工门)+ BATNA/ZOPA谈判', skill: 'BATNA/ZOPA保留价 + 加权效用 + 让步曲线(对外承诺过人工门)', reuses: ['lifu-negotiation', 'governance/gate', 'lifu-fidelity'], engine: true },
  pr_crisis: { id: 'pr_crisis', name: '商务公关司', role: '公关/危机', duty: '危机响应(SCCT姿态+严重度分层);舆情监测调锦衣卫不自采', skill: 'SCCT危机姿态查表 + 严重度tier(舆情调锦衣卫)', reuses: ['lifu-crisis', 'jinyiwei'], engine: true },
  engagement: { id: 'engagement', name: '场合作战司', role: '展会/路演/谈判', duty: '展会/路演/政府谈判准备:口径+筹码+底线+礼仪+文化(不对称作战)', skill: '场合作战手册 + BATNA/让步空间', reuses: [], engine: false },
  brand_culture: { id: 'brand_culture', name: '品牌文化司', role: '品牌/文化', duty: '品牌定位、文化表达、对外口径一致性', skill: '口径一致性校验(防失真门)+ 品牌定性分析', reuses: ['lifu-fidelity'], engine: false },
};

/** 已接真引擎的司数 / 总(诚实展示几真几骨架)。 */
export function lifuEngineStats(): { real: number; total: number } {
  const all = Object.values(LIFU_ROSTER);
  return { real: all.filter((o) => o.engine).length, total: all.length };
}
