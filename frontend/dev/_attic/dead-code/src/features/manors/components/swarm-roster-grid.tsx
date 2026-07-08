'use client';

/**
 * 蜂群聚集地 · 全名册平铺网格（F1）
 *
 * 数据源:chaotang.swarmRoster() → /api/court/swarm/roster → 后端 :8081/api/swarm/roster。
 * 张小龙铁律:全部蜂群**一屏平铺全可见**,按 group 只做颜色/分隔带区分,
 *   **绝不折叠/手风琴**(任何要点开才出现的蜂群都背叛「聚集地」)。
 *   没 run 的蜂群显示 idle 态,不隐藏。
 * 诚实空态:后端不可读 → 占位空态,不白屏、不报错、不伪造分数。
 * join 在后端做,前端只渲染。
 */

import useSWR from 'swr';
import { chaotang } from '@/lib/api/chaotang';
import type { SwarmRosterEntry } from '@/lib/contracts/swarm';

/* --- 功能组色带:固定顺序 + 配色/中文名(取自现有帝金/部门色系,不引新色板) --- */
const GROUP_ORDER = ['exec', 'finlaw', 'rnd', 'intel', 'content', 'review', 'unassigned'] as const;
const GROUP_META: Record<string, { label: string; tone: string }> = {
  exec: { label: '执行群 · Exec', tone: '#F0C66A' },
  finlaw: { label: '财法群 · Finance/Law', tone: '#3DD68C' },
  rnd: { label: '研发群 · R&D', tone: '#6BA0FF' },
  intel: { label: '情报群 · Intel', tone: '#C084FC' },
  content: { label: '内容群 · Content', tone: '#F472B6' },
  review: { label: '复核群 · Review', tone: '#FB923C' },
  unassigned: { label: '未编组 · Unassigned', tone: '#9AA3C4' },
};
function groupMeta(group: string) {
  return GROUP_META[group] ?? { label: `${group} · 其它`, tone: '#9AA3C4' };
}

/* --- run 状态 → 展示色调/标签(后端原始 run 状态,非 SwarmStatus 枚举) --- */
const STATUS_META: Record<string, { label: string; tone: string }> = {
  completed: { label: '已完成', tone: '#3DD68C' },
  running: { label: '运行中', tone: '#7DD3FC' },
  in_progress: { label: '运行中', tone: '#7DD3FC' },
  failed: { label: '失败', tone: '#EF4444' },
  error: { label: '失败', tone: '#EF4444' },
  skipped: { label: '已跳过', tone: '#F59E0B' },
  idle: { label: '待命', tone: '#8F835F' },
};
function statusMeta(status: string) {
  return STATUS_META[status?.toLowerCase()] ?? { label: status || '待命', tone: '#8F835F' };
}

function hasRun(s: SwarmRosterEntry): boolean {
  return Boolean(s.last_run_id);
}

function scoreTone(score: number | null): string {
  if (score == null) return '#6A7299';
  if (score >= 4) return '#3DD68C';
  if (score >= 3) return '#F0C66A';
  return '#FB923C';
}

function fmtTime(iso: string | null): string {
  if (!iso) return '—';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '—';
  return new Date(t).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function SwarmRosterGrid() {
  const { data, error, isLoading, mutate } = useSWR<SwarmRosterEntry[], Error>(
    'swarm-roster',
    () => chaotang.swarmRoster(),
    { refreshInterval: 30_000, revalidateOnFocus: true },
  );

  const swarms = data ?? [];
  // 按固定组顺序分桶;未列入 GROUP_ORDER 的组追加在后(仍平铺,不折叠)。
  const seenGroups = Array.from(new Set(swarms.map((s) => s.group)));
  const orderedGroups = [
    ...GROUP_ORDER.filter((g) => seenGroups.includes(g)),
    ...seenGroups.filter((g) => !GROUP_ORDER.includes(g as (typeof GROUP_ORDER)[number])),
  ];

  const total = swarms.length;
  const withRun = swarms.filter(hasRun).length;
  const idle = total - withRun;

  return (
    <section className="flex h-full min-h-0 flex-col">
      {/* 标题 + 统计 */}
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-[#F0C66A]/14 pb-3">
        <div>
          <div className="page-eyebrow">Swarm Manor · 蜂群聚集地</div>
          <h1 className="display-serif mt-1 text-[26px] font-semibold text-[#F5E9C9] md:text-[32px]">
            {total > 0 ? `${total} 个蜂群在庄园一屏待命` : '蜂群聚集地'}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Stat label="蜂群" value={`${total}`} tone="#F0C66A" />
          <Stat label="有近期产出" value={`${withRun}`} tone="#3DD68C" />
          <Stat label="待命" value={`${idle}`} tone="#8F835F" />
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-auto pt-4">
        {/* 加载态 */}
        {isLoading && swarms.length === 0 && (
          <div className="grid h-40 place-items-center text-[12px] text-[#8F835F]">读取蜂群名册中…</div>
        )}

        {/* 诚实空态:后端不可读 → 不白屏、不报错、不伪造 */}
        {error && swarms.length === 0 && (
          <div className="mx-auto max-w-md rounded-[10px] border border-[#EF4444]/35 bg-[#EF4444]/10 p-5 text-center">
            <div className="text-[13px] font-semibold text-[#F5E9C9]">蜂群名册暂不可读</div>
            <div className="mt-2 text-[11px] leading-5 text-[#C6BB9D]">
              后端蜂群聚集地链路暂不可达。不用本地假数据冒充真实蜂群状态。
            </div>
            <button
              type="button"
              onClick={() => void mutate()}
              className="mt-3 inline-flex items-center gap-1 rounded-[8px] border border-[#F0C66A]/45 px-3 py-1.5 text-[11px] text-[#F0C66A] transition hover:bg-[#F0C66A]/12"
            >
              重新读取
            </button>
          </div>
        )}

        {/* 全名册平铺:按组色带分隔,组内卡片网格,全部可见 */}
        {swarms.length > 0 && (
          <div className="flex flex-col gap-6">
            {orderedGroups.map((group) => {
              const meta = groupMeta(group);
              const members = swarms.filter((s) => s.group === group);
              if (members.length === 0) return null;
              return (
                <div key={group}>
                  {/* 组色带分隔(纯视觉,不可点开) */}
                  <div className="mb-3 flex items-center gap-3">
                    <span
                      className="inline-block h-3 w-1.5 rounded-full"
                      style={{ background: meta.tone, boxShadow: `0 0 10px ${meta.tone}` }}
                    />
                    <span
                      className="text-[12px] font-semibold tracking-[0.08em]"
                      style={{ color: meta.tone }}
                    >
                      {meta.label}
                    </span>
                    <span className="text-[11px] text-[#8F835F]">{members.length} 群</span>
                    <span
                      className="h-px flex-1"
                      style={{ background: `linear-gradient(90deg, ${meta.tone}33, transparent)` }}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {members.map((s) => (
                      <SwarmCard key={s.id} swarm={s} groupTone={meta.tone} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function SwarmCard({ swarm, groupTone }: { swarm: SwarmRosterEntry; groupTone: string }) {
  const st = statusMeta(swarm.status);
  const idle = !hasRun(swarm);
  return (
    <article
      className="flex flex-col gap-2 rounded-[10px] border bg-[#070A14]/72 p-3 backdrop-blur-sm transition hover:border-[#F0C66A]/45"
      style={{
        borderColor: idle ? 'rgba(255,255,255,0.08)' : `${groupTone}33`,
        opacity: idle ? 0.82 : 1,
      }}
    >
      {/* 名称 + run 状态 */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold text-[#F5E9C9]" title={swarm.name}>
            {swarm.name}
          </div>
          <div className="mt-0.5 truncate font-mono text-[10px] text-[#6A7299]">{swarm.id}</div>
        </div>
        <span
          className="shrink-0 rounded-full border px-2 py-0.5 text-[10px]"
          style={{ borderColor: `${st.tone}44`, color: st.tone }}
        >
          {st.label}
        </span>
      </div>

      {/* 最近 run 质量分 + 时间 */}
      <div className="flex items-center justify-between gap-2 rounded-[8px] border border-white/8 bg-white/[0.03] px-2.5 py-2">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[10px] tracking-[0.12em] text-[#8F835F]">质量分</span>
          {swarm.last_quality_score != null ? (
            <span
              className="font-mono text-[18px] font-semibold leading-none"
              style={{ color: scoreTone(swarm.last_quality_score) }}
            >
              {swarm.last_quality_score.toFixed(2)}
            </span>
          ) : (
            <span className="font-mono text-[14px] text-[#6A7299]">—</span>
          )}
        </div>
        <span className="font-mono text-[10px] text-[#8F835F]">{fmtTime(swarm.last_run_at)}</span>
      </div>

      {/* 最近 run 标题(诚实空) */}
      <div className="min-h-[32px] text-[11px] leading-5 text-[#C6BB9D]">
        {swarm.latest_title ? (
          <span className="line-clamp-2" title={swarm.latest_title}>
            {swarm.latest_title}
          </span>
        ) : (
          <span className="text-[#6A7299]">{idle ? '尚无近期任务，待命中' : '本次 run 无标题'}</span>
        )}
      </div>
    </article>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-[8px] border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-center">
      <div className="text-[9px] uppercase tracking-[0.16em]" style={{ color: tone }}>
        {label}
      </div>
      <div className="mt-0.5 font-mono text-[16px] font-semibold text-[#F5E9C9]">{value}</div>
    </div>
  );
}
