# CI 摘要：fix-ext-transparent-promotion-authority-20260810

## 命令

| 命令 | 退出码 | 结果 | 证据覆盖范围 | 证据位置 / 时间 |
| --- | ---: | --- | --- | --- |
| `node --test scripts/execution-authority-v2.nodetest.mjs` | 0 | 75/75 PASS | v2 全套正反例、真实仓库 CLI 与 evidence | 本地控制台，2026-08-10 |
| `node --test scripts/execution-authority.nodetest.mjs` | 0 | 10/10 PASS | v1 失效关闭相邻门禁 | 本地控制台，2026-08-10 |
| `node scripts/execution-authority-v2.mjs --check` | 0 | VALID_STRUCTURE | v2 结构 | 本地控制台，2026-08-10 |
| `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W08` | 0 | GO / APPROVED_WORK_PACKAGE | 真实 PR !20 拓扑 | 本地控制台，2026-08-10 |
| `node scripts/harness-doctor.mjs` | 0 | 0 errors, 0 warnings | 根项目与委派门禁 | 本地控制台，2026-08-10 |
| `python3 backend/scripts/harness_doctor.py` | 0 | 0 errors, 0 warnings | 后端 harness | 本地控制台，2026-08-10 |
| `node --check ... && git diff --check` | 0 | PASS | JavaScript 语法与补丁格式 | 本地控制台，2026-08-10 |

## 结果

透明平台推广被严格识别，执行权威恢复 GO；相邻门禁与攻击反例保持绿色。

## 未验证项

- Gitee 合并后最终远端 SHA 与本地同步尚待完成。

## Diff 与回滚复核

- changed files：resolver、v2 tests、authority wiki、单一 change record。
- diff review：未发现产品代码、manifest、批准证据或 L0 冻结对象变化。
- 回滚是否演练：未执行破坏性回滚；本变更可由单提交 revert 恢复。

## 完成定义映射

| DoD | 证据 | 状态 |
| --- | --- | --- |
| 透明推广正例通过 | 新增回归测试 + 真实仓库授权 GO | PASS |
| tree 改写与无祖先关系拒绝 | 新增两个反例 | PASS |
| authority/Doctor 全绿 | 75+10 tests、root/backend Doctor | PASS |
| Gitee 合入与远端一致 | 待 PR 完成 | PENDING |

## 声明状态

- `DRAFT / VERIFIED_PARTIAL / VERIFIED_COMPLETE / BLOCKED`：`VERIFIED_PARTIAL`（本地完整，待 Gitee 合入后升级）
