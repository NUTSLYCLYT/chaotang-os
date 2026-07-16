# 任务：fix-p4-5-semantic-freeze-20260716

## P4.5a — EmperorDecision.kind（VERIFIED）

- 目标：冻结 `edict_confirm / compat_dispatch / final_verdict` 三类语义。
- 前置条件：现有 10 个 action 与 6 个生产写入口盘点完成。
- 输出：单一映射函数、非 NULL 模型列与 check、迁移 012。
- 状态 / 数据变化：历史已知 action 确定性回填；未知值阻断升级。
- 验证命令与证据：见 `ci_result/ci_summary.md`。
- 回滚边界：代码可原子 revert；迁移降级会删除 kind，需先导出核验。
- 完成定义：契约、API 回归、旧库/空库迁移和真实库指纹全部通过。

## P4.5b — execution_state（PENDING）

- 穷举真实事件/工件词表；建立 first-match-wins 全函数判定表。
- attempt 优先、同 attempt sequence 次序；未知组合 quarantine。
- 保留既有 status 枚举，覆盖六条真实路径 fixture。

## P4.5c — 质量门 import seam（PENDING）

- 只移动调用边界，不改变门禁逻辑；守门禁止生产者模块直接判门。

## P4.5d — CourtReview 写入基线（PENDING）

- 以实施时 AST multiset 固化路径/函数/数量；已纠正当前初始基线为 8。

## P4.5e — DepartmentOpinionV1（PENDING）

- 从现有 sections 完整投影 department opinions，保留 signal/source_label。

## P4.5f — tenant lineage + 013（PENDING）

- 8 张核心表增加 nullable tenant_id；从真实上下文传播，未知留 NULL/quarantine。
- 禁止 default-tenant 掩盖，不宣称租户隔离完成。

## 收口（PENDING）

- 全量相关验证、两层 doctor、独立审查；GO 后方可合入 ext/进入 P5。
