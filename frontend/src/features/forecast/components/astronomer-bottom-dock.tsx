/**
 * 观天台 · 钦天监底部 Dock
 *
 * v2 — 对话走 /api/qintian/chat（快速 LLM + citations）
 *      或 /api/orchestration/run（深度三省审议）。
 */

'use client';

import { useEffect, useRef } from 'react';
import {
  Star,
  ShieldAlert,
  Target,
  Calendar,
  ArrowRight,
  Wind,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { BottomDock } from '@/features/shared/components/bottom-dock';
import { AstronomerPersona, moodFromConfidence } from './astronomer-persona';
import { useForecastFocus } from './forecast-focus-context';
import { useQintianDock } from '@/features/qintian/hooks/use-qintian-dock';
import type { ForecastScenario, ScenarioName } from '@/types/forecast';

const ACCENT = '#B794F4';

const SCENARIO_COLOR: Record<ScenarioName, string> = {
  optimistic: '#3DD68C',
  base: '#F0C66A',
  pessimistic: '#F43F5E',
};
const SCENARIO_LABEL: Record<ScenarioName, string> = {
  optimistic: '上策',
  base: '中策',
  pessimistic: '下策',
};

const QUICK = [
  '此策应否立即启？',
  '最临近的风口何时？',
  '若下策触发，当如何预备？',
  '今日星象可点一条',
  '天气对供应链有何影响',
  '三省详细审议当前情景',
];

export function AstronomerBottomDock({
  scenarios,
  confidence,
  initialAsk,
}: {
  scenarios: ForecastScenario[];
  confidence?: number;
  /** 上书房「问钦天监」带来的问题（/forecast?ask=…），到站即自动送问并展开对话 */
  initialAsk?: string | null;
}) {
  const { focus } = useForecastFocus();
  const mood = moodFromConfidence(confidence);

  // 当前焦点情景作为 LLM 上下文
  const activeScenario =
    focus.kind === 'scenario' ? (scenarios.find((s) => s.id === focus.scenarioId) ?? null) : null;

  const { messages, citations, toolsUsed, handleSend } = useQintianDock(
    '陛下吉安。紫微稳，太白略西，中策概率最高。陛下可议。',
    activeScenario,
  );

  const initialAskSentRef = useRef(false);
  useEffect(() => {
    if (!initialAsk?.trim() || initialAskSentRef.current) return;
    initialAskSentRef.current = true;
    handleSend(initialAsk.trim());
  }, [initialAsk, handleSend]);

  const focusPanel = (() => {
    if (focus.kind === 'scenario') {
      const sc = scenarios.find((s) => s.id === focus.scenarioId);
      if (!sc) return null;
      const color = SCENARIO_COLOR[sc.name];
      const pct = Math.round(sc.probability * 100);
      const conf = Math.round(sc.confidence * 100);
      return (
        <div className="space-y-3">
          <div
            className="rounded-xl border p-3"
            style={{
              borderColor: `${color}55`,
              background: `linear-gradient(135deg, ${color}12, transparent 70%)`,
            }}
          >
            <div className="text-[9px] uppercase tracking-[0.22em]" style={{ color }}>
              {SCENARIO_LABEL[sc.name]}
            </div>
            <div className="mt-1 text-[18px] font-semibold text-[#F5E9C9]">{sc.label}</div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-center text-[10px]">
              <Stat label="概率" value={`${pct}%`} color={color} />
              <Stat label="置信" value={`${conf}%`} color={color} />
              <Stat label="风口" value={`${sc.riskWindows.length}`} color={color} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <ListCard title="触发条件" items={sc.triggerConditions.slice(0, 3).map((t) => t.description)} color={color} icon={ShieldAlert} />
            <ListCard title="预备动作" items={sc.preActions.slice(0, 3)} color="#3DD68C" icon={Target} />
          </div>

          <ListCard
            title="风口"
            items={sc.riskWindows.slice(0, 3).map((r) => `${r.period} · ${r.opportunity}`)}
            color={color}
            icon={Calendar}
          />

          {/* LLM 引用佐证 */}
          {citations.length > 0 && (
            <div
              className="rounded-lg border p-2.5"
              style={{ borderColor: `${ACCENT}33`, background: `${ACCENT}08` }}
            >
              <div
                className="mb-1.5 flex items-center gap-1 text-[9px] uppercase tracking-[0.2em]"
                style={{ color: ACCENT }}
              >
                <ExternalLink size={9} />
                引用佐证 ({citations.length})
              </div>
              <ul className="space-y-1">
                {citations.slice(0, 3).map((c, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-[10px] leading-5 text-[#C8CDD8]">
                    <ArrowRight size={9} className="mt-[3px] shrink-0" style={{ color: ACCENT }} />
                    <span>{c.excerpt}</span>
                  </li>
                ))}
              </ul>
              {toolsUsed.length > 0 && (
                <div className="mt-1.5 text-[9px]" style={{ color: '#6A7299' }}>
                  工具: {toolsUsed.join(', ')}
                </div>
              )}
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {[
          { icon: Star, label: '星象', body: '紫微稳 · 太白略西 · 中策概率最高', color: '#F0C66A' },
          { icon: Wind, label: '风口', body: '未来 14 日 3 个窗口 · 1 个高优', color: ACCENT },
          { icon: ShieldAlert, label: '下策触发', body: '地缘冲突升级 × 流动性收紧同现', color: '#F43F5E' },
          { icon: Sparkles, label: '玄机', body: '本卦既济 · 变卦未济 · 宜守成 + 防微', color: ACCENT },
        ].map((h) => {
          const Icon = h.icon;
          return (
            <div
              key={h.label}
              className="rounded-lg border p-2.5"
              style={{
                borderColor: `${h.color}33`,
                background: `linear-gradient(160deg, ${h.color}0a, rgba(0,0,0,0.3))`,
              }}
            >
              <div
                className="flex items-center gap-1 text-[10px] uppercase tracking-[0.2em]"
                style={{ color: h.color }}
              >
                <Icon size={10} />
                {h.label}
              </div>
              <div className="mt-1 text-[11px] leading-6 text-[#D6CCB0]">{h.body}</div>
            </div>
          );
        })}
      </div>
    );
  })();

  return (
    <BottomDock
      title="Imperial Astronomer"
      name="钦天监正 · 李淳风"
      accent={ACCENT}
      avatar={<AstronomerPersona mood={mood} size="sm" />}
      quickPrompts={QUICK}
      messages={messages}
      placeholder="请陛下问占..."
      sendLabel="占验"
      onSend={handleSend}
      badges={confidence !== undefined ? [{ label: '置信', value: `${confidence}%` }] : []}
      focusPanel={focusPanel}
      defaultExpanded={Boolean(initialAsk?.trim())}
    />
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded border border-white/8 bg-white/[0.03] p-1.5">
      <div className="text-[8px] uppercase tracking-[0.18em] text-[#6A7299]">{label}</div>
      <div className="mt-0.5 font-mono text-[13px] font-bold" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

function ListCard({
  title,
  items,
  color,
  icon: Icon,
}: {
  title: string;
  items: string[];
  color: string;
  icon: typeof Star;
}) {
  return (
    <div
      className="rounded-lg border p-2.5"
      style={{ borderColor: `${color}33`, background: `${color}0a` }}
    >
      <div
        className="flex items-center gap-1 text-[9px] uppercase tracking-[0.2em]"
        style={{ color }}
      >
        <Icon size={10} />
        {title}
      </div>
      <ul className="mt-1.5 space-y-1">
        {items.map((t, i) => (
          <li key={i} className="flex items-start gap-1.5 text-[10px] leading-5 text-[#C8CDD8]">
            <ArrowRight size={9} className="mt-[3px] shrink-0" style={{ color }} />
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

