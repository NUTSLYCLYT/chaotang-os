import { OperatorMetricCard } from './battery-exchange-operator-ui';

export function BatteryExchangeOperatorMetrics({
  reviewListingCount,
  riskyOrderCount,
  fastMovingOrderCount,
  verifiedSellerCount,
}: {
  reviewListingCount: number;
  riskyOrderCount: number;
  fastMovingOrderCount: number;
  verifiedSellerCount: number;
}) {
  return (
    <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <OperatorMetricCard label="待审核货盘" value={String(reviewListingCount)} note="优先看 B+、待复检、项目余量货" />
      <OperatorMetricCard label="高风险交易" value={String(riskyOrderCount)} note="争议单或高风险标记交易" />
      <OperatorMetricCard label="待推进交易" value={String(fastMovingOrderCount)} note="托管和验货节点正在推进" />
      <OperatorMetricCard label="认证卖家" value={String(verifiedSellerCount)} note="带履约分与投诉率监控" />
    </section>
  );
}
