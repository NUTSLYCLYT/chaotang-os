export interface OfficialSeat {
  code: string;
  name: string;
  office: string;
  avatar: string;
  summary: string;
  badge?: string;
  href: string;
  urgency?: 'none' | 'watch' | 'urgent';
  depth?: 'front' | 'mid' | 'rear';
}

export const OFFICIAL_SEATS: OfficialSeat[] = [
  {
    code: 'hubu',
    name: '户部尚书',
    office: '现金流与回款',
    avatar: '户',
    summary: '先看回款预测、预算占用和高价值线索兑现节奏。',
    badge: '急章 3',
    href: '/study/hubu',
    urgency: 'urgent',
    depth: 'rear',
  },
  {
    code: 'xingbu',
    name: '刑部尚书',
    office: '制度边界',
    avatar: '刑',
    summary: '先看会签边界、问责点和当前不能直接放行的风险。',
    badge: '急章 2',
    href: '/study/xingbu',
    urgency: 'urgent',
    depth: 'mid',
  },
  {
    code: 'gongbu',
    name: '工部尚书',
    office: '产品与交付',
    avatar: '工',
    summary: '先看主链顺滑度、技术债和当前上线隐患。',
    badge: '待阅 4',
    href: '/study/gongbu',
    urgency: 'watch',
    depth: 'front',
  },
  {
    code: 'bingbu',
    name: '兵部尚书',
    office: '竞对与战场',
    avatar: '兵',
    summary: '先看攻守节奏、阵地优先级和敌情变化。',
    badge: '急章 2',
    href: '/study/bingbu',
    urgency: 'urgent',
    depth: 'mid',
  },
  {
    code: 'libu',
    name: '吏部尚书',
    office: '组织与主责',
    avatar: '吏',
    summary: '先看谁该背书、谁该增援、哪里职责打架。',
    badge: '待阅 2',
    href: '/study/libu',
    urgency: 'watch',
    depth: 'rear',
  },
  {
    code: 'libu_rites',
    name: '礼部尚书',
    office: '口径与叙事',
    avatar: '礼',
    summary: '先看对外说法是否越界，品牌和事实是否一致。',
    badge: '待阅 1',
    href: '/study/libu_rites',
    urgency: 'none',
    depth: 'rear',
  },
];
