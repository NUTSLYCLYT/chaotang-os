# chaotang-os

仓库正在重建，前后端尚无业务代码或已确定技术栈。

## 导航

- 已确认边界：`ARCHITECTURE.md`
- Agentic 工作流：`docs/agentic-engineering.md`
- Codex/Claude Code 客户端兼容：`docs/tooling-compatibility.md`
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

## 当前验证

- `node scripts/check_harness.mjs`
- `node scripts/check_harness.mjs --self-test`
- `node .agents/hooks/check-harness.mjs --self-test`

前后端命令尚未定义。首次技术选型必须在同一变更中补充真实的 setup、lint、test、
build/run 命令和对应 CI，禁止复制不存在的命令。
