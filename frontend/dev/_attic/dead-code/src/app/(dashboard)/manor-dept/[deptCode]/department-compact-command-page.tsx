'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { ArrowUpRight, Bot, CheckCircle2 } from 'lucide-react';
import { assetUrl } from '@/lib/asset';
import { DOCK_BOTTOM_PADDING } from '@/features/shared/components/bottom-dock';
import { imperialModulePanelStyle, imperialModuleTileStyle } from './imperial-panel-style';
import { CourtAmbientLayer } from '@/components/chaotang/visual/CourtAmbientLayer';

const PANEL_ACCENT = '#3DD68C';
const GOLD = '#F0C66A';
const DANGER = '#F43F5E';
const WARN = '#F0A521';

export interface CompactMetric {
  label: string;
  value: string;
  unit?: string;
  delta: string;
  icon: LucideIcon;
}

export interface CompactPanelItem {
  label: string;
  detail: string;
  status: string;
  tone: 'green' | 'amber' | 'red' | 'muted';
}

export interface CompactPanel {
  title: string;
  icon: LucideIcon;
  action?: string;
  href?: string;
  summary: string;
  items: CompactPanelItem[];
}

export interface CompactAgent {
  name: string;
  duty: string;
  output: string;
  status: string;
  tone: 'green' | 'amber' | 'red' | 'muted';
}

export interface DepartmentCompactCommandPageProps {
  backgroundImage: string;
  notifyCount: number;
  eyebrow: string;
  title: string;
  subtitle: string;
  mainIcon: LucideIcon;
  primaryAction: {
    label: string;
    href: string;
    icon: LucideIcon;
  };
  metrics: CompactMetric[];
  panels: CompactPanel[];
  swarmTitle: string;
  swarmAgents: CompactAgent[];
  dock: ReactNode;
}

function toneColor(tone: CompactPanelItem['tone'] | CompactAgent['tone']) {
  if (tone === 'red') return DANGER;
  if (tone === 'amber') return WARN;
  if (tone === 'green') return PANEL_ACCENT;
  return '#6A7299';
}

function StatusDot({ tone }: { tone: CompactPanelItem['tone'] | CompactAgent['tone'] }) {
  const color = toneColor(tone);
  return <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />;
}

function PanelShell({
  title,
  icon: Icon,
  action,
  href,
  children,
}: {
  title: string;
  icon: LucideIcon;
  action?: string;
  href?: string;
  children: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden border backdrop-blur-[8px]" style={imperialModulePanelStyle(PANEL_ACCENT, 'strong')}>
      <span className="pointer-events-none absolute left-2 top-2 h-3 w-3 border-l border-t border-[#3DD68C]/60" />
      <span className="pointer-events-none absolute right-2 top-2 h-3 w-3 border-r border-t border-[#3DD68C]/50" />
      <span className="pointer-events-none absolute bottom-2 left-2 h-3 w-3 border-b border-l border-[#3DD68C]/40" />
      <span className="pointer-events-none absolute bottom-2 right-2 h-3 w-3 border-b border-r border-[#3DD68C]/55" />
      <div className="absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-[#3DD68C]/36 to-transparent" />
      <div className="absolute inset-x-4 bottom-0 h-px bg-gradient-to-r from-transparent via-[#F0C66A]/16 to-transparent" />

      <div className="flex items-center justify-between border-b border-[#3DD68C]/18 px-4 py-2">
        <h2 className="flex items-center gap-2 font-serif text-[15px] font-semibold tracking-[0.08em] text-[#F5E9C9]">
          <Icon size={15} className="text-[#3DD68C]" strokeWidth={1.8} />
          {title}
        </h2>
        {action && href ? (
          <Link
            href={href}
            className="shrink-0 rounded-full border border-[#3DD68C]/25 bg-[#071B22]/85 px-2 py-0.5 text-[10px] text-[#8FF0B7] transition hover:border-[#F0C66A]/45 hover:text-[#F0C66A]"
          >
            {action}
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function DepartmentCompactCommandPage({
  backgroundImage,
  notifyCount,
  eyebrow,
  title,
  subtitle,
  mainIcon: MainIcon,
  primaryAction,
  metrics,
  panels,
  swarmTitle,
  swarmAgents,
  dock,
}: DepartmentCompactCommandPageProps) {
  const PrimaryIcon = primaryAction.icon;

  return (
    <main className={`relative h-screen w-full overflow-hidden bg-[#03060B] text-[#EDE0B8] ${DOCK_BOTTOM_PADDING}`}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `url("${assetUrl(backgroundImage)}")`,
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          backgroundSize: '100% 100%',
        }}
      />
      <CourtAmbientLayer accent={PANEL_ACCENT} density="quiet" />

      <div className="relative z-10 h-full overflow-y-auto px-5 pb-8 pt-5">
        <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-4">
          <header className="relative overflow-hidden border px-4 py-3 backdrop-blur-[8px]" style={imperialModulePanelStyle(PANEL_ACCENT, 'soft')}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-4">
                <div className="grid h-[62px] w-[62px] shrink-0 place-items-center rounded-full border border-[#3DD68C]/50 bg-[#071820]/70 shadow-[0_0_0_5px_rgba(61,214,140,0.08)]">
                  <MainIcon className="text-[#3DD68C]" size={36} strokeWidth={1.5} />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-[0.28em] text-[#8FF0B7]">{eyebrow}</div>
                  <h1 className="whitespace-nowrap font-serif text-[28px] font-semibold tracking-[0.04em] text-[#F4C76B]">
                    {title}
                  </h1>
                  <p className="mt-1 text-[11px] tracking-[0.05em] text-[#D3BD86]">{subtitle}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={primaryAction.href}
                  className="flex h-10 items-center gap-2 rounded-md border border-[#F0C66A]/35 bg-[#F0C66A]/10 px-3 text-[11px] font-semibold text-[#F0C66A] transition hover:bg-[#F0C66A]/16"
                >
                  <PrimaryIcon size={14} />
                  {primaryAction.label}
                  <ArrowUpRight size={12} />
                </Link>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {metrics.map((metric) => {
                    const Icon = metric.icon;
                    return (
                      <div key={metric.label} className="min-w-[112px] border px-3 py-2" style={imperialModuleTileStyle(PANEL_ACCENT)}>
                        <div className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.08em] text-[#8FF0B7]">
                          <Icon size={13} />
                          <span className="truncate">{metric.label}</span>
                        </div>
                        <div className="mt-1 flex items-baseline gap-1.5">
                          <span className="font-serif text-[23px] leading-none text-[#F3C270]">{metric.value}</span>
                          {metric.unit ? <span className="text-[10px] text-[#BDAA7C]">{metric.unit}</span> : null}
                          <span className="ml-auto text-[10px] text-[#8FF0B7]">{metric.delta}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </header>

          <div className="grid gap-4 xl:grid-cols-[360px_minmax(520px,1fr)_380px]">
            <div className="space-y-4">
              {panels.slice(0, 2).map((panel) => (
                <FeaturePanel key={panel.title} panel={panel} />
              ))}
            </div>

            <div className="space-y-4">
              {panels.slice(2, 4).map((panel) => (
                <FeaturePanel key={panel.title} panel={panel} />
              ))}
            </div>

            <div className="space-y-4">
              {panels.slice(4, 6).map((panel) => (
                <FeaturePanel key={panel.title} panel={panel} />
              ))}
              <PanelShell title={swarmTitle} icon={Bot} action="问蜂群" href="/command-center">
                <div className="space-y-2.5 px-4 py-3">
                  {swarmAgents.map((agent) => (
                    <div key={agent.name} className="rounded-md border px-3 py-2" style={imperialModuleTileStyle(PANEL_ACCENT)}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-serif text-[13px] text-[#F5E9C9]">{agent.name}</span>
                        <span className="flex shrink-0 items-center gap-1 text-[10px]" style={{ color: toneColor(agent.tone) }}>
                          <StatusDot tone={agent.tone} />
                          {agent.status}
                        </span>
                      </div>
                      <div className="mt-1 truncate text-[10px] text-[#9AA3C4]">{agent.duty}</div>
                      <div className="mt-1 flex items-center gap-1.5 text-[10px] text-[#EADFBF]">
                        <CheckCircle2 size={11} className="text-[#3DD68C]" />
                        {agent.output}
                      </div>
                    </div>
                  ))}
                </div>
              </PanelShell>
            </div>
          </div>
        </div>
      </div>

      {dock}
    </main>
  );
}

function FeaturePanel({ panel }: { panel: CompactPanel }) {
  return (
    <PanelShell title={panel.title} icon={panel.icon} action={panel.action} href={panel.href}>
      <div className="px-4 py-3">
        <div className="rounded-md border border-[#F0C66A]/20 bg-[#F0C66A]/[0.06] px-3 py-2 text-[11px] leading-5 text-[#EADFBF]">
          {panel.summary}
        </div>
        <div className="mt-3 space-y-2">
          {panel.items.map((item) => (
            <div key={item.label} className="rounded-md border px-3 py-2" style={imperialModuleTileStyle(PANEL_ACCENT)}>
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-serif text-[13px] text-[#F5E9C9]">{item.label}</span>
                <span className="flex shrink-0 items-center gap-1 text-[10px]" style={{ color: toneColor(item.tone) }}>
                  <StatusDot tone={item.tone} />
                  {item.status}
                </span>
              </div>
              <div className="mt-1 truncate text-[10px] text-[#9AA3C4]">{item.detail}</div>
            </div>
          ))}
        </div>
      </div>
    </PanelShell>
  );
}
