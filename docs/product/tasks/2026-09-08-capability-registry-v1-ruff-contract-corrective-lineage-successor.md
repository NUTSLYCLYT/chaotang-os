# CapabilityRegistry V1 Ruff Contract Corrective Lineage Successor

任务 ID：`CAPABILITY-REGISTRY-V1-RUFF-CONTRACT-CORRECTIVE-LINEAGE-SUCCESSOR-20260908`

## Status

Draft

`DRAFT / NON_AUTHORIZING / READY_FOR_OWNER_CONFIRMATION`

这里的 `Draft` 只描述本文件在 proposed 阶段的文档成熟度，永远不是实时执行权。正式 approval
manifest、实时远端身份和 machine result 是唯一 authority 事实源；本文件不得覆盖它们。

| 生命周期 | 唯一有效含义 |
| --- | --- |
| proposed 仅在本地 | `DRAFT / NON_AUTHORIZING` |
| approval commit 已本地创建或已推送、尚未运行 machine authority | `NON_AUTHORIZING / WAITING_FOR_MACHINE` |
| machine 返回 `GO / APPROVED_FOR_ONE_CHILD` | 只授权 manifest exact4 的一个直接单亲候选 |
| machine `STOP`、远端漂移或 approval 已被消费 | `STOP / NO_REANCHOR / REISSUE_REQUIRED` |
| candidate machine verification PASS | 只具备 Owner 接纳资格；不自动授权 push、Pilot、Release 或部署 |

## Product Definition

当前主线 `c51e87454a5daf2d7febb82c715df1264cf593ce` 的全量 Ruff 复验中，
`python3 -m ruff check app tests` 在 CapabilityRegistry V1 的四个既有文件中确定性报告
13 项格式错误。相同失败已在未修改的 clean approval 工作区复现；Mingshuo exact8 focused
测试为 `4 passed`，因此该阻断属于 approval 基线前置缺陷，而不是 exact8 产品字节回归。

旧草案绑定 `91a74574d454420753d78d15d3edfa889a9e767e`，现只作为 byte donor，不得 re-anchor。
`91a74574…` 是当前基线的祖先；两者之间精确六个 first-parent 提交、23 条 changed paths，
与本 exact4 四路径零重叠，四个 Git blob identity 逐项不变。当前 exact8 machine authority
虽返回 `GO / APPROVED_FOR_ONE_CHILD`，但尚无 candidate commit；其八路径仅保留为
`UNCOMMITTED_BYTE_EVIDENCE_ONLY / REISSUE_REQUIRED_AFTER_PREREQUISITE`。本 successor 若落地，
是显式的串行 prerequisite 处置，不构成 exact8 authority 消费、恢复或继承。

本任务只恢复既有 CapabilityRegistry V1 产品字节与当前 Ruff 合同的一致性，不改变 API、模型、
投影、事实源、权限、测试语义或用户体验。

## Acceptance Criteria

- [ ] exact4 只包含四条冻结路径，全部为 `100644` 修改。
- [ ] 修改仅为 Ruff 要求的多余空行删除和长行换行，完整 AST 保持一致。
- [ ] 候选合同机器校验精确强制 `0 ADD + 4 MODIFY + 0 DELETE`、全部 `100644`。
- [ ] 四文件修改前后完整 AST 必须逐字等价；不允许任何 import 节点或顺序变化。
- [ ] 先保存当前 13 项 Ruff RED，再证明 exact4 Ruff 与全后端 Ruff GREEN。
- [ ] CapabilityRegistry focused tests 与 backend-full 全绿。
- [ ] 根 Harness、doctor、hook、product-authority regression 与 V2 全绿。
- [ ] 独立 Python Review、Governance Review 与 Security Review 无 P0–P2。
- [ ] 不继承历史 approval、candidate、验证或通过身份。
- [ ] 旧基线到当前基线的六提交 lineage、23 路径差异、exact4 零重叠和四 blob 恒等必须可机械复算。
- [ ] exact8 八文件保持未提交且不进入本 approval/candidate；Ruff prerequisite 落地后必须基于最新 ext-dev 重新签发 exact8 successor。

## Delivery Constraints

- 基线：`c51e87454a5daf2d7febb82c715df1264cf593ce` / tree
  `264fd916a39eb82a9cfcad7688c7dea21b1dbcab`。
- 单一产品字节写入者；candidate 必须是未来 approval commit 的直接单亲子。
- 不新增或主动运行外部网络、凭据、外部工具或真实业务副作用；完整既有测试允许受控本机
  loopback、临时文件和子进程，不能据此声称公网隔离。
- 不删除、跳过或放宽任何测试、Ruff 规则、Harness 或 authority。
- 本草案不授权产品实施、commit、push、Pilot、Release 或生产部署。

## Affected Modules

- 模块：CapabilityRegistry V1 后端只读投影的 Ruff 合同纠偏。
- 允许路径：`backend/app/capabilities/contracts.py`、`backend/app/capabilities/projection.py`、`backend/tests/test_capabilities_api.py`、`backend/tests/test_capability_registry_projection.py`。

## Technical Plan

1. 在干净基线机械保存 `python3 -m ruff check .` 的 13 项失败拓扑。
2. 只在 exact4 内删除已确认的多余空行，并把超长表达式拆成括号化多行。
3. 由 manifest 首项 `a0-candidate-contract` 在产品测试前强制校验精确四项 `M/100644`，并直接比较完整 AST 和注释。
   当前唯一 `I001` 只要求删除 `contracts.py` 的多余空行，因此无需允许任何 import 重排；拒绝
   import、常量、调用、条件、字段或测试断言变化。
   所有注释（包括 noqa/type-ignore）必须保持一致；验证使用隔离 Python 解释器，不导入候选产品模块。
4. 运行 manifest 冻结的 focused、full backend、Ruff 与根级矩阵。
5. 完成独立三审；任一 P0–P2、第五条路径、行为差异或验证失败立即 STOP。

## Implementation Report

尚未实施。当前已完成 clean `c51e8745…` 基线复验、13 项失败定位、旧草案到新基线的
单亲 lineage 与 exact4 零重叠证明，并保全 exact8 八文件未提交字节。旧草案、旧 approval
身份与 exact8 one-child identity 均不继承。

## Acceptance Review

待 Owner 确认 canonical approval digest、正式 approval commit 落地并由 machine authority 返回
`GO / APPROVED_FOR_ONE_CHILD` 后，才可实施 exact4。任何聊天确认、草案或测试结果均不得代替机器
authority。本文件即使随 approval commit 落地，其 `Draft` 也只保留 proposed 时的文档历史；实时
生命周期必须以上表中的 manifest、远端和 machine result 联合裁决。
