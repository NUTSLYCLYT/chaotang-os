# 后端 Harness 共享约定

`_shared/` 存放跨 harness 复用的契约、门禁语义和观测字段。这里先固定文档与 schema，不强行抽运行时代码，避免影响已有 harness 行为。

## 目录

- `contracts/base.schema.json`：所有 harness 记录应兼容的公共字段。
- `gates/README.md`：门禁状态、不可逆动作和人工签字约定。
- `observability/README.md`：事件、报告和归档字段约定。

新增 harness 时，先复用这些语义，再决定是否需要自己的专用 schema。
