'use client';

/**
 * 史馆 · 宣传资料归档卡(2026-06-24 · 完成"放到史馆")。
 *
 * 同源 /api/court/shiguan/promo-archive(= 礼部同一真相源 readPromoSnapshot)。
 * 张小龙建议:默认只显「永久档(可对外·60)」,展会照片(569)折叠成计数,防归档变照片垃圾场。
 * 无真档 → 不渲染(诚实,不占位)。只显元数据(标题/分类),不显文件内容。
 */

import { useEffect, useState } from 'react';
import { withBasePath } from '@/lib/base-path';

interface PromoArchive {
  source: string;
  archivedTotal: number;
  curatedCount: number;
  bulkArchiveCount: number;
  byCategory: Record<string, number>;
  curated: Array<{ title: string; category: string; ext: string }>;
}

export function ShiguanPromoArchive() {
  const [data, setData] = useState<PromoArchive | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(withBasePath('/api/court/shiguan/promo-archive'), { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => { if (alive && b?.data) setData(b.data as PromoArchive); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  if (!data || data.source === 'unavailable' || data.curatedCount === 0) return null;

  const shown = open ? data.curated : data.curated.slice(0, 6);

  return (
    <div className="rounded-2xl border border-gold-300/14 bg-black/18 px-3 py-3 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="section-eyebrow text-gold-200/85">宣传资料归档</div>
        <span className="rounded-full border border-[#F0C66A]/35 bg-[#F0C66A]/10 px-2 py-0.5 text-[9px] text-[#F0C66A]">真 · H盘</span>
      </div>
      <div className="mt-1 text-[11px] text-slatey-400">
        永久档 <span className="font-serif text-[15px] text-gold-gradient">{data.curatedCount}</span> 件（可对外） · 展会留档 {data.bulkArchiveCount} 张（折叠）
      </div>

      <div className="mt-2.5 space-y-1">
        {shown.map((it) => (
          <div key={it.title} className="flex items-center justify-between gap-2 rounded-md border border-white/8 bg-white/[0.02] px-2.5 py-1.5">
            <span className="truncate text-[11px] text-[#D6CCB0]">{it.title}</span>
            <span className="ml-2 shrink-0 font-mono text-[9px] text-slatey-400">{it.category}</span>
          </div>
        ))}
      </div>

      {data.curatedCount > 6 && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="mt-2 text-[10px] text-[#F0C66A]/80 transition hover:text-[#F0C66A]"
        >
          {open ? '收起' : `展开全部 ${data.curatedCount} 件永久档 ↓`}
        </button>
      )}
    </div>
  );
}
