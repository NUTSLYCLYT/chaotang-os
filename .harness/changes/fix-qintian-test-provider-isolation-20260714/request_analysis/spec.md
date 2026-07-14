# 规格说明：fix-qintian-test-provider-isolation-20260714

## 背景

`test_qintian_chat_contract_streams_fallback_tokens` 的目标是验证 `/api/qintian/chat` 的 SSE token/sourceLabel 形状，但它直接进入 `_call_qintian_agent()`。开发机配置真实 provider 时，调用成功并诚实返回 `LIVE`，导致测试固定断言 `FALLBACK` 失败并产生真实网络调用。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | 整合集 RED 为 113 passed / 1 failed；响应实际是 `LIVE` | pytest 输出与 `backend/tests/test_contract_alignment_p0.py` | Backend owner | 是，已修复 |
| 已确认事实 | `_call_qintian_agent` 会读取 provider/API key 并在成功时返回 `LIVE` | `backend/web/routers/orchestration_compat.py:58` | code review | 否，生产正确行为 |
| 已确认事实 | 测试只断言 SSE 契约，不断言具体模型质量 | `backend/tests/test_contract_alignment_p0.py` | test review | 否 |
| 推测 | 无；不把本机 provider 可用性当 CI 前提 | 不适用 | 不脑补 | 否 |
| 未知问题 | 全量套件除本整合集以外的剩余失败数 | 本轮不运行全量 suite | 后续测试清零闭环 | 否 |

## 数据流与调用链

修复前：`contract test -> TestClient -> qintian route -> _call_qintian_agent -> local provider config -> external model -> LIVE -> assertion failure`。

修复后：`contract test -> monkeypatched agent boundary -> qintian route -> SSE serialization -> deterministic FALLBACK`。生产请求仍走原 `_call_qintian_agent`，没有行为变化。

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| `_call_qintian_agent(message) -> (text,label)` | production compatibility router | qintian route | 测试在模块边界注入 stub，生产不改 |
| SSE token/done events | qintian route | legacy frontend contract | 继续断言 token 与 FALLBACK label |
| monkeypatch 生命周期 | pytest | 单个测试 | 用例结束自动恢复，不污染其他测试 |

## 范围

只修复一个测试的 provider 隔离并记录证据。

## 非目标

不改变生产 LIVE/FALLBACK 选择；不禁用全局 provider；不修改钦天监提示词、输出内容或 API；不处理其他测试失败；不推送分支。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| 开发机存在有效 API key | 测试仍不访问 provider，稳定 FALLBACK | 当前 GREEN |
| 开发机无 API key | 同一确定性结果 | stub contract |
| stub 收到错误消息 | 测试立即因输入断言失败 | fake function assertion |
| 生产请求 | 仍可根据真实 provider 返回 LIVE | production diff 为零 |

## 风险与回滚边界

风险是把生产函数整体改成测试模式，误伤真实 LIVE 能力；因此只在单测试内 monkeypatch 最窄边界。回滚仅撤销测试改动，但会恢复环境相关失败。

## 计划确认记录

- 批准人：用户（“下一步”）
- 批准日期：2026-07-14
- 批准范围：修复验证阶段发现的单个 provider 污染测试
- 明确未批准：修改生产模型策略、清理其他分支/缓存、推送远端

## 验收标准

原失败可复现；修复后聚焦测试与 114 项整合集通过；生产代码无 diff；doctor、diff/security 通过。

## 验证计划

先保留已有 `LIVE != FALLBACK` RED；实施单测试 monkeypatch 后跑聚焦 GREEN，再复跑整合集、三层 doctor、diff check 与 scoped secret scan。
