/**
 * xingbu-lens —— 刑部「溶进决策环」的合规透镜(铁律5:先溶进已有工位,不另起独立页)。
 *
 * 把刑部两个真引擎(clause-risk 条款扫描 + evidence-gate 缺证核查)合成一个
 * 决策环可直接调用的「刑部裁决」:供军机处会审作一道风控视角、奏折"风险/缺证"段、
 * 以及高危→人工确认门(needs_signoff)。
 *
 * 纯函数、零副作用、客户端可跑(原文不出浏览器,守混合架构)。
 * core 决策环只需一行调用本函数,把结果塞进会审/奏折——wiring 由 core 侧加(本件不碰 core)。
 */

import type { AgentCode } from '@/lib/contracts/agent';
import type { EvidenceRecord, EvidenceType } from '@/lib/contracts/evidence';
import { scanClauses } from './clause-risk';
import { checkEvidenceGate } from './evidence-gate';

export interface XingbuLensInput {
  /** 决策若涉及合同,传客户端解析后的条款文本。 */
  contractText?: string;
  /** 决策现有证据。 */
  evidence?: EvidenceRecord[];
  /** 本决策必备证据类型(缺证核查依据)。 */
  requiredEvidence?: EvidenceType[];
}

export interface XingbuVerdict {
  clauseVerdict: 'veto' | 'caution' | 'pass' | 'n/a';
  evidenceVerdict: 'pass' | 'reject' | 'n/a';
  /** 高危(条款 veto 或缺证 reject)→ 必须过人工确认门。 */
  needsSignoff: boolean;
  /** 供奏折"风险"段的一句话。 */
  summary: string;
  /** 关键风险点(条款风险 + 缺证)。 */
  flags: string[];
}

const XING_BU: AgentCode = 'xing_bu';

export function xingbuComplianceLens(input: XingbuLensInput): XingbuVerdict {
  const flags: string[] = [];

  // 1) 合同条款风险(若有合同)
  let clauseVerdict: XingbuVerdict['clauseVerdict'] = 'n/a';
  if (input.contractText && input.contractText.trim()) {
    const scan = scanClauses(input.contractText);
    clauseVerdict = scan.verdict;
    for (const r of scan.risks.filter((x) => x.severity === 'high')) {
      flags.push(`条款风险:${r.reason}${r.legalBasis ? `(${r.legalBasis.split(':')[0]})` : ''}`);
    }
  }

  // 2) 缺证核查(若指定了必备证据)
  let evidenceVerdict: XingbuVerdict['evidenceVerdict'] = 'n/a';
  if (input.requiredEvidence && input.requiredEvidence.length) {
    const gate = checkEvidenceGate(input.evidence ?? [], { required: input.requiredEvidence }, XING_BU);
    evidenceVerdict = gate.verdict;
    if (gate.missing.length) flags.push(`缺证:缺 ${gate.missing.join('、')}`);
  }

  const needsSignoff = clauseVerdict === 'veto' || evidenceVerdict === 'reject';
  const summary = needsSignoff
    ? `刑部:高风险,须人工/法务复核(${[clauseVerdict === 'veto' ? '条款一票否决' : '', evidenceVerdict === 'reject' ? '缺证打回' : ''].filter(Boolean).join('+')})。`
    : clauseVerdict === 'caution'
      ? '刑部:存在合同风险条款,建议逐条人工确认。'
      : flags.length === 0 && clauseVerdict === 'n/a' && evidenceVerdict === 'n/a'
        ? '刑部:本决策无合同/证据可审,未触发合规风险。'
        : '刑部:合规初审通过,建议人工抽查。';

  return { clauseVerdict, evidenceVerdict, needsSignoff, summary, flags };
}
