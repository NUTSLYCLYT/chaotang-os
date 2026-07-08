import type { NextRequest } from 'next/server';

import type {
  DepartmentPageCanonicalCode,
  DepartmentPageCode,
} from '@/lib/contracts/department-page-view';
import type { DeptOverview } from '@/lib/contracts/dept';
import type { HubuOverview } from '@/lib/contracts/hubu';
import type { LegalOverview } from '@/lib/contracts/xingbu';
import type { BingbuSalesOverview } from '@/lib/contracts/bingbu-sales';
import type {
  DepartmentTaskInsight,
  LibuPromoOverview,
} from '@/features/departments/lib/department-page-view-builder';
import { loadDepartmentTaskInsights } from '@/features/departments/lib/department-task-insights';

export type DepartmentPageViewSources = {
  code: DepartmentPageCode | string;
  overview: DeptOverview | null;
  hubuOverview: HubuOverview | null;
  legalOverview: LegalOverview | null;
  bingbuOverview: BingbuSalesOverview | null;
  libuPromoOverview: LibuPromoOverview | null;
  taskInsights: DepartmentTaskInsight[];
};

const OVERVIEW_CODE: Record<string, string> = {
  finance: 'finance',
  gongbu: 'works',
  works: 'works',
  personnel: 'personnel',
  market: 'market',
  ops: 'ops',
  legal: 'legal',
};

function authHeaders(req: NextRequest): HeadersInit {
  // SSR 内部 fetch 必须同时转发 cookie：部门 overview 端点(hubu/bingbu/legal/libu)的鉴权走
  // requireTenantScope()/getUserIdFromSession() 读 cookie `courtos.access_token`,而非 authorization。
  // 只转 authorization 会让服务端渲染拿不到会话 → overview 恒 null → 六部真数据右栏全回落静态骨架。
  return {
    accept: 'application/json',
    ...(req.headers.get('authorization') ? { authorization: req.headers.get('authorization') ?? '' } : {}),
    ...(req.headers.get('cookie') ? { cookie: req.headers.get('cookie') ?? '' } : {}),
  };
}

async function loadJsonData<T>(req: NextRequest, path: string): Promise<T | null> {
  const url = new URL(`${process.env.BASE_PATH ?? ''}${path}`, req.url);
  try {
    const res = await fetch(url, {
      cache: 'no-store',
      headers: authHeaders(req),
    });
    const json = (await res.json().catch(() => null)) as { success?: boolean; data?: T } | null;
    if (!res.ok || !json?.success || !json.data) return null;
    return json.data;
  } catch {
    return null;
  }
}

export async function loadDepartmentPageViewSources(
  req: NextRequest,
  code: DepartmentPageCode | string,
  canonical: DepartmentPageCanonicalCode,
  tenantId?: string,
): Promise<DepartmentPageViewSources> {
  const overviewCode = OVERVIEW_CODE[canonical] ?? canonical;
  const [overview, hubuOverview, legalOverview, bingbuOverview, libuPromoOverview, taskInsights] = await Promise.all([
    loadJsonData<DeptOverview>(req, `/api/court/chaotang/dept/${encodeURIComponent(overviewCode)}/overview`),
    canonical === 'finance' ? loadJsonData<HubuOverview>(req, '/api/court/hubu/overview') : Promise.resolve(null),
    canonical === 'legal' ? loadJsonData<LegalOverview>(req, '/api/court/legal/overview') : Promise.resolve(null),
    canonical === 'ops' ? loadJsonData<BingbuSalesOverview>(req, '/api/court/bingbu/overview') : Promise.resolve(null),
    canonical === 'market' ? loadJsonData<LibuPromoOverview>(req, '/api/court/libu/promo') : Promise.resolve(null),
    loadDepartmentTaskInsights(canonical, 100, tenantId).catch(() => []),
  ]);

  return {
    code,
    overview,
    hubuOverview,
    legalOverview,
    bingbuOverview,
    libuPromoOverview,
    taskInsights,
  };
}

