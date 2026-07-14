# CI 验证摘要

结论：PASS

## 命令

- `node --test frontend/scripts/guard-credential-leak.nodetest.mjs`
- `bash frontend/scripts/guard-credential-leak.sh`
- `node --test scripts/capability-entry-governance.nodetest.mjs`
- `node scripts/harness-doctor.mjs`

## 结果

- 守卫测试 2/2 通过；能力入口治理测试 3/3 通过。
- 根 Doctor 0 errors / 0 warnings，并委托前后端 Doctor 通过。
