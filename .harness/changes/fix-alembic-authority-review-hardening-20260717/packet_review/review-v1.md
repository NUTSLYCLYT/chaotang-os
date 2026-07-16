# P5.1 Packet Review v1

- Packet ID：P5.1
- 基线：`346dc81faf89effcf6998b944cdc5c7f66e60a28`
- 实现头：`73a4d47618d7fe6f1c4c9a15343d7ef5b92822f7`
- 审查方式：独立只读审查
- Verdict：GO

## SHA 与边界

审查开始及结束时均确认：

- `HEAD=73a4d47618d7fe6f1c4c9a15343d7ef5b92822f7`
- 工作树 clean
- `B` 是 `H4` 的祖先
- 审查期间 H4 未漂移
- 未编辑或提交文件
- 未连接 `backend/var/data/fengqun.db`
- 未启动、停止或重启真实服务
- 所有 DDL 均位于 `/tmp` 临时 SQLite

## Blocker

无。

## 已验证范围

1. 缺失 SQLite 普通路径与 `file:` URI 在 connect 前拒绝，文件保持不存在。
2. 010/011 adoption fingerprint 严格比较：
   - 列全集、类型、nullable、default；
   - PK、unique、check constraint；
   - FK 目标、列及 options；
   - named index 名称、列序和 unique 属性；
   - 未知表、列及约束；
   - 已存在的畸形 `archive_outcome_events` 不会被 010 fallback 忽略。
3. 已存在的 `kind`、`tenant_id` 会在 backup/stamp 前校验；未知 kind、错误 check、错误 tenant 形状均 fail-closed。
4. 既有 identity 表在 adoption 前校验；015 对已发布 014 做 validation-only 复验，包括 PK/null/type/default/unique/FK options，并拒绝额外 FK、named index 和 check。
5. CLI：
   - 明确支持 `--check`；
   - missing Alembic config 在 backup/stamp 前失败；
   - 返回 exit 2、stdout JSON、stderr 无 traceback；
   - Alembic command 或最终 verification 异常统一转为 `AdoptionError`，明确备份位置及恢复要求。
6. 两个 systemd 模板均在 `ExecStart` 使用 `/usr/bin/env FENGQUN_SCHEMA_MODE=strict`，`.env` 无法改变最终进程模式。
7. 015→014 downgrade 只移动版本标记；临时 SQLite 对比证明 identity 表 DDL 与行完全保持。
8. 回滚文档已明确：
   - 尚无数据库到 015 时可直接 revert；
   - 已到 015 时必须在当前代码下获得授权，先 downgrade 到 014、核验，再 revert；
   - adoption 中途失败必须使用 mandatory backup 恢复。

## 实际命令与结果

- SHA、祖先及 clean 检查：通过。
- authority/adoption/007–015/service 定向 pytest：`53 passed in 15.33s`。
- 临时 SQLite 对抗验证：
  - command failure 转 `AdoptionError`：通过；
  - verification failure 转 `AdoptionError`：通过；
  - backup recovery guidance：通过；
  - 015→014 schema 与 rows 保持：通过。
- `git diff --check B..H4`：通过。
- `ruff check` 变更 Python 文件：`All checks passed!`
- 隔离 pycache 的 `compileall`：通过。
- backend harness doctor：`0 errors, 0 warnings`。
- root harness doctor：`0 errors, 0 warnings`。
- 版本化 CI 记录的全量基线对比：H 分支仅有原始 B 同样可复现的 7 个既有失败，无新增失败。

## Non-blocker

- PostgreSQL 未认证；当前生产 strict gate 已显式阻断该形态，本包只认证 SQLite。
- 全量套件的 7 个既有失败属于范围外基线问题，不影响本包定向合同结果。

## 最终结论

`B..H4` 已闭合此前 missing-file、fingerprint、identity、CLI、effective strict 与 rollback 阻断项。允许以精确 H4 生成 versioned review commit；任何后续代码变化均使本 GO 自动失效并要求重新审查。

PACKET_REVIEW_GO
