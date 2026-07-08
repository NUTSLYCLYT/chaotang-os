'use client';

/**
 * ProvenanceBadge — 假数据诚实层的可视角标(MASTER_PLAN §0.2)。
 * real 不打标;demo/fallback/unavailable 各显专属"非帝金"色 + 文案。克制(小药丸),不杀魔法。
 */

import type { Provenance } from '../lib/provenance';
import { treatmentOf } from '../lib/provenance';

export function ProvenanceBadge({
  provenance,
  className,
}: {
  provenance: Provenance;
  className?: string;
}) {
  const t = treatmentOf(provenance);
  if (!t.flagged) return null;
  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '1px 6px',
        fontSize: 10,
        lineHeight: 1.4,
        letterSpacing: '0.08em',
        borderRadius: 999,
        color: t.color,
        border: `1px solid ${t.color}66`,
        background: `${t.color}14`,
      }}
    >
      <span style={{ width: 5, height: 5, borderRadius: 999, background: t.color }} />
      {t.label}
    </span>
  );
}
