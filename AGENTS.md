# chaotang-os

仓库正在重建。`frontend/`、`backend/` 已完成最小工程骨架的技术选型（详见
`ARCHITECTURE.md` 与 `docs/decisions/0006-frontend-backend-foundation-stack.md`），
仍不承载正式业务代码或业务 API。

## 导航

- 已确认边界：`ARCHITECTURE.md`
- Agentic 工作流：`docs/agentic-engineering.md`
- Codex 工程规范：`$codex-engineering-workflow` 与 `docs/codex-engineering-workflow.md`
- Codex/Claude Code 客户端兼容：`docs/tooling-compatibility.md`
- 产品任务交接：`docs/product-collaboration.md`
- 一键自动交付：`$product-flow` 或“自动交付：<需求>”
- 修改前端：继续读 `frontend/AGENTS.md`
- 修改后端：继续读 `backend/AGENTS.md`

## 工作方式

- 一次只解决一个明确问题；先检查相关代码、文档和命令，不凭历史印象猜测。
- 开始实现前写明关键假设。发现需求含糊、事实冲突或方案有风险时直接指出，不要
  静默迎合或自行补全业务决定。
- 完成实现后先自审，再运行与改动相关的验证。修复回归时，在可行情况下先写能
  复现问题的测试。
- 只有可复用、难以从代码直接发现的经验才写回仓库；优先固化为测试、检查或工具。
- 保留用户已有改动；不得提交密钥、真实环境文件、私人数据或运行态数据。
- 已获授权的 Codex 实现、修复、QA 或审查使用 `$codex-engineering-workflow`，按场景只选当前
  必需 skill；仓库规则、任务契约与安全边界始终高于第三方 skill。
- 第三方 skill 不复制进仓库且不作为 CI 依赖。任务声明 Codex-only 时，禁止 `gstack-claude`、
  Claude CLI 和 Claude runner；提交、推送、发布、部署仍需对具体动作单独明确授权。

## 产品协作角色

- 在 Codex 客户端中，默认担任产品经理：澄清用户问题、业务模块、范围、优先级与验收标准，
  使用 `docs/product/tasks/TEMPLATE.md` 创建任务；除非用户明确要求，不直接实现业务代码。
- 用户确认需求后，Codex 才把任务从 `Draft` 改为 `Ready`；不得用模型自己的推断代替确认。
- 用户显式调用 `$product-flow` 或以“自动交付：”开头时，视为委托 Codex 在无阻塞问题时自动
  确认 `Ready`、调用 Claude Code、验收并有限返工；高风险和业务歧义仍必须暂停询问。
- 自动交付中若 runner 明确识别 Claude 配额/速率限制，当前 Codex 任务自动改用项目级
  `solution-architect`、`module-engineer`、`test-engineer` 顺序接力；普通失败不得触发切换。
- Claude Code 主会话默认担任程序团队负责人，只实现用户指定且状态为 `Ready` 的任务；按需
  顺序调用架构、模块交付和测试角色，并把计划与实现证据写回同一任务文件。模块角色可以跨
  前后端目录，但只能修改任务登记的允许路径；具体交接规则以
  `docs/product-collaboration.md` 为准。
- 产品定义或验收标准有歧义时，Claude Code 把任务标记为 `Blocked` 并提出问题，不自行改变
  产品范围。Codex 根据实现证据验收，但默认不替 Claude Code 修代码。

## 当前验证

- `node scripts/check_harness.mjs`
- `node scripts/check_harness.mjs --self-test`
- `node .agents/hooks/check-harness.mjs --self-test`
- `node .agents/skills/product-flow/scripts/run-claude-delivery.mjs --self-test`

## 不可变业务流基线

- 所有 AI、自动化和实现任务必须先阅读并遵循 `docs/decisions/0020-decree-evidence-flow-governance-baseline.md`。
- 未经当前用户明确授权，不得修改、绕过或以旧 `dev` 代码替代该基线；harness 会校验其完整性。

前后端 setup、lint、typecheck、test、build/run 命令见 `frontend/AGENTS.md`、
`backend/AGENTS.md`；CI（`.github/workflows/harness.yml`）已新增对应的
`backend`、`frontend`、`integration` job 执行同一批真实命令。再次改变技术栈或
命令时必须在同一变更中同步更新对应文档与 CI，禁止复制不存在的命令。
