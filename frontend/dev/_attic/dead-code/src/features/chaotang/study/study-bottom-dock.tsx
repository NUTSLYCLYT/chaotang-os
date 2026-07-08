'use client';

/**
 * StudyBottomDock — 底部三栏：左 丞相 / 中 下旨对话框 / 右 钦天监
 * 两位 AI 谋臣（画像）左右护着中间的下旨框。
 */

import { useState, useCallback, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Crown, Send } from 'lucide-react';
import { assetUrl } from '@/lib/asset';

const GOLD = '#F0C66A';

export function StudyBottomDock() {
  const router = useRouter();
  const [draft, setDraft] = useState('');

  const decree = useCallback(
    (e?: FormEvent) => {
      e?.preventDefault();
      const t = draft.trim();
      if (!t) { toast('请先写下批示或指令'); return; }
      router.push(`/throne/compose?seed=${encodeURIComponent(t)}`);
    },
    [draft, router],
  );

  return (
    <div className="grid items-stretch gap-3 lg:grid-cols-[230px_minmax(0,1fr)_230px]">
      <CounselorChat name="丞相" role="中枢调度 · 随时候命" img="/heroes/1-zhuge.webp" pos="62% 22%" accent="#6BA0FF" placeholder="向丞相请教或交代……" />

      <form
        onSubmit={decree}
        className="relative flex flex-col overflow-hidden rounded-2xl border"
        style={{ borderColor: 'rgba(240,198,106,0.26)', background: 'radial-gradient(ellipse 80% 120% at 50% 0%, rgba(240,198,106,0.07), transparent 60%), rgba(5,16,27,0.9)', backdropFilter: 'blur(12px)' }}
      >
        <div className="flex items-center justify-between px-4 pt-2.5">
          <span className="display-serif text-[12px] font-bold" style={{ color: GOLD }}>御前 · 下旨</span>
          <span className="hidden text-[10px] uppercase tracking-[0.24em] text-[#5A6486] sm:inline">Enter 提交 · @ 部门</span>
        </div>
        <div className="flex items-end gap-2 px-3 pb-3 pt-2">
          <textarea
            rows={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); decree(); } }}
            placeholder="请输入您的批示或指令，或直接 @相关部门……"
            className="max-h-20 min-h-[40px] flex-1 resize-none rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2.5 text-[14px] leading-6 text-[#EAEEFB] outline-none transition focus:border-[#F0C66A]/40 placeholder:text-[#4A5278]"
          />
          <button
            type="submit"
            className="flex h-10 shrink-0 items-center gap-1.5 rounded-lg px-5 text-[14px] font-bold text-[#04060E] transition-all hover:scale-[1.04]"
            style={{ background: 'linear-gradient(110deg, #F0C66A, #E5B845 40%, #D4A84B)', boxShadow: '0 0 16px rgba(240,198,106,0.3)' }}
          >
            <Crown size={14} />下旨
          </button>
        </div>
      </form>

      <CounselorChat name="钦天监" role="御前侍从 · 答疑引导" img="/heroes/6-ouyang.webp" pos="55% 30%" accent="#F0C66A" placeholder="有不懂的，问钦天监……" />
    </div>
  );
}

function CounselorChat({ name, role, img, pos, accent, placeholder }: { name: string; role: string; img: string; pos: string; accent: string; placeholder: string }) {
  const router = useRouter();
  const [draft, setDraft] = useState('');
  const ask = useCallback((e: FormEvent) => { e.preventDefault(); const t = draft.trim(); if (!t) return; router.push(`/throne/compose?seed=${encodeURIComponent(t)}`); }, [draft, router]);
  return (
    <div
      className="relative flex flex-col overflow-hidden rounded-2xl border p-3"
      style={{ borderColor: `${accent}38`, background: `radial-gradient(ellipse 120% 110% at 0% 0%, ${accent}12, transparent 60%), rgba(5,16,27,0.9)`, backdropFilter: 'blur(12px)' }}
    >
      <div className="flex items-center gap-2.5">
        <div className="h-[46px] w-[40px] shrink-0 overflow-hidden rounded-lg" style={{ border: `1.5px solid ${accent}55` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={assetUrl(img)} alt={name} className="h-full w-full object-cover" style={{ objectPosition: pos }} />
        </div>
        <div className="min-w-0">
          <div className="display-serif text-[13px] font-bold" style={{ color: accent }}>{name}</div>
          <div className="truncate text-[10px] text-[#6A7299]">{role}</div>
        </div>
      </div>
      <form onSubmit={ask} className="mt-2 flex items-center gap-1.5">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
          className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/[0.02] px-2.5 py-1.5 text-[12px] text-[#EAEEFB] outline-none transition focus:border-[#F0C66A]/40 placeholder:text-[#4A5278]"
        />
        <button type="submit" disabled={!draft.trim()} aria-label={`回话 ${name}`} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition disabled:opacity-40" style={{ borderColor: `${accent}55`, background: `${accent}14`, color: accent }}>
          <Send size={12} />
        </button>
      </form>
    </div>
  );
}
