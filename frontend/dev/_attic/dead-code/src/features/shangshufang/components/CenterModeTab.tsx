'use client';

/**
 * CenterModeTab · 中栏内容区顶部 header
 * 三个小 tab：奏折 / 丞相 / 钦天监
 */

const GOLD = '#F0C66A';

type CenterMode = 'memorial' | 'chancellor' | 'wang';

const TABS: { mode: CenterMode; label: string; requiresMemorial?: boolean }[] = [
  { mode: 'memorial', label: '「奏折」' },
  { mode: 'chancellor', label: '「丞相」' },
  { mode: 'wang', label: '「钦天监」' },
];

export function CenterModeTab({
  mode,
  onModeChange,
  hasMemorial,
}: {
  mode: CenterMode;
  onModeChange: (m: CenterMode) => void;
  hasMemorial: boolean;
}) {
  return (
    <div
      className="flex items-end gap-0 border-b"
      style={{ borderColor: 'rgba(240,198,106,0.12)', height: '34px', paddingLeft: '4px' }}
      role="tablist"
      aria-label="中栏显示模式"
    >
      {TABS.map(({ mode: m, label }) => {
        const isActive = mode === m;
        const disabled = m === 'memorial' && !hasMemorial;

        return (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={isActive}
            disabled={disabled}
            onClick={() => !disabled && onModeChange(m)}
            className="relative flex h-full items-center px-3 text-[11px] tracking-widest transition-colors disabled:cursor-not-allowed disabled:opacity-35"
            style={{
              color: isActive ? GOLD : 'rgba(198,187,157,0.55)',
              fontFamily: 'var(--font-serif)',
              background: isActive ? 'rgba(240,198,106,0.08)' : 'transparent',
            }}
            onMouseEnter={(e) => {
              if (!isActive && !disabled) {
                (e.currentTarget as HTMLButtonElement).style.color = 'rgba(198,187,157,0.85)';
                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(240,198,106,0.04)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                (e.currentTarget as HTMLButtonElement).style.color = 'rgba(198,187,157,0.55)';
                (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
              }
            }}
          >
            {label}

            {/* 金色底线（active 时，实线） */}
            {isActive && (
              <span
                className="absolute inset-x-0 bottom-0"
                style={{ height: '2px', background: '#F0C66A' }}
                aria-hidden
              />
            )}

            {/* 奏折存在时的小圆点 */}
            {m === 'memorial' && hasMemorial && !isActive && (
              <span
                className="absolute right-2 top-1.5 h-1 w-1 rounded-full"
                style={{ background: GOLD }}
                aria-hidden
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
