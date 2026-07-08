/**
 * 二十四节气养生库（2026-06-24 · 太医院养生四时堂）。
 *
 * 顺时养生·通用常识，非诊断、非处方（太医院红线:不断病不开方）。
 * 每个节气给:养护重点(脏/气) + 餐饮/睡眠/起居/导引 四柱当令建议 + 一段导引名。
 * 数据驱动:computeSolarTerm(date) 据公历近似落到当令节气;全年 24 项,绝不空/不编。
 */

export interface SolarTermCare {
  /** 餐饮·食宜（清淡常识，非药膳处方） */
  diet: string;
  /** 睡眠·作息 */
  sleep: string;
  /** 起居·日常 */
  routine: string;
  /** 导引·一段可做的舒缓动作（配视频） */
  guidance: string;
}

export interface SolarTerm {
  /** 节气名 */
  name: string;
  /** 当令养护重点（脏/气，养生语，非诊断） */
  focus: string;
  /** 一句节气养生箴言 */
  motto: string;
  care: SolarTermCare;
}

/** 24 节气 + 起始近似公历日期（月,日）。落点用"今天 ≥ 本节气起 且 < 下一节气起"。 */
const TERMS: ReadonlyArray<{ start: [number, number]; term: SolarTerm }> = [
  { start: [2, 4], term: { name: '立春', focus: '养肝·升发', motto: '夜卧早起，广步于庭，使志生发。', care: { diet: '少酸增甘，韭菜豆芽助阳气', sleep: '可稍晚卧、早起，舒展阳气', routine: '披发缓行、宽衣松带', guidance: '舒肝导引·两臂展扩 5 分钟' } } },
  { start: [2, 19], term: { name: '雨水', focus: '养脾·防湿', motto: '春捂护暖，健脾化湿。', care: { diet: '甘平健脾，山药小米粥', sleep: '早睡养阳，忌熬夜', routine: '春捂下身、足暖', guidance: '健脾导引·摩腹揉膝' } } },
  { start: [3, 5], term: { name: '惊蛰', focus: '养肝·顺气', motto: '春雷动，顺气调神，勿动怒。', care: { diet: '清淡多蔬，梨润燥', sleep: '早起呼吸新气', routine: '多开窗、舒情志', guidance: '疏肝导引·扩胸转体' } } },
  { start: [3, 20], term: { name: '春分', focus: '平阴阳', motto: '昼夜均，求阴阳之平。', care: { diet: '寒热均衡，忌过寒过热', sleep: '作息规律，睡眠定时', routine: '动静相宜、勿过劳', guidance: '平衡导引·缓步深呼吸' } } },
  { start: [4, 4], term: { name: '清明', focus: '养肝·清气', motto: '气清景明，踏青舒怀。', care: { diet: '清补为主，荠菜时蔬', sleep: '早起踏青，亲近自然', routine: '户外舒展、调畅情志', guidance: '舒展导引·登高远望' } } },
  { start: [4, 20], term: { name: '谷雨', focus: '健脾·祛湿', motto: '雨生百谷，祛湿健脾。', care: { diet: '健脾利湿，赤小豆薏米', sleep: '勿贪睡，避潮气', routine: '居处通风防潮', guidance: '祛湿导引·拍打经络' } } },
  { start: [5, 5], term: { name: '立夏', focus: '养心·护阳', motto: '夏气始，养心安神。', care: { diet: '清淡养心，莲子百合', sleep: '晚卧早起，午间小憩', routine: '戒躁、静心纳凉勿过', guidance: '养心导引·静坐调息' } } },
  { start: [5, 21], term: { name: '小满', focus: '清热·防湿热', motto: '小满未满，清心防热。', care: { diet: '清热祛湿，苦瓜黄瓜', sleep: '午憩养神，夜勿过晚', routine: '避汗后当风、衣物透气', guidance: '清心导引·缓伸拉筋' } } },
  { start: [6, 6], term: { name: '芒种', focus: '养心·健脾', motto: '梅雨渐至，健脾防困。', care: { diet: '少油腻，酸梅生津', sleep: '午间补眠解困', routine: '勤换衣、防湿黏', guidance: '醒脾导引·叩齿摩面' } } },
  { start: [6, 21], term: { name: '夏至', focus: '养心·养阳', motto: '昼最长，晚卧早起，戒大汗淋漓。', care: { diet: '食宜清苦，苦瓜绿豆养心', sleep: '晚卧早起，午后小憩 20 分', routine: '避烈日、纳凉勿贪冷', guidance: '养心导引·静坐调息 8 分钟' } } },
  { start: [7, 7], term: { name: '小暑', focus: '清心·消暑', motto: '暑渐盛，心静自然凉。', care: { diet: '清补消暑，冬瓜荷叶', sleep: '夜短午补，避空调直吹', routine: '少动多静、避正午外出', guidance: '消暑导引·缓摇缓转' } } },
  { start: [7, 22], term: { name: '大暑', focus: '清热·护津', motto: '一年最热，护津防暑。', care: { diet: '补水护津，绿豆乌梅', sleep: '午憩避暑，夜卧勿贪凉', routine: '防暑湿、勿露宿', guidance: '生津导引·舌抵上腭咽津' } } },
  { start: [8, 7], term: { name: '立秋', focus: '养肺·润燥', motto: '阳消阴长，收敛神气。', care: { diet: '润燥养肺，银耳百合', sleep: '早卧早起，收敛阳气', routine: '勿过汗、防秋燥', guidance: '润肺导引·深长呼吸' } } },
  { start: [8, 23], term: { name: '处暑', focus: '养肺·防燥', motto: '暑去凉来，添衣防燥。', care: { diet: '滋阴润燥，梨蜂蜜', sleep: '早睡养阴，渐增睡眠', routine: '昼夜温差大、适时添衣', guidance: '养肺导引·扩胸吐纳' } } },
  { start: [9, 7], term: { name: '白露', focus: '养肺·护阳', motto: '露凝而白，勿露身受凉。', care: { diet: '温润为主，南瓜山药', sleep: '早卧早起，足部保暖', routine: '勿赤膊、护好颈背', guidance: '温阳导引·搓手暖背' } } },
  { start: [9, 23], term: { name: '秋分', focus: '平燥·养收', motto: '昼夜再均，养收平燥。', care: { diet: '平补润燥，芝麻核桃', sleep: '作息规律、睡眠充足', routine: '动静相宜、调畅情志', guidance: '平和导引·缓步调息' } } },
  { start: [10, 8], term: { name: '寒露', focus: '养阴·防寒', motto: '寒生露重，足下保暖。', care: { diet: '滋阴润肺，雪梨百合', sleep: '早卧早起，添被防寒', routine: '足暖、勿露足踝', guidance: '固本导引·泡足揉涌泉' } } },
  { start: [10, 23], term: { name: '霜降', focus: '健脾·补阳', motto: '秋之末，补脾养胃。', care: { diet: '温补健脾，南瓜板栗', sleep: '早睡蓄养，勿熬夜', routine: '护腹保暖、防寒入侵', guidance: '健脾导引·摩腹温中' } } },
  { start: [11, 7], term: { name: '立冬', focus: '养肾·藏阳', motto: '冬藏始，早卧晚起待日光。', care: { diet: '温补养肾，黑豆核桃', sleep: '早卧晚起，必待日光', routine: '保暖护肾、勿过劳', guidance: '养肾导引·缓摩腰肾' } } },
  { start: [11, 22], term: { name: '小雪', focus: '养肾·调神', motto: '天地闭藏，宁神少扰。', care: { diet: '温润不燥，羊肉萝卜', sleep: '充足睡眠、宜早卧', routine: '通风晒阳、调畅情志', guidance: '安神导引·静坐观息' } } },
  { start: [12, 7], term: { name: '大雪', focus: '养肾·防寒', motto: '雪盛阴极，护阳防寒。', care: { diet: '温补御寒，桂圆生姜', sleep: '早卧晚起、足暖入睡', routine: '头颈足重点保暖', guidance: '御寒导引·搓腰擦背' } } },
  { start: [12, 22], term: { name: '冬至', focus: '养肾·一阳生', motto: '阴极阳生，静养护初阳。', care: { diet: '温补滋肾，板栗黑豆羊肉（皆寻常食材，非药膳）', sleep: '早卧晚起，养藏阳气', routine: '静养少扰、勿大汗', guidance: '护阳导引·静坐温煦丹田' } } },
  { start: [1, 5], term: { name: '小寒', focus: '养肾·温阳', motto: '寒之始烈，温阳固本。', care: { diet: '温热补益，核桃枸杞', sleep: '早卧晚起、保暖入睡', routine: '防风寒、护好腰背', guidance: '温阳导引·叩齿咽津暖身' } } },
  { start: [1, 20], term: { name: '大寒', focus: '养肾·待春', motto: '岁之末，敛藏待春发。', care: { diet: '温补兼疏，山药红枣', sleep: '充足睡眠、渐迎春气', routine: '保暖兼舒展、勿郁闷', guidance: '舒展导引·缓伸迎春' } } },
];

/** 据公历日期近似落到当令节气（无需农历库,够养生展示用）。
 *  注意:TERMS 书写顺序≠日历键顺序(小寒/大寒键最小却写在末尾),故必须按日历键排序后
 *  取"≤今日的最大键"那一项;年初(< 小寒)跨年回落上一年冬至。 */
export function computeSolarTerm(date: Date): SolarTerm {
  const key = (date.getMonth() + 1) * 100 + date.getDate();
  const sorted = [...TERMS].sort(
    (a, b) => a.start[0] * 100 + a.start[1] - (b.start[0] * 100 + b.start[1]),
  );
  // 默认=日历键最大的节气(冬至),覆盖"年初早于小寒"的跨年区间。
  let current = sorted[sorted.length - 1].term;
  for (const { start, term } of sorted) {
    if (key >= start[0] * 100 + start[1]) current = term;
  }
  return current;
}

export const SOLAR_TERM_NAMES = TERMS.map((t) => t.term.name);
