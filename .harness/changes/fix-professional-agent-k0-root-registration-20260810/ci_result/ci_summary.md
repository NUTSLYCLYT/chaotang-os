# CI 摘要：fix-professional-agent-k0-root-registration-20260810

## 命令

| 命令 | 退出码 | 结果 | 证据覆盖范围 | 证据位置 / 时间 |
| --- | ---: | --- | --- | --- |
| `node --test scripts/professional-agent-matrix.nodetest.mjs` | 0 | 13/13 PASS | root registration 正/负例、matrix/schema/provenance | 本地控制台，2026-08-10 |
| `node scripts/professional-agent-matrix.mjs --check` | 0 | PASS | 8 assets、35 designs、71 prompts | 本地控制台，2026-08-10 |
| `node scripts/harness-doctor.mjs` | 1 | K0 登记全部 PASS；仅 2 个 exact-H authority 错误 | 根登记与 authority 边界 | 本地控制台，2026-08-10 |
| `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W08` | 1 | STOP / INVALID_EXECUTION_AUTHORITY | 新 candidate 尚未 exact-H 推广 | 本地控制台，2026-08-10 |
| `git diff --check` | 0 | PASS | 补丁格式 | 本地控制台，2026-08-10 |

## 结果

根 manifest、required files、doctor 委派与 wiki 已接线；删除登记会令 13 项测试失败，删除/损坏 matrix 会令 doctor 失败。当前 STOP 是预期的 fail-closed 状态：分支 HEAD 尚未成为 EXT pinned HEAD，且 project manifest 已变更。

## 未验证项

- exact-H owner approval、独立复核、authority 重钉和 Gitee 推广尚未完成。
- 99 台账的两个既存 moved-ref 仍需独立 successor 记录。

## Diff 与回滚复核

- changed files：project manifest、root doctor、matrix registration validator/test、两份 root wiki、本 change。
- diff review：无产品 runtime、API、数据、前端、provider 或旧 donor 变更。
- 回滚是否演练：未执行；单注册提交可 revert。

## 完成定义映射

| DoD | 证据 | 状态 |
| --- | --- | --- |
| 根 manifest 精确登记 | Node registration test | PASS |
| 缺失登记 fail closed | negative test | PASS |
| doctor 委派 matrix CLI | doctor 输出 `registered and valid` | PASS |
| exact-H authority | v2 STOP | PENDING |
| Gitee promotion | 未执行 | PENDING |

## 声明状态

- `DRAFT / VERIFIED_PARTIAL / VERIFIED_COMPLETE / BLOCKED`：`VERIFIED_PARTIAL`（登记实现完成，exact-H authority/promotion 待办）
