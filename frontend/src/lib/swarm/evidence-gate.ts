/**
 * evidence-gate —— 刑部「缺证核查司」本命:证据链完整性核查 + 缺证打回。
 *
 * 跨司骨架复用(铁律2):直接吃 contracts/evidence 的 EvidenceRecord + isUsableByDept 安全门,
 * 不重定义证据类型。纯函数、零副作用。
 *
 * 职责:给定一个决策/合同要求的证据类型清单,核查现有证据——
 *   · 齐 & 可用 → present
 *   · 有但被安全门挡(jinyiwei_pending 脏情报) → blocked(仍记为未满足)
 *   · 没有 → missing
 * 缺任一必备 → verdict=reject(缺证打回,决策环不得放行)。
 */

import type { AgentCode } from '@/lib/contracts/agent';
import { isUsableByDept, type EvidenceRecord, type EvidenceType } from '@/lib/contracts/evidence';

export interface EvidenceGateSpec {
  /** 本决策/合同必备的证据类型。 */
  required: EvidenceType[];
}

export interface EvidenceGateResult {
  present: EvidenceType[];
  missing: EvidenceType[];
  blocked: Array<{ type: EvidenceType; reason: string }>;
  verdict: 'pass' | 'reject';
  rationale: string;
}

/**
 * @param records 本租户已归档证据
 * @param spec 必备证据类型
 * @param dept 以哪个司视角核查可用性(默认刑部)
 */
export function checkEvidenceGate(
  records: EvidenceRecord[],
  spec: EvidenceGateSpec,
  dept: AgentCode = 'xing_bu',
): EvidenceGateResult {
  const present: EvidenceType[] = [];
  const missing: EvidenceType[] = [];
  const blocked: Array<{ type: EvidenceType; reason: string }> = [];

  for (const type of spec.required) {
    const ofType = records.filter((r) => r.classification.evidenceType === type);
    if (ofType.some((r) => isUsableByDept(r, dept))) {
      present.push(type);
      continue;
    }
    // 有该类证据但全被安全门挡(脏情报)→ blocked + 未满足
    if (ofType.some((r) => r.classification.trust === 'jinyiwei_pending')) {
      blocked.push({ type, reason: '该类证据存在,但属锦衣卫待核(脏情报),安全门挡下,不得直接采信' });
    }
    missing.push(type);
  }

  const verdict: EvidenceGateResult['verdict'] = missing.length === 0 ? 'pass' : 'reject';
  const rationale =
    verdict === 'pass'
      ? `必备证据 ${spec.required.length} 类齐备且通过安全门,准予放行。`
      : `缺 ${missing.length} 类必备证据${blocked.length ? `(其中 ${blocked.length} 类被安全门挡)` : ''},缺证打回,补齐前不得放行。`;

  return { present, missing, blocked, verdict, rationale };
}
