/**
 * 上书房·史馆旧案徽章 — 纯函数，可单测。
 *
 * 铁律4 回归断言锚点：空旧案（count=0）不挂徽章，
 * 防"0 条也挂徽章冒充有先例"。
 */

/**
 * 根据旧案数量返回徽章标签，或 null（不挂徽章）。
 * count <= 0 时返回 null，防空集合伪造"有引用先例"的视觉暗示。
 */
export function recallBadgeLabel(count: number): string | null {
  return count > 0 ? `引用旧案 ${count} 条` : null;
}
