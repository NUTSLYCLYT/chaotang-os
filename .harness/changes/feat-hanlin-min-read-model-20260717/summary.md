# 变更摘要：feat-hanlin-min-read-model-20260717

| 字段 | 值 |
| --- | --- |
| Change ID | feat-hanlin-min-read-model-20260717 |
| 类型 | feat |
| 状态 | IMPLEMENTED_CANDIDATE / EXTERNAL_REVIEW_PENDING |
| Owner | Project Agent |
| 创建日期 | 20260717 |

## 范围

- 主线：跨线 P9 翰林最小读模型（后端真源/API 权限 + 前端诚实只读投影）
- 文件：`backend/web/routers/hanlin.py`、Hanlin 后端测试、前端 Hanlin types/pages/tests、本 change 证据
- 验证：后端正常/空态/权限测试，前端 node/type，三层 doctor，internal browser smoke

## 边界

- 基点：`origin/feature-chaotang-ext` = `37542c3`（P7 GO+merged）。
- P8 尚未完成；P9 候选在 P8 合入前不进入 ext。
- 当前主工作区的用户脏文件不在本 worktree，也不属于本 change。

## 候选结果

- 第一条真实线：`truth_ledger -> /api/hanlin/{overview,experiments} -> Hanlin UI` 已端到端闭合。
- Hanlin API 全部由后端 admin 门保护，所有现有前端消费者已迁移认证 transport。
- mock、默认静态示例与实验伪写动作已从 P9 生产路径退役。
- 本状态不是 P9 GO；尚未合入或推送 ext。
