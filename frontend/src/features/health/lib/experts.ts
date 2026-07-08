/**
 * 太医院 · 专家资源索引
 *
 * 每位专家标注：所属脏腑 / 所属经络 / 专长疾病。
 * 用于 OrganAtlas / MeridianMap / NewsFeed 点击时，在右侧响应面板展示相关专家。
 */

import type { LucideIcon } from 'lucide-react';

export interface Expert {
  id: string;
  name: string;
  title: string;
  hospital: string;
  city: string;
  specialty: string;
  /** 关联脏腑 ids：heart/lungs/liver/spleen/kidneys */
  relevantOrgans: string[];
  /** 关联经络 ids */
  relevantMeridians: string[];
  /** 关联疾病关键词 */
  relevantKeywords: string[];
  rating: number;
  rating_count: number;
  next_slot: string;
  tags: string[];
  fee: string;
  online: boolean;
}

export const EXPERTS: Expert[] = [
  {
    id: 'e1',
    name: '吴孟超',
    title: '主任医师 · 教授',
    hospital: '上海东方肝胆外科医院',
    city: '上海',
    specialty: '肝胆外科 · 肝癌',
    relevantOrgans: ['liver'],
    relevantMeridians: ['liver'],
    relevantKeywords: ['肝癌', '肝硬化', '胆囊', '肝功能'],
    rating: 4.9,
    rating_count: 3421,
    next_slot: '明日 09:00',
    tags: ['三甲', '博导', '院士'],
    fee: '¥ 1,500',
    online: false,
  },
  {
    id: 'e2',
    name: '葛均波',
    title: '主任医师 · 教授',
    hospital: '复旦大学附属中山医院',
    city: '上海',
    specialty: '心内科 · 冠心病介入',
    relevantOrgans: ['heart'],
    relevantMeridians: ['heart'],
    relevantKeywords: ['冠心病', '心率', '血压', '心衰', '心律'],
    rating: 4.9,
    rating_count: 2876,
    next_slot: '周五 14:00',
    tags: ['三甲', '心脏介入', '院士'],
    fee: '¥ 1,200',
    online: true,
  },
  {
    id: 'e3',
    name: '黄晓军',
    title: '主任医师 · 教授',
    hospital: '北京大学人民医院',
    city: '北京',
    specialty: '血液科 · 造血干细胞移植',
    relevantOrgans: ['spleen'],
    relevantMeridians: ['spleen'],
    relevantKeywords: ['血液', '白血病', '免疫', '白细胞'],
    rating: 4.8,
    rating_count: 1987,
    next_slot: '下周一 10:30',
    tags: ['三甲', '博导'],
    fee: '¥ 1,000',
    online: true,
  },
  {
    id: 'e4',
    name: '林希平',
    title: '副主任医师',
    hospital: '华西医院',
    city: '成都',
    specialty: '内分泌科 · 糖尿病',
    relevantOrgans: ['kidneys', 'spleen'],
    relevantMeridians: ['spleen', 'kidney', 'stomach'],
    relevantKeywords: ['糖尿病', '血糖', '甲状腺', '代谢'],
    rating: 4.7,
    rating_count: 842,
    next_slot: '今日 16:30',
    tags: ['三甲', '代谢'],
    fee: '¥ 350',
    online: true,
  },
  {
    id: 'e5',
    name: '赵雅琳',
    title: '主治医师',
    hospital: '北京协和医院',
    city: '北京',
    specialty: '皮肤科 · 过敏性皮炎',
    relevantOrgans: ['lungs'],
    relevantMeridians: ['largeIntestine', 'lung'],
    relevantKeywords: ['皮肤', '过敏', '湿疹', '皮炎'],
    rating: 4.8,
    rating_count: 1234,
    next_slot: '明日 11:00',
    tags: ['三甲', '皮肤'],
    fee: '¥ 450',
    online: true,
  },
  {
    id: 'e6',
    name: '陈明远',
    title: '主任医师',
    hospital: '浙江大学医学院附属第一医院',
    city: '杭州',
    specialty: '神经内科 · 脑卒中',
    relevantOrgans: ['heart'],
    relevantMeridians: ['bladder'],
    relevantKeywords: ['脑卒中', '脑梗', '神经', '头晕'],
    rating: 4.8,
    rating_count: 1566,
    next_slot: '后日 09:30',
    tags: ['三甲', '脑科'],
    fee: '¥ 800',
    online: false,
  },
  {
    id: 'e7',
    name: '王辰',
    title: '主任医师 · 教授',
    hospital: '中日友好医院',
    city: '北京',
    specialty: '呼吸与危重症医学',
    relevantOrgans: ['lungs'],
    relevantMeridians: ['lung'],
    relevantKeywords: ['肺炎', '哮喘', 'COPD', '肺结节', '呼吸'],
    rating: 4.9,
    rating_count: 2103,
    next_slot: '周四 10:00',
    tags: ['三甲', '院士'],
    fee: '¥ 1,000',
    online: false,
  },
  {
    id: 'e8',
    name: '陈香美',
    title: '主任医师 · 教授',
    hospital: '解放军总医院',
    city: '北京',
    specialty: '肾内科 · 慢性肾病',
    relevantOrgans: ['kidneys'],
    relevantMeridians: ['kidney', 'bladder'],
    relevantKeywords: ['肾病', '蛋白尿', '肌酐', '肾衰', '透析'],
    rating: 4.9,
    rating_count: 1734,
    next_slot: '周六 09:00',
    tags: ['三甲', '院士'],
    fee: '¥ 1,200',
    online: true,
  },
  {
    id: 'e9',
    name: '张秀玲',
    title: '主任医师',
    hospital: '上海中医药大学附属曙光医院',
    city: '上海',
    specialty: '中医推拿 · 经络养生',
    relevantOrgans: ['spleen', 'liver'],
    relevantMeridians: ['spleen', 'stomach', 'liver', 'ren'],
    relevantKeywords: ['失眠', '亚健康', '推拿', '艾灸', '调理'],
    rating: 4.8,
    rating_count: 945,
    next_slot: '今日 15:00',
    tags: ['三甲', '中医'],
    fee: '¥ 400',
    online: true,
  },
  {
    id: 'e10',
    name: '孙思邈堂',
    title: '特聘中医师',
    hospital: '杭州胡庆余堂国药号',
    city: '杭州',
    specialty: '中医综合 · 针灸艾灸',
    relevantOrgans: ['heart', 'liver', 'spleen', 'lungs', 'kidneys'],
    relevantMeridians: ['lung', 'largeIntestine', 'stomach', 'spleen', 'heart', 'bladder', 'kidney', 'ren'],
    relevantKeywords: ['针灸', '艾灸', '经络', '穴位', '养生'],
    rating: 4.9,
    rating_count: 612,
    next_slot: '明日 14:00',
    tags: ['老字号', '中医'],
    fee: '¥ 500',
    online: false,
  },
];

/** 按脏腑 id 返回相关专家 */
export function expertsForOrgan(organId: string): Expert[] {
  return EXPERTS.filter((e) => e.relevantOrgans.includes(organId));
}

/** 按经络 id 返回相关专家 */
export function expertsForMeridian(meridianId: string): Expert[] {
  return EXPERTS.filter((e) => e.relevantMeridians.includes(meridianId));
}

/** 按关键词匹配专家 */
export function expertsForKeyword(keyword: string): Expert[] {
  return EXPERTS.filter((e) =>
    e.relevantKeywords.some((k) => k.includes(keyword) || keyword.includes(k)),
  );
}
