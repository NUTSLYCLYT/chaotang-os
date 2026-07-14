# 任务：fix-compat-decision-task-adapters-20260714

## 任务 1：正式事实适配

- 输入：三个兼容业务入口的 command、当前用户和既有 task ID。
- 输出：待确认 `DecisionTask`、关联的 execution run、兼容响应。
- 完成定义：行为测试从 3 RED 转为 3 GREEN，旧契约回归通过。

## 任务 2：治理与验证

- 更新能力入口清单的替换证据，但保留 `MIGRATE_REQUIRED`。
- 运行主链、权限、唯一写入、registry、能力治理和 Harness Doctor。
- 回滚边界：单提交 revert；不触碰数据库 schema 和无关工作区文件。
