# EXT 专业 Agent 资产矩阵

本矩阵是 `PROFESSIONAL_AGENT_K0` 在当前 EXT 架构上的事实源。它吸收旧 K0 的“机器可读资产台账”能力，但不复制旧 `backend/app` 路径，也不创建第二运行控制面。

## 读取原则

- 唯一可写主线：`feature-chaotang-ext`。
- 现行运行目标：`backend/src` 与 `backend/web`。
- 旧分支只提供能力意图、契约反例和测试线索；来源固定为 `codex/professional-agent-k0-20260803@675aa950a073ae4e3e72b562aab13eea43d018df`。
- 每个运行能力必须同时登记能力、契约入口、测试和验证命令。
- `PROMPT_ONLY`、`DESIGN_ONLY` 或 `PARTIAL` 不能被解释为可运行、已接线或已验收。

## 当前结论

矩阵登记 8 个能力域：5 个现行能力、1 个“诚实不可用”兼容边界，以及 2 个仍需后续逐角色对账的集合资产。太医条目只证明旧接口会明确返回不可用，不能解释为已经具备健康分析或分诊能力。运行 Prompt 共 71 个，Agent 设计契约共 35 个；数量由检查器递归核验，不靠文档手工声明。

## 命令

```bash
node scripts/professional-agent-matrix.mjs --check
node scripts/professional-agent-matrix.mjs --print
node --test scripts/professional-agent-matrix.nodetest.mjs
```

该矩阵只提供治理和吸收决策证据，不授予 Agent 运行、网络、推送、合并、部署或生产启用权限。
