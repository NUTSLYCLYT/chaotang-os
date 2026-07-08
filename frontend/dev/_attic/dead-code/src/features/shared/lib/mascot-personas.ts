/**
 * 朝堂 OS · Mascot 人格表
 *
 * 把"一群人围着陛下做事"落在具体人物身上。
 * 每页 1 位常驻 mascot（钦天监/锦衣卫/史官/丞相/庄主），
 * 共享 CourtMascot 组件壳，只换 persona。
 */

export type MascotTone = 'warm' | 'cold' | 'neutral' | 'regal' | 'rustic';

export interface MascotPersona {
  /** 机内 id，路由无关 */
  id: string;
  /** 正式称谓（卡片顶部） */
  title: string;
  /** 名字（卡片顶部副标） */
  name: string;
  /** 职务一行字（气泡尾） */
  role: string;
  /** 自称（对陛下说话时的第一人称） */
  selfAddress: string;
  /** 主色 hex (边框 / 圆点) */
  accent: string;
  /** 次色（渐变末端） */
  accentDeep: string;
  /** 头像 emoji（过渡方案，后续换 SVG） */
  avatar: string;
  /** 半身立绘 emoji 组合（大尺寸时显示） */
  portrait: string;
  /** 语气 */
  tone: MascotTone;
  /** 收起时按钮的 glyph */
  compactGlyph: string;
}

export const MASCOTS = {
  wangDeQuan: {
    id: 'qintian-oracle',
    title: '钦天监',
    name: '观星导师',
    role: '先知用法 · 按 ? 呼出',
    selfAddress: '钦天监',
    accent: '#F0C66A',
    accentDeep: '#8A6A2A',
    avatar: '✦',
    portrait: '✦',
    tone: 'warm',
    compactGlyph: '✦',
  },
  zhaoWuMian: {
    id: 'zhao-wu-mian',
    title: '北镇抚司千户',
    name: '赵无眠',
    role: '锦衣卫密报官 · 专报天下风声',
    selfAddress: '卑职',
    accent: '#EF4444',
    accentDeep: '#7F1D1D',
    avatar: '🗡',
    portrait: '🗡',
    tone: 'cold',
    compactGlyph: '🗡',
  },
  baiJian: {
    id: 'bai-jian',
    title: '翰林院编修',
    name: '白简',
    role: '史馆执笔 · 记录与回照',
    selfAddress: '臣',
    accent: '#A78BFA',
    accentDeep: '#4C1D95',
    avatar: '✒',
    portrait: '✒',
    tone: 'neutral',
    compactGlyph: '✒',
  },
  chengXiang: {
    id: 'cheng-xiang',
    title: '中枢总理',
    name: '丞相',
    role: '调度六部 · 判断与分派',
    selfAddress: '臣',
    accent: '#F0C66A',
    accentDeep: '#8A6A2A',
    avatar: '👑',
    portrait: '👑',
    tone: 'regal',
    compactGlyph: '👑',
  },
  zhuangZhu: {
    id: 'zhuang-zhu',
    title: '庄园总管',
    name: '庄主',
    role: '蜂群调度 · 阻塞与回写',
    selfAddress: '在下',
    accent: '#6BA0FF',
    accentDeep: '#1E3A8A',
    avatar: '🏯',
    portrait: '🏯',
    tone: 'rustic',
    compactGlyph: '🏯',
  },
} as const satisfies Record<string, MascotPersona>;

export type MascotKey = keyof typeof MASCOTS;
