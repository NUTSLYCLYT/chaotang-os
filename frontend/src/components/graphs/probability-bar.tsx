/**
 * ProbabilityBar — 多段概率条
 *
 * 用于展示情景分布（钦天监）或其他多段求和 = 1 的数据
 */

export interface ProbabilitySegment {
  label: string;
  probability: number;  // 0-1
  color: string;
  payoff?: string;
}

export interface ProbabilityBarProps {
  segments: ProbabilitySegment[];
  /** 是否显示标签行 */
  showLabels?: boolean;
  /** 高度 */
  height?: number;
}

export function ProbabilityBar({
  segments,
  showLabels = true,
  height = 12,
}: ProbabilityBarProps) {
  const total = segments.reduce((acc, s) => acc + s.probability, 0);
  const normalized = total > 0 ? segments.map((s) => ({ ...s, probability: s.probability / total })) : segments;

  return (
    <div className="w-full">
      {/* 条 */}
      <div
        className="flex w-full overflow-hidden rounded-full"
        style={{ height, backgroundColor: 'rgba(26, 33, 66, 0.8)' }}
      >
        {normalized.map((seg, i) => {
          const pct = seg.probability * 100;
          if (pct === 0) return null;
          return (
            <div
              key={i}
              className="relative"
              style={{
                width: `${pct}%`,
                backgroundColor: seg.color,
                boxShadow: `inset 0 0 10px ${seg.color}55`,
              }}
              title={`${seg.label} ${Math.round(pct)}%`}
            />
          );
        })}
      </div>

      {/* 标签行 */}
      {showLabels && (
        <div className="mt-2 space-y-1">
          {normalized.map((seg, i) => {
            const pct = Math.round(seg.probability * 100);
            return (
              <div key={i} className="flex items-center gap-2 text-[10px]">
                <span
                  className="inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: seg.color }}
                />
                <span className="flex-shrink-0 font-mono w-8" style={{ color: seg.color }}>
                  {pct}%
                </span>
                <span className="flex-1 text-[#EAEEFB]">{seg.label}</span>
                {seg.payoff && (
                  <span className="text-[#9AA3C4]">{seg.payoff}</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
