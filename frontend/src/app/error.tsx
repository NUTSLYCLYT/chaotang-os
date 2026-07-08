'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('[CourtOS Error Boundary]', error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#04060E] p-6">
      <div
        className="w-full max-w-md rounded-2xl border p-8 text-center"
        style={{
          borderColor: 'rgba(244,63,94,0.25)',
          background: 'rgba(244,63,94,0.04)',
        }}
      >
        <AlertTriangle size={32} className="mx-auto text-[#F43F5E]" />
        <h1 className="mt-4 text-[18px] font-semibold text-[#EAEEFB]">出现错误</h1>
        <p className="mt-2 text-[13px] leading-[1.7] text-[#9AA3C4]">
          页面遇到了意外错误。请刷新页面重试，若问题持续请联系管理员。
        </p>
        {error.digest && (
          <p className="mt-2 font-mono text-[11px] text-[#484F72]">
            错误代码：{error.digest}
          </p>
        )}
        <button
          type="button"
          onClick={reset}
          className="mt-6 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[13px] font-semibold transition"
          style={{ background: 'linear-gradient(135deg, #F0C66A, #D4A84B)', color: '#04060E' }}
        >
          <RefreshCw size={14} />
          刷新页面重试
        </button>
      </div>
    </div>
  );
}
