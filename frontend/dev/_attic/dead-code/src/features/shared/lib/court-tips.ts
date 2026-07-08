/**
 * 朝堂 OS · 科普小贴士池
 *
 * 钦天监 / 其他 mascot 在默认台词后穿插 1-2 条，
 * 让用户在等待期间被动学到怎么用这套系统。
 *
 * 三类：
 *  - usage   快捷键、操作技巧
 *  - concept 朝堂 OS 概念（庄园/蜂群/六部是什么）
 *  - trivia  官制典故彩蛋
 */

export type CourtTipKind = 'usage' | 'concept' | 'trivia';

export interface CourtTip {
  id: string;
  kind: CourtTipKind;
  text: string;
}

export const COURT_TIPS: CourtTip[] = [
  // ─── usage 使用技巧 ─────────────────────────
  { id: 'u-qmark', kind: 'usage', text: '随时按 ? 键即可召唤钦天监 — 无须回首页。' },
  { id: 'u-kbd-enter', kind: 'usage', text: '在亲笔朱批页按 ⌘+Enter（Win 为 Ctrl+Enter）即可直接下旨，不必挪动鼠标。' },
  { id: 'u-year-toggle', kind: 'usage', text: '点击顶部年号"启元元年"，可切换为公历 — 不习惯古历的陛下可一键换回。' },
  { id: 'u-throne-home', kind: 'usage', text: '王座首页只给一件最值得先看的事。看完即做决定，莫在首页停留。' },
  { id: 'u-pulse-peek', kind: 'usage', text: '页面下方朝堂脉搏每 4 秒换一条 — 看一眼便知系统近态，不必亲自巡视。' },
  { id: 'u-brief-direct', kind: 'usage', text: '锦衣卫密报、执行任务、庄园简讯均可一键直达详页，不必绕经大殿。' },
  { id: 'u-command-palette', kind: 'usage', text: '按 ⌘K（Win 为 Ctrl+K）召出御令面板 — 任何页面、任何操作皆可一键跳转。' },
  { id: 'u-compose-example', kind: 'usage', text: '若懒得动笔，亲笔朱批页下方有多条示例圣旨 — 一点即填入。' },

  // ─── concept 概念科普 ───────────────────────
  { id: 'c-manor', kind: 'concept', text: '"庄园"是一个垂直领域的专家军团 — 律师庄管法务、财务庄管账本。每庄园内藏一群叫"蜂群"的 AI 专家。' },
  { id: 'c-swarm', kind: 'concept', text: '"蜂群"是每座庄园里 9 位专家 Agent 的合称 — 七位领域专家 + 红队蓝队各一，三轮对抗后才出结论。' },
  { id: 'c-six-bu', kind: 'concept', text: '六部 = 工（工程）· 兵（竞品）· 刑（制度）· 户（财务）· 吏（人力）· 礼（品牌）— 每部对应一位常驻大 Agent。' },
  { id: 'c-jinyiwei', kind: 'concept', text: '锦衣卫负责天下情报 — 风声、政策、市场、竞品动向皆由他一人收拢，再呈交陛下。' },
  { id: 'c-qintian', kind: 'concept', text: '钦天监专管"未来推演" — 用多情景假设告诉陛下某个决策在 3 个月后可能出现的局面。' },
  { id: 'c-chengxiang', kind: 'concept', text: '丞相是中枢调度官 — 陛下一句话他拆成任务、分派六部、汇总回呈。无需陛下亲理细节。' },
  { id: 'c-scribe', kind: 'concept', text: '复盘台记录所有执行过的事 — 陛下想复盘任何一次决策，去复盘台按时间一翻便知。' },
  { id: 'c-sansheng', kind: 'concept', text: '三省审议台 = 中书（起草）· 门下（复核）· 尚书（下发） — 事情已清楚、只差拍板时走此路，最短。' },

  // ─── trivia 典故彩蛋 ────────────────────────
  { id: 't-enyuan', kind: 'trivia', text: '"启元"为本朝拟年号 — 启者新也，元者始也。意在每日皆是新局。' },
  { id: 't-shichen', kind: 'trivia', text: '古时一日分十二时辰，一时辰为两刻 — 故"酉时"等于下午五点至七点。' },
  { id: 't-zhupi', kind: 'trivia', text: '朱批即皇帝御笔 — 宋元以下帝王皆用朱砂批阅奏章，红字落笔即为最终裁决。' },
  { id: 't-yushi', kind: 'trivia', text: '御巡台取法前朝"巡按御史" — 不理具体事务，只核查六部是否称职。' },
  { id: 't-regency', kind: 'trivia', text: '"Regency Rule"译自汉语"摄政之道" — 辅弼之人只压缩噪音，不替主君决断。' },
];

/**
 * 从 tips 池里随机取 n 条（不重复）。
 */
export function pickRandomTips(n: number, excludeIds: string[] = []): CourtTip[] {
  const pool = COURT_TIPS.filter((t) => !excludeIds.includes(t.id));
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.max(0, Math.min(n, pool.length)));
}
