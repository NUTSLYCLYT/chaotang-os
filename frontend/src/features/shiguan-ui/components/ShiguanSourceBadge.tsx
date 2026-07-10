import { sourceLabelText, type ShiguanSourceLabel } from '../lib/shiguan-source';

const tone: Record<ShiguanSourceLabel, string> = {
  LIVE: 'border-emerald-400/35 bg-emerald-400/10 text-emerald-100',
  MIXED: 'border-gold-300/35 bg-gold-300/10 text-gold-100',
  FALLBACK: 'border-slatey-400/30 bg-slatey-400/10 text-slatey-300',
  DEMO: 'border-violet-400/30 bg-violet-400/10 text-violet-200',
};

export function ShiguanSourceBadge({ sourceLabel }: { sourceLabel: ShiguanSourceLabel }) {
  return (
    <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[9px] leading-none ${tone[sourceLabel]}`}>
      {sourceLabelText(sourceLabel)}
    </span>
  );
}
