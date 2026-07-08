import { NextResponse } from 'next/server';
import { handleMockBatteryExchange, MockBatteryExchangeError } from '@/features/battery-exchange/lib/mock-battery-exchange';

const baseUrl = process.env.COURTOS_API_URL ?? 'http://localhost:3000/api/v1';
const isMockMode = process.env.NEXT_PUBLIC_API_MODE === 'mock';

export async function proxyBatteryExchange(
  path: string,
  init?: RequestInit,
  successStatus = 200,
) {
  try {
    if (isMockMode) {
      const response = await handleMockBatteryExchange(path, init);
      return NextResponse.json({ success: true, data: response.data }, { status: response.status });
    }

    const response = await fetch(`${baseUrl}/battery-exchange${path}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: payload?.error ?? `upstream:${response.status}` },
        { status: response.status },
      );
    }

    return NextResponse.json({ success: true, data: payload?.data ?? payload }, { status: successStatus });
  } catch (error) {
    if (error instanceof MockBatteryExchangeError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    return NextResponse.json({ success: false, error: 'network_error' }, { status: 502 });
  }
}
