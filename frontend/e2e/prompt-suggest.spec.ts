import { test, expect, type Page } from '@playwright/test';
import { seedSession, clearSession } from './fixtures';

/**
 * 本地镜像 PromptSuggestion 契约（SoT：src/lib/prompt-suggest/types.ts）。
 * 内联而非 `@/` import，避免 e2e 在无独立 tsconfig 下的路径解析风险；
 * 字段若与 SoT 漂移，下方 fixture 的类型标注会报错，起到契约哨兵作用。
 */
type Mode = 'fast' | 'standard' | 'deep';
interface SuggestionOptionShape {
  mode: Mode;
  prompt: string;
  estimatedTime: number;
  estimatedCost: number;
  description: string;
}
interface PromptSuggestionShape {
  userInput: string;
  intent: string;
  dept: string | null;
  suggestions: Record<Mode, SuggestionOptionShape>;
  recommended: Mode;
  recommendedReason: string;
  canSplit: boolean;
  splitSuggestion?: { description: string; subTasks: string[] };
  userHistory: {
    totalAttempts: number;
    successRate: Record<Mode, number>;
    lastUsedMode: Mode | null;
  };
  systemState: {
    openclawQueueLength: number;
    deptCurrentLoad: number;
    estimatedWaitTime: Record<Mode, number>;
    estimatedCost: Record<Mode, number>;
  };
}

/**
 * E2E：下旨推荐 /api/prompt/suggest + <PromptSuggester />
 *
 * 范式照 e2e/swarm-members.spec.ts（无需真实后端、无需真实登录）：
 *  - 双门鉴权种子：seedSession() 同时种 cookie `courtos.access_token` + localStorage `courtos.auth`
 *  - mock：page.route 拦截 /api/prompt/suggest 驱动 success / 500 两态
 *  - 组件挂载点：/e2e-harness/prompt-suggest（E2E 专用壳页，见 src/app/e2e-harness/prompt-suggest/page.tsx）
 *
 * 鉴权分层说明（决定各用例打哪条路径）：
 *  - 服务端中间件 src/proxy.ts：对所有非公开 /api/* 路由，缺 cookie → 401 {error:'unauthorized'}（小写）
 *  - 路由处理器 src/app/api/prompt/suggest/route.ts：cookie 存在但 JWT 解不出 sub → 401 {error:'Unauthorized'}（大写 U）
 *    （getUserIdFromSession → readAccessPayload，见 src/lib/auth/get-user-id.ts）
 *  两层都把未授权钉死在 401。下面用例分别覆盖：①真未登录(clearSession，走中间件) ②cookie 在但 token 非法(走路由处理器自身鉴权)。
 */

const API_GLOB = '**/api/prompt/suggest';
const HARNESS_URL = '/e2e-harness/prompt-suggest';

// 成功响应：三方案(fast/standard/deep) + recommended 徽标(含成功率%) + canSplit splitSuggestion。
// intent/dept 字段经此 mock 间接覆盖「意图/部门识别」(在「显示详情」面板渲染)。
const SUGGESTION_FIXTURE: PromptSuggestionShape = {
  userInput: '户部，看看上季度财务并预测下季度',
  intent: 'forecast',
  dept: 'hu_bu',
  suggestions: {
    fast: {
      mode: 'fast',
      prompt: '户部：用一句话概述上季度营收同比。',
      estimatedTime: 3000,
      estimatedCost: 0.01,
      description: '快速概览',
    },
    standard: {
      mode: 'standard',
      prompt: '户部：拉取上季度三大报表关键指标并给出同比环比解读。',
      estimatedTime: 15000,
      estimatedCost: 0.08,
      description: '标准分析',
    },
    deep: {
      mode: 'deep',
      prompt: '户部：构建上季度财务全景，结合行业基准做下季度三档预测与风险敞口。',
      estimatedTime: 60000,
      estimatedCost: 0.42,
      description: '深度推演',
    },
  },
  recommended: 'standard',
  recommendedReason: '你近 30 天对此类任务多用标准档，且当前队列空闲。',
  canSplit: true,
  splitSuggestion: {
    description: '这条下旨可拆成两步并行更快：',
    subTasks: ['户部：上季度财务复盘', '钦天监：下季度行业趋势预测'],
  },
  userHistory: {
    totalAttempts: 12,
    successRate: { fast: 60, standard: 87, deep: 73 },
    lastUsedMode: 'standard',
  },
  systemState: {
    openclawQueueLength: 0,
    deptCurrentLoad: 1,
    estimatedWaitTime: { fast: 1000, standard: 3000, deep: 8000 },
    estimatedCost: { fast: 0.01, standard: 0.08, deep: 0.42 },
  },
};

/** mock 成功响应（路由契约：{ ok: true, suggestions }）。 */
async function mockSuggestSuccess(page: Page): Promise<void> {
  await page.route(API_GLOB, (route) =>
    route.fulfill({ json: { ok: true, suggestions: SUGGESTION_FIXTURE } }),
  );
}

/** mock 500 失败（路由契约：失败体只含 {error}，绝不含 details，防信息泄漏）。 */
async function mockSuggestServerError(page: Page): Promise<void> {
  await page.route(API_GLOB, (route) =>
    route.fulfill({ status: 500, json: { error: 'Failed to generate suggestions' } }),
  );
}

/** 在挂载页里点「生成建议」触发一次 POST /api/prompt/suggest。 */
async function triggerSuggest(page: Page): Promise<void> {
  await page.getByPlaceholder(/户部.*兵部/).fill('户部，看看上季度财务并预测下季度');
  await page.getByRole('button', { name: /生成建议/ }).click();
}

test.describe('下旨推荐 · API 鉴权', () => {
  test('未登录(clearSession) POST /api/prompt/suggest → 401', async ({ page }) => {
    // 真未登录：清掉双门种子。缺 cookie 时由服务端中间件(src/proxy.ts)钉死 401。
    await clearSession(page);

    const res = await page.request.post('/api/prompt/suggest', {
      data: { input: '户部，看看财务' },
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status()).toBe(401);
    const body = await res.json();
    // 中间件层返回 {error:'unauthorized'}；不区分大小写断言「未授权」语义钉在 error 字段。
    expect(String(body.error).toLowerCase()).toBe('unauthorized');
    // 401 体不得泄漏内部细节。
    expect(body).not.toHaveProperty('details');
    expect(body).not.toHaveProperty('stack');
  });

  test('cookie 在但 token 非法 → 路由处理器自身 401 {error:"Unauthorized"}', async ({
    page,
  }) => {
    // seedSession 种的 cookie 值 'e2e-token' 不是合法 JWT：
    // 过中间件「cookie 存在」检查 → 进路由 → readAccessPayload() 解不出 sub → 路由返回 401 {error:'Unauthorized'}。
    await seedSession(page);

    const res = await page.request.post('/api/prompt/suggest', {
      data: { input: '户部，看看财务' },
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: 'Unauthorized' });
  });
});

test.describe('下旨推荐 · 组件渲染', () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page);
  });

  test('成功 → 渲染三方案卡片 + 推荐徽标(含成功率%) + 分拆按钮', async ({ page }) => {
    await mockSuggestSuccess(page);
    await page.goto(HARNESS_URL);
    await triggerSuggest(page);

    // 三张 OptionCard（fast/standard/deep 的 prompt 文案各自可见）
    await expect(
      page.getByText('户部：用一句话概述上季度营收同比。'),
    ).toBeVisible();
    await expect(
      page.getByText('户部：拉取上季度三大报表关键指标并给出同比环比解读。'),
    ).toBeVisible();
    await expect(
      page.getByText(/户部：构建上季度财务全景/),
    ).toBeVisible();

    // 三档模式标签
    await expect(page.getByText('⚡ 快速')).toBeVisible();
    await expect(page.getByText('⭐ 标准')).toBeVisible();
    await expect(page.getByText('🔬 深度')).toBeVisible();

    // 推荐徽标：recommended='standard' + successRate.standard=87 → 「推荐 (87%)」
    await expect(page.getByText(/推荐\s*\(87%\)/)).toBeVisible();
    // 推荐档的采用按钮文案区分
    await expect(
      page.getByRole('button', { name: '✓ 采用推荐方案' }),
    ).toBeVisible();

    // 分拆建议可见 + 子任务按钮可点
    await expect(page.getByText('这条下旨可拆成两步并行更快：')).toBeVisible();
    await expect(
      page.getByRole('button', { name: '户部：上季度财务复盘' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: '钦天监：下季度行业趋势预测' }),
    ).toBeVisible();
  });

  test('成功 → 「显示详情」间接覆盖意图/部门识别', async ({ page }) => {
    await mockSuggestSuccess(page);
    await page.goto(HARNESS_URL);
    await triggerSuggest(page);

    await page.getByRole('button', { name: /显示详情/ }).click();

    // intent='forecast' / dept='hu_bu' 经成功 mock 间接渲染在详情面板
    await expect(page.getByText(/识别意图/)).toBeVisible();
    await expect(page.getByText('forecast')).toBeVisible();
    await expect(page.getByText('hu_bu')).toBeVisible();
    await expect(page.getByText(/12 次尝试/)).toBeVisible();
  });

  test('接口 500 → 展示内联玻璃面板错误条「建议生成失败，请重试」(而非 alert)', async ({
    page,
  }) => {
    // 监听 dialog：组件用内联错误条替代阻塞式 alert，若误用 alert 此处会捕获到。
    let alertFired = false;
    page.on('dialog', (d) => {
      alertFired = true;
      void d.dismiss();
    });

    await mockSuggestServerError(page);
    await page.goto(HARNESS_URL);
    await triggerSuggest(page);

    // 内联错误条（role="alert" 的玻璃面板）文案。
    // 用 filter 排除 Next.js 注入的 route-announcer（也是 role="alert" 但空文本），避免 strict-mode 撞车。
    const errorBar = page
      .getByRole('alert')
      .filter({ hasText: '建议生成失败，请重试' });
    await expect(errorBar).toBeVisible();
    await expect(errorBar).toHaveText('建议生成失败，请重试');

    // 不应弹出原生 alert
    expect(alertFired).toBe(false);
    // 错误态下不渲染任何方案卡片
    await expect(page.getByText('⚡ 快速')).toBeHidden();
  });

  test('错误响应体只含 {error}，不泄漏 details/stack/message(信息泄漏回归)', async ({
    page,
  }) => {
    // 信息泄漏回归守卫：拍真实路由(page.request 走真后端、不被 page.route 拦)。
    //
    // 为什么不构造 500：route.ts 的 500 分支需 generateSuggestions 抛错才触发，
    // E2E 无法在不接真后端的情况下稳定造一个 500；但 route.ts 所有错误分支共用
    // 同一「只回 {error} 字符串」的封装(401/400/500 同构)。这里打可稳定到达的
    // 401 错误路径(seedSession 的非法 token)，断言错误响应体的形状契约：
    // 只暴露 error，绝不夹带 details / stack / message / suggestions。
    // 若有人日后在 catch 里把 errorMsg 塞进响应体(常见信息泄漏回归)，本断言即红。
    const res = await page.request.post('/api/prompt/suggest', {
      data: { input: '户部，看看财务' },
      headers: { 'Content-Type': 'application/json' },
    });

    expect([400, 401, 500]).toContain(res.status());
    const body = await res.json();
    expect(Object.keys(body)).toEqual(['error']);
    expect(typeof body.error).toBe('string');
    expect(body).not.toHaveProperty('details');
    expect(body).not.toHaveProperty('stack');
    expect(body).not.toHaveProperty('message');
    expect(body).not.toHaveProperty('suggestions');
  });
});
