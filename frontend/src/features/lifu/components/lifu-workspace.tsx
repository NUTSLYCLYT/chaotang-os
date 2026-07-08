'use client';

/**
 * 礼部 · 工作区（三栏 + 司选择状态 · 2026-06-29）
 *
 * 点左栏某司 → 右栏切到司能力详情。
 * 中栏关系台账+流量增长台始终可用（关系台账司/流量增长司为主引擎）。
 */
import { useState } from 'react';
import { AlertCircle, Clock, ShieldCheck } from 'lucide-react';

import type { SixDepartmentContent } from '@/features/departments/lib/six-departments-content';
import {
  ACCENT,
  LIFU_ROSTER,
  LIFU_OFFICE_ORDER,
  type LifuOfficeId,
} from '@/features/lifu/lib/lifu-roster';
import { LifuStaffRail } from '@/features/lifu/components/lifu-staff-rail';
import { LifuGrowthWorkbench } from '@/features/lifu/components/lifu-growth-workbench';
import { useAdvisorSignal } from '@/lib/hooks/use-advisor-signal';
import type { DepartmentLearningVerdict } from '@/lib/contracts/department-learning';

// 真实、诚实分色：confirmed=已被结果验证(正向) / refuted=被证伪(警示) / observing・unknown=中性观察
const VERDICT_META: Record<DepartmentLearningVerdict, { label: string; color: string }> = {
  confirmed: { label: '已验证', color: '#3DD68C' },
  observing: { label: '观察中', color: '#F0C66A' },
  unknown: { label: '证据不足', color: '#7a8090' },
  refuted: { label: '已证伪', color: '#F43F5E' },
};

// ── 右栏 ──────────────────────────────────────────────────────────────────────

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="rounded-[16px] border px-3.5 py-3"
      style={{
        borderColor: `${ACCENT}1f`,
        background: `linear-gradient(180deg,${ACCENT}0d 0%,rgba(6,8,14,0.92) 100%)`,
      }}
    >
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.16em] text-[#8f835f]">
        {icon}
        {title}
      </div>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function PlaceholderRow({ label, note }: { label: string; note: string }) {
  return (
    <div
      className="rounded-[8px] border border-dashed px-2.5 py-1.5 text-[11.5px]"
      style={{ borderColor: '#ffffff12' }}
    >
      <span className="text-[#7a8090]">{label}</span>
      <span className="ml-1 text-[#4a4e58]">· {note}</span>
    </div>
  );
}

function AdvisorSignalPanel() {
  // 礼部 agentCode = 'li_bu_rites'（铁律2 SSOT，见 src/lib/contracts/agent.ts）
  const { signal, isLoading, error } = useAdvisorSignal('li_bu_rites');

  return (
    <Section icon={<ShieldCheck size={12} style={{ color: ACCENT }} />} title="近期判断可信度">
      {isLoading ? (
        <PlaceholderRow label="加载中" note="正在读取判断可信度记录" />
      ) : error ? (
        <PlaceholderRow label="读取失败" note={error.message} />
      ) : !signal ? (
        <PlaceholderRow label="暂无记录" note="尚无礼部判断可信度数据" />
      ) : (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span
              className="rounded-sm px-1.5 py-0.5 text-[9px] uppercase tracking-wider"
              style={{
                background: `${VERDICT_META[signal.verdict].color}22`,
                color: VERDICT_META[signal.verdict].color,
              }}
            >
              {VERDICT_META[signal.verdict].label}
            </span>
            <span className="truncate text-[9.5px] text-[#7a8090]">{signal.metricName}</span>
          </div>
          <p className="text-[11px] leading-snug text-[#8a9aaa]">{signal.caution}</p>
          <p className="text-[9.5px] text-[#4a4e58]">
            更新于 {new Date(signal.updatedAt).toLocaleString('zh-CN')}
          </p>
        </div>
      )}
    </Section>
  );
}

function LifuRightRail({ selected }: { selected: LifuOfficeId | null }) {
  const office = selected ? LIFU_ROSTER[selected] : null;

  return (
    <div className="flex flex-col gap-3 pr-0.5 xl:h-full xl:overflow-y-auto">
      {/* 当前司详情 / 快速提示 */}
      {office ? (
        <section
          className="rounded-[16px] border px-3.5 py-3"
          style={{
            borderColor: office.engine ? `${ACCENT}28` : '#ffffff10',
            background: office.engine
              ? `linear-gradient(180deg,${ACCENT}0e 0%,rgba(6,8,14,0.92) 100%)`
              : 'rgba(6,8,14,0.55)',
          }}
        >
          <div className="text-[10px] uppercase tracking-[0.16em] text-[#8f835f]">当前司</div>
          <div className="mt-2">
            <div className="flex items-center gap-2">
              <span className="text-[14px] font-semibold text-[#F5E9C9]">{office.name}</span>
              {office.engine ? (
                <span
                  className="rounded-sm px-1.5 py-0.5 text-[9px] uppercase tracking-wider"
                  style={{ background: `${ACCENT}22`, color: ACCENT }}
                >
                  真引擎
                </span>
              ) : (
                <span
                  className="rounded-sm px-1.5 py-0.5 text-[9px] text-[#4a5060]"
                  style={{ background: '#ffffff08' }}
                >
                  骨架
                </span>
              )}
            </div>
            <p className="mt-1 text-[11.5px] text-[#8a9aaa]">{office.role}</p>
            <p className="mt-1.5 text-[11px] leading-snug text-[#6a7880]">{office.duty}</p>

            <div
              className="mt-2.5 rounded-[8px] border border-dashed px-2.5 py-2"
              style={{ borderColor: `${ACCENT}18` }}
            >
              <span className="text-[9.5px] uppercase tracking-[0.15em] text-[#8f835f]">
                配置能力
              </span>
              <p
                className="mt-0.5 text-[10.5px] leading-snug"
                style={{ color: `${ACCENT}88` }}
              >
                {office.skill}
              </p>
            </div>

            {office.reuses.length > 0 && (
              <div className="mt-2 text-[10px]" style={{ color: '#7a8090' }}>
                复用：{office.reuses.join(' · ')}
              </div>
            )}

            {!office.engine && (
              <p className="mt-2 text-[10px]" style={{ color: '#E5B84D99' }}>
                骨架司尚未接真引擎，能力待建。
              </p>
            )}
          </div>
        </section>
      ) : (
        <Section
          icon={<AlertCircle size={12} style={{ color: ACCENT }} />}
          title="增长提醒"
        >
          <div className="space-y-2">
            {[
              '关系台账：活跃关系 30 天未联系=该跟进',
              '渠道投放：ROAS<1 先砍，薄数据（<10 次转化）先观察',
              '对外承诺：独家/政府/公开承诺过人工确认门',
              '防失真：对外表达须忠于内部真相，不洗白 sourceLabel',
            ].map((item) => (
              <div key={item} className="flex gap-2 text-[11.5px]">
                <span className="mt-0.5 shrink-0" style={{ color: ACCENT }}>·</span>
                <span className="text-[#7a8890]">{item}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* 近期判断可信度：真实数据，来自 loadAdvisorSignals()（非占位） */}
      <AdvisorSignalPanel />

      {/* 急事占位 */}
      <Section
        icon={<AlertCircle size={12} style={{ color: ACCENT }} />}
        title="待跟进关系"
      >
        <PlaceholderRow label="跟进提醒" note="填入关系台账后自动计算" />
      </Section>

      {/* 在办占位 */}
      <Section
        icon={<Clock size={12} className="text-[#E5B84D]" />}
        title="本月渠道执行"
      >
        <PlaceholderRow label="渠道执行" note="待接入真实投放台账" />
      </Section>

      {/* 骨架司接入计划 */}
      <section
        className="rounded-[16px] border px-3.5 py-3"
        style={{ borderColor: '#ffffff0c', background: 'rgba(6,8,14,0.38)' }}
      >
        <div className="text-[10px] uppercase tracking-[0.16em] text-[#4a5060]">
          骨架司接入计划
        </div>
        <div className="mt-2 space-y-1">
          {/* 从 LIFU_ROSTER 派生(铁律2 SSOT),只列真骨架——已接真引擎的司绝不冒充骨架 */}
          {LIFU_OFFICE_ORDER.filter((id) => !LIFU_ROSTER[id].engine).map((id) => (
            <div key={id} className="flex items-center gap-1.5 text-[11px]">
              <span
                className="inline-block h-1 w-1 rounded-full"
                style={{ background: '#3a4050' }}
              />
              <span className="text-[#454a58]">{LIFU_ROSTER[id].name}</span>
              <span className="text-[#2e3240]">· 骨架待建</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// ── 主工作区 ──────────────────────────────────────────────────────────────────

export function LifuWorkspace({ department }: { department: SixDepartmentContent }) {
  const [selected, setSelected] = useState<LifuOfficeId | null>(null);

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-y-auto xl:grid-cols-[280px_minmax(0,1fr)_300px] xl:overflow-hidden">
      <LifuStaffRail
        department={department}
        selected={selected}
        onSelect={(id) => setSelected((cur) => (cur === id ? null : id))}
      />

      <main
        className="order-first min-h-[60vh] rounded-[24px] border px-4 py-4 xl:order-none xl:min-h-0 xl:overflow-hidden"
        style={{ borderColor: `${ACCENT}1c`, background: 'rgba(6,8,14,0.55)' }}
      >
        <LifuGrowthWorkbench />
      </main>

      <LifuRightRail selected={selected} />
    </div>
  );
}
