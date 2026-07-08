'use client';

/**
 * 户部 · 右栏 急事/在办/已办（M1 · 让部门"活"起来）
 * - 🔴 急事：真 overview（P0/紧急）。🟢
 * - ⚙ 在办进度：哪个司在处理什么 → 需任务态，本版诚实占位"待接"。🟡
 * - ✅ 已办·价值：处理产出 + 价值数字 → 需 outcome 账，本版诚实占位"待接"。🟡
 * 费曼诚实：没有真数据源前不造假活动（铁律13.2，DEMO 不伪装 LIVE）。
 */
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

import { useHubuOverview } from '@/features/hubu/hooks/use-hubu-overview';
import { withRealDecisions, deriveIndustrySignalsFromIntel } from '@/features/hubu/lib/real-decisions';
import { useIntelSignals } from '@/lib/hooks/use-intel-signals';
import type { HubuProject } from '@/lib/contracts/hubu';

const RANK: Record<HubuProject['priority'], number> = { P0: 0, P1: 1, P2: 2 };

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-[16px] border px-3.5 py-3" style={{ borderColor: '#F0C66A1f', background: 'linear-gradient(180deg,#F0C66A0d 0%,rgba(6,8,14,0.92) 100%)' }}>
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.16em] text-[#8f835f]">
        {icon} {title}
      </div>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function PlaceholderRow({ label, note }: { label: string; note: string }) {
  return (
    <div className="rounded-[8px] border border-dashed px-2.5 py-1.5 text-[11.5px]" style={{ borderColor: '#ffffff14' }}>
      <span className="text-[#9aa0ad]">{label}</span>
      <span className="ml-1 text-[#6f6750]">· {note}</span>
    </div>
  );
}

export function HubuActivityRail() {
  const { overview, isLoading } = useHubuOverview();
  const { signals: intelSignals } = useIntelSignals();
  // 样本只在「加载完成且真行确为空」时兜底,绝不在加载中或有真行时混入急事(与 cockpit 口径统一,会审 HIGH-2)。
  const realProjects = overview?.projects ?? [];
  const industrySignals = deriveIndustrySignalsFromIntel(intelSignals);
  const source = !isLoading && realProjects.length === 0 ? withRealDecisions([], industrySignals) : realProjects;
  const urgent = source
    .filter((p) => p.priority === 'P0' || p.risk_level === 'critical' || p.risk_level === 'high')
    .sort((a, b) => RANK[a.priority] - RANK[b.priority])
    .slice(0, 4);

  return (
    <div className="flex flex-col gap-3 pr-0.5 xl:h-full xl:overflow-y-auto">
      <Section title={`急事${urgent.length ? ` · ${urgent.length}` : ''}`} icon={<AlertCircle size={13} className="text-[#E5604D]" />}>
        {urgent.length === 0 ? (
          <p className="text-[11.5px] text-[#6f6750]">暂无紧急事项。</p>
        ) : (
          <ul className="space-y-1.5">
            {urgent.map((p) => (
              <li key={p.id} className="rounded-[8px] px-2 py-1.5 text-[12px]" style={{ background: '#E5604D0c' }}>
                <span className="mr-1 text-[10px] font-semibold text-[#E5604D]">{p.priority}</span>
                <span className="text-[#E9DDBE]">{p.title.length > 22 ? `${p.title.slice(0, 22)}…` : p.title}</span>
                <span className="ml-1 text-[#9aa0ad]">{p.requested_budget !== '—' ? p.requested_budget : ''}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="在办进度" icon={<Loader2 size={13} className="text-[#E5B84D]" />}>
        <div className="space-y-1.5">
          <PlaceholderRow label="税务 · 算本月税负" note="待接任务态" />
          <PlaceholderRow label="投资 · 评审储能项目" note="待接任务态" />
        </div>
      </Section>

      <Section title="已办 · 价值" icon={<CheckCircle2 size={13} className="text-[#5FB97A]" />}>
        <div className="space-y-1.5">
          <PlaceholderRow label="税务 · 本月省税 ¥—" note="待接 outcome 账" />
          <PlaceholderRow label="出纳 · 查出对账差错 ¥—" note="待接 outcome 账" />
        </div>
      </Section>
    </div>
  );
}
