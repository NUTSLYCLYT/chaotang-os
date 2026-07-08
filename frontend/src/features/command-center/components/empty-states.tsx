'use client';

import { Sparkles, Loader2, AlertOctagon } from 'lucide-react';
import { GlassPanel } from '@/components/ui/glass-panel';

export function EmptyTaskState() {
  return (
    <GlassPanel tone="flat" padding="lg" className="text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-[#F0C66A]/30 bg-[#F0C66A]/5">
        <Sparkles size={18} className="text-[#F0C66A]" />
      </div>
      <div className="mt-4 text-[13px] font-medium text-[#EAEEFB]">
        尚无编排结果
      </div>
      <div className="mt-1 text-[11px] text-[#6A7299]">
        于上方密旨栏下达指令，丞相将自动拆解、分派与执行
      </div>
    </GlassPanel>
  );
}

export function LoadingState() {
  return (
    <GlassPanel tone="flat" padding="lg" className="text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-white/10">
        <Loader2 size={18} className="animate-spin text-[#6BA0FF]" />
      </div>
      <div className="mt-4 text-[12px] text-[#9AA3C4]">载入案牍...</div>
    </GlassPanel>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <GlassPanel tone="flat" padding="lg" className="text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-[#F43F5E]/30 bg-[#F43F5E]/5">
        <AlertOctagon size={18} className="text-[#F43F5E]" />
      </div>
      <div className="mt-4 text-[13px] font-medium text-[#EAEEFB]">载入失败</div>
      <div className="mt-1 text-[11px] text-[#6A7299]">{message}</div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-md border border-white/10 px-3 py-1.5 text-[11px] text-[#EAEEFB] transition-colors hover:bg-white/5"
        >
          重试
        </button>
      )}
    </GlassPanel>
  );
}
