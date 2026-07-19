# CI 摘要：fix-p8-p9-frontend-residual-cleanup-20260718

## 命令

| 命令 | 退出码 | 结果 | 证据覆盖范围 | 证据位置 / 时间 |
| --- | ---: | --- | --- | --- |
| `rg -n "hanlin-home-mock" frontend/src` | 1 | 零命中 | 删除文件无生产引用 | 隔离 worktree，2026-07-18 |
| `pnpm exec tsx --test src/features/hanlin/lib/api.nodetest.ts src/features/hanlin/lib/read-model.nodetest.ts src/features/shangshufang/finance-intel-loop-path.nodetest.ts` | 0 | 8 tests passed | Hanlin authenticated transport/read-model + canonical path | 隔离 worktree，2026-07-18 |
| `pnpm exec tsc --noEmit` | 0 | 无输出 | 前端全量类型与删除引用 | 隔离 worktree，2026-07-18 |
| `pnpm build`（未设置 API mode） | 1 | release gate 按设计拒绝 undefined mode | mock/LIVE fail-closed 门 | 隔离 worktree，2026-07-18 |
| `NEXT_PUBLIC_API_MODE=real pnpm build` | 0 | Next.js production build compiled successfully | REAL 模式完整前端构建；既有 middleware deprecation warning | 隔离 worktree，2026-07-18 |
| `pnpm harness:doctor` | 0 | 0 errors, 0 warnings | 前端结构/BFF 禁令 | 隔离 worktree，2026-07-18 |
| `node scripts/harness-doctor.mjs` | 0 | 0 errors, 0 warnings | 根/前端/后端三层结构 | 隔离 worktree，2026-07-18 |
| `git diff --check` | 0 | 无输出 | 当前候选格式 | 隔离 worktree，2026-07-18 |

## 结果

候选清理与机械验证通过。首次 build 的 exit 1 是缺少显式 REAL 模式时的预期
fail-closed；设置 `NEXT_PUBLIC_API_MODE=real` 后完整构建通过。

## 未验证项

- 未运行浏览器 E2E：本包不修改任何可达生产实现或用户可见行为。
- 未宣称 P8/P9 总体验收完成；P12 `VERIFIED_PARTIAL` 边界保持。
- 尚未取得最终实现提交的独立 Claude review；ext 合并/推送保持禁止。

## Diff 与回滚复核

- changed files：删除 1 个零引用 mock、新增 1 个 node test、4 个 root change 文档。
- diff review：无页面/API/adapter/UI/source label/lockfile 变化，无其他本地提交。
- 回滚是否演练：未执行破坏性回滚；可用 `git revert <packet-commit>` 原子恢复。

## 完成定义映射

| DoD | 证据 | 状态 |
| --- | --- | --- |
| mock 零引用 | `rg` 零命中 | PASS |
| 相关回归 | 8 tests passed | PASS |
| 类型与生产构建 | tsc + REAL build | PASS |
| 三层结构 | frontend/root doctor 0 error/warning | PASS |
| 独立 packet 复审 | 等待最终 SHA | PENDING |

## 声明状态

- `IMPLEMENTED_CANDIDATE / EXTERNAL_REVIEW_PENDING`：本地实现和机器验证完成，未合入、未推送。
