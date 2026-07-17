# CI 摘要：fix-p5-1-literal-normalization-repair-20260717

## 命令

| 命令 | 退出码 | 结果 | 证据覆盖范围 | 证据位置 / 时间 |
| --- | ---: | --- | --- | --- |
| 精确复现 `6056e2c` 旧 normalization 函数 | 0 | `old_check_equal=True`、`old_default_equal=True` | 证明两个已知缺陷在旧实现真实存在 | repair worktree，2026-07-17 |
| `test_unversioned_database_adoption.py` | 0 | 20 passed | 两条负例、010/011 adoption、CLI 与失败边界 | venv Alembic/SQLAlchemy + pytest，2026-07-17 |
| 007–015 / authority / adoption / runtime DDL 代表集 | 0 | 55 passed | 历史迁移、精确默认、015 guard、strict authority | 临时 SQLite，2026-07-17 |
| `ruff check` 变更 Python/测试 | 0 | All checks passed | 静态检查 | 2026-07-17 |
| 隔离 `compileall` | 0 | 通过 | `schema_adoption.py` 语法 | `/tmp` pycache，2026-07-17 |
| `python3 scripts/harness_doctor.py` | 0 | 0 errors / 0 warnings | 后端 harness | 2026-07-17 |
| `node scripts/harness-doctor.mjs` | 0 | 0 errors / 0 warnings | 根边界与 change record | 2026-07-17 |
| 全量 `backend/tests` | 1 | 2727 passed, 30 skipped, 7 failed | 全后端回归 | 362.21s，2026-07-17 |
| 远端前序核对 | 0 | origin ext=`bbb1000...99a5f` | 审批/fast-forward 基线 | `git ls-remote origin`，2026-07-17 |

## 结果

从精确远端 `bbb1000` 建立隔离 repair 分支，按原顺序无冲突移植 P5.1
blocker、default 同类证据、事故记录与 `8ae79eb` 修复。两条指定负例在旧实现
均实证误判相等，在 repair 分支 adoption 文件 20/20、相邻代表集 55/55。

全量 7 项失败与 P5.1 修复头既有基线逐项相同：commit-closeout 1、lawyer RAG 4、
persona roster 1、tianjian verdict 1；没有 normalization/adoption 新失败。

## 未验证项

- PostgreSQL 未验证；生产 strict 边界延续，本包只认证 SQLite adoption。
- 未连接、迁移、备份真实数据库；未启动、停止或重启服务。
- reviewer 已登记但本包不扩张处理：`datetime('NOW')` fail-closed 漏归一、外层括号
  剥离、既有 current_timestamp 字面量碰撞、纯函数测试单向锁。
- D6 “最新裁决且无悬挂 NO_GO”终检已采纳为下一独立 gate 变更，不与紧急代码修复混包。

## Diff 与回滚复核

- changed files：既有 P5.1 blocker/incident/change docs、`schema_adoption.py`、两条回归、
  新 repair change record；无 P6 文件。
- diff review：从 `bbb1000` 只加入已审字面量修复、精确 `FALLBACK` 常量与证据，
  不改变业务终态、运行服务或真实数据。
- 回滚是否演练：无数据迁移；push 前丢弃候选即可，push 后只能新增 revert，禁止
  改写共享历史。

## 完成定义映射

| DoD | 证据 | 状态 |
| --- | --- | --- |
| CHECK/default 字面量大小写不折叠 | 旧两项 equal=True；新两条负例 GREEN | 完成 |
| adoption 与历史迁移无新增回归 | 20 passed；代表集 55 passed | 完成 |
| 全量不新增红灯 | 2727 passed / 7 个既有失败 | 完成 |
| 静态与护栏 | Ruff/compile/双 doctor 全绿 | 完成 |
| 独立精确 B/H review | 待 Claude 对 repair-H 复审 | 待完成 |

## 声明状态

- `READY_FOR_CLAUDE_REVIEW`：实现与本地验证完成，尚未获得 repair-H 独立 GO。
