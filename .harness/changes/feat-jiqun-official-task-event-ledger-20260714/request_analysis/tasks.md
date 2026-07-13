# 任务：feat-jiqun-official-task-event-ledger-20260714

## 任务 1：事件账本契约（RED）

- 状态：完成。

- 目标：用失败测试冻结结构化信封、幂等与旧表自愈。
- 前置条件：使用隔离 SQLite，不接触 `backend/data/fengqun.db`。
- 输入：task/stage/actor/message/event_type/trace/source/payload/idempotency。
- 输出：按 sequence 可重放的事件行和状态 timeline。
- 涉及文件：`backend/tests/test_decree_event_ledger.py`。
- 状态 / 数据变化：仅测试临时库。
- 验证命令与证据：目标测试首次必须失败且原因是能力尚不存在。
- 回滚边界：删除新增测试即可，不动生产数据。
- 完成定义：RED 证据记录。

## 任务 2：最小实现（GREEN）

- 状态：完成。

- 目标：扩展既有事件表、记录函数和状态契约。
- 涉及文件：`backend/src/db/models.py`、`backend/src/db/flow_store.py`、`backend/src/chancellor/contracts.py`、`backend/src/chancellor/decree_status.py`、`backend/alembic/versions/009_decree_event_ledger.py`。
- 验证命令与证据：目标测试 exit 0。
- 回滚边界：代码可回滚，数据库新增列保留兼容。
- 完成定义：GREEN 且旧调用测试不回退。

## 任务 3：正式主链接入与验证

- 状态：部分验证完成；专项与目标回归通过，完整套件存在 14 个范围外失败，Alembic CLI 在当前 Python 环境不可用。

- 目标：路由确认、派单开始、分奏完成/质门结果写结构化事件。
- 涉及文件：`backend/web/routers/shangshufang.py`、`backend/src/execution/outbox_worker.py` 及专项测试。
- 验证命令与证据：目标回归 + doctor + diff/security review。
- 回滚边界：新参数均有兼容默认，逐调用点可单独回滚。
- 完成定义：verification report 为 READY 或明确剩余阻塞。
