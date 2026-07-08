/**
 * 太医院 · 脏腑图谱数据
 *
 * 五脏六腑：心肝脾肺肾（core 5）+ 胃/大肠/小肠/膀胱/胆/三焦（supporting）
 * 状态值由后端 biomarker 聚合得出；此处 mock 展示。
 */

export type OrganStatus = 'stable' | 'watch' | 'alert';

export interface OrganMetric {
  label: string;
  value: string;
  status: OrganStatus;
}

export interface OrganInfo {
  id: string;
  nameCn: string;
  nameEn: string;
  /** SVG path / shape reference */
  shape: 'heart' | 'liver' | 'spleen' | 'lungs' | 'kidneys' | 'stomach' | 'intestine';
  /** Anchor point on body SVG (viewBox 0 0 300 600) */
  anchor: { x: number; y: number };
  status: OrganStatus;
  score: number;
  /** 现代医学功能 */
  functionWest: string;
  /** 中医视角功能 */
  functionTcm: string;
  /** 相关生物标志 */
  keyMetrics: OrganMetric[];
  /** 调养建议 */
  recommendations: string[];
}

export const STATUS_META: Record<OrganStatus, { color: string; label: string; glow: string }> = {
  stable: { color: '#34D399', label: '稳定', glow: 'rgba(52, 211, 153, 0.4)' },
  watch: { color: '#F5A524', label: '关注', glow: 'rgba(245, 165, 36, 0.45)' },
  alert: { color: '#F43F5E', label: '预警', glow: 'rgba(244, 63, 94, 0.5)' },
};

export const ORGAN_ATLAS: OrganInfo[] = [
  {
    id: 'heart',
    nameCn: '心',
    nameEn: 'Heart',
    shape: 'heart',
    anchor: { x: 150, y: 180 },
    status: 'stable',
    score: 86,
    functionWest: '泵血循环，维持全身氧合与营养输送。心率、血压、心律节奏是首要监护指标。',
    functionTcm: '主血脉、藏神。心气充则面色红润、神志清明；心血不足则失眠多梦、心悸健忘。',
    keyMetrics: [
      { label: '静息心率', value: '62 bpm', status: 'stable' },
      { label: '血压', value: '118/76', status: 'stable' },
      { label: 'HRV', value: '48 ms', status: 'stable' },
      { label: 'LDL-C', value: '2.4 mmol/L', status: 'stable' },
    ],
    recommendations: [
      '每周 3 次中等强度有氧 30 分钟，心率区间 60-70% HRmax',
      '冥想 10 分钟/日，降低交感张力',
      '每季度测一次血脂、复查心电图',
    ],
  },
  {
    id: 'lungs',
    nameCn: '肺',
    nameEn: 'Lungs',
    shape: 'lungs',
    anchor: { x: 150, y: 170 },
    status: 'watch',
    score: 74,
    functionWest: '气体交换，维持血氧饱和。肺活量与呼吸频率反映整体呼吸效率。',
    functionTcm: '主气、司呼吸，朝百脉。肺气虚则易感冒、气短，肺阴虚则干咳少痰。',
    keyMetrics: [
      { label: '血氧', value: '97%', status: 'stable' },
      { label: '肺活量', value: '3.8 L', status: 'watch' },
      { label: 'PEF', value: '520 L/min', status: 'stable' },
    ],
    recommendations: [
      '呼吸训练：4-7-8 法每日 5 组',
      '空气质量 AQI>100 减少户外运动',
      '建议补充 Vit D3 + 适量户外日照',
    ],
  },
  {
    id: 'liver',
    nameCn: '肝',
    nameEn: 'Liver',
    shape: 'liver',
    anchor: { x: 180, y: 270 },
    status: 'stable',
    score: 82,
    functionWest: '解毒、代谢、合成蛋白与胆汁。转氨酶（ALT/AST）是首要评估指标。',
    functionTcm: '主疏泄、藏血。肝气郁结易怒胁痛；肝血不足易头晕眼花、月事不调。',
    keyMetrics: [
      { label: 'ALT', value: '22 U/L', status: 'stable' },
      { label: 'AST', value: '19 U/L', status: 'stable' },
      { label: 'GGT', value: '28 U/L', status: 'stable' },
    ],
    recommendations: [
      '节制酒精：每周 ≤ 2 个标准单位',
      '避免长期熬夜（23:00 前入睡）',
      '每半年肝功能复查一次',
    ],
  },
  {
    id: 'spleen',
    nameCn: '脾',
    nameEn: 'Spleen',
    shape: 'spleen',
    anchor: { x: 115, y: 285 },
    status: 'watch',
    score: 71,
    functionWest: '免疫与血液过滤器官；中医"脾"含义更广，涵盖消化吸收功能。',
    functionTcm: '主运化、统血、主肌肉。脾虚则食少便溏、乏力、肌肉松弛，思虑过度伤脾。',
    keyMetrics: [
      { label: '消化指数', value: '78', status: 'watch' },
      { label: '肌肉量', value: '24.1 kg', status: 'stable' },
      { label: '白细胞', value: '5.6 ×10⁹', status: 'stable' },
    ],
    recommendations: [
      '规律三餐，少食生冷',
      '情绪管理：减少思虑，正念 5 分钟/日',
      '建议加入普拉提或太极，强化核心',
    ],
  },
  {
    id: 'kidneys',
    nameCn: '肾',
    nameEn: 'Kidneys',
    shape: 'kidneys',
    anchor: { x: 150, y: 340 },
    status: 'stable',
    score: 88,
    functionWest: '过滤血液、调节水电解质、分泌促红素。肌酐、尿素氮是核心指标。',
    functionTcm: '主藏精、主水、主纳气。肾为先天之本，肾精充则骨坚发荣、听觉敏锐。',
    keyMetrics: [
      { label: '肌酐', value: '78 μmol/L', status: 'stable' },
      { label: 'eGFR', value: '98', status: 'stable' },
      { label: '尿蛋白', value: '阴性', status: 'stable' },
    ],
    recommendations: [
      '每日饮水 1800-2400 ml，分次饮用',
      '限盐（<5g/日）',
      '避免长期高蛋白饮食与不必要的止痛药',
    ],
  },
];
