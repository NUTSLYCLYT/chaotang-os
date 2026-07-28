# 任务：修复丞相咨询暂时无法回应

> 所有任务必须阅读并遵循 `docs/decisions/0028-decree-evidence-flow-governance-baseline.md`；若任务与该基线冲突，必须标记为 `Blocked`，不得自行变更流程。

## Status

Blocked

## Product Definition

- 用户确认：用户于 2026-07-28 通过“自动交付：现在和丞相对话时报错：丞相（咨询）暂时无法回应，请稍后再试”委托自动确认，并明确允许保留现有未提交改动、在其上继续。
- 问题：已登录用户在 `/study` 与丞相进行非业务咨询时，合法消息未得到回复，页面显示固定脱敏错误“丞相（咨询）暂时无法回应，请稍后再试”。
- 目标用户：在上书房使用丞相非业务咨询抽屉的已登录用户。
- 目标：定位从同源 BFF 到 FastAPI 咨询图和 DeepSeek 调用之间的真实失败边界，以最小修复恢复合法咨询，并留下能捕获根因的自动化回归证据。
- 非目标：不修改 ADR 0028；不把咨询接入下旨、六部、军机处、锦衣卫、史馆或案卷；不持久化咨询历史；不新增模型供应商、重试、静态回答或模拟成功兜底。

## Acceptance Criteria

- [ ] 已明确区分并定位浏览器/BFF、后端认证、请求校验、配置构造与模型调用边界中的实际失败点，诊断证据不包含密钥、提示词、会话内容或私人数据。
- [ ] 针对根因新增的最小自动化回归测试在修复前以预期原因失败，并在修复后通过。
- [ ] 合法、严格交替且以用户消息结束的咨询请求继续恰好调用一次自由文本模型，并返回非空 `consultant/reply`；不得启用下旨专用 JSON Output。
- [ ] 既有 401/400/422/502/503 脱敏错误分类、失败消息不进入历史、刷新清空历史和独立咨询边界保持不变。
- [ ] 咨询相关前后端测试、完整后端测试、前端 lint/typecheck/test/build、`node scripts/check_harness.mjs` 与 `git diff --check` 通过。

## Delivery Constraints

- 范围：优先限于 `backend/app/agents/chancellor_consult/`、`backend/app/api/chancellor_consult.py`、`backend/app/langgraph_runtime/`、直接相关后端测试、`frontend/src/app/api/chat/chancellor-consult/`、`frontend/src/app/study/chancellorConsult*`、直接相关前端测试、本任务文件及一条故障记忆；只有证据证明失败跨越其它边界时才扩大允许路径。
- 兼容性：保持 ADR 0030 的端点、认证、严格消息契约、单次自由文本模型调用、脱敏错误与纯内存历史不变；保留当前工作区所有既有改动。
- 风险与限制：不得读取、打印或提交真实 dotenv、API Key、会话令牌、提示词或咨询正文；不得用真实模型 smoke 替代离线测试；任何真实 DeepSeek 调用都必须先由当前用户明确授权；未经额外授权不提交、推送、发布或部署。
- 技能计划：`using-superpowers`、`product-flow`、`systematic-debugging`、`test-driven-development`、`record-failure`、`codex-engineering-workflow`、`verification-before-completion`。
- Codex-only：否。

## Affected Modules

- 模块：丞相非业务咨询端到端链路。
- 允许路径：`backend/app/langgraph_runtime/deepseek_client.py`、`backend/app/agents/chancellor/graph.py`、`backend/tests/test_deepseek_client.py`、`backend/tests/test_deepseek_graph.py`、`backend/tests/test_chancellor_graph.py`、`backend/tests/test_chancellor_consult_graph.py`（均为必须保留并兼容的在途修订及其回归证据）；本任务文件；`docs/failures/2026-07-28-chancellor-consult-stale-backend.md`。
- 依赖模块：账户会话、Next.js BFF、FastAPI 咨询 API、独立咨询图、DeepSeek 运行时。

## Technical Plan

- 架构边界：咨询继续通过独立 BFF、FastAPI 咨询 API 与自由文本 DeepSeek 图运行；下旨图单独显式启用 JSON Output。根因是无 reload 的 FastAPI 开发进程早于 15:02 源码修订启动，仍执行修订前曾全局启用 JSON Output 的内存代码，而不是 ADR 0030 当前源码契约错误。
- 接口与依赖：保持 ADR 0030 契约不变；共享 DeepSeek 适配器默认自由文本，仅下旨图显式选择 JSON Output。
- 实施顺序：保留在途修订及其已经建立的默认自由文本/显式 JSON Output 回归测试；停止经 PID 和端口核对的旧后端进程，以相同工作目录、主机和端口重新启动；记录可复发故障；独立验证前后端契约和真实页面恢复。
- 验证计划：运行共享 DeepSeek、咨询图/API 和下旨图的离线回归，再运行完整后端及前端 lint/typecheck/test/build、harness、diff-check；真实模型验证严格限于用户已授权的两次固定诊断文本调用。
- 技术风险：开发服务未使用 `--reload` 时，源码变更不会进入既有 Python 进程；自动化测试验证磁盘源码，不能证明当前常驻进程已加载该版本。当前工作区既有改动必须保留，禁止覆盖或回滚。

## Implementation Report

- 改动摘要：待程序团队填写。
- 自审：待程序团队填写。
- 验证：待程序团队填写。
- 实际使用的 skill：待程序团队填写。
- 验证命令与结果：待程序团队填写。
- 未运行项与原因：待程序团队填写。
- 剩余风险：待程序团队填写。

## Acceptance Review

- 验收结果：Blocked。咨询功能与定向验证已恢复，但第二次交付仍被两个范围外的完整后端门禁失败阻断；不得在本咨询任务内扩展范围修复。
- 验收证据：旧无 reload 后端进程对固定咨询返回 BFF `502`；重启加载当前工作树后，同一句咨询返回 BFF/FastAPI `200`、`status=ok`、咨询身份正确且回复非空。咨询与 DeepSeek 定向测试通过；前端 lint/typecheck/test/build 全部通过（301/301）；harness 通过（72 个基线文件）；`git diff --check` 通过。
- 未通过项：完整后端 Ruff 在非本任务 diff、非允许路径的 `tests/test_junjichu_cases_api.py:3` 报 `I001`；完整 pytest 为 1779 passed / 1 failed，失败项 `test_decree_to_case_ledger_is_private_and_records_only_real_terminal_outcomes` 属于军机处案卷/下旨在途任务（期望 200、实际 502），与咨询旧进程根因无因果关系。独立测试角色未亲历既有在途回归的 RED 阶段，只确认当前 GREEN。后续必须先在对应产品任务中修复这两项，再重新验收本任务；不得修改 ADR 0028 或扩大本咨询任务路径。
