# 变更摘要：docs-r0-w03-secure-ingest-approval-20260722-20260722

> 执行授权：`NOT_GRANTED_BY_CHANGE_RECORD`
> 本目录只记录需求与证据；产品实施必须绑定获批 amendment 和 exact-HEAD 执行权威。

| 字段 | 值 |
| --- | --- |
| Change ID | docs-r0-w03-secure-ingest-approval-20260722-20260722 |
| 类型 | docs |
| 状态 | VERIFIED_COMPLETE |
| Owner | lyt |
| 创建日期 | 20260722 |

## 范围

- 主线：`origin/feature-chaotang-ext@b5106ba7`，R0-W03 从此状态开分支
- 文件：`owner_approval/exact-h-approval.md`（本目录）+ `.harness/manifest/execution-authority.v2.json` ledger 翻转
- 验证：`node scripts/execution-authority-v2.mjs --authorize --work-package R0-W03` → GO
