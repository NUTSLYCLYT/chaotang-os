/**
 * gongbu-spec-ingest —— 工部:H盘 PACK 规格文档 → 脱敏洞见(混合架构·原文不上云)。
 *
 * 铁律13.2 混合联邦:原始规格书/测试报告/技术协议在【客户端解析】(本函数吃已解析文本,
 * 调用方用 pdf.js/mammoth 在浏览器解析,原文永不上传)。本层只从文本抽【脱敏规格洞见】,
 * 产 EvidenceRecord(spec 类,deptAffinity=工部,rawStaysClient:true)。纯函数。
 *
 * 诚实:只抽结构化关键字段做摘要,不回吐全文;抽不到标缺,不编。
 */

import type { EvidenceRecord } from '@/lib/contracts/evidence';

export interface BatterySpecInsight {
  model?: string;
  capacity?: string;
  voltage?: string;
  tempRange?: string;
  cycleLife?: string;
  /** 脱敏摘要(上云只上这个;原文留客户端)。 */
  summary: string;
  /** 抽到的关键字段数(完整度/置信度依据)。 */
  fieldsFound: number;
}

const PATTERNS: Array<{ key: keyof BatterySpecInsight; re: RegExp }> = [
  { key: 'model', re: /(?:型号|Model)\s*[:：]?\s*([A-Za-z0-9][A-Za-z0-9\-./]{2,30})/ },
  { key: 'capacity', re: /(?:额定容量|标称容量|容量|Capacity)\s*[:：]?\s*([\d.]+\s*(?:Ah|mAh|kWh))/i },
  { key: 'voltage', re: /(?:标称电压|额定电压|电压|Voltage)\s*[:：]?\s*([\d.]+\s*V)/i },
  { key: 'tempRange', re: /(?:工作温度|温度范围|使用温度|Temp\w*)\s*[:：]?\s*(-?\d+\s*°?C?\s*[~～\-－至]\s*-?\d+\s*°?C)/i },
  { key: 'cycleLife', re: /(?:循环寿命|循环次数|Cycle\w*)\s*[:：]?\s*([≥>]?\s*[\d,]+\s*次?)/i },
];

/** 从【客户端已解析的规格文本】抽脱敏洞见。rawText 不被保存/上传。 */
export function extractBatterySpec(rawText: string): BatterySpecInsight {
  const text = (rawText ?? '').replace(/\s+/g, ' ');
  const out: BatterySpecInsight = { summary: '', fieldsFound: 0 };
  for (const { key, re } of PATTERNS) {
    const m = text.match(re);
    if (m) {
      (out[key] as string) = m[1].trim();
      out.fieldsFound += 1;
    }
  }
  const parts = [
    out.model && `型号 ${out.model}`,
    out.capacity && `容量 ${out.capacity}`,
    out.voltage && `电压 ${out.voltage}`,
    out.tempRange && `温度 ${out.tempRange}`,
    out.cycleLife && `循环 ${out.cycleLife}`,
  ].filter(Boolean);
  out.summary = parts.length ? parts.join(' · ') : '未抽到结构化规格字段(需人工核原文)';
  return out;
}

/**
 * 洞见 → spec 类证据(进证据管线)。原文不传:insight 只含脱敏摘要,rawStaysClient 恒 true。
 */
export function toSpecEvidence(
  insight: BatterySpecInsight,
  meta: { id: string; filename: string; tenantId: string; uploaderId: string; uploadedAt: string },
): EvidenceRecord {
  // 置信度按抽到字段数(0 字段=低,5 字段=高);≥3 视为可用规格
  const confidence = Math.min(1, insight.fieldsFound / 5);
  return {
    id: meta.id,
    uploaderId: meta.uploaderId,
    tenantId: meta.tenantId,
    uploadedAt: meta.uploadedAt,
    filename: meta.filename,
    insight: insight.summary, // 脱敏摘要,非原文
    classification: {
      evidenceType: 'spec',
      deptAffinity: ['gong_bu'],
      trust: 'user_uploaded',
      confidence,
      rationale: `规格文档客户端解析,抽到 ${insight.fieldsFound}/5 关键字段;原文留本地`,
    },
    rawStaysClient: true,
  };
}
