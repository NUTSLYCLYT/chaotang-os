# 后端运行态目录

后端可变状态的唯一默认根目录是 `backend/var/`。可通过
`FENGQUN_RUNTIME_ROOT` 整体改到独立磁盘；`FENGQUN_DB_PATH` 可单独指定
SQLite 文件，`DB_URL` 仍是 SQLAlchemy/Postgres 的最高优先级配置。

```text
var/
  data/             SQLite、租户数据、业务账本
  events/           事件总线日志
  memory/           可写人物快照与记忆数据库
  sessions/         聊天会话
  swarm_sessions/   蜂群编排会话
  traces/           tracing 输出
  direct_cache/     direct 模式缓存
  direct_feedback/  direct 模式反馈
  repairs/          自动修复历史
  drafts/           工具调用草稿
  reports/          运行报告
  cases/            经验案例
  ab_tests/         A/B 评测结果
```

默认租户的 run 日志位于 `var/data/default/runs/`，继续遵守租户数据隔离，
但不再读取根级 `backend/runs/` 作为隐式回退。

版本化人物/部门种子位于 `resources/memory_profiles/`，首次读取人物快照时
只复制到 `var/memory/persons/`，后续写入不会污染 Git 中的种子。追踪样例位于
`tests/fixtures/traces/`，不再和真实 trace 混放。

## 从旧目录迁移

先停止所有 backend、worker 和本地开发进程，保留备份，然后执行：

```bash
cd backend
python scripts/migrate_runtime_layout.py
python scripts/migrate_runtime_layout.py --apply
```

脚本不会合并已存在的目标目录；如果新旧目录同时有内容，会中止并要求人工
核对。数据库启动也不会悄悄回退到 `backend/data/fengqun.db`：旧库存在而新库
不存在时会 fail-fast，避免创建一套看似正常的空系统。

Docker Compose 沿用原有 named volume 名称，仅把容器挂载点改到 `/app/var/*`，
因此升级后不应创建新的空 data/events/swarm volume。
