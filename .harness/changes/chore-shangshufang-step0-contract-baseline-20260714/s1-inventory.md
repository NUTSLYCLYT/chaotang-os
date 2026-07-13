# S1 真源收敛清单

状态：基线已取证；路径修复与候选 PR 未实施。

## 1. 唯一真源与运行实例

- 唯一代码真源：`/home/ubuntu/Projects/chaotang-os`，Gitee remote `git@gitee.com:msxn/chaotang-os.git`。
- 当前开发 worktree：`feature-chaotang-ext@aa600fe`，脏树，必须保留用户改动。
- 既有 release worktree：`/home/ubuntu/Projects/chaotang-os-release@5aaae0c`。
- 3050 foreign cwd：`/home/ubuntu/workspace/frontend/chaotang-master-wt`。
- 8081 cwd：当前 monorepo `backend/`。

## 2. 需要在独立 S1 worktree 收敛的可执行引用

### 发布与 service（P0）

- `frontend/docker-compose.yml`：`build: ../jiqun_ai_fresh`。
- `frontend/deploy/services/courtos-web.service.template`：旧前端 WorkingDirectory/EnvironmentFile。
- `frontend/deploy/services/jiqun.service.template`：旧后端 WorkingDirectory/PATH/EnvironmentFile/ExecStart。
- `backend/scripts/jiqun_ai.service`：旧 `/home/ubuntu/workspace/jiqun_ai`。
- `frontend/scripts/prod-release-gate.mjs`、`next-with-base-path.mjs`：跨仓 `.env` 搜索路径。

### cron、监控与恢复（P1）

- `frontend/scripts/cron-verify-study-edict.sh`
- `frontend/scripts/cron-chaotang-real-swarm-gate.sh`
- `frontend/scripts/self-healing-monitor.sh`
- `frontend/scripts/health-monitor.mjs`
- `frontend/scripts/daily-metrics.mjs`
- `frontend/scripts/system-restore.sh`
- `backend/scripts/cron-evidence-deficit-daily.sh`
- `backend/scripts/backend_upgrade_watch.sh`

### 工具/命名（P2，需先判定是否仍在使用）

- `backend/scripts/wf_pack_rd_cost_split.js`
- `frontend/scripts/jiqun-contract-smoke.mjs` 的提示文本
- `frontend/scripts/package-release.mjs` 的旧 appName
- `frontend/deploy/env.example` 的旧标题

历史 handoff、brain wiki、测试注释和旧 reference artifact 不机械改写；它们不是当前执行入口，若保留必须标历史来源。

## 3. READY_FOR_REVIEW 验收队列

| Change | 初始分流 | 原因 |
| --- | --- | --- |
| `fix-production-runtime-identity-20260713` | S1/S3 独立验收 | 与 immutable identity 直接相关 |
| `fix-release-harness-launch-routes-20260713` | S1 独立验收 | 发布入口真源 |
| `fix-release-harness-real-session-20260713` | S1/S3 独立验收 | 真实 session 证据 |
| `fix-release-harness-retired-route-20260713` | S1 独立验收 | 退役路径 |
| `fix-release-harness-true-chain-default-20260713` | S1/S3 独立验收 | 默认发布门 |
| `fix-true-chain-health-real-evidence-20260713` | S1/S3 独立验收 | 健康证据真实性 |
| `fix-launch-link-canonicalization-20260713` | S1 独立验收 | canonical link |
| `fix-shangshufang-im-canonical-path-20260713` | S4/S6 延后验收 | 业务契约路径，不阻塞 S1 真源 |
| `fix-shiguan-honest-empty-drawer-20260713` | S6 延后验收 | 业务体验，不阻塞 S1 |
| `fix-mobile-decree-input-overflow-20260713` | S6 延后验收 | UI 修复，不阻塞 S1 |
| `backend/harness/changes/s3-lease-attestation-gate-20260713` | S10.0 延后验收 | 外部 authority 尚未配置 |

“初始分流”不是验收结论。每项后续仍必须检查 diff、测试、依赖和是否已被新实现替代，才能标记合入、退回或废弃。

## 4. S1 安全执行顺序与 S3 移交

1. 在独立 S1 worktree 从经用户确认的基线 SHA 建分支。
2. 先给路径/配置写失败测试或 static gate，再逐项改为 monorepo/manifest 解析。
3. S1 只把 foreign 3050 标 STOP，并冻结旧仓为只读；不构建 artifact、不接管端口。
4. S3 构建 immutable frontend artifact 并验证身份。
5. 只有 S3 替代 artifact 可启动且回滚目标明确，才由 foreign 3050 的原服务管理器停机。
6. 不删除旧仓；至少只读冻结一个发布周期，再决定归档。
