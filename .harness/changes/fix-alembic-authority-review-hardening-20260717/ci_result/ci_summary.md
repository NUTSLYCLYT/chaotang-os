# CI 摘要：fix-alembic-authority-review-hardening-20260717

## 命令

| 命令 | 退出码 | 结果 | 证据覆盖范围 | 证据位置 / 时间 |
| --- | ---: | --- | --- | --- |
| 新增 RED 定向 pytest（实现前） | 1 | 13 failed, 12 passed | 证明新 head、missing-file、fingerprint、015、service 缺口确实存在 | 隔离 worktree，2026-07-17 |
| 独立审查 CLI apply 异常 RED | 1 | missing Alembic config 时 exit 1 + traceback | 证明 operator 异常边界缺口 | 隔离 011 临时 SQLite，2026-07-17 |
| authority/adoption/007-015/DDL guard 定向 pytest | 0 | 53 passed | 相邻迁移、strict、adoption、015、CLI 与 service 契约 | 隔离临时 SQLite，2026-07-17 |
| 上游 P5 代表集 15 文件 | 0 | 111 passed, 6 skipped | auth、worker、poller、ledger、authority、adoption、migration | 隔离 worktree，2026-07-17 |
| `ruff check` 变更 Python 文件 | 0 | All checks passed | 静态错误、导入顺序 | 2026-07-17 |
| `python3 -m compileall -q` 变更生产 Python | 0 | 通过 | 语法/字节码编译 | 2026-07-17 |
| `python3 scripts/harness_doctor.py` | 0 | 0 errors / 0 warnings | 后端 harness | 2026-07-17 |
| `node scripts/harness-doctor.mjs` | 0 | 0 errors / 0 warnings | 根级边界与 change record | 2026-07-17 |
| 全量 `backend/tests` | 1 | 2719 passed, 30 skipped, 7 failed | 全后端回归 | 2026-07-17 |
| 原始 B=`346dc81` 精确复跑上述 7 项 | 1 | 同样 7 failed, 3 passed | 证明全量失败均为基线既有问题 | detached 临时 worktree，已删除，2026-07-17 |
| `git fetch origin feature-chaotang-ext` + SHA 比对 | 0 | 远端仍为 `346dc81`，0/0 漂移 | review 基线稳定性 | 2026-07-17 |
| normalization blocker RED（实现前） | 1 | 2 failed, 18 deselected | CHECK/default 仅字面量大小写不同被误判等价 | P5.1 隔离工作树，2026-07-17 |
| normalization blocker focused GREEN | 0 | 2 passed, 18 deselected | 两函数各一条负例 | P5.1 隔离工作树，2026-07-17 |
| `test_unversioned_database_adoption.py` | 0 | 20 passed | 合法 010/011、CLI、失败边界与新负例 | 临时 SQLite，2026-07-17 |
| 007–015 authority/adoption/DDL 代表集 | 0 | 50 passed | 历史迁移与精确默认兼容 | 临时 SQLite，2026-07-17 |
| `ruff` + isolated `compileall` | 0 | 通过 | 新规范化器静态/语法检查 | 2026-07-17 |
| blocker 回修后全量 `backend/tests` | 1 | 2727 passed, 30 skipped, 7 failed | 7 项与既有 P5.1 全量基线同类；无 normalization/adoption 新失败 | 2026-07-17 |

## 结果

P5.1 自身验证完成。新增 015 作为 validation-only head，避免通过修改已发布 014
制造“旧库不会重新执行 guard”的假安全；合法 010/011 可接管到 015，畸形候选和身份表
均在 backup/stamp/DDL 前拒绝。缺失普通路径与 SQLite file URI 均零创建，生产 service
通过 ExecStart 最终覆盖为 strict。

Claude HIGH blocker 已按 RED→GREEN 回修：共享词法规范化器仅在引号外 lower/折叠空白，
完整保留单/双引号内字面量与转义引号；006/009 frozen migration 的 source-label 默认清单
由错误小写校正为精确 `FALLBACK`。旧 review-v1 GO 不再有效，必须对新实现头重新审查。

## 未验证项

- PostgreSQL 未验证；上游 strict 已显式阻断该生产形态，本包只认证 SQLite。
- 未连接、备份、迁移真实 `backend/var/data/fengqun.db`，未停止或重启真实服务。
- 全量 7 个失败均已在原始 B 精确复现；属于任务范围外既有基线问题，未顺便修复。
- P6 保持冻结且未提交/合并/上传；P5.1 新 GO 前不得合 ext。

## Diff 与回滚复核

- changed files：authority/adoption/CLI、验证型 015、两个 service 模板、迁移/契约测试、
  根 change record。
- diff review：只收紧 preflight 和部署契约，不改 outbox、worker、业务终态或真实数据。
- 回滚是否演练：临时 SQLite 已验证 015→014 只移动 version marker 且身份行保持；生产 runbook
  明确先在当前代码下降到 014、核验后再 revert。未获授权时不对真实库执行该流程。

## 完成定义映射

| DoD | 证据 | 状态 |
| --- | --- | --- |
| 缺失 SQLite 路径零创建 | authority/adoption 普通路径 + file URI tests | 完成 |
| 010/011 完整候选指纹 | column/PK/null/type/default/unique/check/FK/named index/未知结构 tests | 完成 |
| 010 不忽略已存在的畸形 011 表 | malformed archive candidate test | 完成 |
| 已发布 014 的身份表重新过门 | 015 validation-only fresh/legacy/malformed tests | 完成 |
| 接管失败在 backup/stamp/DDL 前 | malformed tasks/identity apply tests | 完成 |
| operator 与生产部署契约 | CLI `--check`/JSON/no-traceback + 双 service strict tests | 完成 |
| 015 发布后代码回滚顺序 | 临时 SQLite 015→014 行保持 + runbook | 完成 |
| 根/后端护栏与相邻回归 | doctors、47/105 test sets、Ruff/compile | 完成 |
| CHECK/default 字面量大小写不折叠 | 2 RED→2 GREEN；adoption 20/20；代表集 50/50 | 完成，待 Claude 复审 |

## 声明状态

- `READY_FOR_CLAUDE_REVIEW`：实现与验证完成；旧 GO 失效，尚未获得新 GO。
