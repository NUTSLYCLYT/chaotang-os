'use client';

import { Archive, Clipboard, ExternalLink, FileSearch, RefreshCw, ShieldCheck } from 'lucide-react';

import { GlassPanel } from '@/features/shangshufang/components/atoms';
import type { IntelSignal } from '@/types/intel';

import {
  isLiveBrief,
  resolveBriefSourceLabel,
  type JinyiweiBrief,
  type JinyiweiBriefPhase,
} from '../lib/jinyiwei-brief-contract';
import { JinyiweiNextRoute } from './JinyiweiNextRoute';

function GateRow({ pass, unknown, text }: { pass?: boolean; unknown?: boolean; text: string }) {
  const tone = unknown ? '#F5A524' : pass ? '#3DD68C' : '#F43F5E';
  return (
    <div className="flex items-start gap-2 text-[10px] leading-4">
      <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: tone }} />
      <span style={{ color: tone }}>{text}</span>
    </div>
  );
}

function IdleVerdict() {
  return (
    <div className="grid min-h-[460px] place-items-center px-5 text-center">
      <div>
        <ShieldCheck className="mx-auto text-[#E0553A]" />
        <h3 className="mt-3 font-serif text-base font-black text-[#EDE3C6]">等待密报</h3>
        <p className="mt-2 text-[10px] leading-5 text-[#747D9B]">完成采证后，这里显示可信度硬门、入库裁决、归档状态和建议流向。</p>
      </div>
    </div>
  );
}

function SelectedSignalVerdict({ signal, source }: { signal: IntelSignal; source: 'turso' | 'fallback' }) {
  const urls = signal.sources.filter((item) => Boolean(item.url));
  return (
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3" data-testid="jinyiwei-signal-verdict">
      <section className="rounded-xl border border-white/[0.08] bg-[#05070D]/48 p-3">
        <div className="text-[9px] uppercase tracking-[0.16em] text-[#8F835F]">已采集情报</div>
        <h3 className="mt-2 text-[12px] font-semibold leading-5 text-[#EAEEFB]">{signal.title}</h3>
        <p className="mt-2 text-[10px] leading-5 text-[#A7AFC6]">{signal.summary}</p>
      </section>
      <section className="rounded-xl border border-white/[0.08] bg-[#05070D]/48 p-3">
        <div className="mb-2 text-[9px] uppercase tracking-[0.16em] text-[#8F835F]">数据质量门</div>
        <div className="space-y-2">
          <GateRow pass={urls.length > 0} text={urls.length > 0 ? `${urls.length} 个公开来源 URL` : '没有公开来源 URL'} />
          <GateRow pass={source === 'turso'} text={source === 'turso' ? '来自真实主库' : 'FALLBACK 样例，不得入库'} />
          <GateRow unknown text="尚未经过本次 /api/intel/brief 确定性核验" />
        </div>
      </section>
      {urls.length > 0 && (
        <section className="space-y-2 rounded-xl border border-white/[0.08] bg-[#05070D]/48 p-3">
          <div className="text-[9px] uppercase tracking-[0.16em] text-[#8F835F]">公开来源</div>
          {urls.map((item, index) => <a key={`${item.name}-${index}`} href={item.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 break-all text-[9px] text-[#60A5FA]"><ExternalLink size={9} />{item.name}</a>)}
        </section>
      )}
    </div>
  );
}

export function JinyiweiVerdictRail({
  brief,
  phase,
  selectedSignal,
  signalSource,
  onRerun,
}: {
  brief: JinyiweiBrief | null;
  phase: JinyiweiBriefPhase;
  selectedSignal: IntelSignal | null;
  signalSource: 'turso' | 'fallback';
  onRerun: () => void;
}) {
  const copyCaseId = () => {
    if (brief?.case_id) void navigator.clipboard?.writeText(brief.case_id);
  };
  const urls = brief?.items.map((item) => item.evidence_ref).filter((value): value is string => Boolean(value && /^https?:\/\//i.test(value))) ?? [];
  const primary = brief?.items.some((item) => item.primary_source === true) ?? false;
  const corroborated = brief?.items.some((item) => (item.distinct_sources ?? 0) >= 2) ?? false;
  const hardClaims = brief?.items.filter((item) => item.hard_claim === true).length ?? 0;

  return (
    <GlassPanel accent="#E0553A" className="min-h-0" data-testid="jinyiwei-verdict-rail">
      <div className="flex items-start justify-between gap-2 px-4 pt-4">
        <div>
          <div className="section-eyebrow text-[#8F835F]">右栏 · 核验处置</div>
          <h2 className="mt-1 font-serif text-[17px] font-black text-[#F5E9C9]">判真假与去向</h2>
        </div>
        {brief && <span className="rounded border border-white/[0.10] px-2 py-1 font-mono text-[8px] text-[#9AA3C4]">{resolveBriefSourceLabel(brief)}</span>}
      </div>

      {!brief && !selectedSignal ? <IdleVerdict /> : !brief && selectedSignal ? <SelectedSignalVerdict signal={selectedSignal} source={signalSource} /> : brief ? (
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
          <section className="rounded-xl border border-white/[0.08] bg-[#05070D]/48 p-3">
            <div className="mb-2 flex items-center gap-2 text-[9px] uppercase tracking-[0.16em] text-[#8F835F]"><ShieldCheck size={11} className="text-[#E0553A]" />可信度硬门</div>
            <div className="space-y-2">
              <GateRow pass={brief.provenance?.deterministic_gated === true} text={brief.provenance?.deterministic_gated ? '确定性可信度门已执行' : '确定性门未确认'} />
              <GateRow pass={primary} text={primary ? '包含一手来源' : '没有一手来源'} />
              <GateRow pass={corroborated || primary} text={corroborated ? '存在多源印证' : primary ? '一手来源可直接采信' : '缺少多源印证'} />
              <GateRow pass={hardClaims === 0 || primary} text={hardClaims > 0 ? `${hardClaims} 条硬声明；${primary ? '已有一手来源' : '必须人工核实'}` : '未识别到认证、数字或绝对化硬声明'} />
              <GateRow pass={isLiveBrief(brief)} text={isLiveBrief(brief) ? '真实来源标签有效' : 'FALLBACK，不得形成事实结论'} />
            </div>
          </section>

          <section className="rounded-xl border border-white/[0.08] bg-[#05070D]/48 p-3">
            <div className="mb-2 flex items-center gap-2 text-[9px] uppercase tracking-[0.16em] text-[#8F835F]"><FileSearch size={11} className="text-[#E0553A]" />裁决统计</div>
            <div className="grid grid-cols-3 gap-1.5 text-center">
              {(['入库', '待核', '拒'] as const).map((decision) => {
                const count = brief.items.filter((item) => item.impact === decision).length;
                const tone = decision === '入库' ? '#3DD68C' : decision === '待核' ? '#F5A524' : '#F43F5E';
                return <div key={decision} className="rounded-lg border border-white/[0.07] bg-white/[0.02] px-2 py-2"><div className="font-mono text-base font-bold" style={{ color: tone }}>{count}</div><div className="text-[8px] text-[#747D9B]">{decision}</div></div>;
              })}
            </div>
          </section>

          <section className="rounded-xl border border-white/[0.08] bg-[#05070D]/48 p-3">
            <div className="mb-2 flex items-center gap-2 text-[9px] uppercase tracking-[0.16em] text-[#8F835F]"><Archive size={11} className="text-[#D4A84B]" />归档状态</div>
            <div className="break-all font-mono text-[9px] text-[#C8B890]">{brief.provenance?.archive_id || '未归档'}</div>
            <div className="mt-1 text-[9px] text-[#747D9B]">门状态：{brief.provenance?.gate || '未知'}</div>
          </section>

          <JinyiweiNextRoute light={brief.light} />

          {urls.length > 0 && <a href={urls[0]} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[9px] text-[#60A5FA]"><ExternalLink size={9} />查看首个公开来源</a>}
        </div>
      ) : null}

      {brief && phase !== 'collecting' && (
        <div className="grid grid-cols-2 gap-2 border-t border-[#E0553A]/18 px-4 py-3">
          <button type="button" onClick={copyCaseId} className="inline-flex items-center justify-center gap-1 rounded-full border border-white/[0.10] bg-white/[0.03] px-3 py-2 text-[10px] text-[#BFC7DD]"><Clipboard size={10} />复制密报编号</button>
          <button type="button" onClick={onRerun} className="inline-flex items-center justify-center gap-1 rounded-full border border-[#E0553A]/35 bg-[#E0553A]/9 px-3 py-2 text-[10px] text-[#E88973]"><RefreshCw size={10} />重新采证</button>
        </div>
      )}
    </GlassPanel>
  );
}
