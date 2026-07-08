import { test, expect } from '@playwright/test';
import { seedSession } from './fixtures';

/**
 * E2E 回归断言：军机处 /command-center「像上书房」改版（批一·高冲击四件，2026-07-05）。
 *
 * 铁律4：给决策卷加"漂浮"视觉权重 + 改共享壳区域 = 高危改动，必须钉一条回归断言，
 * 让 CI 每次替我复核"不该发生的事"，而非靠"按构造正确"的口头承诺。
 *
 * 全部走空态（无 taskId）——不需要后端、不需要 mock，seedSession 双门种子即可进页面。
 * 钉的四件"不该回归"：
 *   1. F1 顶部并列 Tab 栏（作战沙盘/会审室/案卷立案）不得回归——它切断沉浸场景。
 *   2. F3 钦天监左翼不得再出现新手教程编号（"军机处是什么"）。
 *   3. F5 底部命令轴必须存在（召六部会审键可见）。
 *   4. F5 空态下"派蜂群"必须 disabled（禁装饰按钮·铁律13.2.5：无真案不可派蜂群）。
 */

const URL = '/command-center';

test.describe('军机处 · 像上书房 改版回归', () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page);
  });

  test('F1：顶部并列 Tab 栏不回归（场景直入）', async ({ page }) => {
    await page.goto(URL);
    // 旧 JunjichuViewTabBar 的"作战沙盘"标签只在那条被移除的 Tab 栏里出现；命令视图不应再渲染它。
    await expect(page.getByRole('button', { name: '作战沙盘' })).toHaveCount(0);
  });

  test('F3：左翼钦天监不再出现新手教程（去教程化）', async ({ page }) => {
    await page.goto(URL);
    // "军机处是什么" 是被删掉的三条 onboarding 编号之一——不得作为常驻内容复活。
    await expect(page.getByText('军机处是什么')).toHaveCount(0);
    // 常驻应为一句克制候星辞。
    await expect(page.getByText('候星在侧', { exact: false })).toBeVisible();
  });

  test('F4：空态右翼折叠——六部表态/负责人汇报不常驻（安静房）', async ({ page }) => {
    await page.goto(URL);
    // 空态右翼三卡折叠成一句提示（该提示只在空态出现；"六部表态"三字也在页面副标题里，不可 count，故只断言折叠提示）。
    await expect(page.getByText('待接案后于此展开六部会审', { exact: false })).toBeVisible();
    // 负责人汇报(DepartmentWorkflowChip)是部门级日报、非本案数据，空态不得出现（防"误导性满"回归）。
    await expect(page.getByText('负责人汇报')).toHaveCount(0);
  });

  test('F5：底部命令轴存在且空态下派蜂群 disabled（诚实·禁装饰）', async ({ page }) => {
    await page.goto(URL);
    // 命令轴五键之一：召六部会审，必须可见。
    await expect(page.getByRole('button', { name: '召六部会审' })).toBeVisible();
    // 空态（无真案）下，派蜂群 / 转史馆无对象可执行，必须 disabled。
    await expect(page.getByRole('button', { name: '派蜂群' })).toBeDisabled();
    await expect(page.getByRole('button', { name: '转史馆' })).toBeDisabled();
    // 发圣旨常驻可用（永远可回上书房立案）；header 与命令轴各一枚，取首枚验证意图即可。
    await expect(page.getByRole('button', { name: '发圣旨' }).first()).toBeEnabled();
  });
});
