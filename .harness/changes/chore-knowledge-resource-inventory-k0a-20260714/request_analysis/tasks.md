# 任务：chore-knowledge-resource-inventory-k0a-20260714

## 任务 1：K0A 可复跑只读知识资源清单

- 目标：冻结历史知识资源的脱敏计数、snapshot token、元数据完整度和 accepted/quarantine/rejected 数量。
- 前置条件：只实施 K0A；不停止旧服务，不封禁 watcher，不写 Vault/brain.db/Qdrant，不进入 K0B/K0C/K1。
- 输入：`/home/ubuntu/CourtOS-Brain`、仓内 `courtos-brain/`、旧 brain.db/Qdrant、`skills/personas/`、`backend/knowledge/docs/`、当前 sqlite-vec DB 路径。
- 输出：`artifacts/knowledge-resource-inventory.json`；不含正文、源路径、payload value 或 point id。
- 涉及文件：inventory CLI、聚焦测试、本 change、蓝图状态。
- 状态 / 数据变化：只写仓内脱敏 artifact 和临时 Qdrant 副本；外部源零写。当前 RAG DB 不存在，作为可冻结 `ABSENT` 记录。
- 验证命令与证据：见 `../ci_result/ci_summary.md`。
- 回滚边界：删除 CLI、测试、artifact 和本 change；外部资产无需恢复。
- 完成定义：7 个来源均得到 STABLE/ABSENT snapshot；连续复跑 hash 一致；0 accepted / 16,234 quarantined；源写 syscall=0；脱敏门、测试和 doctors 通过。
