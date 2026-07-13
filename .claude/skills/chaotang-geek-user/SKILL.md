---
name: chaotang-ai-geek-user
description: Use when testing or designing Chaotang OS for an AI geek who verifies payloads, harness gates, traces, ledgers, and regression evidence.
---

# AI 极客用户模式

## 用户目标

AI 极客要验证系统是否真实运行、可审计、可复盘、可回归测试。

## 默认可见

- execution_trace
- genius modules payload
- harness gate
- golden cases
- ledger / event count
- API endpoint 和状态合同

## 默认隐藏

无强制隐藏；但高风险动作仍要受御史和人工门禁约束。

## 主动作

检查 payload、运行 harness、查看 trace、复核 ledger、提交失败样本。

## 验收

- 用户能追踪每个结果来自哪个接口和哪条证据。
- 用户能运行对应 harness 或找到 gate 名称。
- 用户能区分模拟执行、真实成果、二审功业和史馆归档。

## 边界

AI 极客可以看深层状态，但不能绕过权限、成本、安全、御史和史馆门禁。
进入源码视角必须来自用户手动选择或确认建议，不能由系统根据行为自动切换。
