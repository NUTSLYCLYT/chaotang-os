# 多 Agent Harness 控制面

本控制面为同一 Git 仓库内的并发 Agent 提供任务、租约、资源锁、构建与发布证据的唯一协调层。详细建设顺序以 `docs/multi-agent-harness-control-plane-blueprint-2026-07-13.md` 为准。

## 状态语义

- `DESIGNED`：仅存在设计，不可作为门禁。
- `IMPLEMENTED`：代码和契约已落地并通过局部测试，但尚未取得 rollout 证据。
- `ROLLOUT`：在 shadow/soft/mandatory 阶段收集真实发布证据。
- `ENFORCED`：只有 mandatory 连续 20 次真实发布全部通过后才能声明。

## 事实源

- 契约：`.harness/contracts/`。
- 初始基线：`.harness/baselines/multi-agent-control-plane-20260713.json`；`null` 表示历史无可靠遥测，不等于零。
- 运行数据库：后续步骤固定在 `git rev-parse --git-common-dir` 所指目录下的 `chaotang-harness/control-plane.sqlite3`。
- 端口：`3002`/`3050` 为共享受保护端口；`3100–3199` 为 worktree 动态隔离池，均必须持有资源租约。
- 根级登记：`.harness/manifest/project-harness.json`。

## S0 验证

```bash
node --test scripts/multi-agent-contracts.nodetest.mjs
node scripts/harness-doctor.mjs
```

本页不授予生产发布权限。租约、资源锁、发布指挥权和外部信任锚在相应步骤完成前均保持未强制状态。
