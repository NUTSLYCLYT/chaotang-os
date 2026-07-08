'use client';

/**
 * 刑部 · 工作区（三栏 + 司选择状态 · 2026-06-28）
 *
 * 点左栏某司 → 右栏切到司能力详情。
 * 中栏合同审查台始终可用（合同审查司是主引擎）。
 */
import { useState } from 'react';
import { AlertCircle, Clock } from 'lucide-react';

import type { SixDepartmentContent } from '@/features/departments/lib/six-departments-content';
import {
  ACCENT,
  XINGBU_ROSTER,
  type XingbuOfficeId,
} from '@/features/xingbu/lib/xingbu-roster';
import { XingbuStaffRail } from '@/features/xingbu/components/xingbu-staff-rail';
import { XingbuContractWorkbench } from '@/features/xingbu/components/xingbu-contract-workbench';

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
        background: 'linear-gradient(180deg,#3DD68C0d 0%,rgba(6,8,14,0.92) 100%)',
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

function XingbuRightRail({ selected }: { selected: XingbuOfficeId | null }) {
  const office = selected ? XINGBU_ROSTER[selected] : null;

  return (
    <div className="flex flex-col gap-3 pr-0.5 xl:h-full xl:overflow-y-auto">
      {/* 当前司详情 / 快速提示 */}
      {office ? (
        <section
          className="rounded-[16px] border px-3.5 py-3"
          style={{
            borderColor: office.engine ? `${ACCENT}28` : '#ffffff10',
            background: office.engine
              ? 'linear-gradient(180deg,#3DD68C0e 0%,rgba(6,8,14,0.92) 100%)'
              : 'rgba(6,8,14,0.55)',
          }}
        >
          <div className="text-[10px] uppercase tracking-[0.16em] text-[#8f835f]">
            当前司
          </div>
          <div className="mt-2">
            <div className="flex items-center gap-2">
              <span className="text-[14px] font-semibold text-[#F5E9C9]">
                {office.name}
              </span>
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

            {!office.engine && (
              <p className="mt-2 text-[10px]" style={{ color: '#E5B84D99' }}>
                骨架司尚未接真引擎，能力待建。
              </p>
            )}
          </div>
        </section>
      ) : (
        <Section
          icon={<AlertCircle size={12} style={{ color: '#E5604D' }} />}
          title="法务提醒"
        >
          <div className="space-y-2">
            {[
              '高危条款：无限责任 / 单方解除 / 违约金畸高',
              '必检缺证：责任上限 + 争议解决条款',
              '格式条款陷阱：最终解释权归对方',
              '全额预付：验收前款项全付风险',
            ].map((item) => (
              <div key={item} className="flex gap-2 text-[11.5px]">
                <span className="mt-0.5 shrink-0 text-[#E5B84D]">·</span>
                <span className="text-[#7a8890]">{item}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* 急事占位 */}
      <Section
        icon={<AlertCircle size={12} className="text-[#E5604D]" />}
        title="今日高危案件"
      >
        <PlaceholderRow label="今日高危" note="待接入案件系统" />
      </Section>

      {/* 在办占位 */}
      <Section
        icon={<Clock size={12} className="text-[#E5B84D]" />}
        title="即将到期合同"
      >
        <PlaceholderRow label="到期提醒" note="待接入合同台账" />
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
          {[
            '合规稽查司',
            '风控司',
            '制度司',
            '争议处置司',
            '知识产权司',
            '刑部尚书',
          ].map((name) => (
            <div key={name} className="flex items-center gap-1.5 text-[11px]">
              <span
                className="inline-block h-1 w-1 rounded-full"
                style={{ background: '#3a4050' }}
              />
              <span className="text-[#454a58]">{name}</span>
              <span className="text-[#2e3240]">· 骨架待建</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// ── 主工作区 ──────────────────────────────────────────────────────────────────

export function XingbuWorkspace({ department }: { department: SixDepartmentContent }) {
  const [selected, setSelected] = useState<XingbuOfficeId | null>(null);

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-y-auto xl:grid-cols-[280px_minmax(0,1fr)_300px] xl:overflow-hidden">
      <XingbuStaffRail
        department={department}
        selected={selected}
        onSelect={(id) => setSelected((cur) => (cur === id ? null : id))}
      />

      <main
        className="order-first min-h-[60vh] rounded-[24px] border px-4 py-4 xl:order-none xl:min-h-0 xl:overflow-hidden"
        style={{ borderColor: '#3DD68C1c', background: 'rgba(6,8,14,0.55)' }}
      >
        <XingbuContractWorkbench />
      </main>

      <XingbuRightRail selected={selected} />
    </div>
  );
}
