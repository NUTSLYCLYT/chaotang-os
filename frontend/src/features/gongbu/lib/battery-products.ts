/**
 * battery-products —— 工部「BOM供应链司」真数据底座(对标户部 price-library)。
 *
 * 数据源:产品部内部参考数据(batterynew/knowledge/battery_prices.yaml,2026-04-01)。
 * 纯函数·零副作用。这是【参考目录底座】(电芯/PACK 规格与价格区间),不是产线计算。
 *
 * 铁律9 边界:真实 PACK sizing / 成本拆分 / 报价 = 后端 jiqun pack_rd 蜂群(:8081),
 * 本底座只供"查规格/比价/初筛选型",真活转后端。诚实:价格是区间参考,非锁定报价。
 */

export type CellChemistry = '磷酸铁锂电芯' | '三元锂电芯' | '钛酸锂电芯';

export interface BatteryCell {
  model: string;
  category: CellChemistry;
  capacity: string;
  voltage: string;
  tempRange: string;
  cycleLife: string;
  dischargeRate: string;
  energyDensity: string;
  /** 价格区间(元/只),参考非锁价。 */
  priceRange: string;
  moq: string;
  leadTime: string;
  note: string;
}

export interface PackSolution {
  name: string;
  config: string;
  voltage: string;
  capacity: string;
  bms?: string;
  /** PACK 级价格区间(元/Wh),参考非锁价。 */
  priceRange: string;
  note: string;
}

/** 电芯目录(产品部 2026-04-01 内部参考)。 */
export const BATTERY_CELLS: BatteryCell[] = [
  { model: 'LFP-40C-100Ah', category: '磷酸铁锂电芯', capacity: '100Ah', voltage: '3.2V', tempRange: '-40°C ~ 60°C', cycleLife: '≥3000次(常温),≥1500次(-20°C)', dischargeRate: '1C(常温),0.5C(-40°C)', energyDensity: '160Wh/kg', priceRange: '350-420元/只', moq: '1000只', leadTime: '6-8周', note: '低温王牌产品,-40°C放电保持率≥70%' },
  { model: 'LFP-25C-280Ah', category: '磷酸铁锂电芯', capacity: '280Ah', voltage: '3.2V', tempRange: '-25°C ~ 55°C', cycleLife: '≥4000次(常温)', dischargeRate: '1C', energyDensity: '170Wh/kg', priceRange: '780-850元/只', moq: '500只', leadTime: '4-6周', note: '储能标准品,性价比最优' },
  { model: 'NCM-40C-50Ah', category: '三元锂电芯', capacity: '50Ah', voltage: '3.7V', tempRange: '-40°C ~ 55°C', cycleLife: '≥2000次(常温),≥800次(-20°C)', dischargeRate: '2C(常温),1C(-40°C)', energyDensity: '230Wh/kg', priceRange: '280-340元/只', moq: '2000只', leadTime: '8-10周', note: '高能量密度低温方案,适合移动储能' },
  { model: 'LTO-50C-40Ah', category: '钛酸锂电芯', capacity: '40Ah', voltage: '2.3V', tempRange: '-50°C ~ 65°C', cycleLife: '≥10000次', dischargeRate: '5C(全温域)', energyDensity: '70Wh/kg', priceRange: '420-500元/只', moq: '500只', leadTime: '10-12周', note: '极寒场景首选,循环寿命最长,但能量密度低' },
];

/** PACK 方案目录(产品部内部参考;真实 sizing/报价走后端 pack_rd 蜂群)。 */
export const PACK_SOLUTIONS: PackSolution[] = [
  { name: '标准低温储能PACK', config: '1P280S (LFP-25C-280Ah)', voltage: '896V', capacity: '250kWh', bms: '自研BMS-V3(含自加热模块)', priceRange: '0.85-1.0元/Wh (PACK级)', note: '含PCS接口,支持并联扩容' },
  { name: '极寒移动储能PACK', config: '4P120S (LFP-40C-100Ah)', voltage: '384V', capacity: '128kWh', priceRange: '1.2-1.5元/Wh (PACK级)', note: '车载/方舱集成,含军标振动防护' },
  { name: '高能量密度低温PACK', config: '2P96S (NCM-40C-50Ah)', voltage: '355V', capacity: '35.5kWh', priceRange: '1.0-1.2元/Wh (PACK级)', note: '轻量化设计,适合AGV/无人机' },
];

export const BATTERY_DATA_SOURCE = '产品部内部参考数据 · 2026-04-01 · 价格为区间参考非锁定报价';

/** 按型号查电芯。 */
export function findCell(model: string): BatteryCell | undefined {
  return BATTERY_CELLS.find((c) => c.model === model);
}

/** 按化学体系筛电芯。 */
export function cellsByChemistry(category: CellChemistry): BatteryCell[] {
  return BATTERY_CELLS.filter((c) => c.category === category);
}

/** 解析温度下限(°C),用于低温选型(如要求 -40°C)。无法解析返回 null。 */
export function lowTempLimit(cell: BatteryCell): number | null {
  const m = cell.tempRange.match(/(-?\d+)°C/);
  return m ? Number(m[1]) : null;
}

/**
 * 低温选型初筛:给一个最低工作温度要求,返回能满足(温度下限 ≤ 要求)的电芯,按能量密度降序。
 * 这是"初筛/查规格",真实 PACK 配置与报价请转后端 pack_rd 蜂群。
 */
export function selectCellsForTemp(minTempC: number): BatteryCell[] {
  return BATTERY_CELLS.filter((c) => {
    const limit = lowTempLimit(c);
    return limit != null && limit <= minTempC;
  }).sort((a, b) => parseInt(b.energyDensity) - parseInt(a.energyDensity));
}
