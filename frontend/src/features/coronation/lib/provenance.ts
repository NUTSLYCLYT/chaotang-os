/**
 * 假数据诚实层 · Provenance(MASTER_PLAN §0.2 / CORONATION_SPEC §2)
 *
 * 把上书房已落地的 sourceMode 泛化成全局原语:任何 mock/demo/fallback 数据,
 * UI 必须一眼可区分,禁止假数据冒充真实(real-loop 铁律的 UI 化)。
 *
 * 铁律:帝金 #F0C66A 仅 `real` 可用。其余一律用"非帝金"诚实色,从颜色层杜绝以假乱真。
 * 待办:稳定后提升为全局契约 `src/lib/contracts/provenance.ts`(SoT),并让设计系统统一消费。
 */

export type Provenance = 'real' | 'demo' | 'fallback' | 'unavailable';

export interface ProvenanceTreatment {
  /** 主色调(除 real 外一律非帝金) */
  color: string;
  /** 角标文案 */
  label: string;
  /** 是否在 UI 显式打标(real 不打标) */
  flagged: boolean;
}

export const PROVENANCE_TREATMENT: Record<Provenance, ProvenanceTreatment> = {
  real: { color: '#F0C66A', label: '真实', flagged: false }, // 帝金 · 真实专属
  demo: { color: '#9A8CC4', label: '演示', flagged: true }, // 静音紫 · 明显非金
  fallback: { color: '#7FA8A0', label: '兜底', flagged: true }, // 静音青 · 明显非金
  unavailable: { color: '#C2553D', label: '不可达', flagged: true }, // 朱砂红(已落地)
};

export function treatmentOf(p: Provenance): ProvenanceTreatment {
  return PROVENANCE_TREATMENT[p];
}

/** real 之外都要打标 */
export function isHonestlyFlagged(p: Provenance): boolean {
  return PROVENANCE_TREATMENT[p].flagged;
}
