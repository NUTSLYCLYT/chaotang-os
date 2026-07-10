import { Archive, Clock, FileSearch, Loader2, ScrollText, ShieldAlert } from 'lucide-react';

import type { IntelSignal } from '@/types/intel';

import {
  isLiveBrief,
  resolveBriefSourceLabel,
  type JinyiweiBrief,
  type JinyiweiBriefPhase,
} from '../lib/jinyiwei-brief-contract';
import { JinyiweiBriefItem } from './JinyiweiBriefItem';

const LIGHT_META = {
  green: { label: '情报可信', tone: '#3DD68C', seal: '准' },
  yellow: { label: '尚待复核', tone: '#F5A524', seal: '核' },
  red: { label: '情报勿信', tone: '#F43F5E', seal: '驳' },
  black: { label: '重大风险', tone: '#A855F7', seal: '危' },
} as const;

function EmptyScroll({ title, body, icon: Icon = ScrollText }: { title: string; body: string; icon?: typeof ScrollText }) {
  return (
    <div className="grid h-full min-h-[520px] place-items-center px-8 text-center">
      <div className="max-w-md">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-full border border-[#8B1A1A]/35 bg-[#8B1A1A]/8 text-[#E0553A]">
          <Icon size={30} />
        </div>
        <h2 className="mt-5 font-serif text-xl font-black tracking-[0.1em] text-[#EDE3C6]">{title}</h2>
        <p className="mt-3 text-[12px] leading-6 text-[#8189A4]">{body}</p>
      </div>
    </div>
  );
}

function HistoricalSignalScroll({ signal, source }: { signal: IntelSignal; source: 'turso' | 'fallback' }) {
  const hasUrls = signal.sources.some((item) => Boolean(item.url));
  return (
    <div className="h-full min-h-0 overflow-y-auto p-5 md:p-7" data-testid="jinyiwei-historical-scroll">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#8B1A1A]/20 pb-4">
        <div>
          <div className="text-[9px] uppercase tracking-[0.24em] text-[#A98A49]">已采集情报 · 非本次核验回奏</div>
          <h2 className="mt-2 font-serif text-xl font-black text-[#EDE3C6]">{signal.title}</h2>
        </div>
        <span className="rounded border px-2 py-1 font-mono text-[9px]" style={{ borderColor: source === 'turso' ? '#3DD68C55' : '#8A6A2A66', color: source === 'turso' ? '#3DD68C' : '#C8A85A' }}>
          {source === 'turso' ? 'TURSO' : 'FALLBACK'}
        </span>
      </div>
      {source === 'fallback' && (
        <div className="mt-4 rounded-lg border border-[#8A6A2A]/35 bg-[#8A6A2A]/10 px-3 py-2 text-[10px] leading-5 text-[#C8A85A]">
          这是兜底样例，只用于界面浏览，不能作为事实、不能入库，也不能显示绿灯。
        </div>
      )}
      <section className="mt-5">
        <div className="text-[9px] tracking-[0.18em] text-[#8F835F]">情报摘要</div>
        <p className="mt-2 text-[12px] leading-7 text-[#C5BDD0]">{signal.summary}</p>
      </section>
      <section className="mt-5 space-y-2">
        <div className="text-[9px] tracking-[0.18em] text-[#8F835F]">公开来源</div>
        {hasUrls ? signal.sources.map((item, index) => (
          <div key={`${item.name}-${index}`} className="rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-2">
            <div className="text-[10px] text-[#D9DDEB]">{item.name}</div>
            {item.url && <a href={item.url} target="_blank" rel="noreferrer" className="mt-1 block break-all text-[9px] text-[#60A5FA]">{item.url}</a>}
          </div>
        )) : <div className="rounded-lg border border-[#F43F5E]/20 bg-[#F43F5E]/7 px-3 py-2 text-[10px] text-[#E88973]">没有公开来源 URL，不允许标记为已核实。</div>}
      </section>
    </div>
  );
}

export function JinyiweiBriefScroll({
  query,
  brief,
  phase,
  error,
  completedAt,
  selectedSignal,
  signalSource,
}: {
  query: string;
  brief: JinyiweiBrief | null;
  phase: JinyiweiBriefPhase;
  error: string | null;
  completedAt: string | null;
  selectedSignal: IntelSignal | null;
  signalSource: 'turso' | 'fallback';
}) {
  if (phase === 'collecting') return <EmptyScroll title="锦衣卫正在采证" body="正在执行真实检索与确定性可信度核验。首期后端未提供细粒度进度事件，因此不模拟虚假阶段。" icon={Loader2} />;
  if (phase === 'error') return <EmptyScroll title="采证未完成" body={error || '后端暂时不可用，请检查登录态和服务配置后重试。'} icon={ShieldAlert} />;
  if ((phase === 'empty' || brief?.items.length === 0) && brief) return <EmptyScroll title="未获取到可核情报" body="锦衣卫未形成事实结论，也没有编造条目。请调整核查目标或补充调用方证据链。" icon={FileSearch} />;
  if (!brief && selectedSignal) return <HistoricalSignalScroll signal={selectedSignal} source={signalSource} />;
  if (!brief) return <EmptyScroll title="密报尚未启封" body="请在左栏输入需要核查的项目、竞品、风险或外部信号。锦衣卫会把检索结果核验后呈为一份可追溯密报。" />;

  const meta = LIGHT_META[brief.light];
  const sourceLabel = resolveBriefSourceLabel(brief);
  return (
    <div className="relative h-full min-h-0 overflow-hidden" data-testid="jinyiwei-brief-scroll">
      <div className="pointer-events-none absolute inset-x-8 top-3 h-px bg-gradient-to-r from-transparent via-[#D4A84B]/50 to-transparent" />
      <div className="h-full min-h-0 overflow-y-auto p-5 md:p-7">
        <header className="relative border-b border-[#8B1A1A]/22 pb-5 text-center">
          <div className="text-[9px] uppercase tracking-[0.28em] text-[#A98A49]">锦衣卫 · 密报卷轴</div>
          <div className="mt-2 text-[10px] text-[#6A7299]">密报编号 {brief.case_id}</div>
          <h2 className="mt-4 font-serif text-2xl font-black tracking-[0.08em] text-[#EDE3C6]">{brief.headline}</h2>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <span className="rounded border px-2 py-1 font-mono text-[9px]" style={{ borderColor: `${meta.tone}55`, color: meta.tone }}>{meta.label}</span>
            <span className="rounded border border-white/[0.10] px-2 py-1 font-mono text-[9px] text-[#9AA3C4]">{sourceLabel}</span>
            {completedAt && <span className="inline-flex items-center gap-1 text-[9px] text-[#6A7299]"><Clock size={9} />{new Date(completedAt).toLocaleString('zh-CN')}</span>}
          </div>
          <div className="absolute right-1 top-0 grid h-16 w-16 place-items-center rounded-full border-2 font-serif text-2xl font-black opacity-70" style={{ borderColor: meta.tone, color: meta.tone, transform: 'rotate(-8deg)' }}>{meta.seal}</div>
        </header>

        <section className="mt-5 rounded-xl border border-[#D4A84B]/16 bg-[#D4A84B]/[0.035] p-4">
          <div className="text-[9px] tracking-[0.18em] text-[#A98A49]">奉查事项</div>
          <p className="mt-2 text-[12px] leading-6 text-[#D9D2C0]">{query}</p>
        </section>

        {brief.shielded && (
          <section className="mt-4 rounded-xl border border-[#E0553A]/20 bg-[#E0553A]/7 p-4">
            <div className="flex items-center gap-2 text-[9px] tracking-[0.18em] text-[#E88973]"><ShieldAlert size={11} />挡门结果</div>
            <p className="mt-2 text-[11px] leading-5 text-[#C8B890]">{brief.shielded}</p>
          </section>
        )}

        <section className="mt-5 space-y-2.5">
          <div className="flex items-center gap-2 text-[9px] tracking-[0.18em] text-[#A98A49]"><FileSearch size={11} />事实声明与证据</div>
          {brief.items.map((item, index) => <JinyiweiBriefItem key={`${item.title}-${index}`} item={item} index={index} />)}
        </section>

        <footer className="mt-5 grid gap-2 border-t border-[#8B1A1A]/20 pt-4 text-[9px] text-[#747D9B] sm:grid-cols-3">
          <div><Archive size={10} className="mb-1 text-[#D4A84B]" />归档：{brief.provenance?.archive_id || '未归档'}</div>
          <div>确定性门：{brief.provenance?.deterministic_gated ? '已执行' : '未确认'}</div>
          <div>真实性：{isLiveBrief(brief) ? '有真实来源标签' : 'FALLBACK，不得形成事实结论'}</div>
        </footer>
      </div>
    </div>
  );
}
