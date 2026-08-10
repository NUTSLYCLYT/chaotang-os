# 需求说明

## 背景

EXT 已能完成真实合同闭环，但下旨后的 task identity、canonical 回奏和旧覆盖层之间存在体验歧义；本轮按 dev-ext-test 的单一事实源原则收敛。

## 范围

1. 下旨成功后将真实 task_id 写入当前上书房 URL，并让合同右栏使用同一任务。
2. canonical formal/candidate/direct/vetoed 回奏优先于草拟/PACK 展示。
3. 为真实闭环增加显式 opt-in 的 Playwright 回归。
4. 记录本轮 Harness 审计证据。

## 非目标

不合并 dev-ext-test 整个分支；不新增页面、Agent、状态机或后端事实源；不部署、不迁移数据库、不操作 3050；默认 E2E 不自动写入 8081。

## 验收标准

下旨后 URL 含真实 task_id；合同面板 task_id 与其一致；canonical 来源不被旧 PACK 覆盖；真实 Loop 完成交付、裁决和史馆 EXACT ARCHIVE 回放。

## 风险

URL 更新可能影响浏览器返回；canonical 优先级可能影响 PACK/钦天监临时视图；真实 E2E 依赖显式隔离运行时。

## 验证计划

pnpm exec tsc --noEmit --ignoreDeprecations 5.0
pnpm exec tsx --test src/features/shangshufang/canonical-memorial-view.nodetest.ts src/features/shangshufang/hooks/useShangshufangBriefing.nodetest.ts
RUN_REAL_LOOP=1 PLAYWRIGHT_SKIP_WEBSERVER=1 pnpm exec playwright test e2e/shangshufang-real-loop.spec.ts
pnpm harness:doctor
