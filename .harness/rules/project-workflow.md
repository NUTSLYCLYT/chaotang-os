# 规则：全项目 Harness 工作流

每个跨线或根级 harness 变更，都应该在 `.harness/changes/{change-id}/` 留下记录。

## 阶段

1. 判断哪条线拥有事实源：根项目、前端、后端或文档。
2. 阅读对应主线入口：
   - 根项目：`AGENTS.md`
   - 前端：`frontend/AGENTS.md`
   - 后端：`backend/AGENTS.md`
3. 修改最小且负责的 harness 层。
4. 当变更影响跨项目规则、清单或验证方式时，记录到根 `.harness/changes/`。
5. 运行最小充分验证：
   - 根项目：`node scripts/harness-doctor.mjs`
   - 前端：`cd frontend && pnpm harness:doctor`
   - 后端：对应 README 中列出的 pytest 或 harness runner。

## 根级 Change 记录

根级变更使用 `.harness/templates/change-template/`，至少包含：

- `summary.md`
- `request_analysis/spec.md`
- `request_analysis/tasks.md`
- `ci_result/ci_summary.md`

如果变更主要归前端所有，则使用前端更完整的 11 阶段记录。
