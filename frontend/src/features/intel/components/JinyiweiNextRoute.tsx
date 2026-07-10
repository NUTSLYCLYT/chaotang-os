import { ArrowRight, Scale, ShieldAlert } from 'lucide-react';

import { nextRouteForLight, type JinyiweiLight } from '../lib/jinyiwei-brief-contract';

const ROUTE_TONE: Record<JinyiweiLight, string> = {
  green: '#3DD68C',
  yellow: '#F5A524',
  red: '#F43F5E',
  black: '#A855F7',
};

export function JinyiweiNextRoute({ light }: { light: JinyiweiLight }) {
  const route = nextRouteForLight(light);
  const tone = ROUTE_TONE[light];
  return (
    <section className="rounded-xl border bg-[#05070D]/48 p-3" style={{ borderColor: `${tone}33` }} data-testid="jinyiwei-next-route">
      <div className="flex items-center gap-2 text-[9px] uppercase tracking-[0.16em] text-[#8F835F]">
        {light === 'black' ? <ShieldAlert size={12} style={{ color: tone }} /> : <Scale size={12} style={{ color: tone }} />}
        建议流向
      </div>
      <div className="mt-3 flex items-center gap-2">
        <span className="rounded border px-2 py-1 text-[11px] font-semibold" style={{ borderColor: `${tone}55`, color: tone }}>{route.label}</span>
        <ArrowRight size={13} className="text-[#6A7299]" />
        <span className="text-[10px] leading-4 text-[#A7AFC6]">{route.reason}</span>
      </div>
      <p className="mt-2 text-[9px] leading-4 text-[#6A7299]">当前仅展示后端协议建议流向；正式转派接口未落地前不提供成功按钮。</p>
    </section>
  );
}
