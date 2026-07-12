# CI 验证摘要

结论：PASS

## 命令

- `pnpm exec tsc --noEmit`
- `pnpm test:node`
- `pnpm harness:doctor`
- `node scripts/harness-doctor.mjs`(根级)

## 结果

- `tsc --noEmit`：绿，无新增错误。
- `test:node`：989 条测试，983 通过 / 6 失败，同一组既有无关失败(BFF 写隔离、`dispatchDeptToSwarm` 鉴权守门、学习持久化解耦、e2e 后门安全、bureau page view)，与本次改动无关。
- `pnpm harness:doctor`：0 errors, 0 warnings。
- `node scripts/harness-doctor.mjs`(根级)：0 errors, 0 warnings。

