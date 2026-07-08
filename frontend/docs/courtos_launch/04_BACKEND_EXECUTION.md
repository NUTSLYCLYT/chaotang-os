# 04 Backend Execution

本文件目的：约束后端上线执行范围，确保后端服务 P0 裁决闭环、API contract、证据链、风险门和归档，而不是继续扩蜂群。
优先级：P0。

## 当前已知事实

- 后端主仓分支：`feat/courtos-loop-harness`。
- 当前后端工作区干净。
- 后端最近收口提交：`a2ec7da fix(jiqun): align registry validation and smoke failure semantics`。
- 关键文件包括 `config/jiqun_registry.yaml`、`config/swarm_orchestrator.yaml`、`config/flow_*.yaml`、`runtime_prompts/*`、`scripts/smoke_all.py`、`scripts/golden_cases/*.json`、`tests/test_*.py`。

## 当前缺口

- API contract 尚未与前端 P0 页面逐项对齐。
- `DecisionCase`、`Memorial`、`ArchiveRecord`、`RiskGate`、`AgentFlowRun` 等对象需要形成最小 contract。
- 后端质量门下一轮需要复跑，但本轮不触发测试或服务。

## 能做什么

- 维护 registry、flow、golden case 和 smoke 语义稳定。
- 定义 P0 后端对象和 API contract。
- 增加 `sourceLabel`、`evidence`、`riskGate`、`audit trail` 的最小支撑。

## 不能做什么

- 不能重新把未落地的 `bingbu_sales_acquisition` 放回正式注册表。
- 不能绕过 release gate 或把 blocked 当成功能错误。
- 不能触发真实蜂群运行来证明文档任务。

## 当前优先级

后端下一步不是继续扩蜂群，而是：

1. 固化 registry validation。
2. 固化 `smoke_all.py` 失败语义。
3. 固化 golden cases。
4. 对齐 flow 与前端 P0 链路。
5. 输出 API contract。
6. 增加 `sourceLabel` / `evidence` / `archive` 字段。
7. 增加 `riskGate` 判断。
8. 增加 audit log。

## P0 后端对象

| 对象 | 含义 |
|---|---|
| `DecisionCase` | 决策事项 |
| `BriefingItem` | 今日预案 |
| `ChiefMinisterReview` | 丞相筛选 |
| `CouncilReview` | 军机处会审 |
| `Memorial` | 奏折 |
| `ImperialDecision` | 老板裁决 |
| `RiskGate` | 高风险确认门 |
| `ArchiveRecord` | 史馆归档 |
| `EvidenceSource` | 证据来源 |
| `AgentFlowRun` | 蜂群/flow 执行记录 |

## 当前状态

- 后端主仓：`/home/ubuntu/fe/fengQun/jiqun_ai_fresh`
- 最近收口提交：`a2ec7da fix(jiqun): align registry validation and smoke failure semantics`
- 正式蜂群：17
- `bingbu_sales_acquisition` 暂不在正式注册表。

## 验收标准

- `.venv/bin/python scripts/validate_flows.py`
- `.venv/bin/python scripts/validate_registry_sync.py`
- `.venv/bin/python scripts/commit_closeout_check.py`
- 相关 pytest，只跑与本次改动相关的测试。

## 后续 Codex 可执行任务

```text
你是 CourtOS 后端 API contract 审查官。
只读检查后端主仓的 registry、flow、测试和现有 API/脚本。
输出 DecisionCase、Memorial、Archive、RiskGate、AgentFlowRun 的最小 contract 草案和缺口。
不要修改 registry、golden case 或 smoke 脚本，不要启动服务，不要触发真实蜂群。
```
