# 变更摘要：chore-v1-route-prune-20260708

| Field | Value |
| --- | --- |
| Change ID | chore-v1-route-prune-20260708 |
| Type | chore |
| Status | DELIVERED |
| Owner | Frontend Agent |
| Created | 20260708 |

## 阶段进度

| # | 阶段 | Status | 证据 |
| --- | --- | --- | --- |
| 0 | 加载上下文 | DONE | 已加载 harness 上下文 |
| 1 | 需求分析 | DONE | request_analysis/spec.md, tasks.md |
| 2 | 需求复核 | DONE | request_analysis/review/spec_review_v1.md |
| 3 | 实现记录 | DONE | coding/coding_report_v1.md |
| 4 | 代码复核 | DONE | coding/review/code_review_v1.md |
| 5 | 测试计划 | DONE | unit_test/test_plan.md, e2e_test/e2e_plan.md |
| 6 | 测试复核 | DONE | unit_test/review/test_review_v1.md |
| 7 | 提交 / 收口 | N/A | 仅本地 harness 记录 |
| 8 | CI 验证 | PASSED | ci_result/ci_summary.md |
| 9 | E2E 验证 | N/A | e2e_test/e2e_summary.md |
| 10 | 部署验证 | N/A | deployment/preview_report.md |
| 11 | 用户确认 | CONFIRMED | 已采用 V1 路由面 |

## 范围

在不重设计页面 UI 的前提下，收束朝堂 OS 1.0 页面路由。

规范路由：

- `/dadian`
- `/shangshufang`
- `/junjichu`
- `/liubu`
- `/zhusi`
- `/shiguan`
- `/zhusi/jinyiwei`
- `/liubu/hubu/yusuan`
- `/liubu/hubu/chuna`
- `/liubu/libu/renmian`
- `/liubu/libu/zhaopin`
- `/liubu/bingbu/baojia`
- `/liubu/bingbu/xiansuo`
- `/liubu/xingbu/hetong`
- `/liubu/gongbu/chan-yan`

## 备注

旧额外页面路由已移到 `dev/_attic/v1-route-prune-20260708/`。
Legacy URLs 在 `next.config.ts` 中仍保留临时 307 redirects。
登录、注册、邀请、进入页等基础设施页面保留。

## 验证

- `pnpm exec tsc --noEmit`：pass
- `NEXT_PUBLIC_API_MODE=real pnpm build`：pass

