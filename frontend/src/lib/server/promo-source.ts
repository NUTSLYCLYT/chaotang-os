import 'server-only';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 宣传资料唯一真相源(2026-06-24 · 礼部 + 史馆共用,避免第二份数据 / 铁律2 SSOT)。
 *
 * 读 data/dept-promo.local.json(import-promo-materials.mjs 产出·H盘民用公开宣传·军用合同已硬过滤·gitignored)。
 * 礼部(/libu/promo) 与 史馆(/shiguan/promo-archive) 都 import 此读取器,一处真相两处展示。
 * 快照缺失 → 诚实空态(source 'unavailable'),绝不伪造。
 */
export interface PromoItem {
  title: string;
  category: string;
  kind: string;
  ext: string;
  tier?: 'high' | 'low';
  sizeKB?: number;
}

export interface PromoSnapshot {
  source: 'h-drive-promo' | 'unavailable';
  count: number;
  highValueCount: number;
  byCategory: Record<string, number>;
  items: PromoItem[];
}

export function readPromoSnapshot(): PromoSnapshot {
  try {
    const raw = readFileSync(join(process.cwd(), 'data', 'dept-promo.local.json'), 'utf8');
    const p = JSON.parse(raw) as Partial<PromoSnapshot>;
    const items = Array.isArray(p.items) ? p.items : [];
    return {
      source: items.length ? 'h-drive-promo' : 'unavailable',
      count: items.length,
      highValueCount: typeof p.highValueCount === 'number' ? p.highValueCount : 0,
      byCategory: p.byCategory ?? {},
      items,
    };
  } catch {
    return { source: 'unavailable', count: 0, highValueCount: 0, byCategory: {}, items: [] };
  }
}
