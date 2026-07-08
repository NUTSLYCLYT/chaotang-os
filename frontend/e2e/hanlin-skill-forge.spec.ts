import { expect, test } from '@playwright/test';
import { seedSession } from './fixtures';

test.describe('翰林炼 Skill', () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page);
    await page.addInitScript(() => {
      window.localStorage.setItem('courtos.onboarded', '1');
    });
  });

  test('首屏呈现采证到入史的 Skill 蒸馏闭环', async ({ page }) => {
    await page.goto('/hanlin/skill-forge');

    await expect(page.getByRole('heading', { name: 'Serenity 瓶颈投资法' })).toBeVisible();
    await expect(page.getByText('来源与证据', { exact: true })).toBeVisible();
    await expect(page.getByText('丞相裁决', { exact: true })).toBeVisible();

    for (const step of ['采证', '学习', '炼 Skill', '评测', '入史']) {
      await expect(page.getByText(step, { exact: true }).first()).toBeVisible();
    }

    for (const evidence of ['绿牌', '黄牌', '红牌', '黑牌']) {
      await expect(page.getByText(new RegExp(evidence))).toBeVisible();
    }

    await expect(page.getByText('unsafe blocked').first()).toBeVisible();
    await expect(page.getByText('不是个人投资建议')).toBeVisible();
    await expect(page.getByText('Video to Skill · 视频炼 Skill')).toBeVisible();
    await expect(page.getByText('learn-video-to-skill', { exact: true })).toBeVisible();
    await expect(page.getByText('已安装/创建 · 能装就装，不能装就本地复刻')).toBeVisible();
    await expect(page.getByRole('link', { name: /运行评测/ }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /送户部评测/ }).first()).toBeVisible();
    await expect(page.getByText('NotebookLM-like self-hosted path')).toBeVisible();
  });
});
