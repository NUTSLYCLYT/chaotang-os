# 任务拆解

## 任务 1

- 目标：修复 merge commit 的继承内容误报，同时保持新泄露阻断。
- 输入：被 pre-commit 拦截的全量 ext 合并与命中清单。
- 输出：merge-aware 守卫、两条真实 Git 集成测试、审计记录。
- 验收：RED 1/2 后 GREEN 2/2，手工守卫和根 Doctor 通过。
- 依赖：Git `MERGE_HEAD` 与 staged index。
