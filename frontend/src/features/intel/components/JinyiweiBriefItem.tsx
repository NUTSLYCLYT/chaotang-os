import { ExternalLink, FileSearch } from 'lucide-react';

import { evidenceHref, type JinyiweiBriefItem as BriefItem } from '../lib/jinyiwei-brief-contract';

export function JinyiweiBriefItem({ item, index }: { item: BriefItem; index: number }) {
  const tone = item.impact === '入库' ? '#3DD68C' : item.impact === '待核' ? '#F5A524' : '#F43F5E';
  const href = evidenceHref(item.evidence_ref);
  return (
    <article className="rounded-xl border border-[#8B1A1A]/18 bg-[#080B14]/58 p-3" data-testid="jinyiwei-brief-item">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border border-[#D4A84B]/25 font-mono text-[9px] text-[#D4A84B]">{index + 1}</span>
          <h3 className="text-[12px] font-semibold leading-5 text-[#ECE4CF]">{item.title}</h3>
        </div>
        <span className="shrink-0 rounded border px-2 py-0.5 font-mono text-[9px]" style={{ borderColor: `${tone}55`, color: tone }}>
          {item.impact || item.level}
        </span>
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <div className="rounded-lg border border-white/[0.06] bg-black/15 px-2.5 py-2">
          <div className="text-[8px] tracking-[0.14em] text-[#6A7299]">可信度</div>
          <div className="mt-1 text-[10px] text-[#C8B890]">{item.odds || '未证实'}</div>
        </div>
        <div className="rounded-lg border border-white/[0.06] bg-black/15 px-2.5 py-2">
          <div className="flex items-center gap-1 text-[8px] tracking-[0.14em] text-[#6A7299]"><FileSearch size={9} />证据</div>
          {href ? (
            <a href={href} target="_blank" rel="noreferrer" className="mt-1 flex items-center gap-1 break-all text-[9px] text-[#60A5FA] hover:text-[#F0C66A]">
              <ExternalLink size={9} />查看公开来源
            </a>
          ) : (
            <div className="mt-1 break-all text-[9px] text-[#8A92AC]">{item.evidence_ref || '未提供公开来源'}</div>
          )}
        </div>
      </div>
      {item.vet_reason && <div className="mt-2 text-[9px] leading-4 text-[#8F98B2]">核验依据：{item.vet_reason}</div>}
      {item.sources && item.sources.length > 0 && (
        <div className="mt-2 space-y-1">
          {item.sources.map((source, sourceIndex) => (
            <div key={`${source.name}-${sourceIndex}`} className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-white/[0.06] bg-black/10 px-2.5 py-1.5 text-[8px] text-[#7E86A8]">
              {source.url ? <a href={source.url} target="_blank" rel="noreferrer" className="text-[#60A5FA] hover:text-[#F0C66A]">{source.name}</a> : <span>{source.name}</span>}
              <span>类型：{source.tier || item.odds || '未分级'}</span>
              <span>发布日期：{source.published_at ? new Date(source.published_at).toLocaleDateString('zh-CN') : '未提供'}</span>
            </div>
          ))}
        </div>
      )}
      {item.fix && <div className="mt-2 rounded-lg border border-[#F5A524]/18 bg-[#F5A524]/7 px-2.5 py-2 text-[9px] leading-4 text-[#D3A84C]">补证要求：{item.fix}</div>}
    </article>
  );
}
