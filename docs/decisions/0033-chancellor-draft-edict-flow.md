# 决策 0033：丞相案例驱动拟旨独立流程

## Status

Accepted — 2026-07-29

## Context

当前 `/study` 只有非业务咨询和直接下旨两个通道。咨询受 ADR 0030 约束，不得成为业务入口；正式下旨图在用户已经授权后才进行六部分流，无法承担下旨前的意图澄清。仓库新增的 `chancellor-draft-edict` Skill 目前仅供 Codex 扫描，运行时丞相不会加载。

用户确认需要新增独立拟旨流程，让丞相先通过专业案例帮助用户把模糊意图说清，再由用户决定是否下旨。

## Decision

新增独立、受认证的丞相拟旨 Agent 与 HTTP/BFF 契约。拟旨 Agent 从固定仓库路径加载 `chancellor-draft-edict` Skill，只生成案例建议、修订提示和结构化草案，不调用六部、军机处、锦衣卫、史馆或现有下旨图。

拟旨状态采用 `CLARIFYING`、`DRAFT_READY`、`NEEDS_INPUT`、`PARTIAL`、`ISSUE_BLOCKED`。草案以版本号和内容指纹标识；只有当前 `DRAFT_READY` 草案能启用【下旨】。用户点击【下旨】后仍调用既有正式下旨端点，并以用户看见的草案正文作为旨意输入。

页面保存当前草案展示状态；服务端同时按认证用户保存最新 `DRAFT_READY` 草案的一次性下旨授权。授权严格绑定版本、指纹和服务端规范化草案正文，下旨时原子消费；新草案覆盖旧授权，非就绪草案撤销授权。该授权不写入史馆或正式业务档案。

本决策在 ADR 0028 的业务入口之前增加无执行副作用的准备阶段，不改变下旨是唯一执行入口、下旨后的六部/军机处拓扑、锦衣卫边界或一旨一条 `REPLY`。

## Consequences

- 收益：用户无需先会写专业需求；拟旨与执行授权清晰分离。
- 收益：Skill 成为拟旨行为规范源，缺失或损坏时失败关闭，避免运行时静默漂移。
- 收益：咨询、拟旨、下旨三个通道职责独立，可分别测试和演进。
- 代价：新增一次模型调用、跨端契约和浏览器草案状态；同步响应仍受模型延迟影响。
- 限制：首版一次性授权为进程内状态，不跨进程、不跨重启；多实例部署前必须迁移到共享原子存储并增加过期策略。
- 治理：Skill、运行时契约、前端状态和 Harness 必须在同一变更中保持一致。

## Verification

```powershell
cd backend
.\.venv\Scripts\ruff.exe check app tests
.\.venv\Scripts\python.exe -m pytest -q

cd ..\frontend
npm run lint
npm run typecheck
npm test
npm run build

cd ..
node scripts/check_harness.mjs
node scripts/check_harness.mjs --self-test
git diff --check
```
