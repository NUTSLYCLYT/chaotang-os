'use client';

import { AlertTriangle, AlertCircle, Info } from 'lucide-react';
import type { ManorRiskItem } from '@/types/manor';

const LEVEL_CONFIG = {
  high:   { label: '高风险', icon: AlertTriangle, color: '#F58B8B', bg: 'rgba(245,139,139,0.06)', border: 'rgba(245,139,139,0.2)' },
  medium: { label: '中风险', icon: AlertCircle,  color: '#F0C66A', bg: 'rgba(240,198,106,0.06)', border: 'rgba(240,198,106,0.2)' },
  low:    { label: '低风险', icon: Info,          color: '#9AA3C4', bg: 'rgba(154,163,196,0.05)', border: 'rgba(154,163,196,0.15)' },
} as const;

interface RiskListProps {
  risks: ManorRiskItem[];
}

export function RiskList({ risks }: RiskListProps) {
  return (
    <div className="space-y-3">
      {risks.map((risk, i) => {
        const cfg = LEVEL_CONFIG[risk.level];
        const Icon = cfg.icon;
        return (
          <div
            key={i}
            className="rounded-xl p-4"
            style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}
          >
            <div className="flex items-start gap-3">
              <Icon size={14} className="mt-0.5 shrink-0" style={{ color: cfg.color }} />
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                    style={{ background: `${cfg.color}18`, color: cfg.color, border: `1px solid ${cfg.color}30` }}
                  >
                    {cfg.label}
                  </span>
                  <span className="text-[13px] font-semibold text-[#F5E9C9]">{risk.title}</span>
                </div>
                <p className="mt-2 text-[12px] leading-relaxed text-[#9AA3C4]">
                  <span className="text-[#6A7299]">建议：</span>
                  {risk.mitigation}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
