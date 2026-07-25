# 史馆运行库 schema 恢复设计

## 目标

为本地史馆 SQLite 运行库提供显式、可验证的 v2 到 v3 恢复流程，消除代码已升级而被 Git 忽略的运行库仍停留在旧 schema 时的假绿。

## 边界

- 保持 `get_connection()` 对旧 schema 的 fail-closed 行为；普通请求和服务启动不得静默迁移业务数据。
- 新增 `app.shiguan.maintenance` 模块及 `python -m app.shiguan.maintenance` 运维入口，不新增 HTTP API、依赖或自动迁移。
- `--check` 以 SQLite 只读模式报告数据库是否存在、schema 版本、完整性和必需表是否齐全；输出仅包含路径、版本和布尔/计数状态，不含档案或证据正文。
- `--migrate-v2-to-v3` 仅接受完整的 v2 库；先创建不覆盖的相邻备份，再调用现有事务性 `migrate_v2_to_v3()`，随后再次预检并通过 `storage.list_archives()` 做真实读回。
- 本次授权包含迁移当前 `backend/data/shiguan.sqlite3`，但只在预检确认其为健康 v2 库后执行。

## 接口

`inspect_runtime_database(path)` 返回脱敏的预检结果；不存在、损坏、版本不匹配和必需表缺失均为非就绪状态。

`migrate_runtime_v2_to_v3(path)` 先保存 `<database>.v2-backup`，再完成 v2 到 v3 迁移并读回验证。备份已存在、库不健康或非 v2 时均失败且不改写业务库。

模块命令提供互斥的 `--check` 与 `--migrate-v2-to-v3`，并允许通过 `--database` 显式指定路径；默认仍是史馆的既有运行库路径。

## 验证

测试先覆盖：健康 v2 库的预检、迁移会生成备份并保留档案、非 v2 库与既有备份被拒绝、命令返回机器可读且脱敏的结果。完成后运行聚焦测试、后端 Ruff/pytest、harness 检查；最后对真实运行库做预检、迁移、只读与 HTTP 读回。
