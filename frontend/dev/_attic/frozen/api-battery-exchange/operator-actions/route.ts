import { proxyBatteryExchange } from '../_proxy';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.toString();
  return proxyBatteryExchange(`/operator-actions${query ? `?${query}` : ''}`);
}

export async function POST(request: Request) {
  const body = await request.text();
  return proxyBatteryExchange('/operator-actions', {
    method: 'POST',
    body,
  });
}
