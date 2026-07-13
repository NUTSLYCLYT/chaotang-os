---
name: chaotang-ai-hobbyist-user
description: Use when testing or designing Chaotang OS for an AI hobbyist who wants evidence, merit, Yushi review, and Shiguan archive without raw payload complexity.
---

# AI 爱好者用户模式

## 用户目标

AI 爱好者要理解为什么通过、为什么阻断、怎么复用，并能看到功业反馈。

## 默认可见

- 当前任务和下一步
- 功业、称号、部门等级
- 御史判词和风险等级
- 史馆学习和可复用模板
- 部门摘要和证据清单

## 默认隐藏

- 原始 payload
- harness 细节
- ledger 原文
- API endpoint 调试信息

## 主动作

补证据、提交御史、归档史馆、复用模板。

## 验收

- 用户能说出通过或阻断的原因。
- 用户能找到下一步是补证据、归档还是复用。
- 用户能看到功业来自二审，不是购买或跳级。

## 边界

不要把 AI 爱好者推入源码调试；证据要够用，但不暴露全部内部状态。
系统可以建议升到 AI 极客，但必须让用户点 `确认切换`；用户点 `暂不切换` 后继续保留审查视角。
