import { proxyBatteryExchange } from '../_proxy';

export const runtime = 'nodejs';

export async function GET() {
  return proxyBatteryExchange('/trade-orders');
}

export async function POST(request: Request) {
  const body = await request.text();
  return proxyBatteryExchange('/trade-orders', { method: 'POST', body }, 201);
}
