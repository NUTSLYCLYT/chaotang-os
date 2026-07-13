# 任务：feat-final-memorial-quality-gate-20260714

## 任务 1：门禁契约（RED）

- 状态：完成。
- 目标：冻结唯一落库、来源阻断、质量阻断与裁决防绕过。
- 输入：task/review/swarm run/quality result/source label/candidate memorial。
- 输出：失败测试证据。
- 回滚边界：仅删除新增测试与本变更记录，不动运行数据。

## 任务 2：正式奏折事实源（GREEN）

- 状态：完成。
- 目标：新增 `FinalMemorial`、迁移与正式化服务。
- 回滚边界：代码可回退，新增表可保留为空。

## 任务 3：主链与裁决接入

- 状态：完成。
- 目标：worker 生成/阻断正式奏折，裁决入口只读取正式事实源，事件账本记录结果。
- 回滚边界：接入点可逐处回退，不修改旧候选奏折结构。

## 任务 4：verification-loop

- 状态：完成；专项和目标回归通过，全量观察与未验证项已记录。
- 目标：专项、目标回归、全量观察、编译、lint、doctor、diff/security review。
