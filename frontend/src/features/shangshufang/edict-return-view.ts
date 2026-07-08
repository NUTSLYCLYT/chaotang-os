/**
 * 上书房 · 蜂群回奏 EdictView 持久化往返的纯转换层。
 *
 * 把"校验/重建 EdictView"逻辑从 route handler 与 4629 行 ShangshufangPage 里抽出,
 * 纯函数、无 @/ 运行时依赖(仅类型) → 可离线单测。
 * 接缝铁律(2026-06-20 会审):这两道都按字段重建 meta,任一漏字段 → blastRadius 等
 * 判红信号在持久化往返中被静默摔掉。改这里务必同步 edict-return-view.nodetest 的往返断言。
 */

import type { EdictView } from './edict-content';
import type { PersistedEdictReturnView, ShangshufangEdictReturn } from '@/lib/contracts/shangshufang';

type Dict = Record<string, unknown>;

function isRecord(value: unknown): value is Dict {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function readEdictString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeRows(value: unknown): PersistedEdictReturnView['rows'] | null {
  if (!Array.isArray(value)) return null;
  const rows = value
    .map((row) => {
      if (!isRecord(row)) return null;
      const label = readEdictString(row.label);
      const body = readEdictString(row.body);
      return label && body ? { label, body } : null;
    })
    .filter((row): row is PersistedEdictReturnView['rows'][number] => Boolean(row));
  return rows.length > 0 ? rows : null;
}

function normalizeBadges(
  value: unknown,
): NonNullable<NonNullable<PersistedEdictReturnView['meta']>['badges']> | undefined {
  if (!Array.isArray(value)) return undefined;
  const badges: NonNullable<NonNullable<PersistedEdictReturnView['meta']>['badges']> = [];
  for (const badge of value) {
    if (!isRecord(badge)) continue;
    const label = readEdictString(badge.label);
    if (!label) continue;
    const tone = readEdictString(badge.tone);
    const normalizedTone =
      tone === 'green' || tone === 'amber' || tone === 'red' || tone === 'blue' ? tone : undefined;
    badges.push(normalizedTone ? { label, tone: normalizedTone } : { label });
  }
  return badges.length > 0 ? badges : undefined;
}

/** 校验/重建客户端 POST 的 EdictView → 可持久化的 PersistedEdictReturnView(非法返回 null)。 */
export function normalizeEdictView(value: unknown): PersistedEdictReturnView | null {
  if (!isRecord(value)) return null;
  const id = readEdictString(value.id);
  const title = readEdictString(value.title);
  const rows = normalizeRows(value.rows);
  const seal = readEdictString(value.seal);
  if (!id || !title || !rows || !seal) return null;

  const meta = isRecord(value.meta) ? value.meta : {};
  return {
    id,
    title,
    subtitle: readEdictString(value.subtitle) ?? undefined,
    meta: {
      petitioner: readEdictString(meta.petitioner) ?? undefined,
      reporter: readEdictString(meta.reporter) ?? undefined,
      priority:
        meta.priority === 'urgent' || meta.priority === 'high' || meta.priority === 'medium' || meta.priority === 'low'
          ? meta.priority
          : undefined,
      // 持久化往返须保留 blastRadius,否则裁决责任徽/降级在回读后丢失判红信号(会审 live 验证)。
      blastRadius:
        meta.blastRadius === 'irreversible' || meta.blastRadius === 'external' || meta.blastRadius === 'internal'
          ? meta.blastRadius
          : undefined,
      badges: normalizeBadges(meta.badges),
    },
    rows,
    sealDate: readEdictString(value.sealDate) ?? undefined,
    seal,
  };
}

/** 读回的 PersistedEdictReturnView → 渲染用 EdictView(meta 整体带过,含 blastRadius)。 */
export function persistedEdictReturnToView(edictReturn: ShangshufangEdictReturn): EdictView {
  const view = edictReturn.edictView;
  const seal: EdictView['seal'] =
    view.seal === 'imperial' || view.seal === 'chancellor' || view.seal === 'tutorial' || view.seal === 'secret'
      ? view.seal
      : 'imperial';
  return {
    id: view.id,
    title: view.title.replace(/\s*·\s*残缺$/, ''),
    subtitle: view.subtitle,
    meta: view.meta,
    rows: view.rows,
    sealDate: view.sealDate,
    seal,
  };
}
