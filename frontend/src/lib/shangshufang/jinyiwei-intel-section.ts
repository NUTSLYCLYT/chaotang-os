/**
 * 锦衣卫采证段 · 挂进回奏卷轴
 *
 * 7 步闭环的「锦衣卫采证」这一节点：把 retrieveContext(读 intel_signals 情报库)的召回结果，
 * 作为一个「锦衣卫」department_memorial + evidence_chain 挂进户部回奏 memorial，让卷轴自动渲染。
 *
 * 诚实缺证纪律(用户选定 v1)：情报库有相关记录 → 采得情报进证据链；无相关记录 → 不伪造，
 * 明确标「采证缺失」进 missing_evidence，户部核算据此标注不确定性。
 *
 * 纯函数、不可变：返回新 memorial，不改入参。source_label 一律继承 memorial 的信封源
 * (buildLiveMemorial 的「全字段同源」不变量，采证段不得破坏)。
 */
import type { ShangshufangReviewMemorial } from '@/lib/jiqun-api';

/** retrieveContext 的召回形状(只取采证要用的字段)。 */
export interface JinyiweiIntel {
  tavilyCitations: Array<{ url?: string; title: string; snippet?: string }>;
}

const JINYIWEI = '锦衣卫';

export function attachJinyiweiIntelSection(
  memorial: ShangshufangReviewMemorial,
  intel: JinyiweiIntel,
): ShangshufangReviewMemorial {
  const src = memorial.source_label;
  const hits = intel.tavilyCitations ?? [];
  const hasIntel = hits.length > 0;

  const opinion = hasIntel
    ? `锦衣卫采得 ${hits.length} 条相关情报，供户部核算垫证：\n${hits
        .map((h) => `· ${h.title}`)
        .join('\n')}`
    : '锦衣卫遍查情报库，未见本议题相关记录 —— 采证缺失。户部核算须据此标注不确定性，不得凭空推断。';

  // 证据链：采得的情报进链(诚实标源，可信度 unknown —— 情报可信度不硬编码，见锦衣卫纪律)。
  const intelEvidence = hits.map((h, i) => ({
    schema_version: 'EvidenceItemV1' as const,
    id: `jinyiwei-intel-${i}`,
    label: h.title,
    summary: h.snippet ?? h.title,
    reliability: 'unknown' as const,
    source_label: src,
  }));

  // 锦衣卫作为一个部门回奏挂进 department_memorials(卷轴按部名自动渲染)。
  const jinyiweiDept: NonNullable<ShangshufangReviewMemorial['department_memorials']>[number] = {
    schema_version: 'DepartmentOpinionV1',
    task_id: memorial.task_id ?? '',
    department_id: JINYIWEI,
    signal: hasIntel ? 'GREEN' : 'GRAY',
    verdict: hasIntel ? 'APPROVE' : 'NEED_EVIDENCE',
    summary: opinion,
    evidence: intelEvidence,
    missing_evidence: hasIntel ? [] : ['情报库无本议题相关记录，需授权锦衣卫外出侦查采证'],
    risks: [],
    next_order: hasIntel ? '交户部据情报核算' : '授权锦衣卫侦查后再核算',
    human_confirmation_required: false,
    source_label: src,
  };

  const missingLine = hasIntel ? [] : ['锦衣卫采证：情报库无本议题相关记录'];

  return {
    ...memorial,
    department_memorials: [jinyiweiDept, ...(memorial.department_memorials ?? [])],
    ministry_outputs: [
      {
        department: JINYIWEI,
        focus: '情报采证',
        opinion,
        status: hasIntel ? '已采证' : '缺证',
        source_label: src,
      },
      ...(memorial.ministry_outputs ?? []),
    ],
    evidence_chain: [...intelEvidence, ...(memorial.evidence_chain ?? [])],
    missing_evidence: [...missingLine, ...(memorial.missing_evidence ?? [])],
    evidence_gaps: [...missingLine, ...(memorial.evidence_gaps ?? [])],
  };
}
