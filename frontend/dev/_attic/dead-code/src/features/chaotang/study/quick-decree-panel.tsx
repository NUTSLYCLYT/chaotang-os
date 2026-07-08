'use client';

/**
 * QuickDecreePanel — 快捷下旨（AI 辅助 · 一键批复）
 * 6 个批复 + 自定义下旨。全部真按钮，带 toast / 路由反馈。
 */

import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Check, X, Search, Scale, Gift, HeartHandshake, Feather } from 'lucide-react';
import { ScrollSection } from './scroll-primitives';

const ITEMS = [
  { id: 'agree', label: '同意', sub: '批准通过', icon: Check, tone: '#3DD68C', act: (t: typeof toast) => t.success('已同意 · 批准通过', { description: '朱批已盖印，旨意下达。' }) },
  { id: 'reject', label: '驳回', sub: '退回重议', icon: X, tone: '#F43F5E', act: (t: typeof toast) => t('已驳回 · 退回重议') },
  { id: 'investigate', label: '查办', sub: '彻查办理', icon: Search, tone: '#F5A524', act: (t: typeof toast) => t('已交查办', { description: '相关部门彻查办理。' }) },
  { id: 'discuss', label: '议处', sub: '依法处置', icon: Scale, tone: '#8B5CF6', act: (t: typeof toast) => t('转交议处', { description: '依法处置，军机处会审。' }) },
  { id: 'reward', label: '赐赏', sub: '赏赐表彰', icon: Gift, tone: '#F0C66A', act: (t: typeof toast) => t.success('已拟赐赏', { description: '赏赐表彰之旨已拟。' }) },
  { id: 'pardon', label: '宽免', sub: '宽宥减责', icon: HeartHandshake, tone: '#60A5FA', act: (t: typeof toast) => t('已拟宽免', { description: '宽宥减责之旨已拟。' }) },
] as const;

export function QuickDecreePanel() {
  const router = useRouter();
  return (
    <ScrollSection title="快捷下旨" eyebrow="AI 辅助 · 一键批复">
      <div className="grid grid-cols-2 gap-2">
        {ITEMS.map((it) => {
          const Icon = it.icon;
          return (
            <button
              key={it.id}
              type="button"
              onClick={() => it.act(toast)}
              className="group flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-all hover:-translate-y-0.5"
              style={{ borderColor: `${it.tone}33`, background: `linear-gradient(120deg, ${it.tone}10, transparent 70%), rgba(4,6,14,0.4)` }}
            >
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                style={{ background: `${it.tone}1f`, border: `1px solid ${it.tone}55` }}
              >
                <Icon size={15} style={{ color: it.tone }} />
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-bold" style={{ color: '#F5E9C9' }}>{it.label}</span>
                <span className="block truncate text-[10px] text-[#6A7299]">{it.sub}</span>
              </span>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => router.push('/throne/compose')}
        className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-bold text-[#04060E] transition-all hover:scale-[1.02]"
        style={{ background: 'linear-gradient(110deg, #F0C66A, #E5B845 45%, #D4A84B)', boxShadow: '0 0 16px rgba(240,198,106,0.3)' }}
      >
        <Feather size={14} />
        自定义下旨 · 定制批示内容
      </button>
    </ScrollSection>
  );
}
