'use client';

/**
 * 工部 · 单司圣旨详情（M2 · 架构司为样板间）
 * 架构司做满🟢：技术可行性表 + 产线资产锁全景(铁律9 看板) + 跨部会审需求。
 * 真实可行性/方案生成需后端 PACK 研发蜂群 → 标"待接"；产线数字整字段上锁，前端只看定性。
 */
import { useGongbuTasks } from '@/features/gongbu/hooks/use-gongbu-tasks';
import { GONGBU_STAFF_CATALOG } from '@/features/gongbu/lib/gongbu-roster';
import { evaluateTask, type GongbuTask } from '@/features/gongbu/lib/gongbu-engines';

const TYPE_CN: Record<string, string> = {
  STORAGE_OR_HARDWARE_PROJECT: '硬件/储能', BOM_SUPPLY_CHAIN: 'BOM/供应链', TECHNICAL_FEASIBILITY: '技术可行性',
  MVP_SCOPE: 'MVP 范围', SCHEDULE_CAPACITY: '工期/产能', QUALITY_ACCEPTANCE: '质量验收', FIELD_IMPLEMENTATION: '现场实施',
  DELIVERY_COMMITMENT: '交付承诺', SCOPE_CHANGE: '范围变更', DELIVERY_REVIEW: '交付复盘', OTHER_DELIVERY_RISK: '其他',
};

function Block({ title, source, children }: { title: string; source: 'live' | 'feed' | 'backend'; children: React.ReactNode }) {
  const tag = { live: { c: '#5FB97A', t: '🟢 真算' }, feed: { c: '#E5B84D', t: '🟡 待接行情' }, backend: { c: '#4A82F0', t: '🔵 待接后端蜂群' } }[source];
  return (
    <section className="rounded-[14px] border px-3.5 py-3" style={{ borderColor: '#7FC9A81c', background: 'rgba(255,255,255,0.02)' }}>
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-medium text-[#EAF3EE]">{title}</span>
        <span className="text-[10.5px]" style={{ color: tag.c }}>{tag.t}</span>
      </div>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function ArchitectureBoard({ tasks }: { tasks: GongbuTask[] }) {
  const rows = tasks.map((t) => ({ t, ev: evaluateTask(t) }));
  // 产线锁全景：按类目聚合命中任务数
  const lockTally = new Map<string, number>();
  for (const { ev } of rows) for (const l of ev.locks) lockTally.set(l, (lockTally.get(l) ?? 0) + 1);
  // 跨部会审聚合
  const crossTally = new Map<string, number>();
  for (const { ev } of rows) for (const c of ev.cross) crossTally.set(c.cn, (crossTally.get(c.cn) ?? 0) + 1);

  return (
    <div className="space-y-3">
      <Block title="① 技术可行性（定性裁决）" source="live">
        {rows.length === 0 ? (
          <p className="text-[11.5px] text-[#586a62]">暂无建设任务（后端蜂群未起，队列为空）。</p>
        ) : (
          <div className="overflow-hidden rounded-[10px] border" style={{ borderColor: '#ffffff10' }}>
            <table className="w-full text-[11.5px]">
              <thead><tr className="text-[#7a8a82]" style={{ background: '#ffffff06' }}>
                <th className="px-2 py-1 text-left font-normal">任务</th><th className="px-2 py-1 text-left font-normal">类型</th>
                <th className="px-2 py-1 text-right font-normal">裁决</th><th className="px-2 py-1 text-right font-normal">锁</th>
              </tr></thead>
              <tbody>
                {rows.slice(0, 6).map(({ t, ev }) => (
                  <tr key={t.id} className="border-t" style={{ borderColor: '#ffffff08' }}>
                    <td className="max-w-0 truncate px-2 py-1 text-[#cfe0d6]" title={t.title}>{t.title}</td>
                    <td className="px-2 py-1 text-[#aebeb5]">{TYPE_CN[ev.type] ?? ev.type}</td>
                    <td className="px-2 py-1 text-right" style={{ color: ev.verdict === 'review' ? '#4A82F0' : ev.verdict === 'approve' ? '#5FB97A' : '#E5B84D' }}>{ev.verdictCn}</td>
                    <td className="px-2 py-1 text-right">{ev.locks.length ? '🔒' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-1.5 text-[11px] text-[#7a8a82]">真实可行性/方案生成 → <span style={{ color: '#4A82F0' }}>待接后端 PACK 研发蜂群</span></p>
      </Block>

      <Block title="② 产线资产锁全景（铁律9）" source="live">
        {lockTally.size === 0 ? (
          <p className="text-[11.5px] text-[#586a62]">当前无任务触及产线资产（成本/BOM/交期…）。</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {[...lockTally.entries()].map(([cat, n]) => (
              <span key={cat} className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[12px] text-[#9ec5ff]" style={{ borderColor: '#4A82F040', background: '#4A82F010' }}>
                🔒 {cat} · {n}
              </span>
            ))}
          </div>
        )}
        <p className="mt-1.5 text-[11px] text-[#7a8a82]">这些字段前端不渲染其值，整字段上锁、转后端 jiqun 核算。</p>
      </Block>

      <Block title="③ 跨部会审需求" source="live">
        {crossTally.size === 0 ? (
          <p className="text-[11.5px] text-[#586a62]">当前无需跨部会审。</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {[...crossTally.entries()].map(([cn, n]) => (
              <span key={cn} className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[12px] text-[#bda7e0]" style={{ borderColor: '#8B5CF640', background: '#8B5CF610' }}>
                需会审 {cn} · {n}
              </span>
            ))}
          </div>
        )}
      </Block>

      <p className="text-[11.5px] text-[#7a8a82]">产出：技术方案 / PRD / API 契约（生成走后端蜂群，前端只做定性会诊与会审需求）。</p>
    </div>
  );
}

function RolePlaceholder({ topics }: { topics: string[] }) {
  return (
    <div className="space-y-2">
      <p className="text-[12px] text-[#8fa39a]">本司圣旨详情按样板间（架构司）复制，待建。计划板块：</p>
      <ul className="space-y-1">
        {topics.map((t) => (
          <li key={t} className="flex items-center justify-between rounded-[8px] border border-dashed px-2.5 py-1.5 text-[12px]" style={{ borderColor: '#ffffff14' }}>
            <span className="text-[#cfe0d6]">{t}</span><span className="text-[10.5px] text-[#586a62]">待建</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function GongbuStaffDetail({ staffId }: { staffId: string }) {
  const { tasks } = useGongbuTasks();
  const role = GONGBU_STAFF_CATALOG[staffId];

  return (
    <section className="flex min-h-0 flex-col gap-3 pr-1 xl:h-full xl:overflow-y-auto">
      {role ? (
        <>
          <div className="rounded-[14px] border px-3.5 py-3" style={{ borderColor: `${role.accent}2a`, background: `linear-gradient(180deg,${role.accent}10 0%,rgba(6,8,14,0.9) 100%)` }}>
            <div className="flex items-center gap-2">
              <span className="display-serif text-[18px] text-[#EAF3EE]">{role.nameCn}司</span>
              <span className="text-[12px] text-[#8fa39a]">· {role.realJobTitle}</span>
            </div>
            <p className="mt-1 text-[11.5px] text-[#7a8a82]">{role.guardianLens}</p>
            {role.note && <p className="mt-1 text-[11px] text-[#7f9fce]">{role.note}</p>}
          </div>
          {staffId === 'solution_architecture' ? <ArchitectureBoard tasks={tasks} /> : <RolePlaceholder topics={role.frontendTopics} />}
        </>
      ) : (
        <p className="body-copy text-[#E5604D]">未知岗位。</p>
      )}
    </section>
  );
}
