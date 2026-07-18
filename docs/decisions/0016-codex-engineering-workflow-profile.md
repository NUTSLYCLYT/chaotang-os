# ADR 0016：Codex 工程工作流配置

## Status

Accepted — 2026-07-18

## Context

仓库已有 Agentic Engineering 基线、产品任务契约和双客户端兼容层，但尚未定义如何在项目内
场景化使用用户级 Superpowers 与 gstack。直接复制全部第三方 skill 会引入版本漂移、CI 环境依赖、
权限扩大和上下文膨胀；永久移除 Claude Code 又会破坏既有兼容架构。用户同时要求当前交付只用
Codex，因此需要明确按任务激活的 Codex-only 优先级。

## Decision

新增 Codex 专用项目 skill `.agents/skills/codex-engineering-workflow/` 和规范文档
`docs/codex-engineering-workflow.md`，只保存场景路由、降级、安全授权与验证门禁，不复制
Superpowers/gstack 源码。用户显式选择 Codex-only 时，禁止 `gstack-claude`、Claude CLI 和
product-flow Claude runner；需要团队角色时使用现有 Codex 专业角色顺序接力。个人技能安装保持
可选，基础 CI 仅检查仓库规范，不依赖个人目录。

## Consequences

项目获得可审计的最小流程选择与新鲜验证要求，并能在缺少第三方 skill 时安全降级。代价是静态
规范不能证明运行时绝不越权，第三方升级后仍需人工复审；Codex-only 与 `$product-flow` 同时出现时，
必须走 Codex 角色链而不能使用默认 runner。现有双客户端默认架构保持不变。

## Verification

```text
node scripts/check_harness.mjs
node scripts/check_harness.mjs --self-test
node .agents/hooks/check-harness.mjs --self-test
```
