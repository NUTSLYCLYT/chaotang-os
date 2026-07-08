'use client';

/**
 * DecreSuggestionPanel · 下旨前智能提示面板
 * 浮于输入框上方，展示「补充建议」或「派遣建议」。
 */

const ORANGE = '#E8A838';
const GREEN = '#3DD68C';
const GOLD = '#F0C66A';

export interface DecreSuggestionPanelProps {
  type: 'missing' | 'ready';
  items: string[];
  onConfirm: () => void;
  onDismiss: () => void;
  loading?: boolean;
}

export function DecreSuggestionPanel({
  type,
  items,
  onConfirm,
  onDismiss,
  loading,
}: DecreSuggestionPanelProps) {
  const isMissing = type === 'missing';
  const accentColor = isMissing ? ORANGE : GREEN;
  const borderColor = isMissing ? 'rgba(232,168,56,0.4)' : 'rgba(61,214,140,0.4)';
  const accentBg = isMissing ? 'rgba(232,168,56,0.08)' : 'rgba(61,214,140,0.08)';

  return (
    <div
      className="absolute -top-2 left-0 right-0 -translate-y-full rounded-[10px] px-4 py-3"
      style={{
        background: 'rgba(8,11,22,0.96)',
        border: `1px solid ${borderColor}`,
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        zIndex: 20,
      }}
      role="dialog"
      aria-live="polite"
    >
      {/* 标题行 */}
      <div
        className="mb-2 flex items-center gap-2 text-[11.5px] font-semibold tracking-[0.1em]"
        style={{ color: accentColor, fontFamily: 'var(--font-serif)' }}
      >
        <span
          className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px]"
          style={{ background: accentBg, border: `1px solid ${accentColor}66` }}
          aria-hidden
        >
          {isMissing ? '⚠' : '✦'}
        </span>
        {isMissing ? '旨意尚需补充，丞相建议说明：' : '丞相建议派遣：'}
      </div>

      {/* 建议列表 */}
      <ul className="mb-3 space-y-1 pl-1">
        {items.map((item, i) => (
          <li
            key={i}
            className="flex items-start gap-1.5 text-[12px] leading-[1.7]"
            style={{ color: '#C6BB9D', fontFamily: 'var(--font-serif)' }}
          >
            <span style={{ color: accentColor, marginTop: 2, flexShrink: 0 }}>·</span>
            {item}
          </li>
        ))}
      </ul>

      {/* 操作按钮 */}
      <div className="flex items-center gap-2">
        {isMissing ? (
          <>
            <button
              type="button"
              onClick={onDismiss}
              className="rounded-full px-3.5 py-1.5 text-[11.5px] font-medium tracking-[0.04em] transition-opacity hover:opacity-80"
              style={{
                background: 'rgba(198,187,157,0.08)',
                border: '1px solid rgba(198,187,157,0.2)',
                color: '#C6BB9D',
                fontFamily: 'var(--font-sans)',
              }}
            >
              补充完善（关闭此提示）
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className="rounded-full px-3.5 py-1.5 text-[11.5px] font-semibold tracking-[0.04em] transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{
                background: `${ORANGE}22`,
                border: `1px solid ${ORANGE}55`,
                color: ORANGE,
                fontFamily: 'var(--font-sans)',
              }}
            >
              {loading ? (
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 animate-spin rounded-full border-[1.5px] border-current border-t-transparent" />
                  派出中…
                </span>
              ) : (
                '直接派出'
              )}
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={onDismiss}
              className="rounded-full px-3.5 py-1.5 text-[11.5px] font-medium tracking-[0.04em] transition-opacity hover:opacity-80"
              style={{
                background: 'rgba(198,187,157,0.08)',
                border: '1px solid rgba(198,187,157,0.2)',
                color: '#C6BB9D',
                fontFamily: 'var(--font-sans)',
              }}
            >
              调整
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[11.5px] font-bold tracking-[0.06em] transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{
                background: `linear-gradient(180deg, ${GREEN}cc, ${GREEN}99)`,
                color: '#041A0F',
                fontFamily: 'var(--font-serif)',
                boxShadow: `0 3px 12px ${GREEN}33`,
              }}
            >
              {loading ? (
                <span className="h-2.5 w-2.5 animate-spin rounded-full border-[1.5px] border-[#041A0F] border-t-transparent" />
              ) : null}
              确认下旨 →
            </button>
          </>
        )}
      </div>

      {/* 装饰线 */}
      <div
        className="pointer-events-none absolute inset-x-4 bottom-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${accentColor}33, transparent)` }}
      />
    </div>
  );
}
