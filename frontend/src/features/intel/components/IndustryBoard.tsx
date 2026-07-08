/**
 * 锦衣卫 · 本产业(电池)五道板块（2026-07-06 · Phase 2）
 *
 * 消费已建分类器 groupByLane（复用现有 intel_signals，真数据，无后端依赖）。
 * 诚实约束：不显示「异动类型(新增/突变/消失)」glyph —— 那需仙狐 diff，尚未接入；改用真有的 level。
 */
import { INDUSTRY_LANES, classifyLenses, groupByLane, SECTOR_LENSES, type LaneId } from '@/features/intel/lib/industry-classify';
import type { IntelLevel, IntelSignal } from '@/lib/contracts/intel';

const LEVEL_COLOR: Record<IntelLevel, string> = { info: '#60A5FA', watch: '#F0C66A', warning: '#F5A524', critical: '#F43F5E' };
const LEVEL_LABEL: Record<IntelLevel, string> = { info: '情报', watch: '关注', warning: '预警', critical: '急报' };
const CRED_DOTS: Record<IntelSignal['credibility'], number> = { low: 1, medium: 2, high: 3, verified: 4 };
const LENS_LABEL = new Map(SECTOR_LENSES.map((l) => [l.id, l.label] as const));

const OTHER_LANE = { id: 'other' as LaneId, label: '其他', icon: '•' };

export function IndustryBoard({
  signals,
  selectedId,
  onSelect,
}: {
  signals: IntelSignal[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const groups = groupByLane(signals);
  const lanes = [...INDUSTRY_LANES, OTHER_LANE].filter((lane) => (groups.get(lane.id)?.length ?? 0) > 0);

  if (lanes.length === 0) {
    return (
      <div className="grid h-full min-h-[420px] place-items-center text-center text-[#8A92AC]">
        <div>
          <div className="text-3xl">🔋</div>
          <p className="mt-2 text-sm">本产业暂无情报</p>
          <p className="mt-1 text-[11px] text-[#6A7299]">仙狐采集到电池相关公开信号后在此按五道呈现</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="grid min-h-0 flex-1 gap-2.5 overflow-y-auto p-3 md:grid-cols-2"
      data-testid="jinyiwei-industry-board"
    >
      {lanes.map((lane) => {
        const items = groups.get(lane.id) ?? [];
        const isTech = lane.id === 'tech';
        return (
          <section
            key={lane.id}
            className={`rounded-xl border border-white/[0.07] bg-[#070A12]/55 p-3 ${isTech ? 'md:col-span-2' : ''}`}
          >
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[12px] font-bold text-[#EDE3C6]">
                <span>{lane.icon}</span>
                {lane.label}
              </div>
              <span className="font-mono text-[9px] text-[#6A7299]">{items.length} 条</span>
            </div>
            <div className="flex flex-col">
              {items.slice(0, 5).map((signal) => (
                <LaneItem key={signal.id} signal={signal} selected={signal.id === selectedId} onSelect={onSelect} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function LaneItem({
  signal,
  selected,
  onSelect,
}: {
  signal: IntelSignal;
  selected: boolean;
  onSelect: (id: string | null) => void;
}) {
  const dots = CRED_DOTS[signal.credibility];
  const lenses = classifyLenses(signal).slice(0, 2);
  return (
    <button
      type="button"
      onClick={() => onSelect(signal.id)}
      className="grid grid-cols-[auto_1fr_auto] items-center gap-2 border-t border-white/[0.04] py-1.5 text-left outline-none transition first-of-type:border-t-0 hover:bg-white/[0.03]"
      style={selected ? { background: 'rgba(224,85,58,0.08)' } : undefined}
      aria-label={`查看情报：${signal.title}`}
    >
      <span
        className="h-2 w-2 flex-none rounded-full"
        style={{ background: LEVEL_COLOR[signal.level], boxShadow: `0 0 6px ${LEVEL_COLOR[signal.level]}` }}
        title={LEVEL_LABEL[signal.level]}
      />
      <span className="min-w-0 text-[11px] leading-snug text-[#EAE0C4]">
        <span className="line-clamp-1">{signal.title}</span>
        {lenses.length > 0 && (
          <span className="mt-0.5 flex gap-1">
            {lenses.map((id) => (
              <span key={id} className="rounded border border-white/[0.08] px-1 font-mono text-[8px] text-[#7E86A8]">
                ←{LENS_LABEL.get(id)}
              </span>
            ))}
          </span>
        )}
      </span>
      <span className="flex flex-none gap-0.5" aria-label={`可信度 ${dots}/4`}>
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className="h-1 w-1 rounded-full"
            style={{ background: i < dots ? '#3DD68C' : '#8A6A2A', boxShadow: i < dots ? '0 0 4px #3DD68C' : undefined }}
          />
        ))}
      </span>
    </button>
  );
}
