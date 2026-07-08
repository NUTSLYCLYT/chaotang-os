'use client';

import Link from 'next/link';
import { ArrowLeft, BookOpen, Clock, Download, Scale } from 'lucide-react';
import type { ManorDomain } from '@/types/manor';

const DOMAIN_META: Record<ManorDomain, { label: string; subtitle: string; icon: React.ReactNode }> = {
  legal:        { label: '法务研判 · LCR-001', subtitle: 'Legal Analysis Report', icon: <Scale size={18} className="text-[#F0C66A]" /> },
  hr:           { label: 'HR 研判 · HRM-001',  subtitle: 'HR Analysis Report',    icon: <Scale size={18} className="text-[#6BA0FF]" /> },
  finance:      { label: '财务研判 · FIN-001',  subtitle: 'Finance Analysis',      icon: <Scale size={18} className="text-[#3DD68C]" /> },
  compliance:   { label: '合规研判 · CPL-001',  subtitle: 'Compliance Report',     icon: <Scale size={18} className="text-[#F5A524]" /> },
  'supply-chain': { label: '供应链研判 · SCM-001', subtitle: 'Supply Chain Analysis', icon: <Scale size={18} className="text-[#C26AF5]" /> },
  investment:   { label: '投资研判 · INV-001',  subtitle: 'Investment Analysis',   icon: <Scale size={18} className="text-[#F0C66A]" /> },
  sales:        { label: '销售研判 · SLS-001',  subtitle: 'Sales Analysis',        icon: <Scale size={18} className="text-[#F0C66A]" /> },
  marketing:    { label: '营销研判 · MKT-001',  subtitle: 'Marketing Analysis',    icon: <Scale size={18} className="text-[#F0C66A]" /> },
  ecommerce:    { label: '电商研判 · ECO-001',  subtitle: 'Ecommerce Analysis',    icon: <Scale size={18} className="text-[#F0C66A]" /> },
  ops:          { label: '运营研判 · OPS-001',  subtitle: 'Operations Analysis',   icon: <Scale size={18} className="text-[#F0C66A]" /> },
  battery_pack: { label: '电池研判 · BAT-001',  subtitle: 'Battery Analysis',      icon: <Scale size={18} className="text-[#F0C66A]" /> },
};

import React from 'react';

interface LegalReportHeaderProps {
  taskId: string;
  taskTitle: string;
  createdAt: string;
  domain?: ManorDomain;
}

export function LegalReportHeader({ taskId, taskTitle, createdAt, domain = 'legal' }: LegalReportHeaderProps) {
  const meta = DOMAIN_META[domain] ?? DOMAIN_META.legal;

  return (
    <div className="space-y-4">
      {/* Top nav */}
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/command-center"
          className="inline-flex items-center gap-1.5 rounded-full border border-white/8 bg-white/[0.03] px-3 py-1.5 text-[11px] text-[#9AA3C4] transition hover:border-white/15 hover:text-[#F5E9C9]"
        >
          <ArrowLeft size={11} />
          返回指挥台
        </Link>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-full border border-white/8 bg-white/[0.03] px-3 py-1.5 text-[11px] text-[#9AA3C4] transition hover:border-white/15 hover:text-[#F5E9C9]"
          title="导出报告（EXP-002）"
        >
          <Download size={11} />
          导出报告
        </button>
        <Link
          href={`/scribe?manor=${domain}`}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/8 bg-white/[0.03] px-3 py-1.5 text-[11px] text-[#9AA3C4] transition hover:border-white/15 hover:text-[#F5E9C9]"
        >
          <BookOpen size={11} />
          历史比对
        </Link>
      </div>

      {/* Seal */}
      <div
        className="relative overflow-hidden rounded-[20px] border p-6"
        style={{
          borderColor: 'rgba(240,198,106,0.25)',
          background: 'radial-gradient(ellipse 100% 60% at 50% 0%, rgba(240,198,106,0.08), transparent 65%), linear-gradient(180deg, rgba(10,8,4,0.96), rgba(4,6,14,0.94))',
          boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
        }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(240,198,106,0.5), transparent)' }}
        />
        <div className="flex items-start gap-4">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
            style={{
              background: 'linear-gradient(135deg, rgba(240,198,106,0.2), rgba(138,106,42,0.08))',
              border: '1px solid rgba(240,198,106,0.3)',
            }}
          >
            {meta.icon}
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="rounded-full px-3 py-1 text-[11px] font-semibold tracking-[0.15em]"
                style={{
                  background: 'rgba(240,198,106,0.1)',
                  border: '1px solid rgba(240,198,106,0.25)',
                  color: '#F0C66A',
                }}
              >
                {meta.label}
              </span>
              <span className="text-[11px] uppercase tracking-[0.2em] text-[#6A7299]">
                {meta.subtitle}
              </span>
            </div>
            <h1 className="mt-2 text-[22px] font-bold leading-tight text-[#F6EFD8]">
              {taskTitle}
            </h1>
            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-[#6A7299]">
              <Clock size={11} />
              {new Date(createdAt).toLocaleString('zh-CN')} · 案件 ID: {taskId}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
