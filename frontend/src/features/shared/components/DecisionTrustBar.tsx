'use client';

/**
 * 决策可信度条(2026-06-25 · Deming · 客户长期信任度量)。
 *
 * 把"它帮到我没"变成客户能看的数字:读 decision-judgment(波1 真👍/👎沉淀)→ 显"奏折帮到率 X%·基于 N 条"。
 * 无真样本 → 不渲染(诚实,绝不编一个好看的率)。这是客户自己评出来的信任,不是我们吹的。
 */

import { useEffect, useState } from 'react';
import { withBasePath } from '@/lib/base-path';

interface Trust {
  count: number;
  helpfulRate: number | null;
}

export function DecisionTrustBar({ accent = '#F0C66A' }: { accent?: string }) {
  const [data, setData] = useState<Trust | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(withBasePath('/api/court/decision-judgment'), { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => { if (alive && b?.data) setData(b.data as Trust); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  if (!data || data.count === 0 || data.helpfulRate === null) return null; // 无真样本不显(诚实)

  const rate = data.helpfulRate;
  const tone = rate >= 70 ? '#34D399' : rate >= 50 ? '#F5A524' : '#FF6B6B';

  return (
    <div className="mt-2 flex items-center gap-2 text-[10.5px] text-[#9AA3C4]">
      <span style={{ color: accent }}>奏折帮到率</span>
      <span className="font-mono text-[13px] font-semibold" style={{ color: tone }}>{rate}%</span>
      <span className="text-[#8A8470]">· 基于你 {data.count} 次真评判</span>
    </div>
  );
}
