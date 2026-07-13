# 单测计划

## 覆盖范围

`frontend/scripts/harness-doctor.nodetest.ts`，3 个用例：

1. 干净仓库（无 `src/app/api`、无 `route.*`）——doctor 输出两条 `[ok]`。
2. 临时制造 `src/app/api/__bff_guard_regression_test__/`——doctor 非 0 退出，报
   `BFF layer forbidden`，`finally` 块清理。
3. 临时制造 `src/app/__bff_guard_regression_test__/route.ts`——doctor 非 0 退出，报
   `BFF route handlers forbidden` 并列出具体路径，`finally` 块清理。

## 命令

```bash
cd frontend
npx --yes tsx --test scripts/harness-doctor.nodetest.ts
```

## 未覆盖风险

- 没有测试 `route.tsx`/`route.js`/`route.jsx` 三种变体（只测了 `route.ts`）——正则本身
  `^route\.(ts|tsx|js|jsx)$` 是同一条规则处理四种后缀，风险低，未额外补测。
- 没有测试嵌套多层目录下的 `route.*`（只测了一层）——`collectForbiddenRouteHandlers` 是
  简单递归，逻辑上层数不影响判断，未额外补测。
