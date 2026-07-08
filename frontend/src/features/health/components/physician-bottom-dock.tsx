/**
 * 太医院 · 底部 Dock（取代右侧 chat panel）
 *
 * 组合：BottomDock + 太医 SVG 头像 + focus 响应面板 + 真实问诊对话
 *
 * 数据来源：/api/orchestration/run SSE（三省审议流水线）
 *   - 问诊请求 → 中书省调用 query_health_profile 工具读 Turso 健康档案
 *   - 回答带 citations，标注数据来源
 */

'use client';

import { BottomDock } from '@/features/shared/components/bottom-dock';
import { usePhysicianChat } from '@/lib/hooks/use-physician-chat';
import { PhysicianPersona, moodFromScore } from './physician-persona';
import { useHealthFocus } from './health-focus-context';
import { ORGAN_ATLAS, STATUS_META } from '../lib/organs';
import { MERIDIANS } from '../lib/meridians';
import { expertsForOrgan, expertsForMeridian, EXPERTS } from '../lib/experts';
import { Activity, Hospital, Star, CalendarCheck, Hand, Flower2 } from 'lucide-react';

const HEALTH_ACCENT = '#34D399';

const QUICK = [
  '今日血压如何？',
  '看最近睡眠',
  '推荐今日运动',
  '脾经虚该怎么调',
  '生化指标有异常吗',
  '推荐一位心内医生',
];

export function PhysicianBottomDock({ totalScore }: { totalScore?: number }) {
  const { focus } = useHealthFocus();
  const mood = moodFromScore(totalScore);

  // 太医院专属 hook：对接 /api/orchestration/run SSE + query_health_profile Turso 工具
  const { messages, handleSend } = usePhysicianChat(
    '陛下晨安，臣太医已阅昨日脉案。心率平稳、血压尚佳，唯脾经活力略低。今日可议。',
  );

  const focusPanel = (() => {
    if (focus.kind === 'module') {
      const tone = focus.tone ?? HEALTH_ACCENT;
      return (
        <div className="space-y-3">
          <div>
            <div className="text-[9px] uppercase tracking-[0.22em]" style={{ color: tone }}>
              Taiyi Focus · {focus.moduleId}
            </div>
            <div className="mt-1 text-[22px] font-semibold text-[#F5E9C9]">{focus.title}</div>
          </div>
          <div
            className="rounded-lg border px-3 py-2 text-[12px] leading-6 text-[#D6CCB0]"
            style={{ borderColor: `${tone}33`, background: `${tone}0d` }}
          >
            {focus.summary}
          </div>
          <div className="rounded-lg border border-[#F0C66A]/25 bg-[#F0C66A]/[0.055] px-3 py-2">
            <div className="text-[9px] uppercase tracking-[0.2em] text-[#F0C66A]">太医建议</div>
            <div className="mt-1 text-[12px] leading-6 text-[#E8D9A8]">{focus.nextAction}</div>
          </div>
        </div>
      );
    }

    if (focus.kind === 'organ') {
      const organ = ORGAN_ATLAS.find((o) => o.id === focus.organId);
      if (!organ) return null;
      const experts = expertsForOrgan(focus.organId);
      const meta = STATUS_META[organ.status];
      return (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[9px] uppercase tracking-[0.22em]" style={{ color: meta.color }}>
                Focus · {organ.nameEn}
              </div>
              <div className="flex items-baseline gap-2">
                <div className="text-[22px] font-semibold text-[#F5E9C9]">{organ.nameCn}</div>
                <div
                  className="rounded-full px-2 py-0.5 text-[10px]"
                  style={{ background: `${meta.color}18`, color: meta.color, border: `1px solid ${meta.color}55` }}
                >
                  {meta.label} · {organ.score}
                </div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <div className="rounded-lg border border-[#6BA0FF]/25 bg-[#6BA0FF]/06 p-2.5">
              <div className="flex items-center gap-1 text-[9px] uppercase tracking-[0.2em] text-[#6BA0FF]">
                <Activity size={10} />
                现代医学
              </div>
              <div className="mt-1 text-[11px] leading-6 text-[#C8CDD8]">{organ.functionWest}</div>
            </div>
            <div className="rounded-lg border border-[#F0C66A]/25 bg-[#F0C66A]/06 p-2.5">
              <div className="flex items-center gap-1 text-[9px] uppercase tracking-[0.2em] text-[#F0C66A]">
                <Flower2 size={10} />
                中医视角
              </div>
              <div className="mt-1 text-[11px] leading-6 text-[#C8CDD8]">{organ.functionTcm}</div>
            </div>
          </div>
          {experts.length > 0 && <ExpertRow experts={experts} title="相关专家与城市医院" />}
        </div>
      );
    }

    if (focus.kind === 'meridian') {
      const m = MERIDIANS.find((x) => x.id === focus.meridianId);
      const p = m?.points.find((pt) => pt.id === focus.pointId) ?? m?.points[0];
      const experts = expertsForMeridian(focus.meridianId);
      if (!m) return null;
      return (
        <div className="space-y-3">
          <div>
            <div className="text-[9px] uppercase tracking-[0.22em]" style={{ color: m.color }}>
              {m.nameCn} · {m.element} 行
            </div>
            {p && (
              <div className="mt-1 flex items-baseline gap-2">
                <div className="text-[22px] font-semibold text-[#F5E9C9]">{p.nameCn}</div>
                <span className="font-mono text-[12px]" style={{ color: m.color }}>
                  {p.code}
                </span>
              </div>
            )}
            {p && (
              <>
                <div className="mt-2 rounded-lg border border-white/8 bg-white/[0.03] px-2.5 py-2 text-[11px] leading-6 text-[#C8CDD8]">
                  <span className="text-[9px] uppercase tracking-[0.18em] text-[#8F835F]">主治：</span> {p.function}
                </div>
                <div className="mt-2 rounded-lg border border-[#34D399]/40 bg-[#34D399]/08 px-2.5 py-2 text-[11px] leading-6 text-[#D6CCB0]">
                  <Hand size={10} className="mr-1 inline" style={{ color: HEALTH_ACCENT }} />
                  <span className="text-[9px] uppercase tracking-[0.18em] text-[#34D399]">按摩：</span>
                  {p.massage}
                </div>
              </>
            )}
          </div>
          {experts.length > 0 && <ExpertRow experts={experts} title="推荐中医与针灸师" />}
        </div>
      );
    }

    // home — 占位信息，待 Turso 数据加载后由 useTaiyiDashboard 替换
    return (
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {[
          { label: '今日脉象', body: '心率 62 稳 · 血压 118/76 · 血氧 97%', color: HEALTH_ACCENT },
          { label: '昨夜睡眠', body: '7h 12m · 深睡占 22% · 节律前移 18 分', color: '#6BA0FF' },
          { label: '本周要事', body: '3 项复诊提醒 · 1 次一键体检待发起', color: '#F5A524' },
          { label: '风险告警', body: '脾经活力下降 · 建议观察饮食与情绪', color: '#F43F5E' },
        ].map((h) => (
          <div
            key={h.label}
            className="rounded-lg border p-2.5"
            style={{
              borderColor: `${h.color}33`,
              background: `linear-gradient(160deg, ${h.color}0a, rgba(0,0,0,0.3))`,
            }}
          >
            <div className="text-[10px] uppercase tracking-[0.2em]" style={{ color: h.color }}>
              {h.label}
            </div>
            <div className="mt-1 text-[11px] leading-6 text-[#D6CCB0]">{h.body}</div>
          </div>
        ))}
      </div>
    );
  })();

  return (
    <BottomDock
      title="Imperial Physician"
      name="太医 · 孙思邈堂"
      accent={HEALTH_ACCENT}
      avatar={<PhysicianPersona mood={mood} size="sm" />}
      quickPrompts={QUICK}
      messages={messages}
      placeholder="请陛下问诊..."
      sendLabel="问诊"
      onSend={handleSend}
      badges={totalScore !== undefined ? [{ label: '脉象', value: `${totalScore}` }] : []}
      focusPanel={focusPanel}
      collapsedTeaser={
        focus.kind === 'module'
          ? `${focus.title}：${focus.summary}`
          : undefined
      }
      showCollapsedQuickPrompts={false}
    />
  );
}

function ExpertRow({
  experts,
  title,
}: {
  experts: typeof EXPERTS;
  title: string;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-1 text-[9px] uppercase tracking-[0.22em] text-[#8F835F]">
        <Hospital size={10} style={{ color: HEALTH_ACCENT }} />
        {title}
      </div>
      <div className="flex flex-wrap gap-2">
        {experts.slice(0, 4).map((e) => (
          <div
            key={e.id}
            className="flex items-center gap-2 rounded-lg border border-white/8 bg-white/[0.02] px-2.5 py-1.5"
          >
            <div
              className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold"
              style={{
                background: 'radial-gradient(circle at 30% 30%, rgba(240,198,106,0.6), rgba(240,198,106,0.1))',
                border: '1px solid rgba(240,198,106,0.5)',
                color: '#F5E9C9',
              }}
            >
              {e.name.charAt(0)}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <span className="text-[11px] font-semibold text-[#F5E9C9]">{e.name}</span>
                {e.online && (
                  <span className="rounded border border-[#34D399]/50 bg-[#34D399]/10 px-1 text-[8px] text-[#34D399]">
                    线上
                  </span>
                )}
              </div>
              <div className="text-[9px] text-[#9AA3C4]">
                {e.hospital} · {e.city}
              </div>
              <div className="flex items-center gap-1 text-[9px]">
                <Star size={8} className="text-[#F0C66A]" fill="currentColor" />
                <span className="font-mono text-[#F5E9C9]">{e.rating}</span>
                <span className="text-[#34D399]">· {e.next_slot}</span>
              </div>
            </div>
            <button
              type="button"
              className="flex items-center gap-0.5 rounded-md border px-2 py-0.5 text-[9px]"
              style={{ borderColor: `${HEALTH_ACCENT}55`, background: `${HEALTH_ACCENT}14`, color: HEALTH_ACCENT }}
            >
              <CalendarCheck size={9} />
              挂号
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
