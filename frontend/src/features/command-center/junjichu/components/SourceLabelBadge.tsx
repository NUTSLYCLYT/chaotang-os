import { sourceLabelTone } from '../model/source-label';
import type { JunjichuSourceLabel } from '../model/types';

export function SourceLabelBadge({ label }: { label: JunjichuSourceLabel }) {
  const tone = sourceLabelTone(label);
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-full border px-1.5 py-px text-[9px] font-semibold uppercase tracking-[0.12em]"
      style={{ color: tone.text, borderColor: tone.border, background: tone.background }}
    >
      {label}
    </span>
  );
}
