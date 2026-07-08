import { proxyBatteryExchange } from '../_proxy';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.toString();
  return proxyBatteryExchange(`/listings${query ? `?${query}` : ''}`);
}
