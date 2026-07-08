/**
 * 下旨 → 咨询立项 桥接（2026-06-28）
 *
 * "下旨=立项"落地：一句下旨 → classifyDecree 分流 →
 *   - 开创性(做/开拓/研发) → 是立项 → extractDecisionFromText 抽字段 → 交户部裁决(写主库 tasks)
 *   - 处置性(准/驳/批)   → 是裁决 → 不建新立项(处置既有)
 *   - 待澄清            → 请说清是发起新事还是处置既有
 * 纯函数。咨询立项不触真产线资产(铁律9)；触真备料/报价时再升级转后端。
 */
import { classifyDecree, type DecreeClassification } from '@/core/courtos/decree-classifier';
import { extractDecisionFromText, type ExtractedDecision } from '@/features/hubu/lib/decision-extract';

export interface DecreeToProject {
  classification: DecreeClassification;
  /** 开创性下旨才诞生立项对象。 */
  isProject: boolean;
  /** 开创才抽字段；否则 null。 */
  extracted: ExtractedDecision | null;
  /** 一句人话反馈（给录入框显示）。 */
  feedback: string;
}

export function decreeToProject(command: string): DecreeToProject {
  const classification = classifyDecree(command);
  if (classification.kind === 'initiate') {
    return {
      classification,
      isProject: true,
      extracted: extractDecisionFromText(command),
      feedback: `开创·立项 — 含动词「${classification.matchedVerb}」，诞生立项，已抽字段，交户部裁决`,
    };
  }
  if (classification.kind === 'dispose') {
    return {
      classification,
      isProject: false,
      extracted: null,
      feedback: `处置·裁决 — 含动词「${classification.matchedVerb}」，这是处置既有事的裁决，不建新立项`,
    };
  }
  return {
    classification,
    isProject: false,
    extracted: null,
    feedback: '待澄清 — 请说清：是发起一件新事（立项），还是处置一件已有的事（裁决）？',
  };
}
