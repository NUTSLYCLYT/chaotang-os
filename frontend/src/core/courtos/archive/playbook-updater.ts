/**
 * PlaybookUpdater（V3 Prompt 8，原则 10：史馆必须形成复利）。
 * 把一次归档决策提炼成"下次同类问题更准"的 Playbook 规则。
 * 纯函数 + mock 输入；不接真实存储，不改既有 archive-store（additive）。
 */
import type { SourceLabel } from '../types.ts';

export type MinistrySignal = 'GREEN' | 'YELLOW' | 'RED' | 'GRAY';

export interface ArchivedDecisionSummary {
  id: string;
  topic?: string;
  ministrySignals?: Record<string, MinistrySignal>;
  riskTriggers?: string[];
  missingEvidence?: string[];
  userAction?: 'accept' | 'reject' | 'request_evidence' | 'recheck' | 'follow_up';
  rejectReason?: string;
  usedSecretEdict?: boolean;
  sourceLabel: SourceLabel;
}

export interface PlaybookUpdate {
  rule: string;
  appliesWhen: string;
  nextTimeBehavior: string;
  sourceLabel: SourceLabel;
}

export function buildPlaybookUpdate(record: ArchivedDecisionSummary): PlaybookUpdate[] {
  const out: PlaybookUpdate[] = [];
  const sl = record.sourceLabel;
  const triggers = new Set(record.riskTriggers ?? []);
  const missing = record.missingEvidence ?? [];
  const topic = record.topic ?? '';

  // 1. 刑部因 股权+独家/预付款 红灯 → 下次该组合默认刑部红灯
  if (record.ministrySignals?.justice === 'RED' && triggers.has('股权') && (triggers.has('独家') || triggers.has('预付款'))) {
    out.push({ rule: 'justice_red_combo', appliesWhen: '股权 + 独家/预付款', nextTimeBehavior: '下次出现该组合，刑部默认红灯 + 提前人工确认。', sourceLabel: sl });
  }
  // 2. 户部缺 ROI / 黄灯 → 合作/投资类下次提前要 ROI
  if ((missing.some((e) => /ROI/.test(e)) || record.ministrySignals?.finance === 'YELLOW') && /合作|投资/.test(topic)) {
    out.push({ rule: 'finance_roi_early', appliesWhen: '合作/投资类问题', nextTimeBehavior: '下次提前要求 ROI 假设与最坏情况。', sourceLabel: sl });
  }
  // 2b. 兵部正式报价未放行 → 下次先走报价前检查清单
  if ((record.ministrySignals?.war === 'RED' || record.ministrySignals?.war === 'YELLOW') && /正式报价|报价单|发报价|客户.*报价/.test(topic)) {
    out.push({ rule: 'war_quote_readiness_gate', appliesWhen: '正式报价/客户催报价', nextTimeBehavior: '下次先生成客户安全回复和报价前检查清单，并联动户部、刑部复核。', sourceLabel: sl });
  }
  // 2c. 兵部缺客户意图/决策链/预算 → 下次先补商机证据
  if (record.ministrySignals?.war === 'YELLOW' && missing.some((e) => /客户意图|决策链|预算|采购|负责人|owner|Owner/i.test(e))) {
    out.push({ rule: 'war_opportunity_evidence_early', appliesWhen: '客户推进/商机评估', nextTimeBehavior: '下次先确认客户意图、决策链、预算来源和销售 owner。', sourceLabel: sl });
  }
  // 2d. 竞品相关话术 → 下次先证据核验 + 礼部/刑部复核
  if (/竞品|竞争对手|对手/.test(topic) || [...triggers].some((t) => /竞品|贬低|攻击/.test(t))) {
    out.push({ rule: 'war_competitor_claim_review', appliesWhen: '竞品比较/竞争回应', nextTimeBehavior: '下次先要求事实证据，联动锦衣卫、礼部和刑部，禁止无证据攻击。', sourceLabel: sl });
  }
  // 3. 工部缺 BOM → 交付类下次先要 BOM
  if (missing.some((e) => /BOM/.test(e))) {
    out.push({ rule: 'works_bom_early', appliesWhen: '交付类问题', nextTimeBehavior: '下次先要求 BOM 与交期。', sourceLabel: sl });
  }
  // 3b. 工部缺验收标准/测试计划 → 下次先定义验收边界
  if (missing.some((e) => /验收|测试计划|验收标准/.test(e))) {
    out.push({ rule: 'works_acceptance_early', appliesWhen: '交付/上线/验收类问题', nextTimeBehavior: '下次先要求验收标准、测试计划和交付完成定义。', sourceLabel: sl });
  }
  // 3c. 固定交期/交付承诺风险 → 下次默认工部质门 + 刑部复核
  if (record.ministrySignals?.works === 'RED' && [...triggers].some((t) => /固定交期|交付承诺|30天交付|一定交付|供应商锁定/.test(t))) {
    out.push({ rule: 'works_delivery_commitment_gate', appliesWhen: '固定交期/交付承诺/供应商锁定', nextTimeBehavior: '下次先过工部交付质门，禁止对外承诺，并触发刑部复核。', sourceLabel: sl });
  }
  // 4. 礼部保证收益话术阻断 → 下次自动提示禁止表达
  if (record.ministrySignals?.ritual === 'RED' && [...triggers].some((t) => /保证收益/.test(t))) {
    out.push({ rule: 'ritual_guarantee_banned', appliesWhen: '对外话术含保证收益', nextTimeBehavior: '下次自动标记禁止表达。', sourceLabel: sl });
  }
  // 5. 用户驳回"太泛" → 下次报告更具体
  if (record.userAction === 'reject' && record.rejectReason === '太泛') {
    out.push({ rule: 'report_more_specific', appliesWhen: '用户驳回太泛', nextTimeBehavior: '下次报告给更具体的责任人与下一步。', sourceLabel: sl });
  }
  // 6. 用密旨预研 → 合作类下次默认提供"转密旨"选项
  if (record.usedSecretEdict && /合作/.test(topic)) {
    out.push({ rule: 'offer_secret_edict', appliesWhen: '合作类问题', nextTimeBehavior: '下次默认提供"转密旨预研"选项。', sourceLabel: sl });
  }
  return out;
}
