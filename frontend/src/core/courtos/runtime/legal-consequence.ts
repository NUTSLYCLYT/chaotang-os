/**
 * 刑部命门 · 后果性法律字段分类(纯逻辑,可测) · 2026-06-22
 *
 * 这是刑部比吏部多的唯一一道门(GONGBU_DESIGN §13.2#5 / §8.7 高风险)。
 * 对标工部 stripProductionFields,但**关键差异:刑部不剥离 body**——
 * 法律意见的内容可读供老板研判;但**后果性结论(违约金/独家/诉讼/对外立场)禁一键采纳**,
 * 必须过人工确认门(humanConfirmationRequired)。AI 不给法律意见盖章(§13.2#5)。
 *
 * fail-secure(Schneier):字段在后果白名单 OR 内容命中高危词 → 锁。拿不准默认锁,绝不静默放行。
 * worst-wins:整卡 blastRadius 取所有锁字段里最严的(irreversible > external > internal)。
 * BlastRadius 类型从 gate.ts import(type-only,运行时剥离,nodetest 安全)——SSOT,不重定义。
 */
import type { BlastRadius } from '@/features/governance/lib/gate';

/** 后果性字段白名单(flow_legal 真实输出键)——这些字段藏对外/不可逆法律立场。 */
const CONSEQUENTIAL_FIELDS = ['核心条款建议', '法务决策建议', '争议与执行方案'];

/** 内容级高危词:即便字段名是"清单/结论",命中即升级为锁(防 flow_legal 换字段名绕过)。 */
const LOCK_MARKERS = [
  '违约金', '独家', '排他', '知识产权', '著作权', '专利', '商业秘密', '归属',
  '对外', '外发', '发函', '律师函', '起诉', '仲裁', '应诉', '诉讼',
  '付款', '预付款', '保证金', '签署', '盖章', '报价', '赔偿',
];

/** 不可逆级:诉讼/签署/发函=做了撤不回的对外动作。 */
const IRREVERSIBLE_MARKERS = ['起诉', '仲裁', '应诉', '诉讼', '发函', '律师函', '签署', '盖章'];

function hits(body: string, markers: string[]): string[] {
  return markers.filter((m) => body.includes(m));
}
function isConsequentialField(field: string): boolean {
  return CONSEQUENTIAL_FIELDS.some((f) => field.includes(f));
}

export interface LegalFieldGate {
  field: string;
  body: string;
  /** true = 禁一键采纳,必走人工确认门 */
  humanConfirmationRequired: boolean;
  blastRadius: BlastRadius;
  /** 触发原因(后果字段名 / 命中的高危词),供 UI/审计显示 */
  triggers: string[];
}

/** 单字段判定(纯函数,fail-secure)。 */
export function gateLegalField(field: string, body: string): LegalFieldGate {
  const markerHits = hits(body, LOCK_MARKERS);
  const consequential = isConsequentialField(field) || markerHits.length > 0;
  const irreversible = hits(body, IRREVERSIBLE_MARKERS).length > 0;
  const blastRadius: BlastRadius = irreversible ? 'irreversible' : consequential ? 'external' : 'internal';
  return {
    field,
    body,
    humanConfirmationRequired: consequential,
    blastRadius,
    triggers: [
      ...(isConsequentialField(field) ? [`后果字段:${field}`] : []),
      ...markerHits.map((h) => `高危词:${h}`),
    ],
  };
}

const BLAST_ORDER: BlastRadius[] = ['internal', 'external', 'irreversible'];
function worseBlast(a: BlastRadius, b: BlastRadius): BlastRadius {
  return BLAST_ORDER.indexOf(a) >= BLAST_ORDER.indexOf(b) ? a : b;
}

export interface ClassifiedLegalOutput {
  /** 定性字段(可直接渲染供研判) */
  consult: Record<string, string>;
  /** 后果性字段(body 仍带、可读,但标 humanConfirmationRequired,禁一键采纳) */
  consequentialFields: LegalFieldGate[];
  /** ★顶层单点裁决(Russell):任一锁 → true,整卡禁一键采纳。后端算,前端无裁量。 */
  humanConfirmationRequired: boolean;
  /** ★worst-wins:整卡爆炸半径 */
  blastRadius: BlastRadius;
  triggers: string[];
}

/** 把 flow_legal 整包产出分成"放行 consult"与"后果性需确认",并折叠顶层裁决。 */
export function classifyLegalOutput(
  finalOutput: Record<string, unknown> | null | undefined,
): ClassifiedLegalOutput {
  const consult: Record<string, string> = {};
  const consequentialFields: LegalFieldGate[] = [];
  let humanConfirmationRequired = false;
  let blastRadius: BlastRadius = 'internal';
  const triggers: string[] = [];
  if (!finalOutput || typeof finalOutput !== 'object') {
    return { consult, consequentialFields, humanConfirmationRequired, blastRadius, triggers };
  }
  for (const [field, raw] of Object.entries(finalOutput)) {
    const body = typeof raw === 'string' ? raw : JSON.stringify(raw);
    const gate = gateLegalField(field, body);
    if (gate.humanConfirmationRequired) {
      consequentialFields.push(gate);
      humanConfirmationRequired = true;
      blastRadius = worseBlast(blastRadius, gate.blastRadius);
      triggers.push(...gate.triggers);
    } else {
      consult[field] = body;
    }
  }
  return {
    consult,
    consequentialFields,
    humanConfirmationRequired,
    blastRadius,
    triggers: [...new Set(triggers)],
  };
}
