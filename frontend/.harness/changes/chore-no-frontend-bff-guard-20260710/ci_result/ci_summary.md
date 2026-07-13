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
- 2026-07-14 第二轮：修正测试清理逻辑的删除范围（见 `unit_test/review/test_review_v1.md`"修正记录"）后，
  手动模拟"`src/app/api/` 下有别人的真实文件"场景，确认测试不再连坐删除；清理模拟文件后复跑仍
  `3 pass / 0 fail`；反向验证也重跑过，确认修复没有削弱检测能力。
- 2026-07-14 第三轮：`process.pid` 命名唯一性不可靠（见 `unit_test/review/test_review_v1.md`"修正记录"），
  改用 `fs.mkdtempSync` 由操作系统保证路径唯一。复跑完整验证链：正常 `3 pass / 0 fail`；模拟别人的
  文件后确认不受影响、`git status` 确认无残留；反向验证 `1 pass / 2 fail` 后恢复回 `3 pass / 0 fail`。
