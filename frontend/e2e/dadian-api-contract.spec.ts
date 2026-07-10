import { expect, test, type APIRequestContext } from '@playwright/test';
import { seedSession } from './fixtures';

const BACKEND_BASE =
  process.env.NEXT_PUBLIC_JIQUN_API_URL ??
  process.env.NEXT_PUBLIC_CHAOTANG_API_URL ??
  process.env.NEXT_PUBLIC_BACKEND_API_URL ??
  'http://localhost:8081';

async function getJson(request: APIRequestContext, path: string): Promise<unknown> {
  const response = await request.get(`${BACKEND_BASE}${path}`);
  expect(response.ok(), `${path} should be served by the real backend`).toBeTruthy();
  return response.json();
}

test.describe('dadian P0 backend contract smoke', () => {
  test('opens the protected dadian page without falling to browser 404/500', async ({ page }) => {
    await seedSession(page);
    const response = await page.goto('/dadian', { waitUntil: 'domcontentloaded' });
    expect(response?.status(), '/dadian should not return a Next/browser error page').toBeLessThan(400);
    await expect(page.getByRole('heading', { name: '404', exact: true })).toHaveCount(0);
    await expect(page.locator('body')).not.toHaveText('');
  });

  test('reads pulse and feed from backend-owned dadian endpoints', async ({ request }) => {
    const pulse = await getJson(request, '/api/court/dadian/pulse');
    const feed = await getJson(request, '/api/court/dadian/feed');
    expect(pulse, 'pulse response should be an object').toEqual(expect.any(Object));
    expect(feed, 'feed response should be an object').toEqual(expect.any(Object));
  });
});
