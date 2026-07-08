/**
 * 收件箱五源 feed 边界校验（BFF 诚实闸）。
 *
 * 前端拥有「什么算对」，后端拥有「怎么产出」(铁律9)。后端各源 agent 吐待裁项，
 * 这里在渲染进收件箱**前**当场把关，fail-loud，绝不静默把脏/假/降级数据当真实裁决呈现：
 *   - sourceMode 缺失/非法 → 一律判 unavailable，不渲染(区分「今天没有」vs「读不到」)
 *   - 单项形状非法(坏 origin/缺 priority…) → 丢弃该项并记因，不整批崩
 *   - 证据疑似占位/伪造(空 snippet 或含 示例/待补/placeholder…) → 丢弃(锦衣卫可信度门)
 *
 * 注：「情报≠决策」这类语义正确性属后端 eval(金标集)范畴，不是结构校验能拦的，此处只守结构+诚实。
 */
import { ZInboxItem } from '@/lib/contracts/schemas';
import type { InboxItem, BriefingSourceMode } from '@/lib/contracts/shangshufang';

/** 占位/伪造证据特征词——命中即判该项证据不可信，拒收。 */
const PLACEHOLDER_RE = /示例|待补|待接入|占位|placeholder|lorem|example|todo|xxx/i;

export interface InboxParseResult {
  items: InboxItem[];
  sourceMode: BriefingSourceMode;
  /** 被拒项与原因，供运维排障(不进 UI)。 */
  rejected: Array<{ id?: string; reason: string }>;
}

function readEnvelope(raw: unknown): { items: unknown[]; mode: unknown } {
  const outer = (raw ?? {}) as Record<string, unknown>;
  // 兼容 {success,data:{items,sourceMode}} 与裸 {items,sourceMode}
  const data = (outer.data ?? outer) as Record<string, unknown>;
  return {
    items: Array.isArray(data.items) ? data.items : [],
    mode: data.sourceMode,
  };
}

export function parseInboxFeed(raw: unknown): InboxParseResult {
  const rejected: InboxParseResult['rejected'] = [];
  const { items: rawItems, mode } = readEnvelope(raw);

  // sourceMode 必须可信；缺失/非法一律 unavailable，不冒充真实(诚实链路纪律)
  if (mode !== 'real' && mode !== 'fallback') {
    if (mode !== 'unavailable') {
      rejected.push({ reason: `sourceMode 缺失/非法(${String(mode)}) → 判 unavailable，拒渲染` });
    }
    return { items: [], sourceMode: 'unavailable', rejected };
  }
  const sourceMode: BriefingSourceMode = mode;

  const items: InboxItem[] = [];
  for (const candidate of rawItems) {
    const parsed = ZInboxItem.safeParse(candidate);
    if (!parsed.success) {
      const id = (candidate as { id?: unknown })?.id;
      rejected.push({
        id: typeof id === 'string' ? id : undefined,
        reason: `形状非法: ${parsed.error.issues[0]?.message ?? 'schema mismatch'}`,
      });
      continue;
    }
    const item = parsed.data as InboxItem;
    const fake = item.citations?.find(
      (c) => !c.snippet.trim() || PLACEHOLDER_RE.test(c.snippet) || PLACEHOLDER_RE.test(c.source),
    );
    if (fake) {
      rejected.push({ id: item.id, reason: `证据疑似占位/伪造: "${fake.snippet}"` });
      continue;
    }
    items.push(item);
  }

  return { items, sourceMode, rejected };
}
