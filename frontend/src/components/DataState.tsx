interface Props {
  loading?: boolean;
  error?: unknown;
  empty?: boolean;
  emptyMessage?: string;
  onRetry?: () => void;
  children: React.ReactNode;
}

export function DataState({ loading, error, empty, emptyMessage = '暂无数据', onRetry, children }: Props) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-sm" style={{ color: '#484F72' }}>
        <span className="animate-pulse">加载中…</span>
      </div>
    );
  }
  if (error) {
    const msg = error instanceof Error ? error.message : '请求失败，请稍后重试';
    return (
      <div className="flex items-center justify-center py-12">
        <div
          className="rounded-lg px-6 py-4 text-sm flex flex-col items-center gap-3"
          style={{ border: '1px solid rgba(244,63,94,0.3)', background: 'rgba(244,63,94,0.08)', color: '#F43F5E' }}
        >
          <span>⚠ {msg}</span>
          {onRetry && (
            <button
              onClick={onRetry}
              className="rounded px-3 py-1 text-xs transition-colors"
              style={{ border: '1px solid rgba(244,63,94,0.4)', color: '#F43F5E', background: 'rgba(244,63,94,0.1)' }}
            >
              重试
            </button>
          )}
        </div>
      </div>
    );
  }
  if (empty) {
    return <div className="flex items-center justify-center py-12 text-sm" style={{ color: '#484F72' }}>{emptyMessage}</div>;
  }
  return <>{children}</>;
}
