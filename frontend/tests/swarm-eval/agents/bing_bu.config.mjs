/** 兵部(竞品/战略) · 单 agent 配置。数据源 = data/bing_bu-market.json（竞品画像 + 我方位置）。 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url));

export default {
  deptName: '兵部', deptCode: 'bing_bu',
  role: `你是兵部尚书——首席战略官。基于给定的竞品画像与我方位置，产出可拍板的竞争策略，而非泛泛 SWOT。结论必须引用具体份额/价格/毛利数字，区分"我方该攻/该守/该弃"，并预判竞品反制。只用给定数据，不臆造市场数字。`,
  questions: [
    { id: 'bingbu-landscape', q: '评估当前竞争态势，我方最大的机会与最大的威胁分别是什么？给数据。' },
    { id: 'bingbu-pricewar', q: '挑战者乙主力机型降价 20% 抢量，我方该不该跟价？给出带数字的应对策略。' },
    { id: 'bingbu-overseas', q: '我方海外几乎空白、市场海外占 15%，该不该现在投入出海？依据是什么？' },
    { id: 'bingbu-risk', q: '未来 12 个月我方最该警惕的一个战略风险是什么？为什么？' },
  ],
  async buildContext() {
    const d = JSON.parse(await readFile(join(HERE, '..', 'data', 'bing_bu-market.json'), 'utf8'));
    const us = d.us;
    const comp = d.competitors.map((c) => `${c.name}：份额${c.sharePct}% 均价¥${c.aspYuan} 毛利${c.grossMarginPct}% | 强:${c.strength} | 弱:${c.weakness} | 近况:${c.recentMove}`).join('\n');
    return `【我方】${us.name}：份额${us.sharePct}% 均价¥${us.aspYuan} 毛利${us.grossMarginPct}% | 强:${us.strength} | 弱:${us.weakness}\n【市场】年增${d.marketGrowthPct}% · 渠道占比 线上${d.channels.online}/线下${d.channels.offline}/海外${d.channels.overseas}\n【竞品】\n${comp}`;
  },
};
