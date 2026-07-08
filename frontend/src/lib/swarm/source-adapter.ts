/**
 * SourceAdapter —— 把归档的证据,按「司归属 + 可信度安全门」取出,组成 dept-agent 的真数据上下文。
 * 接通输入端(上传/归档的证据)与输出端(dept-agent 研判 → 可下载报告)。
 *
 * 安全门(Schneier):trust='jinyiwei_pending' 的脏情报**永不进上下文**(isUsableByDept 拦)。
 * 诚实(铁律2):用到 user_uploaded(未核)证据 → 标 hasUnverified,报告须注明"基于未核证据"。
 */

import type { AgentCode } from '@/lib/contracts/agent';
import { isUsableByDept, type EvidenceRecord } from '@/lib/contracts/evidence';
import type { RealityState } from '@/lib/reality/reality-state';

export interface DeptContext {
  /** 喂给 dept-agent 的 context 串(逐条真证据)。 */
  context: string;
  /** 来源标(铁律2):有可用真证据=real;无=missing。 */
  sourceLabel: RealityState;
  /** 用到的证据 id(可溯源)。 */
  usedIds: string[];
  /** 是否含未核证据(user_uploaded)→ 报告须标"基于未核证据"。 */
  hasUnverified: boolean;
}

/**
 * 取某司可用的证据,组成上下文。
 * @param dept 目标司
 * @param evidence 史馆里这租户的证据集合(调用方按 tenant 过滤后传入)
 * @param maxItems 上下文证据条数上限(控 token)
 */
export function buildContextForDept(
  dept: AgentCode,
  evidence: EvidenceRecord[],
  maxItems = 12,
): DeptContext {
  const usable = evidence.filter((e) => isUsableByDept(e, dept)).slice(0, maxItems);

  if (usable.length === 0) {
    return {
      context: '（无可用真证据:请在对话处上传相关材料,或等锦衣卫情报核查通过。）',
      sourceLabel: 'missing',
      usedIds: [],
      hasUnverified: false,
    };
  }

  const hasUnverified = usable.some((e) => e.classification.trust === 'user_uploaded');
  const lines = usable.map((e) => {
    const verifyTag =
      e.classification.trust === 'user_uploaded'
        ? '〔未核〕'
        : e.classification.trust === 'external_live'
          ? '〔LIVE〕'
          : '〔已核〕';
    return `- ${verifyTag}【${e.classification.evidenceType}】${e.filename}:${e.insight}`;
  });

  return {
    context:
      (hasUnverified ? '注意:以下含用户上传的未核证据,结论须注明「基于未核证据」。\n' : '') +
      lines.join('\n'),
    sourceLabel: 'real',
    usedIds: usable.map((e) => e.id),
    hasUnverified,
  };
}
