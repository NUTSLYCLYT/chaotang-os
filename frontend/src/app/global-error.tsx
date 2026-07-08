'use client';

/**
 * #9 root 崩溃兜底(可观测/韧性,charity-majors+Grove 顾虑)：
 * 段级 error.tsx 兜不住 root layout(layout.tsx 注入 Nav/字体/AuthGate)崩溃——那会整页白屏且无任何信号。
 * global-error.tsx 是 Next 的 root error boundary,崩溃时整体替换 layout(故须自带 <html><body> 壳),
 * 并在 useEffect 里把 digest 结构化打日志(配合 instrumentation.onRequestError 服务端落盘),
 * 让"前端 root 崩了"从"白屏没人知道"变成"有品牌错误页 + 一条带错误码的日志"。
 */

import { useEffect } from 'react';

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('[CourtOS GlobalError · root 崩溃]', {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    });
  }, [error]);

  return (
    <html lang="zh-CN">
      <body style={{ margin: 0, background: '#04060E' }}>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 420,
              borderRadius: 16,
              border: '1px solid rgba(244,63,94,0.25)',
              background: 'rgba(244,63,94,0.04)',
              padding: 32,
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 30, color: '#F43F5E', lineHeight: 1 }}>⚠</div>
            <h1 style={{ marginTop: 16, fontSize: 18, fontWeight: 600, color: '#EAEEFB' }}>朝堂遇到意外错误</h1>
            <p style={{ marginTop: 8, fontSize: 13, lineHeight: 1.7, color: '#9AA3C4' }}>
              页面遇到了意外错误（根级）。已记录错误码。请刷新重试，若持续请联系管理员。
            </p>
            {error.digest && (
              <p style={{ marginTop: 8, fontFamily: 'monospace', fontSize: 11, color: '#484F72' }}>
                错误代码：{error.digest}
              </p>
            )}
            <button
              type="button"
              onClick={reset}
              style={{
                marginTop: 24,
                padding: '10px 20px',
                fontSize: 13,
                fontWeight: 600,
                color: '#04060E',
                background: 'linear-gradient(135deg, #F0C66A, #D4A84B)',
                border: 'none',
                borderRadius: 12,
                cursor: 'pointer',
              }}
            >
              刷新页面重试
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
