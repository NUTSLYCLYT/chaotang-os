'use client'

/**
 * 移动端拦截横幅
 * 视口宽度 < 768px（md 断点）时显示"请使用桌面端"提示。
 * md+ 时完全不渲染，不影响桌面性能。
 */
export function MobileGuard() {
  return (
    <div
      className="md:hidden"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(160deg, #04060E 0%, #0A0E1E 60%, #04060E 100%)',
        padding: '2rem',
        textAlign: 'center',
      }}
    >
      {/* 金色印章图标 */}
      <div
        aria-hidden
        style={{
          width: 64,
          height: 64,
          borderRadius: 12,
          background: 'linear-gradient(135deg, rgba(240,198,106,0.15), rgba(240,198,106,0.05))',
          border: '1px solid rgba(240,198,106,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 28,
          marginBottom: '1.5rem',
        }}
      >
        ⛩
      </div>

      <h2
        style={{
          fontFamily: 'var(--font-serif)',
          color: 'var(--color-gold)',
          fontSize: '1.25rem',
          letterSpacing: '0.06em',
          marginBottom: '0.75rem',
        }}
      >
        朝堂 Console
      </h2>

      <p
        style={{
          color: 'var(--color-text-muted)',
          fontSize: '0.875rem',
          lineHeight: 1.75,
          maxWidth: 280,
          marginBottom: '1.5rem',
        }}
      >
        朝堂 Console 为桌面端设计，需要较宽视口方能完整呈现六站流程。
      </p>

      <div
        style={{
          padding: '0.625rem 1.25rem',
          borderRadius: 8,
          border: '1px solid rgba(240,198,106,0.25)',
          background: 'rgba(240,198,106,0.08)',
          color: 'var(--color-gold)',
          fontSize: '0.75rem',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
        }}
      >
        请切换至桌面端访问
      </div>
    </div>
  )
}
