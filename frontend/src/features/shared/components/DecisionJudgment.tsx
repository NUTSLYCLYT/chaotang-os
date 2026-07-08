'use client';

/**
 * 决策 judgment 捕获(2026-06-25 · 波1 自用验证)。
 *
 * 奏折/建议底部一行:"这建议帮到我了吗?👍/👎 + 一句哪不对" → 落本地(decision-judgment API)。
 * 极简:唯一职责是把"用的感受"变 eval 真样本。点完即记,不打扰。
 */

import { useState } from 'react';
import { withBasePath } from '@/lib/base-path';

interface Props {
  question: string;
  verdict?: string;
  taskId?: string;
  accent?: string;
}

export function DecisionJudgment({ question, verdict, taskId, accent = '#F0C66A' }: Props) {
  const [done, setDone] = useState(false);
  const [helpful, setHelpful] = useState<boolean | null>(null);
  const [note, setNote] = useState('');

  const submit = async (h: boolean) => {
    setHelpful(h);
    if (h) await send(h, ''); // 👍 一键记;👎 等用户补一句再记
  };
  const send = async (h: boolean, n: string) => {
    try {
      await fetch(withBasePath('/api/court/decision-judgment'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question, verdict, taskId, helpful: h, note: n }),
      });
    } catch {
      /* 自用验证,失败不打扰 */
    }
    setDone(true);
  };

  if (done) {
    return <div className="mt-2 text-[10px] text-[#8A8470]">已记录 · 谢陛下评判（波1 真样本 +1）</div>;
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-[#9AA3C4]">
      <span>这奏折帮到了吗？</span>
      <button
        type="button"
        onClick={() => submit(true)}
        className="rounded-full border px-2 py-0.5 transition hover:brightness-110"
        style={{ borderColor: `${accent}55`, color: accent }}
      >
        👍 帮到了
      </button>
      <button
        type="button"
        onClick={() => submit(false)}
        className="rounded-full border px-2 py-0.5 transition hover:brightness-110"
        style={{ borderColor: 'rgba(244,107,107,0.5)', color: '#FF6B6B' }}
      >
        👎 没帮到
      </button>
      {helpful === false && (
        <span className="flex items-center gap-1.5">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="哪不对？（一句）"
            className="w-44 rounded border bg-transparent px-2 py-0.5 text-[11px] outline-none"
            style={{ borderColor: 'rgba(232,255,245,0.14)', color: '#E8FFF5' }}
            onKeyDown={(e) => { if (e.key === 'Enter') send(false, note); }}
          />
          <button type="button" onClick={() => send(false, note)} className="text-[10px]" style={{ color: accent }}>记下</button>
        </span>
      )}
    </div>
  );
}
