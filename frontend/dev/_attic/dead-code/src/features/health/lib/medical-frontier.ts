/**
 * 医疗前沿资讯库（2026-06-24 · 太医院 #3 典藏阁·医疗前沿）。
 *
 * 公开研究/产业资讯(脑机接口/长寿等),非个人医疗建议、零诊断。每条带来源+日期+原文链接。
 * 诚实:这是「截至 ASOF 的快照」,非实时;需定期用联网检索刷新(见 README 备注)。
 * 安全墙:本层只显公开前沿信息,绝不结合用户体检数据生成任何个人结论。
 */

export interface FrontierItem {
  topic: '脑机接口' | '长寿' | 'AI医疗' | '前沿';
  title: string;
  source: string;
  date: string;
  href: string;
}

/** 资讯快照采集日期(向用户明示非实时)。刷新时同步更新本值与下方条目。 */
export const FRONTIER_AS_OF = '2026-06-24';

export const MEDICAL_FRONTIER: ReadonlyArray<FrontierItem> = [
  {
    topic: '脑机接口',
    title: '“读脑”与“治脑”一体化操作，脑机接口持续突破',
    source: '央视新闻',
    date: '2026-04-28',
    href: 'https://news.cctv.com/2026/04/28/ARTIFWfGhveOoo9D96Rmt3m8260428.shtml',
  },
  {
    topic: '脑机接口',
    title: '脑机接口：加力推进从实验室到产业化“关键一跃”',
    source: '新华社 / 中国证券报',
    date: '2026-03-07',
    href: 'https://paper.cnstock.com/html/2026-03/07/content_2186353.htm',
  },
  {
    topic: '脑机接口',
    title: '脑机接口正迎来从科幻向临床与商业转化的历史拐点（2026 行业深度分析）',
    source: 'AgeClub',
    date: '2026-06',
    href: 'https://www.ageclub.net/article-detail/9393',
  },
  {
    topic: '脑机接口',
    title: '脑机接口市场：2026 年约 27.7 亿美元，预计 2034 年达 85.5 亿美元',
    source: 'Straits Research',
    date: '2026-06',
    href: 'https://straitsresearch.com/zh/report/brain-computer-interfaces-market',
  },
  {
    topic: '长寿',
    title: '华大尹烨：科技普惠是通往健康长寿的钥匙',
    source: 'china.com',
    date: '2026-01-24',
    href: 'https://mtz.china.com/touzi/2026/0124/214517.html',
  },
];
