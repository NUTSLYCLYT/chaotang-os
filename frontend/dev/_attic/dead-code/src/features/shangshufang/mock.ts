/**
 * 上书房 · 演练数据（mock）
 * 内容对齐 Figma「01-shangshufang」：江南赈灾主线奏折 + 丞相建议 + 钦天监指导。
 * 文案为演示数据，非真实政务。接入真实 API 时替换为 fetch（见 ShangshufangPage 注释）。
 */

import type { ChancellorSuggestion, Memorial, WangTutorial } from './types';

/** 左栏 · 丞相今日建议（按优先级：急 → 缓） */
export const chancellorSuggestionsMock: ChancellorSuggestion[] = [
  { id: 'cs1', title: '江南赈灾粮的拨付建议', tag: '甲申 · 急报', priority: 'urgent' },
  { id: 'cs2', title: '西北边境军需整备指示', tag: '甲申 · 密', priority: 'high' },
  { id: 'cs3', title: '选派盐官督查盐务指示', tag: '甲申 · 要', priority: 'high' },
  { id: 'cs4', title: '科举考试规则调整建议', tag: '已阅 · 拟', priority: 'medium' },
  { id: 'cs5', title: '义仓粮食储备增储建议', tag: '已阅 · 缓', priority: 'low' },
];

/** 中央 · 当日主奏折（御前奏报） */
export const featuredMemorialMock: Memorial = {
  id: 'm-jiangnan-relief',
  title: '奏折',
  subtitle: '御前奏报',
  petitioner: '江南巡抚 田丰',
  reporter: '兵部尚书 白浚',
  priority: 'urgent',
  reason:
    '江南连岁阴雨，水患频仍，田苗受损，民生凋敝。巡臣呈报赈粮调拨不公，恳请朝廷准予拨纳，以赈黎民之急。',
  suggestion:
    '臣已会户部覆核，赈济常备约需三十万两。建议自常平仓拨付二十万两，余十万两从盐茶盈余中调拨，以济灾民、安定民心。',
  risk: '若赈济延误，恐致流民滞留、滋生盗患，影响地方治安与漕运安全，甚至动摇根本。',
  verdict:
    '恳请皇上裁定：一、是否自盐茶盈余调拨十万两；二、赈济期限是否延定至秋收之后。俾使赈济有度，事权明断。',
  closing: '恭惟陛下圣明，深谋远虑，臣不胜惶恐谨奏，伏候圣裁。',
  sealDate: '甲申三刻',
  decisionOptions: [
    '准奏 · 自盐茶盈余调拨十万两',
    '准奏 · 仅常平仓拨付二十万两',
    '驳回 · 着户部另议',
  ],
};

/** 右栏 · 钦天监指导条目 */
export const wangTutorialsMock: WangTutorial[] = [
  { id: 'wt1', title: '新岁引导 · 如何使用朝堂 OS', subtitle: '快速熟悉系统功能', duration: '1 分钟' },
  { id: 'wt2', title: '御令发布 · 如何下旨批示', subtitle: '一句话下旨的完整流程', duration: '1 分钟' },
  { id: 'wt3', title: '朝议通报 · 六部要枢简介', subtitle: '了解六部要务与运作', duration: '2 分钟' },
  { id: 'wt4', title: '快捷查询 · 奏折处理流程', subtitle: '从批阅到归档的完整链路', duration: '2 分钟' },
  { id: 'wt5', title: '红机密奏 · 启用系统总览', subtitle: '要务速览与告警设置', duration: '1 分钟' },
];

/** 钦天监指导提示语 */
export const wangGreetingMock =
  '陛下，今日上书房已为您展开江南赈灾主奏折一封，丞相另有五条要务待您过目。建议先批阅红印急报，再下达新旨。不知下一步时，问钦天监便是。';

/**
 * 简讯 → 奏折详情映射（点击丞相/钦天监任一条目，奏折即展示该条详情）
 * key = 条目 id（chancellorSuggestions 的 cs*、wangTutorials 的 wt*）
 * 丞相 cs1 复用江南赈灾主折。
 */
export const memorialById: Record<string, Memorial> = {
  cs1: featuredMemorialMock,
  cs2: {
    id: 'cs2',
    title: '奏折',
    subtitle: '御前奏报',
    petitioner: '兵部职方司 郎中',
    reporter: '兵部尚书 白浚',
    priority: 'high',
    reason: '西北边镇连岁戍守，甲胄军械久未补给，冬衣粮秣告急，戍卒多有怨言。',
    suggestion: '臣请自武库拨甲三千、弓弩五百，并调太仓粟十万石转运西北，限一月内整备完毕。',
    risk: '若整备迟滞，恐边备空虚，敌乘隙而入，戍卒离散，边镇动摇。',
    verdict: '恳请皇上裁定：一、是否即调武库军械；二、转运粮秣由户部抑或兵部主办。',
    closing: '臣谨奏，伏候圣裁。',
    sealDate: '甲申二刻',
    decisionOptions: ['准奏 · 即调军械并转运粮秣', '准奏 · 仅补冬衣粮秣', '驳回 · 着兵部再议'],
  },
  cs3: {
    id: 'cs3',
    title: '奏折',
    subtitle: '御前奏报',
    petitioner: '户部山东司 主事',
    reporter: '户部尚书',
    priority: 'high',
    reason: '近闻沿海盐场私贩猖獗，盐课岁入锐减，恐亏国用。',
    suggestion: '臣请遴选干员充盐政巡按，分赴两淮、长芦督查，严缉私贩、清核盐引。',
    risk: '若稽查不力，私盐泛滥，盐课益亏，且滋生官商勾结之弊。',
    verdict: '恳请皇上裁定：一、巡按由吏部会推抑或陛下钦点；二、稽查期限几何。',
    closing: '臣谨奏，伏候圣裁。',
    sealDate: '甲申二刻',
    decisionOptions: ['准奏 · 钦点巡按即赴两淮', '准奏 · 吏部会推后差遣', '驳回 · 另议'],
  },
  cs4: {
    id: 'cs4',
    title: '奏折',
    subtitle: '御前奏报',
    petitioner: '礼部仪制司 郎中',
    reporter: '礼部尚书',
    priority: 'medium',
    reason: '历科取士偏重词章，疏于经世实务，所拔之才多不谙政事。',
    suggestion: '臣请于乡会试增策论一场，考以钱谷、刑名、河漕实务，以拔实才。',
    risk: '骤改旧制，恐士林哗然、备考无所适从，需明示施行之年以安人心。',
    verdict: '恳请皇上裁定：一、是否增设策论；二、自何科起施行。',
    closing: '臣谨奏，伏候圣裁。',
    sealDate: '甲申一刻',
    decisionOptions: ['准奏 · 下科起增策论', '准奏 · 三年后施行', '暂缓 · 交礼部详议'],
  },
  cs5: {
    id: 'cs5',
    title: '奏折',
    subtitle: '御前奏报',
    petitioner: '司农寺 寺丞',
    reporter: '户部尚书',
    priority: 'low',
    reason: '各州义仓积谷渐耗，遇歉年恐无以赈给。',
    suggestion: '臣请按州县户口酌增义仓积谷一成，秋成时随赋带征，丰年增储以备凶荒。',
    risk: '增征若过，恐增民负、起怨言；需核实仓储、严防胥吏侵渔。',
    verdict: '恳请皇上裁定：一、增储成数几何；二、是否随赋带征。',
    closing: '臣谨奏，伏候圣裁。',
    sealDate: '甲申一刻',
    decisionOptions: ['准奏 · 增储一成随赋带征', '准奏 · 增储半成', '暂缓 · 先核仓储'],
  },
  wt1: {
    id: 'wt1',
    title: '奏折',
    subtitle: '钦天监指导',
    petitioner: '钦天监',
    reporter: '司礼监',
    priority: 'low',
    reason: '朝堂 OS 乃陛下号令群臣、统御万机之枢。新岁伊始，钦天监先为陛下引路。',
    suggestion: '上书房理今日要务，大殿见群臣百官；一句话下旨，朝堂自会拆解、分派、回奏。',
    risk: '若不熟流程，恐旨意含糊、群臣误事；钦天监建议先看一分钟演示。',
    verdict: '此为教习，无需裁决；陛下随时可唤钦天监再讲。',
    closing: '钦天监候星在侧，陛下但有不明，问一句便是。',
    sealDate: '新岁吉时',
    decisionOptions: ['这就去试一试', '看一分钟演示', '改日再学'],
  },
  wt2: {
    id: 'wt2',
    title: '奏折',
    subtitle: '钦天监指导',
    petitioner: '钦天监',
    reporter: '司礼监',
    priority: 'low',
    reason: '下旨乃陛下行权之要，一句话即可号令群臣。',
    suggestion: '于底部「御前·下旨」框直陈旨意；不明则切「问丞相」先参详，明确则「下旨」即分派。',
    risk: '旨意太略，群臣难以承办；宜一事一旨、目标明确。',
    verdict: '此为教习，无需裁决；陛下可即在下旨框一试。',
    closing: '钦天监谨呈，愿陛下号令如流。',
    sealDate: '新岁吉时',
    decisionOptions: ['这就去下旨', '看一例示范', '改日再学'],
  },
  wt3: {
    id: 'wt3',
    title: '奏折',
    subtitle: '钦天监指导',
    petitioner: '钦天监',
    reporter: '司礼监',
    priority: 'low',
    reason: '六部分掌钱粮、兵戎、刑名、礼乐、工营、官吏，乃朝廷执行之手足。',
    suggestion: '顶部导航可巡各部：户部理财、兵部主战、太医院司康健、锦衣卫掌情报。',
    risk: '不谙各部职掌，恐所托非人、事倍功半。',
    verdict: '此为教习，无需裁决；陛下可逐部巡视。',
    closing: '钦天监备述六部，供陛下御览。',
    sealDate: '新岁吉时',
    decisionOptions: ['巡视六部', '改日再看'],
  },
  wt4: {
    id: 'wt4',
    title: '奏折',
    subtitle: '钦天监指导',
    petitioner: '钦天监',
    reporter: '司礼监',
    priority: 'medium',
    reason: '奏折自呈报、批阅、裁决至归档，自有其流。',
    suggestion: '中央奏折即当日要务；阅毕可「立即裁决」，已决之折自动归档备查。',
    risk: '久积不阅，要务延误；宜日清日结。',
    verdict: '此为教习，无需裁决；陛下可即批中央之折。',
    closing: '钦天监谨陈处折之法。',
    sealDate: '新岁吉时',
    decisionOptions: ['去批一折', '改日再学'],
  },
  wt5: {
    id: 'wt5',
    title: '奏折',
    subtitle: '钦天监指导',
    petitioner: '钦天监',
    reporter: '司礼监',
    priority: 'high',
    reason: '军国密要、急报危情，另以红机密奏直达御前。',
    suggestion: '启用密奏总览，急报、风险一屏尽览，遇警即时呈报。',
    risk: '密奏不设，恐急情壅蔽、贻误军机。',
    verdict: '是否启用红机密奏总览，请陛下定夺。',
    closing: '钦天监谨奏密奏之要。',
    sealDate: '新岁吉时',
    decisionOptions: ['启用密奏总览', '暂不启用', '改日再议'],
  },
};

/** 演示数据标识 */
export const SHANGSHUFANG_MOCK_META = {
  source: 'mock' as const,
  generatedAt: '2026-05-27',
  tenantId: 'demo',
};
