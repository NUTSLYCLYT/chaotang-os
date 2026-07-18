# 融合稿输入快照清单

本目录固化 `docs-product-definition-convergence-20260718` 实际比较的输入，避免未跟踪文件或后续编辑改变评审依据。读取日期为 2026-07-18（Asia/Shanghai）。

| 输入 | 原始位置 | 本 change 固化文件 | 完整 SHA-256 | 使用口径 |
| --- | --- | --- | --- | --- |
| A：超级任务交付蓝图 | `/home/ubuntu/Projects/.fullcourt-worktrees/docs-super-task-delivery-design-20260718/docs/plans/chaotang-os-super-task-delivery-blueprint-2026-07-18.md` | `chaotang-os-super-task-delivery-blueprint-2026-07-18.md` | `51374f5daf1a66fb0777abd34ada6c72e5b9ea8388e12386ee96228803d5a5b3` | 本次比较的原始全文；工作副本后来只增加了文档关系与权威路线声明 |
| B：全域服务质量架构 | `/home/ubuntu/Projects/chaotang-os/docs/plans/chaotang-os-life-agent-service-quality-architecture-2026-07-18.md` | `chaotang-os-life-agent-service-quality-architecture-2026-07-18.md` | `715a8126ee04de7371f64ed39c39d27a36e3047c28acd99fcf1a472aa41d0813` | 最终重新全文读取并用于融合/终审的版本；主工作区保持只读 |

审计说明：B 在本任务首次读取时的 SHA-256 为 `ad80fb6f6065f0ee2bee29cd8228ca855cbe67067af11ddbbda0545370bd12e6`，随后被其他协作者扩充。融合稿终审前已重新读取当前全文，并以表中 `715a…0813` 快照为准；早期短哈希不再作为引用依据。

复核命令：

```bash
sha256sum .harness/changes/docs-product-definition-convergence-20260718/source_inputs/*.md
```

这些快照只是审计输入，不是新的产品或架构事实源，不进入运行时，也不与原文双向同步。
