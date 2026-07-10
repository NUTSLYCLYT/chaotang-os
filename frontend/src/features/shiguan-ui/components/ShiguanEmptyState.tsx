import { ShiguanSourceBadge } from './ShiguanSourceBadge';
import type { ShiguanSourceLabel } from '../lib/shiguan-source';

export function ShiguanEmptyState({
  title,
  body,
  sourceLabel = 'FALLBACK',
}: {
  title: string;
  body: string;
  sourceLabel?: ShiguanSourceLabel;
}) {
  return (
    <div className="rounded-xl border border-gold-300/12 bg-black/20 px-3 py-4">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[12px] font-semibold text-jade-100">{title}</div>
        <ShiguanSourceBadge sourceLabel={sourceLabel} />
      </div>
      <p className="mt-2 text-[11px] leading-5 text-slatey-300">{body}</p>
    </div>
  );
}
