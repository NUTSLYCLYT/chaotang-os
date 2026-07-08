/**
 * 锦衣卫 · 每日朝报分类引擎
 *
 * 七类朝报：天下 / 机巧 / 财赋 / 兵戎 / 商贾 / 政令 / 竞合
 * 每条信号按 industry + title + summary 关键词自动归类
 */

import type { IntelSignal } from '@/types/intel';

export type BriefingCategoryId =
  | 'world'
  | 'ai_tech'
  | 'finance'
  | 'military'
  | 'trade'
  | 'policy'
  | 'rivalry';

export interface BriefingCategory {
  id: BriefingCategoryId;
  label: string;
  seal: string;       // 单字印章
  subtitle: string;    // 英文副标题
  keywords: RegExp;
  order: number;
}

export const BRIEFING_CATEGORIES: BriefingCategory[] = [
  {
    id: 'world',
    label: '天下',
    seal: '天',
    subtitle: 'World',
    keywords: /地缘|国际|外交|冲突|局势|北约|欧盟|联合国|g7|g20|opec|中东|南海|台海/i,
    order: 1,
  },
  {
    id: 'ai_tech',
    label: '机巧',
    seal: '机',
    subtitle: 'AI/Tech',
    keywords: /ai\b|人工智能|模型|agent|自动化|大模型|llm|gpt|claude|deepseek|机器人|芯片|半导体|量子|算力|开源|benchmark|transformer|推理/i,
    order: 2,
  },
  {
    id: 'finance',
    label: '财赋',
    seal: '财',
    subtitle: 'Finance',
    keywords: /美联储|利率|通胀|cpi|ppi|投资|融资|估值|ipo|股市|债券|汇率|美元|人民币|央行|降息|加息|缩表|信贷|资本|基金|vc|pe/i,
    order: 3,
  },
  {
    id: 'military',
    label: '兵戎',
    seal: '兵',
    subtitle: 'Defense',
    keywords: /军事|国防|军队|武器|导弹|网络攻击|黑客|安全漏洞|零日|间谍|情报|恐怖|威胁|战|冲突|军演|制裁|禁运|出口管制/i,
    order: 4,
  },
  {
    id: 'trade',
    label: '商贾',
    seal: '商',
    subtitle: 'Trade',
    keywords: /贸易|关税|供应链|物流|航运|港口|bom|原材料|稀土|矿产|能源|石油|天然气|锂|钴|镍|进出口|集装箱|运费|交期/i,
    order: 5,
  },
  {
    id: 'policy',
    label: '政令',
    seal: '政',
    subtitle: 'Policy',
    keywords: /政策|监管|法规|合规|法案|细则|补贴|退税|审批|牌照|许可|环保|碳排放|esg|劳动法|数据隐私|gdpr/i,
    order: 6,
  },
  {
    id: 'rivalry',
    label: '竞合',
    seal: '竞',
    subtitle: 'Rivalry',
    keywords: /竞品|对手|市场|份额|价格战|收购|合并|裁员|财报|营收|利润|新品|发布|专利|诉讼|合作|战略|联盟/i,
    order: 7,
  },
];

function classifySignal(s: IntelSignal): BriefingCategoryId {
  const text = `${s.industry ?? ''} ${s.title ?? ''} ${s.summary ?? ''}`;

  // 按 order 匹配，先匹配到的优先
  const sorted = [...BRIEFING_CATEGORIES].sort((a, b) => a.order - b.order);
  for (const cat of sorted) {
    if (cat.keywords.test(text)) return cat.id;
  }

  // 兜底：世界新闻
  return 'world';
}

export interface BriefingSlot {
  category: BriefingCategory;
  signals: IntelSignal[];
  criticalCount: number;
  warningCount: number;
  totalCount: number;
  urgentCount: number; // < 6h
}

export function buildBriefingBoard(signals: IntelSignal[]): BriefingSlot[] {
  const map = new Map<BriefingCategoryId, IntelSignal[]>();

  for (const cat of BRIEFING_CATEGORIES) {
    map.set(cat.id, []);
  }

  for (const s of signals) {
    const cid = classifySignal(s);
    const bucket = map.get(cid);
    if (bucket) bucket.push(s);
  }

  return BRIEFING_CATEGORIES.map((cat) => {
    const bucket = map.get(cat.id) ?? [];
    const criticalCount = bucket.filter((s) => s.level === 'critical').length;
    const warningCount = bucket.filter((s) => s.level === 'warning').length;
    const urgentCount = bucket.filter((s) => {
      const h = (Date.now() - new Date(s.lastUpdatedAt).getTime()) / 3600000;
      return h < 6 && (s.level === 'critical' || s.level === 'warning');
    }).length;
    return {
      category: cat,
      signals: bucket,
      criticalCount,
      warningCount,
      totalCount: bucket.length,
      urgentCount,
    };
  });
}

export function briefingCategoryById(id: BriefingCategoryId): BriefingCategory {
  return BRIEFING_CATEGORIES.find((c) => c.id === id) ?? BRIEFING_CATEGORIES[0];
}
