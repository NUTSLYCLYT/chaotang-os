/**
 * Evidence 证据契约（SSOT · 铁律2/13.2.4）
 *
 * 上传文件/锦衣卫情报 = **证据**,不是普通附件。每份证据自动分三维:
 *  ① evidenceType 证据类型(决定内容)
 *  ② deptAffinity 司归属(决定哪个司能用)
 *  ③ trust 可信度/来源(决定能不能直接用 —— Schneier 安全门)
 * 由 SourceAdapter 按「司归属 + 类型 + 可信度」取用,喂给 dept-agent 当真数据源(解铁律5)。
 */

import type { AgentCode } from './agent';

/** 证据类型 —— 跨上传/分类/取用三侧的单一枚举,禁平行表(铁律2)。 */
export type EvidenceType =
  | 'financial_statement' // 财报/科目余额
  | 'contract' // 合同/协议
  | 'legal_doc' // 法规/合规
  | 'market_data' // 行情/股价
  | 'intel' // 情报/竞品
  | 'spec' // 需求/技术文档
  | 'brand_asset' // 品牌/营销素材
  | 'health_doc' // 健康/医疗
  | 'other';

/** 可信度/来源 —— Schneier 安全门:pending/rejected 的证据**禁止**直接喂给司。 */
export type EvidenceTrust =
  | 'user_uploaded' // 用户上传:高信但未验,司用时须标"基于未核证据"
  | 'jinyiwei_pending' // 锦衣卫采集:**待可信度核查,不可直接用**(脏情报挡门外)
  | 'jinyiwei_verified' // 锦衣卫:已核查
  | 'jinyiwei_rejected' // 锦衣卫:确定性 vet 门判"拒"(脏情报),**禁止直接使用**
  | 'external_live'; // 外部 API:LIVE 实时

/** 三维分类结果。 */
export interface EvidenceClassification {
  evidenceType: EvidenceType;
  /** 哪些司能用这份证据(可多个)。 */
  deptAffinity: AgentCode[];
  trust: EvidenceTrust;
  /** 分类置信度 0-1(规则命中=高,LLM 兜底=中)。 */
  confidence: number;
  /** 分类依据(可审计)。 */
  rationale: string;
}

/**
 * 归档进史馆的一份证据。
 * 混合联邦架构(docs/数据架构-混合联邦-SoT.md):**原文永不上云**——
 * 原始敏感文件(财报/BOM/合同)客户端解析,服务端只存「脱敏洞见 + 分类 + 兑现」。
 */
export interface EvidenceRecord {
  id: string;
  uploaderId: string;
  /** 租户隔离(钦天监跨司综合踩在这上面;洞见上云必须 tenant-scoped)。 */
  tenantId: string;
  /** ISO 时间(由调用方传,本层不调 Date,可测)。 */
  uploadedAt: string;
  /** 文件名(低敏;真敏感可传 hash)。 */
  filename: string;
  /** **脱敏洞见**(结论/摘要,非原始数值)。客户端解析后只上传这个,原文留本地。 */
  insight: string;
  classification: EvidenceClassification;
  /** 不变式:原文是否留客户端(本架构恒为 true,守"原文永不上云")。 */
  rawStaysClient: true;
}

/** 司能不能直接用这份证据(可信度安全门)。 */
export function isUsableByDept(rec: EvidenceRecord, dept: AgentCode): boolean {
  // 待核/已拒的锦衣卫情报都挡门外——待核是"还没判完"，已拒是"判完了、是脏的"，
  // 两种都不能直接喂给司(2026-07-12 补 jinyiwei_rejected：后端 jinyiwei_evidence
  // 共享情报池的 vet 门判"拒"的记录不会出现在查询结果里，但契约上仍需要覆盖
  // 这个字面量，不能让它悄悄落进"deptAffinity 命中就算可用"的默认分支)。
  if (rec.classification.trust === 'jinyiwei_pending') return false;
  if (rec.classification.trust === 'jinyiwei_rejected') return false;
  return rec.classification.deptAffinity.includes(dept);
}
