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

## 证据驱动开发协议

跨前端、API、业务逻辑、数据库或 worker 的任务，默认遵守以下顺序：

1. **调查**：先读入口、调用链、契约、持久化与验证设施；区分“已确认事实 / 推测 / 未知问题”，结论必须指向文件或运行证据。
2. **计划**：先写数据流、契约事实源、边界条件和最小纵向闭环；每一步必须写明前置条件、涉及文件、状态变化、验证方法和回滚边界。
3. **确认闸**：调查输出和计划必须先获得用户确认，并在 change 中记录批准范围；未确认时 STOP，不进入实现。
4. **实施**：一次只完成一个可独立验证的最小闭环，使用最小充分文件集；未经用户确认的后续步骤保持未实施。
5. **验证**：按风险选择类型检查、单元/契约/集成测试、真实浏览器、后端日志和数据库证据。后端 dry-run 不证明浏览器体验，前端 mock 不证明后端运行质量。
6. **复核**：检查 diff、失败路径、权限边界、幂等/重试和未验证项；验证失败不得把状态写成完成。

## 执行权威闸

- 调查、计划、change 记录、用户确认与 packet review 都不单独授予产品实施权。
- 进入 M0–M10 或其他产品 runtime 实施前，必须先运行 `node scripts/execution-authority.mjs --check` 验证 v1 失效关闭护栏完整性；`V1_CHECK_INTEGRITY_ONLY_NON_AUTHORIZING`：该检查退出 0 仍不授予产品施工权。
- 随后必须运行 `node scripts/execution-authority-v2.mjs --authorize --work-package <R0-Wxx>`；`V2_SCOPED_AUTHORIZE_SOLE_PRODUCT_DECISION`：它是唯一的范围化产品施工决定。只有 `GO / APPROVED_WORK_PACKAGE` 才能进入所请求的 work package，`STOP` 时只能编制 amendment，不得领取旧 P/PKT/S 队列。
- `execution-authority.v1 --authorize` 不存在 GO 路径，持续返回 `STOP / AMENDMENT_APPROVAL_REQUIRED`；任何非空 v1 amendment、approval evidence 或 effective HEAD 都是无效输入并必须失效关闭。
- 另行明确批准的治理、事故与证据修复只能在批准的精确范围内执行，且不得冒充 M0–M10 完成。

补充规则：

- 契约先行：后端 OpenAPI/Pydantic 是跨语言 API 的默认事实源；前端类型与校验器应由其生成或通过契约测试验证，禁止维护互相漂移的“共享源码”。
- 声明受证据约束：CI 摘要必须记录命令、退出码、结果、证据覆盖范围和未验证项；只允许声明证据实际证明的范围。
- 连续三次修补仍未通过同一验收时，停止继续叠加补丁，回到调查阶段更新根因与未知问题。
- 上下文不足时先留下 checkpoint 或 change 记录，不以清空上下文或高频提交替代证据；提交、推送和外部状态变更仍需遵守用户授权。

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
