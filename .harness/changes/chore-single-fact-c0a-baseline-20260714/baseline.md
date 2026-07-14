# C0A clean base

## Repository identity

| 字段 | 值 |
| --- | --- |
| Repository | `/home/ubuntu/Projects/chaotang-os-c0a` |
| Branch | `chore/single-fact-c0a-20260714` |
| Parent SHA | `417a90eea010598b36bffc46eed01d62e0a9f049` |
| Parent tree | `046073709b3114a70d8fdcbb44d771de51853a1d` |
| Source branch at fork | `feature-chaotang-ext` |
| Worktree at fork | clean |

`feature-chaotang-ext` 的共享 worktree 在此前调查中持续移动且存在他人未提交文件，因此本 change 没有在该目录写入、reset、stash 或提交。父 SHA 是本 change 的输入身份；本 change 完成后的候选 SHA 必须在提交后另行记录和验证，不能沿用父 SHA 的测试结论。

## Business inventory baseline

| 状态 | 数量 | 含义 |
| --- | ---: | --- |
| `CANONICAL` | 1 | 唯一正式任务写内核 |
| `MIGRATE_REQUIRED` | 7 | 已知必须适配/停写的并行面 |
| `DISCOVERED` | 4 | 缺调用/副作用证据，阻断 C0D |
| `DELETE_CANDIDATE` | 0 | 无入口满足删除门 |

机器事实源：`.harness/manifest/capability-entry-inventory.json`。

## Evidence boundary

- 本 change 证明“入口已登记并且不会被误删”。
- 本 change 不证明“入口无人调用”“替代能力已上线”“旧链已停写”或“生产已经统一”。
- telemetry 的 `null` 表示未知，不能解释为 0。
