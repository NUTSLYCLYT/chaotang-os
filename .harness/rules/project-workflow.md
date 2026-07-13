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

## 候选提交租约证明

- 每个候选提交必须在租约仍有效且 holder 身份仍存活时生成 unsigned request，绑定 Task、Lease、fencing epoch、credential commitment、进程身份、repository identity、worktree、parent、tree、commit、规范化 diff paths 与 lease audit checkpoint。
- 独立 Ed25519 signer 进程是唯一签发方；私钥只能从仓库外 secret path 读取，worker 不得读取私钥或签发证明。integrator 只信配置的外部公钥和签名 checkpoint。
- pre-commit hook 只运行快速反馈，可以被 `--no-verify` 绕过，因此不构成安全边界。
- integration/CI 必须运行 `node scripts/integration-lease-gate.mjs --candidate <exact-40-char-sha>`，从 Git object 重算 parent/tree/name-status-z diff，并验证 Ed25519 签名、checkpoint 和 lease epoch。缺失、篡改、越权或已撤销证明一律 STOP。Gitee required check 未由仓库代码自动配置时，状态只能是 `IMPLEMENTED_LOCAL`。

## 根级 Change 记录

根级变更使用 `.harness/templates/change-template/`，至少包含：

- `summary.md`
- `request_analysis/spec.md`
- `request_analysis/tasks.md`
- `ci_result/ci_summary.md`

如果变更主要归前端所有，则使用前端更完整的 11 阶段记录。
