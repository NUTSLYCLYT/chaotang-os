import Link from 'next/link';
import type { OperatorScopePill } from '../lib/operator-console-utils';

export function BatteryExchangeOperatorHeader({
  onCopyView,
  copyState,
  scopePills,
}: {
  onCopyView: () => void;
  copyState: 'idle' | 'copied' | 'error';
  scopePills: OperatorScopePill[];
}) {
  return (
    <section className="rounded-[30px] border border-[#3c2c20] bg-[#171311]/90 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.32em] text-[#bd8751]">Operator Console</div>
          <h1
            className="mt-3 text-[38px] font-semibold leading-tight text-[#f7ead1]"
            style={{ fontFamily: 'var(--font-serif)' }}
          >
            风控与处置台。
          </h1>
          <p className="mt-3 max-w-3xl text-[15px] leading-7 text-[#cfb493]">
            优先看最危险的货、最紧急的单和最值得人工跟进的机会，不把运营变成信息堆积。
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {scopePills.length > 0 ? (
              scopePills.slice(0, 8).map((item) => (
                <span
                  key={item.key}
                  className="rounded-full border border-[#4d3827] bg-[#201713] px-3 py-1 text-xs text-[#e1c49c]"
                >
                  {item.label}
                </span>
              ))
            ) : (
              <span className="rounded-full border border-[#33271d] bg-[#161210] px-3 py-1 text-xs text-[#a98b67]">
                当前视图: 全量处置面板
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onCopyView}
            className="rounded-full border border-[#5f442b] px-5 py-3 text-sm font-semibold text-[#f0c27b] transition hover:border-[#c98a49]"
          >
            {copyState === 'copied' ? '已复制交班链接' : copyState === 'error' ? '复制失败，重试' : '复制交班链接'}
          </button>
          <Link
            href="/battery-exchange/market"
            className="rounded-full bg-[#f0b76b] px-5 py-3 text-sm font-semibold text-[#20160f]"
          >
            去交易台
          </Link>
          <Link
            href="/battery-exchange/inquiries"
            className="rounded-full border border-[#3f2e22] px-5 py-3 text-sm font-semibold text-[#d9bb97]"
          >
            去询盘中心
          </Link>
          <Link
            href="/battery-exchange/trade-orders"
            className="rounded-full border border-[#3f2e22] px-5 py-3 text-sm font-semibold text-[#d9bb97]"
          >
            去交易单列表
          </Link>
          <Link
            href="/battery-exchange/sell"
            className="rounded-full border border-[#6d4d31] px-5 py-3 text-sm font-semibold text-[#f3d0a1]"
          >
            去卖家挂货台
          </Link>
        </div>
      </div>
    </section>
  );
}
