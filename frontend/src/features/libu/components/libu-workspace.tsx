'use client';

/**
 * 吏部 · 工作区（三栏 + 司选择状态 · 2026-06-29）
 *
 * 点左栏某司 → 右栏切到司能力详情。
 * 中栏 HR 工作台（招人/辞退/薪酬/转正）始终可用。
 */
import { useState } from 'react';
import { AlertCircle, Clock, ShieldCheck } from 'lucide-react';

import type { SixDepartmentContent } from '@/features/departments/lib/six-departments-content';
import {
  ACCENT,
  LIBU_ROSTER,
  LIBU_OFFICE_ORDER,
  type LibuOfficeId,
} from '@/features/libu/lib/libu-roster';
import { LibuStaffRail } from '@/features/libu/components/libu-staff-rail';
import { LibuHRWorkbench } from '@/features/libu/components/libu-hr-workbench';
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
  // 吏部 agentCode = 'li_bu'（铁律2 SSOT，见 src/lib/contracts/agent.ts）
  const { signal, isLoading, error } = useAdvisorSignal('li_bu');

  return (
    <Section icon={<ShieldCheck size={12} style={{ color: ACCENT }} />} title="近期判断可信度">
      {isLoading ? (
        <PlaceholderRow label="加载中" note="正在读取判断可信度记录" />
      ) : error ? (
        <PlaceholderRow label="读取失败" note={error.message} />
      ) : !signal ? (
        <PlaceholderRow label="暂无记录" note="尚无吏部判断可信度数据" />
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

function LibuRightRail({ selected }: { selected: LibuOfficeId | null }) {
  const office = selected ? LIBU_ROSTER[selected] : null;

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
          title="人事提醒"
        >
          <div className="space-y-2">
            {[
              '招人必须有预算 + JD + 90天成功标准，三件套缺一先补',
              '辞退路径：协商解除风险最低；"不胜任"必须先做 PIP',
              '违法解除赔 2N（双倍），合法辞退最多 N+1——差距巨大',
              '高风险人事决策（辞退/降薪）须人工确认（needsSignoff）',
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
        title="待裁决人事"
      >
        <PlaceholderRow label="待裁决事项" note="接入真实人事台账后自动计算" />
      </Section>

      {/* 在办占位 */}
      <Section
        icon={<Clock size={12} className="text-[#E5B84D]" />}
        title="本月招聘进度"
      >
        <PlaceholderRow label="招聘进度" note="待接入真实招聘台账" />
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
          {/* 从 LIBU_ROSTER 派生（铁律2 SSOT），只列真骨架 */}
          {LIBU_OFFICE_ORDER.filter((id) => !LIBU_ROSTER[id].engine).map((id) => (
            <div key={id} className="flex items-center gap-1.5 text-[11px]">
              <span
                className="inline-block h-1 w-1 rounded-full"
                style={{ background: '#3a4050' }}
              />
              <span className="text-[#454a58]">{LIBU_ROSTER[id].name}</span>
              <span className="text-[#2e3240]">· 骨架待建</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// ── 主工作区 ──────────────────────────────────────────────────────────────────

export function LibuWorkspace({ department }: { department: SixDepartmentContent }) {
  const [selected, setSelected] = useState<LibuOfficeId | null>(null);

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-y-auto xl:grid-cols-[280px_minmax(0,1fr)_300px] xl:overflow-hidden">
      <LibuStaffRail
        department={department}
        selected={selected}
        onSelect={(id) => setSelected((cur) => (cur === id ? null : id))}
      />

      <main
        className="order-first min-h-[60vh] rounded-[24px] border px-4 py-4 xl:order-none xl:min-h-0 xl:overflow-hidden"
        style={{ borderColor: `${ACCENT}1c`, background: 'rgba(6,8,14,0.55)' }}
      >
        <LibuHRWorkbench />
      </main>

      <LibuRightRail selected={selected} />
    </div>
  );
}
