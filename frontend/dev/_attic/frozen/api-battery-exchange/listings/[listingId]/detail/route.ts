import { proxyBatteryExchange } from '../../../_proxy';

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  context: { params: Promise<{ listingId: string }> },
) {
  const { listingId } = await context.params;
  return proxyBatteryExchange(`/listings/${encodeURIComponent(listingId)}/detail`);
}
