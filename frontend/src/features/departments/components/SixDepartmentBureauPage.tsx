'use client';

import Link from 'next/link';
import {
  ArrowRight,
  BookOpenText,
  Building2,
  CheckCircle2,
  Landmark,
  LibraryBig,
  ShieldCheck,
} from 'lucide-react';

import { EdictStage } from '@/features/shangshufang/components/MemorialScroll';
import type { EdictView } from '@/features/shangshufang/edict-content';
import {
  ShangshufangLayoutShell,
  ShangshufangRailPanel,
} from '@/features/shared/components/shangshufang-layout-shell';
import {
  getDepartmentBureauSlug,
  getSixDepartmentLinks,
  getSixDepartmentScrollTheme,
  type SixDepartmentContent,
} from '@/features/departments/lib/six-departments-content';
import type { GovernanceBureau } from '@/features/departments/lib/department-governance';

type SixDepartmentBureauPageProps = {
  department: SixDepartmentContent;
  bureau: GovernanceBureau;
  bureaus: GovernanceBureau[];
  bureauIndex: number;
};

function sealForDepartment(code: SixDepartmentContent['code']): EdictView['seal'] {
  return code === 'legal' ? 'secret' : 'imperial';
}

function priorityForDepartment(code: SixDepartmentContent['code']): NonNullable<EdictView['meta']>['priority'] {
  return code === 'finance' || code === 'legal' ? 'high' : 'medium';
}

function bureauToEdict(
  department: SixDepartmentContent,
  bureau: GovernanceBureau,
  bureauIndex: number,
): EdictView {
  const scrollTheme = getSixDepartmentScrollTheme(department.code);
  return {
    id: `six-department:${department.code}:bureau-${bureauIndex + 1}`,
    title: `${bureau.name}案卷`,
    subtitle: bureau.scope,
    headerKicker: 'SIX MINISTRIES · BUREAU DETAIL',
    issuerLine: `${department.name} · ${bureau.name}`,
    question: bureau.scope,
    seal: sealForDepartment(department.code),
    meta: {
      accent: scrollTheme.accent,
      accentSoft: scrollTheme.accentSoft,
      reporter: bureau.name,
      priority: priorityForDepartment(department.code),
      badges: [
        { label: department.name, tone: 'blue' },
        { label: bureau.role, tone: 'amber' },
        { label: `第 ${bureauIndex + 1} 司`, tone: 'green' },
      ],
    },
    rows: [
      { label: '圣裁', body: `${bureau.name}负责${bureau.scope}。` },
      { label: '职责', body: bureau.scope },
      { label: '归属', body: `${department.name} · ${department.titleEn}` },
      { label: '部门定位', body: department.positioning },
      { label: '可调用能力', body: department.capabilities.slice(0, 6).join('\n') },
      { label: '落地判断', body: department.currentState.join('\n') },
      { label: '后令', body: department.nextFocus },
    ],
  };
}

export function SixDepartmentBureauPage({
  department,
  bureau,
  bureaus,
  bureauIndex,
}: SixDepartmentBureauPageProps) {
  const quickLinks = getSixDepartmentLinks();
  const edict = bureauToEdict(department, bureau, bureauIndex);

  return (
    <ShangshufangLayoutShell
      eyebrow={`${department.titleEn} · BUREAU DETAIL`}
      title={`${bureau.name}详情`}
      subtitle={`${department.name}下设司局，按六部详情页结构展示职责、案卷、去向和验收口。`}
      accent={department.accent}
      background={department.background}
      breadcrumb={
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[#8F99B3]">
          <Link href="/liubu" className="transition hover:text-[#F0C66A]">
            六部大厅
          </Link>
          <span>/</span>
          <Link href={`/liubu/${department.code}`} className="transition hover:text-[#F0C66A]">
            {department.name}详情
          </Link>
          <span>/</span>
          <span style={{ color: department.accent }}>{bureau.name}详情</span>
        </div>
      }
      actions={
        <Link
          href="/shangshufang"
          className="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12px] transition hover:brightness-110"
          style={{
            borderColor: `${department.accent}58`,
            color: department.accent,
            background: `${department.accent}10`,
          }}
        >
          <Landmark size={13} />
          回上书房
        </Link>
      }
      left={
        <ShangshufangRailPanel
          title={`${department.name}各司`}
          subtitle="同部司局导航"
          accent={department.accent}
        >
          <div className="space-y-3">
            <div
              className="rounded-[8px] border px-3 py-3"
              style={{ borderColor: `${department.accent}24`, background: 'rgba(5,7,13,0.56)' }}
            >
              <div className="flex items-center gap-2 text-[11px] font-semibold" style={{ color: department.accent }}>
                <LibraryBig size={13} />
                下设各司
              </div>
              <div className="mt-2 space-y-1.5">
                {bureaus.map((item, index) => {
                  const active = index === bureauIndex;
                  return (
                    <Link
                      key={`${item.name}-${index}`}
                      href={`/liubu/${department.code}/${getDepartmentBureauSlug(index, department.code)}`}
                      className="group flex items-start justify-between gap-2 rounded-[8px] border px-3 py-2 transition hover:bg-white/[0.04]"
                      style={{
                        borderColor: active ? `${department.accent}58` : `${department.accent}24`,
                        background: active ? `${department.accent}18` : `${department.accent}08`,
                      }}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[12px] font-semibold text-[#F5E9C9]">{item.name}</span>
                        <span className="mt-0.5 block truncate text-[10px] uppercase tracking-[0.12em]" style={{ color: department.accent }}>
                          {item.role}
                        </span>
                        <span className="mt-1 block line-clamp-2 text-[11px] leading-5 text-[#C8CDD8]">
                          {item.scope}
                        </span>
                      </span>
                      <ArrowRight
                        size={12}
                        className="mt-1 shrink-0 text-[#7C86A6] transition group-hover:translate-x-0.5"
                      />
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </ShangshufangRailPanel>
      }
      center={
        <div className="h-full min-h-0">
          <EdictStage
            view={edict}
            customBodyScroll="styled"
            footer={
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Link
                  href="/shangshufang"
                  className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-semibold"
                  style={{
                    borderColor: `${department.accent}44`,
                    color: '#5b3410',
                    background: `${department.accent}28`,
                  }}
                >
                  <Landmark size={13} />
                  下门
                </Link>
              </div>
            }
          />
        </div>
      }
      right={
        <ShangshufangRailPanel
          title={`${bureau.name}右批`}
          subtitle="职责、边界、去向和验收口集中在这里。"
          accent={department.accent}
        >
          <div className="space-y-3">
            <section
              className="rounded-[8px] border px-3 py-3"
              style={{ borderColor: `${department.accent}24`, background: `${department.accent}08` }}
            >
              <div className="flex items-center gap-2 text-[11px] font-semibold" style={{ color: department.accent }}>
                <ShieldCheck size={13} />
                本司职责
              </div>
              <p className="mt-2 text-[12px] leading-6 text-[#D7DFF2]">{bureau.scope}</p>
            </section>

            <section
              className="rounded-[8px] border px-3 py-3"
              style={{ borderColor: `${department.accent}24`, background: 'rgba(5,7,13,0.56)' }}
            >
              <div className="flex items-center gap-2 text-[11px] font-semibold" style={{ color: department.accent }}>
                <BookOpenText size={13} />
                部门能力
              </div>
              <div className="mt-2 space-y-2">
                {department.capabilities.slice(0, 4).map((item) => (
                  <div key={item} className="flex items-start gap-2">
                    <CheckCircle2 size={13} className="mt-1 shrink-0" style={{ color: department.accent }} />
                    <p className="text-[11px] leading-5 text-[#D7DFF2]">{item}</p>
                  </div>
                ))}
              </div>
            </section>

            <section
              className="rounded-[8px] border px-3 py-3"
              style={{ borderColor: `${department.accent}24`, background: 'rgba(5,7,13,0.56)' }}
            >
              <div className="flex items-center gap-2 text-[11px] font-semibold" style={{ color: department.accent }}>
                <Building2 size={13} />
                快捷去向
              </div>
              <div className="mt-2 space-y-1.5">
                {quickLinks.map((item) => (
                  <Link
                    key={`${item.href}-${item.label}`}
                    href={item.href}
                    className="flex items-center justify-between rounded border px-2.5 py-1.5 text-[10px] transition hover:bg-white/[0.03]"
                    style={{ borderColor: `${department.accent}30`, color: department.accent }}
                  >
                    <span>{item.label}</span>
                    <ArrowRight size={11} />
                  </Link>
                ))}
              </div>
            </section>
          </div>
        </ShangshufangRailPanel>
      }
      footer={
        <div className="text-center text-[10px] tracking-[0.22em] text-[#5a5340]">
          朝堂 OS · {department.name} · {bureau.name} · 上书房式三轴详情页
        </div>
      }
    />
  );
}
