/**
 * TimelineRail — 通用时间轴组件
 *
 * 支持水平和垂直，用于事件流、情报时间线、干预计划等
 */

export type TimelineItemKind = 'event' | 'milestone' | 'window';
export type TimelineTone = 'neutral' | 'progress' | 'success' | 'warning' | 'danger';

export interface TimelineItem {
  id: string;
  timestamp: string;
  label: string;
  description?: string;
  kind?: TimelineItemKind;
  tone?: TimelineTone;
}

export interface TimelineRailProps {
  items: TimelineItem[];
  orientation?: 'horizontal' | 'vertical';
  /** 可选 click 回调 */
  onItemClick?: (id: string) => void;
  selectedId?: string | null;
}

const TONE_COLOR: Record<TimelineTone, string> = {
  neutral: '#9AA3C4',
  progress: '#60A5FA',
  success: '#3DD68C',
  warning: '#F5A524',
  danger: '#F43F5E',
};

export function TimelineRail({
  items,
  orientation = 'horizontal',
  onItemClick,
  selectedId,
}: TimelineRailProps) {
  const sorted = [...items].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  if (orientation === 'vertical') {
    return <VerticalRail items={sorted} onItemClick={onItemClick} selectedId={selectedId} />;
  }
  return <HorizontalRail items={sorted} onItemClick={onItemClick} selectedId={selectedId} />;
}

/* ==========================================================================
   Horizontal
   ========================================================================== */

function HorizontalRail({
  items,
  onItemClick,
  selectedId,
}: {
  items: TimelineItem[];
  onItemClick?: (id: string) => void;
  selectedId?: string | null;
}) {
  if (items.length === 0) {
    return <div className="py-4 text-center text-[10px] text-[#484F72]">暂无事件</div>;
  }

  return (
    <div className="relative h-[100px] w-full">
      {/* 基线 */}
      <div
        className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2"
        style={{
          background:
            'linear-gradient(90deg, transparent, rgba(107, 160, 255, 0.35), rgba(240, 198, 106, 0.4), rgba(107, 160, 255, 0.35), transparent)',
        }}
      />

      <div className="absolute inset-x-4 top-0 h-full">
        {items.map((item, idx) => {
          const pct = items.length === 1 ? 50 : (idx / (items.length - 1)) * 100;
          const topOffset = idx % 2 === 0 ? '24%' : '66%';
          const color = TONE_COLOR[item.tone ?? 'neutral'];
          const isSelected = selectedId === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onItemClick?.(item.id)}
              className="group absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${pct}%`, top: topOffset }}
            >
              {/* 光晕 */}
              <span
                className="animate-breathe absolute inset-0 -m-2 rounded-full"
                style={{
                  backgroundColor: color,
                  opacity: 0.2,
                  filter: 'blur(6px)',
                }}
              />
              {/* 点 */}
              <span
                className="relative block rounded-full border-2 transition-transform group-hover:scale-125"
                style={{
                  width: 12,
                  height: 12,
                  backgroundColor: color,
                  borderColor: isSelected ? '#F0C66A' : 'rgba(4, 6, 14, 0.9)',
                  boxShadow: `0 0 10px ${color}`,
                }}
              />
              {/* label */}
              <div
                className="pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap font-mono text-[9px] opacity-70 group-hover:opacity-100"
                style={{
                  color,
                  top: idx % 2 === 0 ? '18px' : undefined,
                  bottom: idx % 2 === 0 ? undefined : '18px',
                }}
              >
                {item.label}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ==========================================================================
   Vertical
   ========================================================================== */

function VerticalRail({
  items,
  onItemClick,
  selectedId,
}: {
  items: TimelineItem[];
  onItemClick?: (id: string) => void;
  selectedId?: string | null;
}) {
  if (items.length === 0) {
    return <div className="py-4 text-center text-[10px] text-[#484F72]">暂无事件</div>;
  }

  return (
    <div className="relative pl-6">
      {/* 垂直基线 */}
      <div
        className="absolute bottom-0 left-2 top-0 w-px"
        style={{
          background:
            'linear-gradient(180deg, transparent, rgba(240, 198, 106, 0.4), rgba(107, 160, 255, 0.3), transparent)',
        }}
      />
      <div className="space-y-4">
        {items.map((item) => {
          const color = TONE_COLOR[item.tone ?? 'neutral'];
          const isSelected = selectedId === item.id;
          return (
            <div
              key={item.id}
              className={`relative cursor-pointer transition-opacity ${isSelected ? '' : 'hover:opacity-80'}`}
              onClick={() => onItemClick?.(item.id)}
            >
              <span
                className="absolute -left-[22px] top-1 block h-3 w-3 rounded-full border-2"
                style={{
                  backgroundColor: color,
                  borderColor: isSelected ? '#F0C66A' : 'rgba(4, 6, 14, 0.9)',
                  boxShadow: `0 0 8px ${color}`,
                }}
              />
              <div className="font-mono text-[9px] text-[#6A7299]">
                {new Date(item.timestamp).toLocaleString('zh-CN')}
              </div>
              <div
                className="text-[11px] font-medium"
                style={{ color: isSelected ? '#F0C66A' : '#EAEEFB' }}
              >
                {item.label}
              </div>
              {item.description && (
                <div className="mt-0.5 text-[10px] text-[#9AA3C4]">{item.description}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
