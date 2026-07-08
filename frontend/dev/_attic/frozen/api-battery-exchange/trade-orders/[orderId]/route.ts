import { proxyBatteryExchange } from '../../_proxy';

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  context: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await context.params;
  return proxyBatteryExchange(`/trade-orders/${encodeURIComponent(orderId)}`);
}
