/**
 * 东宫 · 反事实奏折信任标注（改造③ · 大神会审 2026-06-03）
 *
 * 大神红线（张一鸣 / Sam Altman）：rule/骨架兜底期的奏折若不明示来源，就是
 * "瞎子给瞎子写体检报告"——看起来可信的假体检，反而加速信任透支。
 * 修正：奏折每条结论携带来源，非确认的智能判断（rule / unknown）必须打"非智能判断"水印。
 *
 * source 是【运行期标注】，随奏折携带、由 UI 渲染，**不入契约 SoT**（memorial.ts 受 SoT 保护，
 * 且来源是 BFF/后端响应的运行期事实，不是稳定数据形状）。来源取自上游 `decree/draft` 的
 * `source` 字段（实测 rule 期返回 `source:'rule'`，见 tests/swarm-eval/FINDINGS.md）。
 * 闭环部分（execute 级动作留影子记录 + 事后实际损益回灌打分）属后端审计副产物，本模块不含，
 * 见 docs/东宫-人机权力边界-会审与北极星.md 改造③·闭环。
 */

/** 奏折来源：llm=真实智能推理；rule=规则/骨架兜底；unknown=未标注。 */
export type MemorialSource = 'rule' | 'llm' | 'unknown';

/** UI 水印文案：rule/未知来源的奏折统一提示人工复核。 */
export const RULE_FALLBACK_NOTICE =
  '⚠ 规则生成 · 非智能判断 · 请人工复核（底层大脑未接通时的兜底输出）';

/** 是否需要"非智能判断"水印：只有确认为 'llm' 才不提示。 */
export function memorialNeedsTrustWarning(source: MemorialSource): boolean {
  return source !== 'llm';
}

/** 渲染用：需要则返回水印文案，否则 null。 */
export function memorialTrustBanner(source: MemorialSource): string | null {
  return memorialNeedsTrustWarning(source) ? RULE_FALLBACK_NOTICE : null;
}

/** 把上游响应的 source 字段（如 decree/draft 的 data.source）归一化为 MemorialSource。 */
export function normalizeMemorialSource(raw: unknown): MemorialSource {
  return raw === 'llm' ? 'llm' : raw === 'rule' ? 'rule' : 'unknown';
}
