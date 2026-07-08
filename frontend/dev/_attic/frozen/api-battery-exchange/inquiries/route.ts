import { proxyBatteryExchange } from '../_proxy';

export const runtime = 'nodejs';

export async function GET() {
  return proxyBatteryExchange('/inquiries');
}

export async function POST(request: Request) {
  const body = await request.text();
  return proxyBatteryExchange('/inquiries', { method: 'POST', body }, 201);
}
