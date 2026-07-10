# 实现报告 v1

## 改动

- `/liubu` 恢复 1672×941 宫苑全景、六部浮卡、响应式缩放和部门焦点轨道。
- `/zhuanshu` 恢复为独立专署门户，使用写实情报中枢背景，并渲染指向 `/zhuanshu/jinyiwei` 的锦衣卫入口卡。
- 移除专署门户上的 `1.0`、开放边界、英文眉题及其余说明性占位文案，仅保留标题和入口。
- 六部指标请求改用 `backendFetch`，不恢复前端 BFF。
- 锦衣卫信号接口不可用时使用现有 `mockIntelSignals`，并保持 `source: fallback`，避免整页被错误态遮住。

## 取舍

- 六部 LIVE 状态从当前 `CHAOTANG_V1_LIUBU` 派生，避免复活已删除的旧状态模块。
- 保留现有六部详情、专署锦衣卫详情路由和当前顶栏/底栏，不回滚其他主线收敛内容。

## 验证

- `pnpm exec tsc --noEmit`
- `$env:CI='true'; $env:NEXT_PUBLIC_API_MODE='real'; node scripts/next-with-base-path.mjs build --webpack`
- Playwright 1440×1000 截图与 DOM/资源核验。

