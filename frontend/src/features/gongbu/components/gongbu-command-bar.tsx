'use client';

/**
 * 工部 · 底部 CommandBar（M1）
 * 快捷问 chips + 羽笔输入 + 派建设案/会诊。工部无自由文本 ask 端点(只有结构化 feasibility)，
 * 本版为意向占位；真实建设案/可行性会诊走后端 jiqun PACK 研发蜂群(铁律9)。
 */
import { useState } from 'react';
import { Feather, Hammer } from 'lucide-react';

const ACCENT = '#7FC9A8';
const QUICK = ['这个能不能造？', '先切个 MVP 怎么切？', '技术选型建议', '质量门怎么定？'];

export function GongbuCommandBar() {
  const [text, setText] = useState('');
  return (
    <div className="rounded-[18px] border px-4 py-3" style={{ borderColor: `${ACCENT}26`, background: 'linear-gradient(180deg,#7FC9A80d 0%,rgba(6,8,14,0.94) 100%)' }}>
      <div className="flex flex-wrap items-center gap-1.5">
        {QUICK.map((q) => (
          <button key={q} onClick={() => setText(q)} className="rounded-full border px-2.5 py-1 text-[11.5px] text-[#bcd2c7] transition hover:text-[#EAF3EE]" style={{ borderColor: `${ACCENT}2a` }}>
            {q}
          </button>
        ))}
      </div>
      <div className="mt-2.5 flex items-center gap-2">
        <Feather size={15} className="text-[#7a8a82]" />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="问工部：能不能造、怎么切 MVP、技术选型…"
          className="min-w-0 flex-1 bg-transparent text-[13px] text-[#EAF3EE] placeholder:text-[#586a62] focus:outline-none"
        />
        <button className="inline-flex items-center gap-1 rounded-full border px-3.5 py-1.5 text-[12px] text-[#0c1712] transition hover:brightness-110" style={{ borderColor: ACCENT, background: ACCENT }}>
          <Hammer size={13} /> 派建设案
        </button>
        <button className="rounded-full border px-3 py-1.5 text-[12px] text-[#9ec5ff] transition hover:text-[#cfe2ff]" style={{ borderColor: '#4A82F040' }}>
          会诊
        </button>
      </div>
      <p className="mt-1.5 text-[10px] text-[#586a62]">派建设案/可行性会诊走后端 PACK 研发蜂群（铁律9）；本版为意向入口。</p>
    </div>
  );
}
