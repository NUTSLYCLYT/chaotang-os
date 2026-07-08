'use client';

/**
 * ImperialCommandBar — 御笔下旨区（底部）
 * 按钮：下旨 / 问丞相 / 召集群臣 · 快捷指令 chips · 真实输入与反馈
 */

import { useState, useCallback, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Crown, MessageSquare, Users, Feather } from 'lucide-react';
import { quickCommandsMock } from '@/features/chaotang/mock/study.mock';

export function ImperialCommandBar() {
  const router = useRouter();
  const [draft, setDraft] = useState('');

  const decree = useCallback(
    (e?: FormEvent) => {
      e?.preventDefault();
      const text = draft.trim();
      if (!text) {
        toast('请先写下批示或指令', { description: '可点击下方快捷指令快速起草。' });
        return;
      }
      router.push(`/throne/compose?seed=${encodeURIComponent(text)}`);
    },
    [draft, router],
  );

  const askChancellor = useCallback(() => {
    const text = draft.trim();
    toast('已呈丞相', { description: text ? `丞相将就「${text}」奏对。` : '丞相随时候命，请陛下示下。' });
    router.push(`/throne/compose?seed=${encodeURIComponent(text || '请丞相为我研判今日要务')}`);
  }, [draft, router]);

  const addQuick = useCallback((cmd: string) => {
    setDraft((d) => (d ? `${d} ${cmd}` : cmd));
    const el = document.getElementById('study-command-input') as HTMLTextAreaElement | null;
    el?.focus();
    toast(`已添加指令 · ${cmd}`);
  }, []);

  return (
    <div
      className="relative z-20 flex-shrink-0 border-t px-4 py-3 md:px-7"
      style={{
        background: 'linear-gradient(0deg, rgba(7,11,24,0.96), rgba(7,11,24,0.8))',
        borderColor: 'rgba(240,198,106,0.2)',
        backdropFilter: 'blur(14px)',
      }}
    >
      {/* 快捷指令 */}
      <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] text-[#6A7299]">快捷指令</span>
        {quickCommandsMock.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => addQuick(c)}
            className="rounded-full border px-2.5 py-1 text-[11px] text-[#CDB98A] transition hover:-translate-y-0.5 hover:text-[#F0C66A]"
            style={{ borderColor: 'rgba(240,198,106,0.26)', background: 'rgba(240,198,106,0.05)' }}
          >
            {c}
          </button>
        ))}
      </div>

      <form onSubmit={decree} className="flex items-end gap-2.5">
        <div
          className="flex flex-1 items-center gap-2 rounded-xl border px-3 py-2"
          style={{ borderColor: 'rgba(240,198,106,0.26)', background: 'rgba(4,6,14,0.6)' }}
        >
          <Feather size={15} className="shrink-0 text-[#F0C66A]" />
          <textarea
            id="study-command-input"
            rows={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                decree();
              }
            }}
            placeholder="请输入您的批示或指令，或直接 @相关部门……"
            className="max-h-24 min-h-[24px] flex-1 resize-none bg-transparent text-[14px] leading-6 text-[#EAEEFB] outline-none placeholder:text-[#4A5278]"
          />
        </div>
        <button
          type="submit"
          className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl px-5 text-[14px] font-bold text-[#04060E] transition-all hover:scale-[1.04]"
          style={{
            background: 'linear-gradient(110deg, #F0C66A 0%, #E5B845 40%, #D4A84B 100%)',
            boxShadow: '0 0 18px rgba(240,198,106,0.32)',
          }}
        >
          <Crown size={15} />
          下旨
        </button>
        <button
          type="button"
          onClick={askChancellor}
          className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl border px-4 text-[13px] font-semibold text-[#6BA0FF] transition hover:-translate-y-0.5"
          style={{ borderColor: 'rgba(107,160,255,0.4)', background: 'rgba(107,160,255,0.1)' }}
        >
          <MessageSquare size={14} />
          问丞相
        </button>
        <button
          type="button"
          onClick={() => router.push('/grand-council')}
          className="hidden h-10 shrink-0 items-center gap-1.5 rounded-xl border px-4 text-[13px] font-semibold text-[#C6CEE6] transition hover:-translate-y-0.5 sm:flex"
          style={{ borderColor: 'rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.02)' }}
        >
          <Users size={14} />
          召集群臣
        </button>
      </form>
    </div>
  );
}
