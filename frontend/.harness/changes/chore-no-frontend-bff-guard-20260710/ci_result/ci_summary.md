# CI 验证摘要

结论：PASSED

## 命令

```bash
cd frontend
node scripts/harness-doctor.mjs
npx --yes tsx --test scripts/harness-doctor.nodetest.ts
```

## 结果

- `node scripts/harness-doctor.mjs`：`harness-doctor: 0 errors, 0 warning(s)`。
- `npx --yes tsx --test scripts/harness-doctor.nodetest.ts`：`3 pass / 0 fail`。
- 反向验证（meta-test，证明测试非摆设）：临时禁用 `harness-doctor.mjs` 里两处 BFF 检查条件后
  重跑测试，得到 `1 pass / 2 fail`（失败路径用例正确变红），随后恢复原文件确认回到 `3 pass / 0 fail`。
