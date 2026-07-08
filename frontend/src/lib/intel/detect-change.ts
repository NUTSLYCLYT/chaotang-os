/**
 * 锦衣卫 · 异动雷达(detect_change 的 TypeScript 移植)
 *
 * 源:`~/.claude/skills/锦衣卫/scripts/intel.py::detect_change`。纯确定性 diff,零 LLM。
 * 对比上一轮 vs 本轮情报,产出「新增/消失/突变/持续」。突变优先比数值字段(如 impact_score,
 * 环比变化超过 valueThr 判突变);没有可比数值时,退化为比 level 是否变化(同 id 但级别变了
 * 也算突变)。不生搬硬套 Python 版必须有的字段——这里按 intel_signals 表实际结构(id/impact_score/
 * level)定字段,语义对齐,不强求 Python 侧的 key/value 形状。
 */

export interface IntelChangeItem {
  /** 情报唯一标识(intel_signals.id) */
  key: string;
  /** 可比数值(如 impact_score);没有则退化用 level 判突变 */
  value?: number | null;
  /** 情报级别(如 IntelLevel);value 缺失或未过阈值时用它判突变 */
  level?: string | null;
}

export interface IntelSurgeEntry {
  key: string;
  /** 数值变化量;由 level 变化触发时为 null(无可比数值) */
  delta: number | null;
  from: number | string;
  to: number | string;
  reason: 'value' | 'level';
}

export interface IntelChangeResult {
  新增: string[];
  消失: string[];
  突变: IntelSurgeEntry[];
  持续: string[];
}

/**
 * 对比上一轮(prevItems) vs 本轮(currItems),返回新增/消失/突变/持续。
 * @param valueThr 数值突变阈值(绝对值),默认 20 —— 对齐 impact_score 0-100 量级下的显著跳变。
 */
export function detectChange(
  prevItems: readonly IntelChangeItem[],
  currItems: readonly IntelChangeItem[],
  valueThr = 20,
): IntelChangeResult {
  const prev = new Map(prevItems.map((it) => [it.key, it]));
  const curr = new Map(currItems.map((it) => [it.key, it]));

  const 新增 = [...curr.keys()].filter((k) => !prev.has(k));
  const 消失 = [...prev.keys()].filter((k) => !curr.has(k));

  const 突变: IntelSurgeEntry[] = [];
  for (const [key, c] of curr) {
    const p = prev.get(key);
    if (!p) continue;

    if (typeof p.value === 'number' && typeof c.value === 'number') {
      const delta = c.value - p.value;
      if (Math.abs(delta) > valueThr) {
        突变.push({ key, delta, from: p.value, to: c.value, reason: 'value' });
        continue;
      }
    }

    if (p.level && c.level && p.level !== c.level) {
      突变.push({ key, delta: null, from: p.level, to: c.level, reason: 'level' });
    }
  }

  const surgedKeys = new Set(突变.map((s) => s.key));
  const 持续 = [...curr.keys()].filter((k) => prev.has(k) && !surgedKeys.has(k));

  return { 新增, 消失, 突变, 持续 };
}
