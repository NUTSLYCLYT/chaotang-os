import { proxyBatteryExchange } from '../_proxy';

export const runtime = 'nodejs';

export async function GET() {
  return proxyBatteryExchange('/overview');
}
