# 任务：fix-alembic-single-authority-20260717

## 任务 1：RED 与事实契约

- 目标：用测试复现未登记库误启动、盲接管、worker 异常二次崩溃。
- 前置条件：真实事故证据和 P5 v2 清单已确认。
- 输入：现有迁移链、真实库只读 schema、outbox worker。
- 输出：失败的定向测试；不得修改真实库。
- 涉及文件：`backend/tests/test_schema_authority.py`、`test_unversioned_database_adoption.py`、`test_outbox_worker.py`。
- 状态 / 数据变化：仅临时数据库。
- 验证命令与证据：对应 pytest 必须先 RED，错误与目标一致。
- 回滚边界：删除新增测试即可；真实运行态不变。
- 完成定义：三个事故不变量均有可读、确定性的失败测试。
- 状态：完成。schema authority、未登记接管、worker 二次失败均先 RED 后 GREEN。

## 任务 2：Alembic 单一权威与旧库接管

- 目标：strict 启动门、tenant 表正式迁移、未登记兼容旧库显式接管。
- 前置条件：任务 1 RED。
- 输入：Alembic 001–013、ORM metadata、legacy schema contract。
- 输出：schema authority 模块、014 migration、接管 CLI；生产 runtime DDL 清零。
- 涉及文件：`backend/alembic/`、`backend/src/schema_authority.py`、`backend/scripts/`、现有主库 DDL 调用点。
- 状态 / 数据变化：仅测试/副本数据库。
- 验证命令与证据：定向 GREEN；空库、旧库、未登记库到 head。
- 回滚边界：真实库未改前可整体回退代码；迁移脚本必须可 downgrade。
- 完成定义：三起点到唯一 head，非法形状零写入。
- 状态：完成。空库、011 fixture、真实 010 形状副本均到 014；不兼容库文件字节不变。

## 任务 3：worker 失败收口

- 目标：主异常、错误记录异常和旧对象属性缺失均留下 failed/dead_letter 证据。
- 前置条件：任务 1 worker RED。
- 输入：`process_event`、timeline writer、tenant lineage。
- 输出：最小、无递归失败的 outbox failure finalizer。
- 涉及文件：`backend/src/execution/outbox_worker.py`、定向测试。
- 状态 / 数据变化：失败 attempt 原子递增，记录 `last_error`。
- 验证命令与证据：worker 全套及卡死回收测试。
- 回滚边界：不改变成功执行语义；失败路径可独立回退。
- 完成定义：异常不逃逸，事件不再停在 processing/attempts=0。
- 状态：完成。主异常、timeline 异常、stale reaper timeline 异常均提交最小失败事实；
  poller 不回收本进程已 claim 的长任务。

## 任务 4：真实恢复与三案验真

- 目标：让真实服务与当前代码/head 对齐并证明下旨闭环。
- 前置条件：任务 2/3 GREEN，副本演练通过，备份/hash 完成。
- 输入：`backend/var/data/fengqun.db`、systemd `chaotang-api.service`、卡单 ID。
- 输出：迁移后 head、新 PID、卡单审计恢复、三案 trace。
- 涉及文件：真实 SQLite 运行态（不进 Git）、systemd 运行态、CI 证据文档。
- 状态 / 数据变化：主库 schema 升级；服务受控重启；测试案件新增。
- 验证命令与证据：schema/current、health、journal、status API、三案结果。
- 回滚边界：失败即停服并恢复一致备份；不带病继续接单。
- 完成定义：代码/DB/进程同版，三案闭环符合预期。
- 状态：完成。真实库备份/迁移/重启完成；旧卡单补证阻断、低风险 direct 完成、高风险
  未确认不生成 outbox，三条证据链均已落库。
