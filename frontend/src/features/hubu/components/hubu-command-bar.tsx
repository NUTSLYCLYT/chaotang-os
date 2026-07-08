'use client';

/**
 * 户部 · 底部 CommandBar（M1）
 * 快捷问 chips + 羽笔输入 + 追问户部。追问走真 /api/court/hubu/ask（带接地率）。
 * 下旨/合议属真实产线动作 → 后端 jiqun(铁律9)，本版为意向占位。
 */
import { useState } from 'react';
import { Feather, Loader2, Sparkles } from 'lucide-react';

const ACCENT = '#F0C66A';
const QUICK = ['现金够付这月开销吗？', '这个月要交多少税？', '哪笔货款该催？', '待批里先批哪个？'];

type AskState = { answer?: string; grounding?: { rate: number; grounded: number; total: number }; error?: string };

export function HubuCommandBar() {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<AskState | null>(null);

  async function ask(q: string) {
    const command = q.trim();
    if (command.length < 5 || busy) return;
    setBusy(true);
    setRes(null);
    try {
      const r = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/api/court/hubu/ask`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ command }),
      });
      const j = (await r.json()) as AskState & { ok?: boolean; error?: string };
      setRes(!r.ok || j.ok === false ? { error: j.error ?? `户部暂时无法应答（${r.status}）` } : j);
    } catch {
      setRes({ error: '网络异常，户部未应答' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-[18px] border px-4 py-3" style={{ borderColor: `${ACCENT}26`, background: 'linear-gradient(180deg,#F0C66A0d 0%,rgba(6,8,14,0.94) 100%)' }}>
      {res && (
        <div className="mb-2 rounded-[12px] border px-3 py-2 text-[12px]" style={{ borderColor: '#ffffff14', background: '#ffffff06' }}>
          {res.error ? (
            <p className="text-[#E5604D]">{res.error}</p>
          ) : (
            <>
              <p className="leading-relaxed text-[#d8cba8]">{res.answer}</p>
              {res.grounding && (
                <p className="mt-1 text-[10.5px]" style={{ color: res.grounding.rate >= 0.8 ? '#5FB97A' : '#E5B84D' }}>
                  接地率 {Math.round(res.grounding.rate * 100)}%（{res.grounding.grounded}/{res.grounding.total} 数字有据）
                </p>
              )}
            </>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        {QUICK.map((q) => (
          <button
            key={q}
            onClick={() => ask(q)}
            disabled={busy}
            className="rounded-full border px-2.5 py-1 text-[11.5px] text-[#c8bd9c] transition hover:text-[#F5E9C9] disabled:opacity-50"
            style={{ borderColor: `${ACCENT}2a` }}
          >
            {q}
          </button>
        ))}
      </div>

      <div className="mt-2.5 flex items-center gap-2">
        <Feather size={15} className="text-[#8f835f]" />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && ask(text)}
          placeholder="问户部任何财务问题…"
          className="min-w-0 flex-1 bg-transparent text-[13px] text-[#E9DDBE] placeholder:text-[#6f6750] focus:outline-none"
        />
        <button
          onClick={() => ask(text)}
          disabled={busy}
          className="inline-flex items-center gap-1 rounded-full border px-3.5 py-1.5 text-[12px] text-[#1a1408] transition hover:brightness-110 disabled:opacity-60"
          style={{ borderColor: ACCENT, background: ACCENT }}
        >
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} 追问户部
        </button>
        <button className="rounded-full border px-3 py-1.5 text-[12px] text-[#9ec5ff] transition hover:text-[#cfe2ff]" style={{ borderColor: '#60A5FA40' }}>
          下旨
        </button>
        <button className="rounded-full border px-3 py-1.5 text-[12px] text-[#c8bd9c] transition hover:text-[#F5E9C9]" style={{ borderColor: `${ACCENT}2a` }}>
          召合议
        </button>
      </div>
    </div>
  );
}
