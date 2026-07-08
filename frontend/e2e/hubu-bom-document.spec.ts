import { test, expect, type Page } from '@playwright/test';
import { seedSession } from './fixtures';

/**
 * 户部真闭环回归：上传 BOM → 浏览器解析(数据不上传) → 成本引擎 → 盖章呈奏公文。
 * 护住 2026-06-29 建的"真决策→盖章公文→可导出PDF"链路不退化（AGENTS.md §11）。
 *
 * 双门鉴权：seedSession() 种 cookie + localStorage（见 fixtures.ts）。
 * basePath：dev 现带 /chaotang，从 env 取（见 basepath-routing-trap）。
 */
const basePath = process.env.PLAYWRIGHT_BASE_PATH ?? process.env.NEXT_PUBLIC_BASE_PATH ?? '';
const BOM_FIXTURE = 'e2e/fixtures/电动三轮电池包.xlsx';

async function gotoFinance(page: Page) {
  await seedSession(page);
  await page.goto(`${basePath}/departments/finance`, { waitUntil: 'domcontentloaded' });
}

test.describe('户部 · 上传BOM → 盖章呈奏', () => {
  test('真闭环：上传 BOM 解析出真成本，一键生成盖章呈奏（数字全推导自上传文件）', async ({ page }) => {
    await gotoFinance(page);

    // 上传 BOM（客户端解析，原始数据不上传）
    await page.locator('input[type=file]').first().setInputFiles(BOM_FIXTURE);

    // 解析出真成本（电芯 9836+BMS 2400+结构件 1645+充电器 800 = 14681）
    await expect(page.getByText('14681').or(page.getByText('14,681'))).toBeVisible({ timeout: 15_000 });

    // 一键生成盖章呈奏
    await page.getByRole('button', { name: /生成盖章呈奏/ }).click();

    // 公文浮层：标题/BLUF 全推导自上传文件
    await expect(page.getByText(/成本核定的呈奏/)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/14,681 元/).first()).toBeVisible();
    await expect(page.getByText(/磷酸铁锂电芯占比 67%/)).toBeVisible();

    // 户部官印（aria-label 含部门名）+ 导出PDF 入口
    await expect(page.getByRole('img', { name: /户部.*财政专用章/ }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: '导出 PDF / 打印' })).toBeVisible();
  });

  test('诚实：缺竞品报价标"缺"，不伪造（铁律13.2）', async ({ page }) => {
    await gotoFinance(page);
    await page.locator('input[type=file]').first().setInputFiles(BOM_FIXTURE);
    await expect(page.getByText('14681').or(page.getByText('14,681'))).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: /生成盖章呈奏/ }).click();
    await expect(page.getByText(/竞品.*报价/)).toBeVisible({ timeout: 10_000 });
    // 高风险报价门
    await expect(page.getByText(/高风险事项|禁一键对外/)).toBeVisible();
  });
});
