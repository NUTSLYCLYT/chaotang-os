import { test, expect } from '@playwright/test';
import { seedSession } from './fixtures';
import { resolveBasePath } from './helpers/base-path';

const SIGNALS = [
  {
    id: 'signal_kr_hbm',
    category: 'risk',
    level: 'critical',
    title: '韩国 HBM4 量产节奏提前',
    summary: 'HBM4 出货节奏超预期，可能冲击存储供应链价格体系。',
    region: 'KR',
    regionLabel: '韩国',
    industry: '半导体',
    credibility: 'verified',
    sources: [{ name: 'Yonhap', publishedAt: '2026-06-20T04:30:00Z' }],
    firstSeenAt: '2026-06-20T04:30:00Z',
    lastUpdatedAt: '2026-06-20T09:45:00Z',
    coordinates: { lat: 37.57, lng: 126.98 },
    routedTo: ['bing_bu', 'gong_bu'],
    impactScore: 91,
  },
  {
    id: 'signal_jp_export',
    category: 'opportunity',
    level: 'watch',
    title: '日本半导体材料出口审查放松',
    summary: '特定半导体材料出口审查可能放宽。',
    region: 'JP',
    regionLabel: '日本',
    industry: '半导体',
    credibility: 'high',
    sources: [{ name: 'Nikkei', publishedAt: '2026-06-20T01:00:00Z' }],
    firstSeenAt: '2026-06-20T01:00:00Z',
    lastUpdatedAt: '2026-06-20T07:30:00Z',
    coordinates: { lat: 35.68, lng: 139.69 },
    impactScore: 62,
  },
  {
    id: 'signal_us_macro',
    category: 'risk',
    level: 'warning',
    title: '美国流动性预期转弱',
    summary: '宏观流动性预期转弱，影响海外客户预算。',
    region: 'US',
    regionLabel: '美国',
    industry: '宏观 / 货币',
    credibility: 'verified',
    sources: [{ name: 'WSJ', publishedAt: '2026-06-20T06:30:00Z' }],
    firstSeenAt: '2026-06-20T06:30:00Z',
    lastUpdatedAt: '2026-06-20T09:00:00Z',
    coordinates: { lat: 38.9, lng: -77.0 },
    impactScore: 78,
  },
];

function industryTestId(industry: string): string {
  return `intel-map-industry-${encodeURIComponent(industry).replace(/%/g, '')}`;
}

test.describe('锦衣卫世界地图级联下钻', () => {
  test.setTimeout(60_000);

  test('点击战区后按国家/产业/信号级联展示，并联动详情抽屉', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1100 });
    await seedSession(page);
    await page.route('**/api/court/intel/signals**', (route) =>
      route.fulfill({
        status: 200,
        json: {
          success: true,
          data: SIGNALS,
          meta: { source: 'turso' },
        },
      }),
    );

    const basePath = await resolveBasePath(page.request);
    const signalsResponse = page.waitForResponse((response) =>
      response.url().includes(`${basePath}/api/court/intel/signals`) && response.status() === 200,
    );

    await page.goto(`${basePath}/intel`, { waitUntil: 'domcontentloaded' });
    await signalsResponse;

    await expect(page.getByTestId('intel-world-map')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('[data-testid="intel-real-tile-layer"] image').first()).toHaveAttribute(
      'href',
      /tile\.openstreetmap\.org/,
    );
    await expect(page.getByTestId('intel-map-attribution')).toContainText('OpenStreetMap');
    await expect(page.getByTestId('intel-sweep-delta')).toBeVisible();

    await page.getByRole('button', { name: '球面' }).click();
    await expect(page.getByTestId('intel-orbital-globe')).toBeVisible();
    await expect(page.getByTestId('intel-orbit-signal-signal_kr_hbm')).toBeVisible();

    await page.getByRole('button', { name: 'LITE' }).click();
    await expect(page.getByTestId('intel-world-map')).toContainText('VISUALS LITE');

    await page.getByRole('button', { name: '平图' }).click();
    await page.getByTestId('intel-map-region-east_asia').click();

    const drilldown = page.getByTestId('intel-map-drilldown');
    await expect(drilldown).toContainText('东亚战区');
    await expect(page.getByTestId('intel-map-country-KR')).toBeVisible();

    await page.getByTestId('intel-map-country-KR').click();
    await expect(drilldown).toContainText('韩国');

    await page.getByTestId(industryTestId('半导体')).click();
    await expect(page.getByTestId('intel-map-signal-signal_kr_hbm')).toBeVisible();

    await page.getByTestId('intel-map-signal-signal_kr_hbm').click();
    await expect(page.getByText('Signal Detail')).toBeVisible();
    await expect(page.locator('h2').filter({ hasText: '韩国 HBM4 量产节奏提前' })).toBeVisible();
  });
});
