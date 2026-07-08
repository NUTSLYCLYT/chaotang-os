import Link from 'next/link';
import { GlassPanel } from '@/components/ui/glass-panel';

type SurfaceMode = 'frontstage' | 'backstage';

interface SurfaceBridgePanelProps {
  mode: SurfaceMode;
  frontstageHref?: string;
  backstageHref?: string;
  backstageLabel?: string;
  frontstageLabel?: string;
}

export function SurfaceBridgePanel({
  mode,
  frontstageHref = '/overview',
  backstageHref = '/governance',
  backstageLabel = '进入三省审议台',
  frontstageLabel = '回陛下第一眼',
}: SurfaceBridgePanelProps) {
  const isFrontstage = mode === 'frontstage';

  return (
    <GlassPanel variant="gold" tone="deep" padding="md" hudCorners>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div>
          <div className="section-eyebrow">Surface Rule · 双层操作界面</div>
          <h2 className="section-title mt-2 text-[22px]">
            {isFrontstage ? '前台看局，后台落地。' : '后台落地，前台收局。'}
          </h2>
          <p className="body-copy mt-3 max-w-[60ch] text-[13px] text-[#C6BB9D]">
            帝王前台负责看局、召见、收判断；专业后台负责审议、执行、沉淀。两层共用同一套事实源，只是展示深度和操作方式不同。
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-[#F0C66A]/15 bg-[#F0C66A]/[0.04] px-4 py-4">
            <div className="text-[11px] uppercase tracking-[0.2em] text-[#8F835F]">帝王前台</div>
            <div className="mt-2 text-[14px] font-semibold text-[#F5E9C9]">看局、召见、收判断</div>
            <div className="mt-2 text-[11px] leading-6 text-[#9AA3C4]">
              丞相总批、群臣奏章、房间对话、大屏查看。
            </div>
          </div>
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4">
            <div className="text-[11px] uppercase tracking-[0.2em] text-[#8F835F]">专业后台</div>
            <div className="mt-2 text-[14px] font-semibold text-[#F5E9C9]">审议、执行、沉淀</div>
            <div className="mt-2 text-[11px] leading-6 text-[#9AA3C4]">
              三省裁断、蜂群推进、阻塞升级、回写与史馆专题。
            </div>
          </div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={frontstageHref}
          className="rounded-full border border-[#F0C66A]/35 bg-[#F0C66A]/12 px-4 py-2 text-[11px] text-[#F0C66A] transition hover:bg-[#F0C66A]/18"
        >
          {frontstageLabel}
        </Link>
        <Link
          href={backstageHref}
          className="rounded-full border border-white/10 px-4 py-2 text-[11px] text-[#EAEEFB] transition hover:bg-white/5"
        >
          {backstageLabel}
        </Link>
      </div>
    </GlassPanel>
  );
}
