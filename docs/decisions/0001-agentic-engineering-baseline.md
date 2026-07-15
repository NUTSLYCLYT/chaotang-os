# 决策 0001：采用最小、闭环优先的 Agentic Engineering 基线

## Status

Accepted — 2026-07-14

## Context

仓库尚无业务代码。早期方案预建了三套 meta-harness，之后又按照完整性清单增加
adoption report 和固定 failure schema；这些结构超过了当前真实需求，并曾把未经确认
的前后端职责写成事实。

## Decision

以 Software Mansion Agentic Engineering Guide 为主要实践参考：保持 `AGENTS.md`
最小、显式暴露假设、使用小步验证、建立 agent 可直接读取的反馈闭环，并根据重复
痛点逐步引入 skills、MCP、hooks 或 subagents。

当前只保留短入口、已确认架构事实、本地检查、检查器自测和 CI。不为尚未发生的
业务失败或尚未选择的技术栈预建复杂治理结构。

## Consequences

- 仓库规则更少，但每条规则必须具体、相关并尽可能可验证。
- 首次前后端实现需要同时补充实际命令、测试、运行反馈和 CI。
- 经验只在可复用且不易从代码发现时写入仓库，优先转化为自动化反馈。

## Verification

- `node scripts/check_harness.mjs`
- `node scripts/check_harness.mjs --self-test`
