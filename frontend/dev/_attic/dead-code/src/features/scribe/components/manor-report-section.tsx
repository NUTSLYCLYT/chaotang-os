'use client';

import { Brain, Shield, Zap, Building2 } from 'lucide-react';
import { GlassPanel } from '@/components/ui/glass-panel';
import { SectionLabel } from './section-label';
import type { ManorAnalyzeResult } from '@/types/manor';

const DOMAIN_LABELS: Record<string, string> = {
  legal: '律师庄园',
  hr: 'HR 庄园',
  finance: '财务庄园',
  ecommerce: '电商庄园',
  ops: '运维庄园',
  compliance: '合规庄园',
  sales: '销售庄园',
  marketing: '营销庄园',
  battery_pack: '电池Pack庄园',
  'supply-chain': '供应链庄园',
  investment: '投资庄园',
};

const DEPT_LABELS: Record<string, string> = {
  xingbu: '刑部',
  libu_hr: '吏部',
  hubu: '户部',
  libu: '礼部',
  gongbu: '工部',
  bingbu: '兵部',
};

const LIGHT_STYLES: Record<string, string> = {
  green: 'border-[#3DD68C]/30 bg-[#3DD68C]/8 text-[#3DD68C]',
  yellow: 'border-[#F0C66A]/30 bg-[#F0C66A]/8 text-[#F0C66A]',
  red: 'border-[#F58B8B]/30 bg-[#F58B8B]/8 text-[#F58B8B]',
};

interface ManorReportSectionProps {
  report: ManorAnalyzeResult;
}

export function ManorReportSection({ report }: ManorReportSectionProps) {
  return (
    <GlassPanel tone="elevated" padding="md">
      <SectionLabel icon={<Brain size={13} className="text-[#8AA4FF]" />}>
        Manor Intelligence · 庄园研判呈报
      </SectionLabel>

      <div className="mt-3 flex items-center gap-2">
        <span className="rounded-full border border-[#8AA4FF]/20 bg-[#8AA4FF]/10 px-2 py-0.5 font-mono text-[11px] text-[#8AA4FF]">
          {DOMAIN_LABELS[report.domain] ?? report.domain}
        </span>
        <span className="text-[11px] text-[#5A6280]">专家研判 · 已归档</span>
      </div>

      {/* 摘要 */}
      <div className="mt-3 rounded-xl border border-[#8AA4FF]/15 bg-[#8AA4FF]/[0.04] px-4 py-3">
        <div className="text-[11px] uppercase tracking-wider text-[#5A6280]">中枢研判</div>
        <div className="mt-1.5 text-[14px] font-semibold leading-6 text-[#EAEEFB]">
          {report.summary}
        </div>
      </div>

      {/* 风险清单 */}
      {report.risks.length > 0 && (
        <div className="mt-3 space-y-2">
          <div className="text-[11px] uppercase tracking-wider text-[#5A6280]">
            <Shield size={10} className="mr-1 inline" />
            风险清单
          </div>
          {report.risks.map((risk, i) => (
            <div
              key={i}
              className="rounded-xl border border-[#F58B8B]/20 bg-[#F58B8B]/[0.03] px-3 py-2.5"
            >
              <div className="flex items-center gap-1.5">
                <Shield
                  size={10}
                  className={risk.level === 'high' ? 'text-[#F58B8B]' : 'text-[#F0C66A]'}
                />
                <span className="text-[11px] uppercase text-[#6A7299]">
                  {risk.level === 'high' ? '高风险' : '中风险'}
                </span>
              </div>
              <div className="mt-1 text-[12px] font-medium text-[#C8CDD8]">{risk.title}</div>
              {risk.mitigation && (
                <div className="mt-1 text-[11px] text-[#9AA3C4]">建议：{risk.mitigation}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 行动卡 */}
      {report.action_cards.length > 0 && (
        <div className="mt-3">
          <div className="mb-2 text-[11px] uppercase tracking-wider text-[#5A6280]">
            <Zap size={9} className="mr-1 inline" />
            行动卡片
          </div>
          <div className="flex flex-wrap gap-2">
            {report.action_cards.map((card, i) => (
              <div
                key={i}
                className={`rounded-full border px-3 py-1 text-[11px] ${LIGHT_STYLES[card.light] ?? LIGHT_STYLES.yellow}`}
              >
                <span className="font-medium">{card.title}</span>
                <span className="ml-1.5 opacity-60">{card.when}</span>
              </div>
            ))}
          </div>
          {report.action_cards.map((card, i) => (
            <div key={`why-${i}`} className="mt-2 text-[11px] text-[#6A7299]">
              <span className="mr-1 font-medium" style={{ color: card.light === 'green' ? '#3DD68C' : card.light === 'red' ? '#F58B8B' : '#F0C66A' }}>
                {card.title}：
              </span>
              {card.why}
            </div>
          ))}
        </div>
      )}

      {/* 需协同部门 */}
      {report.requires_departments.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <Building2 size={11} className="text-[#6A7299]" />
          <span className="text-[11px] uppercase tracking-wider text-[#5A6280]">需协同</span>
          {report.requires_departments.map((dept) => (
            <span
              key={dept}
              className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] text-[#9AA3C4]"
            >
              {DEPT_LABELS[dept] ?? dept}
            </span>
          ))}
        </div>
      )}
    </GlassPanel>
  );
}
