/**
 * 下旨分流：开创性(立项) vs 处置性(裁决)（2026-06-28）
 *
 * 架构决策"下旨=立项"的执行：只有**开创性下旨**(发起以前没有的事)诞生一个立项对象；
 * **处置性下旨**(处置既有事)是裁决，不生新立项。否则下旨=立项会被垃圾立项淹没。
 * 靠**动词确定性判**，不靠 AI 猜（Karpathy：一道旨自动走对管道）。纯函数。
 */

export type DecreeKind = 'initiate' | 'dispose' | 'ambiguous';

/** 开创性动词：发起一件以前没有的事 → 立项。 */
const INITIATE_VERBS = ['做', '开拓', '研发', '新建', '上马', '立项', '开发', '进军', '布局', '打造', '拓展', '开辟', '建设', '投产', '启动', '研制', '推出', '开干'];
/** 处置性动词：处置一件已有的事 → 裁决。 */
const DISPOSE_VERBS = ['准', '驳', '批', '回复', '复核', '采纳', '否决', '通过', '拒绝', '退回', '签', '付', '撤', '催', '核销', '审'];

export const DECREE_KIND_CN: Record<DecreeKind, string> = {
  initiate: '开创·立项',
  dispose: '处置·裁决',
  ambiguous: '不明·待澄清',
};

export interface DecreeClassification {
  kind: DecreeKind;
  matchedVerb: string | null;
  /** 开创性下旨才生立项对象。 */
  createsProject: boolean;
  reason: string;
}

/** 分流一道下旨：开创→立项 / 处置→裁决 / 都不命中或都命中→待澄清(不瞎归类)。 */
export function classifyDecree(command: string): DecreeClassification {
  const text = (command || '').replace(/\s/g, '');
  const initiate = INITIATE_VERBS.find((v) => text.includes(v)) ?? null;
  const dispose = DISPOSE_VERBS.find((v) => text.includes(v)) ?? null;

  // 都命中或都不命中 → 不瞎判(费曼:拿不准就说拿不准)
  if (initiate && dispose) {
    return { kind: 'ambiguous', matchedVerb: null, createsProject: false, reason: `同时含开创「${initiate}」和处置「${dispose}」动词，需澄清是发起新事还是处置既有` };
  }
  if (initiate) {
    return { kind: 'initiate', matchedVerb: initiate, createsProject: true, reason: `含开创动词「${initiate}」→ 发起新事，诞生一个立项对象` };
  }
  if (dispose) {
    return { kind: 'dispose', matchedVerb: dispose, createsProject: false, reason: `含处置动词「${dispose}」→ 处置既有事，是裁决不是新立项` };
  }
  return { kind: 'ambiguous', matchedVerb: null, createsProject: false, reason: '无明确开创/处置动词，需澄清意图' };
}
