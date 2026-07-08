/**
 * 朝堂 OS V2 · agent 说明 tab 内容
 * 渲染 AGENT_PROFILES 中某一部的 guide，完整介绍职责 + 流程 + 术语
 */

'use client';

import { GlassPanel } from '@/components/ui/glass-panel';
import type { AgentProfile } from '@/features/shared/lib/agent-profiles';

export interface AgentGuidePanelProps {
  profile: AgentProfile;
  accent: string;
  personaName: string;
  personaEra: string;
}

export function AgentGuidePanel({ profile, accent, personaName, personaEra }: AgentGuidePanelProps) {
  const { guide, capabilities, resources } = profile;

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.1fr_1fr]">
      {/* 左：主介绍 + 流程 */}
      <GlassPanel variant="gold" tone="flat" padding="lg" className="space-y-6">
        <div>
          <div
            className="text-[11px] font-semibold uppercase tracking-[0.08em]"
            style={{ color: accent, opacity: 0.9 }}
          >
            {personaEra} · 代言人 {personaName}
          </div>
          <h2
            className="mt-2 text-[26px] font-semibold tracking-[0.02em]"
            style={{
              color: '#F5E9C9',
              fontFamily: 'var(--font-serif)',
              textShadow: `0 0 16px ${accent}33`,
            }}
          >
            {guide.headline}
          </h2>
        </div>

        <div className="space-y-4">
          {guide.description.map((p, i) => (
            <p
              key={i}
              className="text-[14px] leading-[1.85]"
              style={{ color: '#C8CDD8' }}
            >
              {p}
            </p>
          ))}
        </div>

        {guide.workflow && guide.workflow.length > 0 && (
          <div>
            <div
              className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em]"
              style={{ color: accent }}
            >
              工作流
            </div>
            <div className="space-y-2">
              {guide.workflow.map((w, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 rounded-md border border-white/5 bg-white/[0.02] px-3 py-2.5"
                >
                  <div
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md font-mono text-[12px] font-bold"
                    style={{
                      background: `${accent}22`,
                      border: `1px solid ${accent}66`,
                      color: accent,
                    }}
                  >
                    {w.step}
                  </div>
                  <div
                    className="pt-0.5 text-[13px] leading-6"
                    style={{ color: '#D6CCB0' }}
                  >
                    {w.detail}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </GlassPanel>

      {/* 右：能力 + 资源 + 术语 */}
      <div className="space-y-5">
        <GlassPanel tone="flat" padding="md">
          <div
            className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em]"
            style={{ color: accent }}
          >
            核心能力
          </div>
          <div className="grid grid-cols-2 gap-2">
            {capabilities.map((cap, i) => (
              <div
                key={i}
                className="flex items-center gap-2 rounded-md border border-white/5 bg-white/[0.02] px-3 py-2 text-[12.5px]"
                style={{ color: '#E6DBBC' }}
              >
                <span
                  className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: accent }}
                />
                {cap}
              </div>
            ))}
          </div>
        </GlassPanel>

        <GlassPanel tone="flat" padding="md">
          <div
            className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em]"
            style={{ color: accent }}
          >
            可调用资源
          </div>
          <div className="flex flex-wrap gap-2">
            {resources.map((r, i) => (
              <div
                key={i}
                className="flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[12px]"
                style={{
                  background: `${accent}11`,
                  borderColor: `${accent}44`,
                  color: '#E6DBBC',
                }}
              >
                <span style={{ color: accent, fontWeight: 600 }}>{r.name}</span>
                {r.type && (
                  <span className="text-[11px] opacity-70" style={{ color: '#8A92AC' }}>
                    · {r.type}
                  </span>
                )}
              </div>
            ))}
          </div>
        </GlassPanel>

        {guide.terms && guide.terms.length > 0 && (
          <GlassPanel tone="flat" padding="md">
            <div
              className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em]"
              style={{ color: accent }}
            >
              术语
            </div>
            <dl className="space-y-2">
              {guide.terms.map((t, i) => (
                <div key={i} className="flex items-start gap-3 text-[12.5px]">
                  <dt
                    className="w-24 shrink-0 font-semibold"
                    style={{ color: accent }}
                  >
                    {t.term}
                  </dt>
                  <dd className="flex-1 leading-6" style={{ color: '#C8CDD8' }}>
                    {t.meaning}
                  </dd>
                </div>
              ))}
            </dl>
          </GlassPanel>
        )}
      </div>
    </div>
  );
}
