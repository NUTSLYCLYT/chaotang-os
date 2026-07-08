/**
 * 太医院 · 经络与穴位数据
 *
 * 12 正经 + 任督二脉，先取 8 条最常用 + 每条 2-3 个关键穴位。
 * SVG 坐标系：viewBox 0 0 320 620（人体正背双视）
 */

export interface Acupoint {
  id: string;
  nameCn: string;
  code: string;          // e.g. LU9, LI4
  x: number;
  y: number;
  function: string;      // 主治
  massage: string;       // 按摩方法与作用
}

export interface Meridian {
  id: string;
  nameCn: string;
  nameShort: string;     // 简称，如 "肺经"
  element: '金' | '木' | '水' | '火' | '土' | '任' | '督';
  color: string;
  /** SVG path d 属性（顺序：起点 → 关键穴位 → 终点） */
  path: string;
  /** 关键穴位 */
  points: Acupoint[];
  /** 一句话功效 */
  summary: string;
}

/** 五行配色 */
export const ELEMENT_COLOR: Record<Meridian['element'], string> = {
  金: '#E5E7EB',
  木: '#3DD68C',
  水: '#6BA0FF',
  火: '#F43F5E',
  土: '#F5A524',
  任: '#F0C66A',
  督: '#B794F4',
};

export const MERIDIANS: Meridian[] = [
  {
    id: 'lung',
    nameCn: '手太阴肺经',
    nameShort: '肺经',
    element: '金',
    color: ELEMENT_COLOR['金'],
    path: 'M118 152 Q100 175 90 220 Q78 275 68 320 L60 380 Q55 410 55 430',
    summary: '主气、司呼吸；舒肺利气，治咳喘鼻塞',
    points: [
      { id: 'LU1',  nameCn: '中府', code: 'LU1',  x: 118, y: 152, function: '肺与胸中气汇聚', massage: '指腹点按 1-2 分钟，缓胸闷气短' },
      { id: 'LU9',  nameCn: '太渊', code: 'LU9',  x: 62,  y: 380, function: '脉会，补肺气',     massage: '拇指按压 30 秒×3，补气护肺' },
      { id: 'LU11', nameCn: '少商', code: 'LU11', x: 55,  y: 430, function: '清肺泻火',         massage: '点刺或重掐，咽痛急救' },
    ],
  },
  {
    id: 'largeIntestine',
    nameCn: '手阳明大肠经',
    nameShort: '大肠经',
    element: '金',
    color: '#D6CCB0',
    path: 'M80 440 L75 410 Q70 360 75 320 Q80 270 95 230 Q108 200 120 180 L150 115',
    summary: '通调腑气；治头面五官与皮肤',
    points: [
      { id: 'LI4',  nameCn: '合谷', code: 'LI4',  x: 75,  y: 422, function: '面口合谷收',       massage: '拇食指捏 1 分钟，止头痛牙痛' },
      { id: 'LI11', nameCn: '曲池', code: 'LI11', x: 95,  y: 235, function: '清热疏风',         massage: '屈肘按压 1 分钟，降压去湿疹' },
      { id: 'LI20', nameCn: '迎香', code: 'LI20', x: 144, y: 78,  function: '通鼻窍',           massage: '鼻翼两侧点按，通鼻塞' },
    ],
  },
  {
    id: 'stomach',
    nameCn: '足阳明胃经',
    nameShort: '胃经',
    element: '土',
    color: ELEMENT_COLOR['土'],
    path: 'M168 80 L172 120 Q178 180 180 250 Q182 340 180 420 Q180 500 178 560',
    summary: '后天之本；理脾胃、调经气',
    points: [
      { id: 'ST25', nameCn: '天枢', code: 'ST25', x: 180, y: 300, function: '调大肠、理气机', massage: '仰卧环按脐旁 2 寸 2 分钟，通便' },
      { id: 'ST36', nameCn: '足三里', code: 'ST36', x: 180, y: 450, function: '强身第一穴',      massage: '拇指按揉 3 分钟，补元气健脾胃' },
      { id: 'ST40', nameCn: '丰隆', code: 'ST40', x: 180, y: 500, function: '化痰除湿',         massage: '按压 1-2 分钟，祛痰湿减脂' },
    ],
  },
  {
    id: 'spleen',
    nameCn: '足太阴脾经',
    nameShort: '脾经',
    element: '土',
    color: '#FFB562',
    path: 'M200 560 Q195 490 192 420 Q190 340 188 260 Q186 190 182 140',
    summary: '运化水谷；健脾升清止血',
    points: [
      { id: 'SP6', nameCn: '三阴交', code: 'SP6', x: 192, y: 525, function: '妇科要穴，三阴交会', massage: '拇指旋按 2 分钟，调月经助眠（孕妇禁）' },
      { id: 'SP9', nameCn: '阴陵泉', code: 'SP9', x: 192, y: 470, function: '利水消肿',           massage: '按压 1 分钟，减浮肿' },
    ],
  },
  {
    id: 'heart',
    nameCn: '手少阴心经',
    nameShort: '心经',
    element: '火',
    color: ELEMENT_COLOR['火'],
    path: 'M170 195 Q180 230 195 280 Q215 350 235 400 L245 430',
    summary: '藏神主脉；安神定悸',
    points: [
      { id: 'HT7', nameCn: '神门', code: 'HT7', x: 245, y: 430, function: '安神助眠',   massage: '腕横纹尺侧按 1-2 分钟，失眠常按' },
      { id: 'HT3', nameCn: '少海', code: 'HT3', x: 215, y: 330, function: '清心火',     massage: '肘内侧按压，缓心烦健忘' },
    ],
  },
  {
    id: 'bladder',
    nameCn: '足太阳膀胱经',
    nameShort: '膀胱经',
    element: '水',
    color: ELEMENT_COLOR['水'],
    path: 'M140 55 L138 110 Q136 200 138 300 Q140 400 143 480 Q145 540 148 580',
    summary: '最长经络；主后背所有俞穴',
    points: [
      { id: 'BL23', nameCn: '肾俞', code: 'BL23', x: 138, y: 340, function: '补肾要穴',   massage: '双手搓热后贴肾俞，早晚各 1 次' },
      { id: 'BL40', nameCn: '委中', code: 'BL40', x: 145, y: 500, function: '腰背委中求', massage: '膝后横纹中点按压，缓腰痛' },
      { id: 'BL60', nameCn: '昆仑', code: 'BL60', x: 148, y: 575, function: '通经活络',   massage: '外踝后按 1 分钟，头痛颈僵' },
    ],
  },
  {
    id: 'kidney',
    nameCn: '足少阴肾经',
    nameShort: '肾经',
    element: '水',
    color: '#60A5FA',
    path: 'M158 575 Q158 500 160 400 Q162 320 164 240 Q166 180 165 130',
    summary: '先天之本；强腰壮骨',
    points: [
      { id: 'KD1', nameCn: '涌泉', code: 'KD1', x: 158, y: 595, function: '滋阴降火',   massage: '睡前搓涌泉至温，降压助眠' },
      { id: 'KD3', nameCn: '太溪', code: 'KD3', x: 160, y: 570, function: '补肾填精',   massage: '内踝后按压 2 分钟，强腰膝' },
    ],
  },
  {
    id: 'ren',
    nameCn: '任脉',
    nameShort: '任脉',
    element: '任',
    color: ELEMENT_COLOR['任'],
    path: 'M160 90 L160 150 L160 220 L160 290 L160 380',
    summary: '阴脉之海；统阴脉',
    points: [
      { id: 'CV6',  nameCn: '气海', code: 'CV6',  x: 160, y: 320, function: '培元固本',   massage: '脐下 1.5 寸温灸或按揉，补元气' },
      { id: 'CV12', nameCn: '中脘', code: 'CV12', x: 160, y: 275, function: '理脾胃',     massage: '脐上 4 寸，顺时针摩腹 3 分钟' },
      { id: 'CV17', nameCn: '膻中', code: 'CV17', x: 160, y: 215, function: '气之会',     massage: '胸正中按揉 1 分钟，开胸理气' },
    ],
  },
];
