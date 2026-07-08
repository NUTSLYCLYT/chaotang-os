'use client';

/**
 * 兵部 · 锦衣卫验客备战面板（2026-06-28）
 *
 * 合法版「锦衣卫验客 → 兵部备战 → 人扳机」：
 *   - 纯客户端算（qualifyProspect），数据不出浏览器、不写库、不抓取、不外联。
 *   - AI 只动脑：判断是否目标客户 + 开场角度；真外联是 humanActions（人扳机，铁律9/13.2）。
 *   - 示例数据标【示例】；现场可"试算"一个（你手填，合法来源）。
 */
import { useMemo, useState } from 'react';
import { ShieldCheck, ShieldAlert, CircleDashed, Hand, RadioTower } from 'lucide-react';

import { CustomerUploadQualify } from '@/features/bingbu/components/customer-upload-qualify';
import {
  qualifyProspect,
  QUALIFY_VERDICT_CN,
  type IcpProfile,
  type Prospect,
  type QualifyVerdict,
} from '@/features/bingbu/lib/prospect-qualify';
import { useIntelSignals } from '@/lib/hooks/use-intel-signals';
import type { IntelSignal } from '@/lib/contracts/intel';

const ACCENT = '#7FC9A8';

// 你的目标客户画像（示例；正式版由老板自定义）。
const DEMO_ICP: IcpProfile = {
  industries: ['新能源', '储能', '光伏'],
  sizeMin: 50,
  sizeMax: 5000,
  signals: ['扩产', '招聘销售', '换供应商', '新工厂', '融资'],
  disqualifiers: ['竞品', '已合作'],
};

const DEMO_PROSPECTS: Prospect[] = [
  {
    id: 'demo-1', name: '【示例】华东某储能集成商', industry: '储能', size: 320,
    observedSignals: ['扩产', '招聘销售总监'], source: 'public_business',
    contacts: [{ channel: 'email', value: '公开商务邮箱', consent: true }],
  },
  {
    id: 'demo-2', name: '【示例】某光伏初创', industry: '光伏', size: 18,
    observedSignals: [], source: 'inbound',
  },
  {
    id: 'demo-3', name: '【示例】本地餐饮连锁', industry: '餐饮', size: 200,
    observedSignals: ['开新店'], source: 'referral',
  },
];

const VERDICT_STYLE: Record<QualifyVerdict, { color: string; bg: string; Icon: typeof ShieldCheck }> = {
  target: { color: '#5FB97A', bg: '#5FB97A1f', Icon: ShieldCheck },
  maybe: { color: '#E0B764', bg: '#E0B7641f', Icon: CircleDashed },
  not_target: { color: '#9aa0ad', bg: '#ffffff0d', Icon: ShieldAlert },
};

const BINGBU_SIGNAL_RE = /竞争|竞品|客户|渠道|销售|商机|线索|招标|投标|订单|扩产|采购|海外|market|sales|customer|competitor|tender|order/i;

function signalToObservedSignals(signal: IntelSignal): string[] {
  const text = `${signal.title} ${signal.summary}`;
  const candidates = ['扩产', '采购', '招标', '投标', '订单', '渠道', '海外', '竞品', '融资', '招聘'];
  return candidates.filter((keyword) => text.includes(keyword));
}

function signalToProspectDraft(signal: IntelSignal): Pick<Prospect, 'name' | 'industry' | 'observedSignals'> {
  return {
    name: signal.title.replace(/^【[^】]+】/, '').slice(0, 28),
    industry: signal.industry && signal.industry !== '综合' ? signal.industry : '',
    observedSignals: signalToObservedSignals(signal),
  };
}

function ProspectCard({ p, icp }: { p: Prospect; icp: IcpProfile }) {
  const r = useMemo(() => qualifyProspect(p, icp), [p, icp]);
  const s = VERDICT_STYLE[r.verdict];
  return (
    <div className="rounded-[14px] border px-4 py-3" style={{ borderColor: `${s.color}33`, background: 'rgba(255,255,255,0.025)' }}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13.5px] font-semibold text-[#E9DDBE]">{p.name}</span>
        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-medium" style={{ background: s.bg, color: s.color }}>
          <s.Icon size={12} /> {QUALIFY_VERDICT_CN[r.verdict]} · {r.matchScore}
        </span>
      </div>
      <ul className="mt-2 space-y-0.5 text-[11.5px] leading-relaxed text-[#c6bb9d]">
        {r.reasons.map((x, i) => <li key={i}>· {x}</li>)}
      </ul>
      {r.verdict !== 'not_target' && (
        <div className="mt-2 rounded-lg border px-2.5 py-1.5 text-[11.5px]" style={{ borderColor: `${ACCENT}22`, background: '#ffffff05' }}>
          <span className="text-[#8f835f]">开场角度：</span><span className="text-[#d8cba8]">{r.outreachAngle}</span>
        </div>
      )}
      {/* 人扳机：永远是人做 */}
      <div className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-[#b6ab8c]">
        <Hand size={12} className="mt-0.5 shrink-0" style={{ color: ACCENT }} />
        <span><span className="font-medium" style={{ color: ACCENT }}>人扳机：</span>{r.humanActions[0]}</span>
      </div>
      {r.complianceFlags.length > 0 && (
        <div className="mt-1.5 text-[10.5px] leading-relaxed text-[#d8a657]">
          ⚠️ 合规：{r.complianceFlags.join('；')}
        </div>
      )}
    </div>
  );
}

function JinyiweiSignalProspects({
  onUseSignal,
}: {
  onUseSignal: (draft: Pick<Prospect, 'name' | 'industry' | 'observedSignals'>) => void;
}) {
  const { signals, source, isLoading, isError } = useIntelSignals({ categories: ['opportunity'] });
  const bingbuSignals = useMemo(
    () =>
      signals
        .filter((signal) => {
          if (signal.routedTo?.includes('bing_bu')) return true;
          return BINGBU_SIGNAL_RE.test(`${signal.title} ${signal.summary} ${signal.industry}`);
        })
        .slice(0, 4),
    [signals],
  );

  return (
    <div className="rounded-[14px] border px-4 py-3" style={{ borderColor: '#6BA0FF33', background: '#6BA0FF0a' }}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <RadioTower size={15} className="text-[#6BA0FF]" />
          <span className="text-[13.5px] font-semibold text-[#F5E9C9]">锦衣卫外部信号 → 兵部候选</span>
        </div>
        <span className="rounded-full border px-2 py-0.5 text-[10px] text-[#9AA3C4]" style={{ borderColor: '#ffffff18' }}>
          {source === 'turso' ? '真实情报' : '兜底演示'}
        </span>
      </div>

      <p className="mt-1.5 text-[11.5px] leading-relaxed text-[#9a9170]">
        只把有来源的机会信号带入验客；若显示兜底演示，不能当真销售名单，需锦衣卫补真实来源。
      </p>

      {isLoading ? <p className="mt-2 text-[11.5px] text-[#8f835f]">锦衣卫信号读取中…</p> : null}
      {isError ? <p className="mt-2 text-[11.5px] text-[#E5604D]">锦衣卫信号暂不可用，先用上传名单或手填试算。</p> : null}
      {!isLoading && !isError && bingbuSignals.length === 0 ? (
        <p className="mt-2 text-[11.5px] text-[#8f835f]">暂无可转兵部的机会信号。</p>
      ) : null}

      <div className="mt-2 space-y-2">
        {bingbuSignals.map((signal) => {
          const draft = signalToProspectDraft(signal);
          const observedSignals = draft.observedSignals ?? [];
          const hasSource = signal.sources.some((item) => item.url);
          return (
            <div key={signal.id} className="rounded-[12px] border px-3 py-2.5" style={{ borderColor: '#ffffff12', background: '#ffffff05' }}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-[12.5px] font-medium text-[#E9DDBE]" title={signal.title}>
                    {signal.title}
                  </div>
                  <div className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-[#b6ab8c]">{signal.summary}</div>
                </div>
                <button
                  type="button"
                  onClick={() => onUseSignal(draft)}
                  className="shrink-0 rounded-full border px-2.5 py-1 text-[11px] text-[#DDEBFF] transition hover:text-white"
                  style={{ borderColor: '#6BA0FF44', background: '#6BA0FF14' }}
                >
                  带入试算
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
                <span className="rounded px-1.5 py-0.5 text-[#6BA0FF]" style={{ background: '#6BA0FF18' }}>
                  {signal.category === 'opportunity' ? '机会' : signal.category}
                </span>
                <span className="rounded px-1.5 py-0.5 text-[#E0B764]" style={{ background: '#E0B76418' }}>
                  {signal.credibility}
                </span>
                <span className="rounded px-1.5 py-0.5 text-[#9AA3C4]" style={{ background: '#ffffff0d' }}>
                  {hasSource ? `来源 ${signal.sources.length}` : '待补来源'}
                </span>
                {observedSignals.map((tag) => (
                  <span key={tag} className="rounded px-1.5 py-0.5 text-[#7FC9A8]" style={{ background: '#7FC9A818' }}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function BingbuProspectPanel() {
  const [tryName, setTryName] = useState('');
  const [tryIndustry, setTryIndustry] = useState('');
  const [trySignals, setTrySignals] = useState('');
  const tryProspect: Prospect | null = tryName.trim()
    ? {
        id: 'try', name: tryName.trim(), industry: tryIndustry.trim() || undefined,
        observedSignals: trySignals.split(/[、,，\s]+/).filter(Boolean), source: 'user_provided',
      }
    : null;

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto">
      <header>
        <div className="text-[10px] uppercase tracking-[0.2em]" style={{ color: ACCENT }}>PROSPECT QUALIFICATION</div>
        <h2 className="section-title mt-1">锦衣卫验客 · 兵部备战</h2>
        <p className="mt-1 text-[11.5px] leading-relaxed text-[#9a9170]">
          先验"是不是你的目标客户"——别把力气花在不会买的人身上。AI 动脑判断 + 备好开场角度；
          <span style={{ color: ACCENT }}>加好友、发消息那一下，永远是你亲自做</span>（合法、不封号）。
        </p>
      </header>

      <CustomerUploadQualify />

      <JinyiweiSignalProspects
        onUseSignal={(draft) => {
          setTryName(draft.name);
          setTryIndustry(draft.industry ?? '');
          setTrySignals((draft.observedSignals ?? []).join('、'));
        }}
      />

      {/* 现场试算 */}
      <div className="rounded-[14px] border px-3.5 py-3" style={{ borderColor: `${ACCENT}26`, background: `${ACCENT}0a` }}>
        <div className="text-[11px] font-medium text-[#d8cba8]">试一个（你手填，合法来源）</div>
        <div className="mt-2 grid grid-cols-1 gap-1.5">
          <input value={tryName} onChange={(e) => setTryName(e.target.value)} placeholder="公司/人名"
            className="rounded-md border bg-black/20 px-2.5 py-1.5 text-[12px] text-[#E9DDBE] outline-none" style={{ borderColor: '#ffffff18' }} />
          <input value={tryIndustry} onChange={(e) => setTryIndustry(e.target.value)} placeholder="行业（如 储能）"
            className="rounded-md border bg-black/20 px-2.5 py-1.5 text-[12px] text-[#E9DDBE] outline-none" style={{ borderColor: '#ffffff18' }} />
          <input value={trySignals} onChange={(e) => setTrySignals(e.target.value)} placeholder="观察到的信号（扩产、招聘…顿号分隔）"
            className="rounded-md border bg-black/20 px-2.5 py-1.5 text-[12px] text-[#E9DDBE] outline-none" style={{ borderColor: '#ffffff18' }} />
        </div>
        {tryProspect && <div className="mt-2"><ProspectCard p={tryProspect} icp={DEMO_ICP} /></div>}
      </div>

      {/* 示例客户已验 */}
      <div className="text-[10px] uppercase tracking-[0.18em] text-[#8f835f]">示例：锦衣卫带来的候选，已验</div>
      <div className="space-y-2">
        {DEMO_PROSPECTS.map((p) => <ProspectCard key={p.id} p={p} icp={DEMO_ICP} />)}
      </div>

      <p className="mt-1 text-[10.5px] leading-relaxed text-[#6f6750]">
        合规底线：不抓取陌生人个人数据；联系方式须来自公开商务/对方留资/转介；首次触达由人发起，不自动加好友/群发（铁律9）。
      </p>
    </div>
  );
}
