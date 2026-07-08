'use client';

/**
 * 太医院 · 健康养生与医疗资源台（不诊断版）
 *
 * 定位（2026-06-23 产品纠偏）：太医院是陛下的「健康内务府」——
 *   理养生知识、管自己的起居/用药/练形、通天下医馆与急救，
 *   **但绝不替用户做诊断**。见疑似症状只给"该挂哪科 / 最近医馆 / 急救步骤"，判断交给真医生。
 *
 * 三面板：
 *   左：圣躬起居注（健康自管 · 自录，无真数据时诚实空态，绝不编造体征）
 *   中：养生堂 + 救急门（真·参考内容，零依赖，本页价值主角）
 *   右：天下医馆 + 司药房（资源导航 / 挂号 / 买药入口；碰真实服务的走后端，前端不假成交）
 *   底部 DecreeInput：问养生 / 找医馆 / 查急救 —— 边界安全回应，不诊断。
 *
 * 诚实纪律：本页不展示任何"健康总分/今日诊断/症候预警"等诊断式结论；
 * 自录指标无真数据时显「待录」，资源/挂号/买药未接真实服务时显「待接」，不冒充 LIVE。
 */

import { useRef, useState, type CSSProperties, type ReactNode } from 'react';
import Link from 'next/link';
import {
  Activity,
  BookOpen,
  Footprints,
  HeartPulse,
  MapPin,
  Moon,
  Pill,
  ShieldAlert,
  Siren,
  Utensils,
} from 'lucide-react';
import { assetUrl } from '@/lib/asset';
import { DecreeInput } from '@/features/shangshufang/components/DecreeInput';
import type { DecreeState } from '@/features/shangshufang/types';
import { DOCK_BOTTOM_PADDING } from '@/features/shared/components/bottom-dock';
import { imperialModulePanelStyle } from './imperial-panel-style';
import { useTaiyiDashboard } from '@/features/taiyi/hooks/use-taiyi-dashboard';
import { WellnessSijiHall } from '@/features/health/components/wellness-siji-hall';
import { EmergencyClinicDesk } from '@/features/health/components/emergency-clinic-desk';
import { TaiyiTreasury } from '@/features/health/components/taiyi-treasury';

/* ── 常量 ──────────────────────────────────────────────────────────────────── */

const BG_IMAGE = '/assets/taiyi/taiyiyuan-bg.webp';
const CANVAS_W = 1672;
const CANVAS_H = 941;
const ACCENT = '#34D399';

type Rect = { x: number; y: number; w: number; h: number };


/** 起居自录指标（无真数据 → 诚实「待录」，绝不编造体征） */
const SELF_LOG = [
  { label: '步数', icon: Footprints, unit: '步' },
  { label: '睡眠', icon: Moon, unit: '' },
  { label: '饮水', icon: Activity, unit: 'ml' },
  { label: '体重', icon: HeartPulse, unit: 'kg' },
] as const;

/* ── 定位 ──────────────────────────────────────────────────────────────────── */

function pos({ x, y, w, h }: Rect): CSSProperties {
  return {
    left: `${(x / CANVAS_W) * 100}%`,
    top: `${(y / CANVAS_H) * 100}%`,
    width: `${(w / CANVAS_W) * 100}%`,
    height: `${(h / CANVAS_H) * 100}%`,
  };
}

function Frame({ children, style }: { children: ReactNode; style: CSSProperties }) {
  return (
    <section className="absolute" style={style}>
      <div
        className="relative flex h-full min-h-0 w-full flex-col overflow-hidden border backdrop-blur-[8px]"
        style={imperialModulePanelStyle(ACCENT, 'strong')}
      >
        <span className="pointer-events-none absolute left-0 top-0 h-4 w-4 border-l border-t" style={{ borderColor: `${ACCENT}70` }} />
        <span className="pointer-events-none absolute right-0 top-0 h-4 w-4 border-r border-t" style={{ borderColor: `${ACCENT}70` }} />
        <span className="pointer-events-none absolute bottom-0 left-0 h-4 w-4 border-b border-l" style={{ borderColor: `${ACCENT}55` }} />
        <span className="pointer-events-none absolute bottom-0 right-0 h-4 w-4 border-b border-r" style={{ borderColor: `${ACCENT}55` }} />
        <div className="pointer-events-none absolute inset-x-4 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${ACCENT}55, transparent)` }} />
        {children}
      </div>
    </section>
  );
}

function PanelTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex shrink-0 items-center justify-between border-b px-4 py-2.5" style={{ borderColor: `${ACCENT}18` }}>
      <h2 className="font-serif text-[15px] font-semibold tracking-[0.1em] text-[#CFFFE9]">{title}</h2>
      {hint ? <span className="text-[10px] tracking-[0.08em] text-[#7F9D92]">{hint}</span> : null}
    </div>
  );
}

/** 诚实徽：待录（自录无数据）/ 待接（未接真实服务）。绝不冒充 LIVE。 */
function PendingTag({ text }: { text: string }) {
  return (
    <span
      className="shrink-0 rounded border px-1.5 py-0.5 text-[9.5px] font-mono tracking-[0.06em]"
      style={{ color: '#BDAA7C', borderColor: 'rgba(240,198,106,0.34)' }}
    >
      {text}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */

export default function TaiyiClient() {
  return <TaiyiScene />;
}

function TaiyiScene() {
  // 真数据：太医院健康档案。dataSource==='fallback' 视为无真数据（诚实空态），
  // 绝不把 mock 当真展示。
  const { dashboard, isLoading, error } = useTaiyiDashboard();
  const profile = dashboard && dashboard.dataSource !== 'fallback' ? dashboard.profile : null;
  const metrics = profile?.metrics ?? [];
  // 自录指标按名称匹配真 metric（步数/睡眠/饮水/体重）。
  const findMetric = (label: string) =>
    metrics.find((m) => m.name.includes(label) || label.includes(m.name)) ?? null;

  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const [decreeText, setDecreeText] = useState('');
  const [decreeState, setDecreeState] = useState<DecreeState>('idle');
  const [decreeMsg, setDecreeMsg] = useState<string | null>(null);

  function handleSend() {
    const text = decreeText.trim();
    if (!text) return;
    setDecreeState('consulting');
    window.setTimeout(() => {
      // 边界安全回应：太医院不诊断，只导航到养生 / 医馆 / 急救。
      setDecreeMsg(
        '太医院只理养生、备急救、通医馆，不替陛下断病。若有疑似症状，请就近就医或拨 120。' +
          '可问我：养生起居建议 / 附近医馆挂号 / 急救处置步骤。',
      );
      setDecreeState('submitted');
      setDecreeText('');
    }, 240);
  }

  return (
    <main className={`relative h-screen w-full overflow-hidden bg-[#040A10] ${DOCK_BOTTOM_PADDING}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={assetUrl(BG_IMAGE)} alt="太医院" draggable={false} className="absolute inset-0 h-full w-full object-cover opacity-95" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_24%,rgba(8,31,40,0.20),transparent_38%),linear-gradient(180deg,rgba(1,5,8,0.24),rgba(1,5,8,0.52))]" />

      {/* ═══════════ 边界条（硬红线·常驻）═══════════ */}
      <div className="absolute inset-x-0 top-0 z-20 mx-auto max-w-[1680px] px-4 pt-3">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border px-5 py-2.5 backdrop-blur-lg" style={{ borderColor: `${ACCENT}30`, background: `${ACCENT}09` }}>
          <div className="flex flex-wrap items-center gap-3 text-[12px]">
            <span className="text-[11px] font-semibold uppercase tracking-[0.26em] text-[#34D399]">太医院</span>
            <span className="flex items-center gap-1.5 text-[#F5E9C9]">
              <ShieldAlert size={13} className="text-[#F0C66A]" />
              本院不诊病 · 只理养生、备急救、通医馆
            </span>
            <span className="text-[#9CD7C0]">疑似症状请就医或拨 120</span>
          </div>
          <div className="flex items-center gap-2">
            {[
              { label: '养生堂', icon: BookOpen },
              { label: '救急门', icon: Siren },
              { label: '天下医馆', icon: MapPin },
            ].map(({ label, icon: Icon }) => (
              <span key={label} className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold tracking-[0.05em]" style={{ borderColor: `${ACCENT}33`, color: ACCENT, background: `${ACCENT}0c` }}>
                <Icon size={12} strokeWidth={1.8} />
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ═══════════ 三面板 ═══════════ */}
      <div className="absolute inset-x-0 top-[112px] bottom-[112px] z-10 min-h-0 overflow-x-auto overflow-y-hidden">
        <div className="relative h-full min-w-[1180px] xl:min-w-0">

          {/* ═══════════ 左：圣躬起居注（自管·自录）═══════════ */}
          <Frame style={pos({ x: 28, y: 42, w: 320, h: 800 })}>
            <PanelTitle title="圣躬起居注" hint={isLoading ? '同步中' : error ? '离线' : profile ? '已接真库' : '自录'} />
            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 space-y-3">
              <p className="text-[12px] leading-6 text-[#9CD7C0]">起居自管：自己记一笔，太医院只为陛下留底与提醒，不据此断病。</p>
              <div className="grid grid-cols-2 gap-2">
                {SELF_LOG.map(({ label, icon: Icon, unit }) => {
                  const m = findMetric(label);
                  return (
                  <div key={label} className="rounded-md border px-2.5 py-2" style={{ borderColor: `${ACCENT}22`, background: `${ACCENT}07` }}>
                    <div className="flex items-center gap-1.5 text-[10px]" style={{ color: ACCENT }}>
                      <Icon size={12} strokeWidth={1.8} />
                      {label}
                    </div>
                    <div className="mt-1 flex items-end justify-between">
                      <span className="font-mono text-[15px] text-[#7F9D92]">{m ? String(m.value) : '—'}</span>
                      {m ? <PendingTag text="已录" /> : <PendingTag text="待录" />}
                    </div>
                    {(m?.unit ?? unit) ? <div className="text-[9px] text-[#5F7D72]">{m?.unit ?? unit}</div> : null}
                  </div>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => { setDecreeText('起居注：今日想记一笔 '); window.requestAnimationFrame(() => inputRef.current?.focus()); }}
                className="w-full rounded-md border px-3 py-2 text-left text-[12px] font-semibold transition hover:brightness-110"
                style={{ borderColor: `${ACCENT}30`, background: `${ACCENT}0d`, color: '#CFFFE9' }}
              >
                ✎ 记一笔起居
              </button>
              <div className="rounded-md border p-3" style={{ borderColor: '#F0C66A22', background: '#F0C66A06' }}>
                <div className="text-[10px] uppercase tracking-[0.18em] text-[#D8C18A]">用药提醒 · 司药房</div>
                <div className="mt-1.5 flex items-center justify-between">
                  <p className="text-[12px] leading-5 text-[#CDE5D8]">尚未登记服药计划</p>
                  <PendingTag text="待录" />
                </div>
                <button
                  type="button"
                  onClick={() => { setDecreeText('司药房：登记一项服药提醒 '); window.requestAnimationFrame(() => inputRef.current?.focus()); }}
                  className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-[#F0C66A] transition hover:brightness-110"
                >
                  <Pill size={12} /> 登记服药提醒
                </button>
              </div>
            </div>
          </Frame>

          {/* ═══════════ 中：养生堂 + 救急门（真内容·主角）═══════════ */}
          <Frame style={pos({ x: 372, y: 42, w: 928, h: 800 })}>
            <div className="shrink-0 px-6 py-4" style={{ borderBottom: `1px solid ${ACCENT}18` }}>
              <div className="text-[10px] uppercase tracking-[0.22em] text-[#83E6BF]">Imperial Medical Bureau · 养生 & 急救</div>
              <h1 className="mt-0.5 font-serif text-[26px] font-semibold tracking-[0.12em] text-[#E8FFF5]">太 医 院</h1>
              <div className="mt-0.5 text-[12px] tracking-[0.14em] text-[#D8C18A]">养生 · 起居 · 急救 · 通医馆（不诊断）</div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {/* —— 养生四时堂（养生#1 英雄位）—— */}
              <WellnessSijiHall />
              {/* —— 急救·就医台（需求#2 · 只显示不自动操作）—— */}
              <EmergencyClinicDesk />
              {/* —— 太医典藏阁（需求#3 · 体检档案/科普/前沿 · 只显示）—— */}
              <TaiyiTreasury />
            </div>
          </Frame>

          {/* ═══════════ 右：天下医馆（资源 / 挂号 / 买药入口）═══════════ */}
          <Frame style={pos({ x: 1324, y: 42, w: 320, h: 800 })}>
            <PanelTitle title="天下医馆" hint="资源" />
            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 space-y-3">
              <p className="text-[12px] leading-6 text-[#9CD7C0]">通周边与全国医疗资源。挂号、买药对接真实服务，太医院只引路、不替陛下成交。</p>

              {[
                { label: '周边医馆', body: '按定位查最近医院 / 诊所 / 药房', icon: MapPin },
                { label: '全国三甲', body: '科室 · 专家 · 预约挂号目录', icon: HeartPulse },
              ].map(({ label, body, icon: Icon }) => (
                <div key={label} className="rounded-md border p-3" style={{ borderColor: `${ACCENT}22`, background: `${ACCENT}06` }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: '#CFFFE9' }}>
                      <Icon size={13} strokeWidth={1.8} style={{ color: ACCENT }} /> {label}
                    </div>
                    <PendingTag text="待接" />
                  </div>
                  <p className="mt-1.5 text-[11px] leading-5 text-[#9CD7C0]">{body}</p>
                </div>
              ))}

              <div className="grid grid-cols-2 gap-2 pt-1">
                {[
                  { label: '请脉挂号', icon: HeartPulse, tone: ACCENT },
                  { label: '抓药买药', icon: Pill, tone: '#F0C66A' },
                ].map(({ label, icon: Icon, tone }) => (
                  <div
                    key={label}
                    className="flex flex-col gap-1 rounded-md border px-2.5 py-2.5"
                    style={{ borderColor: `${tone}33`, background: `${tone}0c` }}
                  >
                    <span className="flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: tone }}>
                      <Icon size={13} strokeWidth={1.8} /> {label}
                    </span>
                    <PendingTag text="待接真实服务" />
                  </div>
                ))}
              </div>

              <Link
                href="/health"
                className="flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-[11px] font-semibold transition hover:brightness-110"
                style={{ borderColor: `${ACCENT}30`, color: ACCENT, background: `${ACCENT}0c` }}
              >
                进健康中枢 →
              </Link>
            </div>
          </Frame>

        </div>
      </div>

      <DecreeInput
        value={decreeText}
        onChange={(v) => {
          setDecreeText(v);
          // 发送成功/出错后再次输入时复位，避免输入框停在 submitted/error 态被冻住。
          if (decreeState === 'error' || decreeState === 'submitted') {
            setDecreeState('idle');
            setDecreeMsg(null);
          }
        }}
        mode="ask"
        onModeChange={() => {}}
        onSend={handleSend}
        state={decreeState}
        message={decreeMsg}
        inputRef={inputRef}
        availableModes={['ask']}
        context={{
          title: '太医院 · 养生 / 医馆 / 急救（不诊断）',
          evidenceLabel: '养生常识与急救步骤仅供参考',
          nextDepartments: '太医院',
          readiness: 'info',
          sourceLabel: '太医院 · 不诊断',
        }}
        showContext={false}
      />
    </main>
  );
}
