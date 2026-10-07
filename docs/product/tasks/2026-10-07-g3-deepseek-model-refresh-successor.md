# G3 DeepSeek 模型目录刷新与真实调用验收（继任批准）（2026-10-07）

> 所有任务必须阅读并遵循 `docs/decisions/0028-decree-evidence-flow-governance-baseline.md`；本任务不改变该基线。

## Status

Ready

## Product Definition

- 用户确认：用户已授权继续 G3 真实执行与封闭试用准备，并允许使用已有 DeepSeek 凭据进行受限真实调用；本任务仅使用已配置的本地环境变量，不保存或上传密钥。
- 问题：DeepSeek provider 当前配置的 `deepseek-v4-flash` 已被真实 provider 拒绝；可用模型目录已变为 `deepseek-flash` 与 `deepseek-v4-pro`，导致生产执行链无法可靠启动。
- 目标用户：使用朝堂上书房、军机处和六部真实执行流程的封闭试用用户。
- 目标：在保持现有 `openai/` 配置前缀契约、预算、失败分类和权限边界不变的前提下，刷新默认模型目录，并用一次不超过 20,000 tokens 的真实只读 DeepSeek 调用验证生产客户端可用性。
- 非目标：不扩展模型供应商，不改任务/权限/结果契约，不新增网关、API、UI 或部署能力。

## Acceptance Criteria

- [ ] `backend/config/providers.yaml` 的默认模型为 `openai/deepseek-flash`，可选目录至少包含 `openai/deepseek-flash` 与 `openai/deepseek-v4-pro`，并继续通过现有配置验证。
- [ ] 现有 DeepSeek 名称规范化仍输出 provider 需要的裸模型名；缺少 `openai/` 前缀仍 fail closed。
- [ ] 已配置的真实 DeepSeek 客户端以不超过 20,000 tokens 的预算完成一次只读探针或返回可分类的真实失败；证据记录模型、时间、额度、是否联网和是否产生产品写入，不记录密钥或完整私密提示词。
- [ ] 上述变更不改后端 API、数据库、任务系统、权限系统和前端 UI；失败时可回退到批准父提交。

## Delivery Constraints

- 范围：仅允许修改 provider 配置、对应配置测试和本任务证据文档。
- 兼容性：保留配置中的 `openai/` 前缀与 `normalize_deepseek_model_name()` 契约；保留现有 token budget、重试和错误分类。
- 风险与限制：真实调用使用现有 `DEEPSEEK_API_KEY` 环境变量；不得在仓库、PR、桌面归档或日志中写入密钥。LiteLLM 网关当前未证明在线，因此本任务的真实运行验收明确记录为开发环境豁免，不扩展到公开部署。
- 技能计划：systematic-debugging（已发现 provider 目录漂移）；verification-before-completion（候选交付前证据验收）。
- Codex-only：是；禁止 Claude CLI、Claude runner 与 gstack-claude。
- dev-mode: exempt；理由：本任务只修正朝堂产品运行时已存在的 DeepSeek 直连配置，并执行一次用户已授权的、只读、预算封顶的 provider 接受性探针；不把该调用当作工部开发执行器的网关绕过或生产部署。

## Affected Modules

- 模块：DeepSeek provider 配置与配置回归测试。
- 允许路径：`backend/config/providers.yaml`、`backend/tests/test_deepseek_config.py`、`docs/product/tasks/2026-10-07-g3-deepseek-model-refresh.md`、`docs/evidence/g3-deepseek-model-refresh-20261007.json`。
- 依赖模块：`backend/app/langgraph_runtime/deepseek_config.py`、`backend/app/langgraph_runtime/deepseek_client.py`（只读，不改动）。

## Technical Plan

1. 先冻结当前 HEAD/tree 与本任务 M0 approval manifest。
2. 将配置默认模型和候选目录更新为 provider 实测可用名称，保留 `openai/` 前缀。
3. 更新配置测试的精确断言，先跑 RED，再做最小 GREEN。
4. 运行 focused 配置/客户端/图构造测试、根 Harness 和 diff 检查。
5. 使用已有授权的 DeepSeek key 进行一次真实、只读、`max_tokens <= 64` 的生产客户端调用；记录安全的摘要证据。
6. 通过候选矩阵后，产品子提交可回退到批准父提交 `18ae2406b31c42fd3f7cf13253139b5cdb0bebb3`。

## Verification Plan

- `backend` 配置、客户端和图构造测试。
- 根 `check_harness` 与 `git diff --check`。
- 候选矩阵使用跨平台 Node 结构检查；完整 pytest 仍单独运行并写入证据，避免把 Windows 上不存在的 `/usr/bin/python3` 误报为产品失败。
- 真实 provider 接受性探针：最多一次请求、最多 64 输出 tokens、总任务预算不超过 20,000 tokens；只发送最小非敏感提示词。
- 失败验证：记录真实 HTTP/网络/预算分类，不把失败写成成功。

## Implementation Report

- 改动摘要：待施工。
- 自审：待施工。
- 验证：待施工。
- 实际使用的 skill：待施工。
- 验证命令与结果：待施工。
- 未运行项与原因：待施工。
- 剩余风险：待施工。

## Acceptance Review

- 验收结果：Pending
- 验收证据：待翰林院逐条核对。
- 未通过项：待填写。

