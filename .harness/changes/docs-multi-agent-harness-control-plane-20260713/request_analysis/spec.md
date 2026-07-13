# 规格说明：docs-multi-agent-harness-control-plane-20260713

## 背景

现有产品多 Agent 运行架构已有编排、证据门和发布门，但工程协作缺少路径租约、端口/构建锁、worktree 隔离和唯一发布指挥权，已实际产生进程、构建和同文件并发冲突。

## 范围

制定可按 PR 逐步实施的根级 harness 控制面方案，覆盖契约、租约、锁、worktree、安全 build/start、Release Commander、测试会话、发布证据、故障演练和分阶段推广。

## 非目标

不重写 FlowEngine、SwarmOrchestrator 或产品页面；不在本文档变更运行时。

## 验收标准

每步都有冷启动上下文、主文件、精确验证、退出条件、回滚和依赖；全局 A1–A12 可机器验证。

## 验证计划

`node scripts/harness-doctor.mjs`；检查文档步骤、依赖、验收和回滚完整性。
