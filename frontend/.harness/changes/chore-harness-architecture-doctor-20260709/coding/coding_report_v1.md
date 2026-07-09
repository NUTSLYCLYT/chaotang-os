# 编码报告 v1：chore-harness-architecture-doctor-20260709

## 变更文件

- `scripts/harness-doctor.mjs`
- `.harness/changes/chore-remove-bff-layer-20260708/**`
- `.harness/changes/chore-v1-module-taxonomy-20260708/**`
- `.harness/changes/chore-v1-route-prune-20260708/**`
- `.harness/changes/chore-harness-architecture-doctor-20260709/**`
- `.harness/wiki/architecture.md`
- `docs/HARNESS-USAGE-GUIDE.md`

## 关键决策

- 保留当前朝堂定制化 harness，不用参考 scaffold 覆盖替换。
- 修复 doctor，使其适配跨平台 checkout，并使用可读 ASCII 输出。
- 对 delivered change 执行严格规则：阶段文件完整、元数据规范、状态合法、无未解析占位符。
- 将 package scripts、模板骨架、MCP JSON、skill frontmatter 纳入 doctor 契约。
- 记录 frontend `.harness/` 与 后端 `harness/` 的边界，避免工程工作流和运行时评测 harness 漂移到一起。

## 验证

- `node scripts/harness-doctor.mjs`：严格契约检查后通过。

