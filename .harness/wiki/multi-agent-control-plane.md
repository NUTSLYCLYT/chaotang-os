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

## S9 恢复边界

- 控制面数据库升级到 schema v8，加入单次 break-glass 使用记录，并对身份字段及全局 audit 启用不可更新/删除触发器。
- 数据库无法打开、完整性损坏、真实 `SQLITE_FULL` 或只读写失败时保持 fail closed，并在 owner-only 恢复目录保留原始或操作前快照；不会自动删除或重建权威库。
- Emergency Maintainer 必须提交最长 30 分钟、绑定完整 commit SHA、release ID、operator、reason、evidence 和精确 resource operation 的 Ed25519 票据；两个不同信任域的审批人都必须签名。执行固定使用 `/usr/bin/corepack pnpm gate:prod-release`，任何失败或 `SKIP` 都不执行紧急操作。
- 票据在操作前必须由控制面外的原子 replay authority `claim`，操作后先写外部 `complete` 再写本地 terminal；本地数据库回滚或终态落盘失败都不能让同一票据再次使用。
- 仓库内的 `.harness/trust/break-glass-trust.json` 是 `EXTERNAL_REQUIRED` 占位配置，因此当前生产 break-glass 有意 fail closed。只有管理员经过审查固定两把独立公钥及外部 replay adapter 后才可进入 S10 rollout。
