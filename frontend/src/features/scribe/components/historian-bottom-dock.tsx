/**
 * 史馆 · 史官底部 Dock
 */

'use client';

import { ScrollText, Tag, Award, AlertTriangle, Clock } from 'lucide-react';
import { BottomDock } from '@/features/shared/components/bottom-dock';
import { HistorianPersona, type HistorianMood } from './historian-persona';
import { useScribeFocus } from './scribe-focus-context';
import { useDockChat } from '@/lib/hooks/use-dock-chat';
import { ANNALS_ENTRIES, OUTCOME_META } from '../lib/annals-entries';

const GOLD = '#F0C66A';

const QUICK = [
  '近期最值得回看一卷？',
  '过往失误都栽在哪个口子？',
  '相似的旧案可召回几例？',
  '今年成败比如何？',
  '把近 3 条成案要义抄送丞相',
];

export function HistorianBottomDock() {
  const { focus } = useScribeFocus();

  const mood: HistorianMood =
    focus.kind === 'entry'
      ? (ANNALS_ENTRIES.find((e) => e.id === focus.entryId)?.outcome === 'failure'
          ? 'stern'
          : 'recalling')
      : 'contemplative';

  const { messages, handleSend } = useDockChat(
    '陛下今日安。臣已整理近年十二卷宗 · 七成一败、三混两成。',
  );

  const s = ANNALS_ENTRIES.filter((e) => e.outcome === 'success').length;
  const m = ANNALS_ENTRIES.filter((e) => e.outcome === 'mixed').length;
  const f = ANNALS_ENTRIES.filter((e) => e.outcome === 'failure').length;

  const focusPanel = (() => {
    if (focus.kind === 'entry') {
      const entry = ANNALS_ENTRIES.find((e) => e.id === focus.entryId);
      if (!entry) return null;
      const meta = OUTCOME_META[entry.outcome];
      return (
        <div className="space-y-3">
          <div
            className="rounded-xl border p-3"
            style={{
              borderColor: `${meta.color}55`,
              background: `linear-gradient(135deg, ${meta.color}12, transparent 70%)`,
            }}
          >
            <div className="flex items-center justify-between">
              <div className="text-[9px] uppercase tracking-[0.22em]" style={{ color: meta.color }}>
                {entry.dateLabel} · {entry.category}
              </div>
              <div
                className="flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-bold"
                style={{
                  background: `radial-gradient(circle, ${meta.color}aa, ${meta.color}22)`,
                  color: '#F5E9C9',
                  border: `1px solid ${meta.color}`,
                }}
              >
                {meta.glyph}
              </div>
            </div>
            <div className="mt-1 text-[18px] font-semibold text-[#F5E9C9]">{entry.title}</div>
            <div className="mt-1 text-[11px] text-[#9AA3C4]">{entry.summary}</div>
          </div>

          <div className="rounded-lg border border-white/8 p-2.5 bg-white/[0.03]">
            <div className="text-[9px] uppercase tracking-[0.22em] text-[#8F835F]">
              Lessons · 教训 ({entry.lessons.length})
            </div>
            <ul className="mt-1.5 space-y-1">
              {entry.lessons.map((l, i) => (
                <li key={i} className="flex items-start gap-1.5 text-[10px] leading-5 text-[#D6CCB0]">
                  <span
                    className="mt-[5px] flex h-3 w-3 shrink-0 items-center justify-center rounded-full text-[8px] font-mono"
                    style={{ background: `${GOLD}22`, color: GOLD, border: `1px solid ${GOLD}55` }}
                  >
                    {i + 1}
                  </span>
                  <span>{l}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {entry.relatedDepartments.map((d) => (
              <span
                key={d}
                className="rounded-full border border-[#F0C66A]/30 bg-[#F0C66A]/08 px-2 py-0.5 text-[10px] text-[#F5E9C9]"
              >
                {d}
              </span>
            ))}
          </div>
        </div>
      );
    }

    const recent = ANNALS_ENTRIES[0];
    const failure = ANNALS_ENTRIES.find((e) => e.outcome === 'failure');
    return (
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {[
          {
            icon: Award,
            color: '#3DD68C',
            label: '近期最值得回看',
            body: recent ? `"${recent.title}" — ${recent.summary}` : '',
          },
          {
            icon: AlertTriangle,
            color: '#F43F5E',
            label: '最该警醒一卷',
            body: failure ? `"${failure.title}" — ${failure.summary}` : '',
          },
          {
            icon: Tag,
            color: '#FB923C',
            label: '最高频教训',
            body: '单点依赖 · 预算乐观 · 节奏错配',
          },
          {
            icon: Clock,
            color: GOLD,
            label: '卷宗在录',
            body: `成 ${s} · 混 ${m} · 败 ${f} · 共 ${ANNALS_ENTRIES.length} 卷`,
          },
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
      title="Imperial Historian"
      name="复盘台 · 秉笔司马迁"
      accent={GOLD}
      avatar={<HistorianPersona mood={mood} size="sm" />}
      quickPrompts={QUICK}
      messages={messages}
      placeholder="请陛下问史..."
      sendLabel="问史"
      onSend={handleSend}
      badges={[{ label: '在录', value: `${ANNALS_ENTRIES.length}` }]}
      focusPanel={focusPanel}
    />
  );
}

