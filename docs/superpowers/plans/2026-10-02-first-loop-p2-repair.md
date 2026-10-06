# 实施计划：首个真实流程 P2 编排

## 约束

只在 `ext-dev` 基线的隔离候选中实施，Codex 为唯一写入者。沿用现有任务、预算、Result Contract 和 owner 隔离；本批不启动真实模型。

## 步骤

1. 核对既有 contracts、基线和三项产品路径。
2. 将 GoalInterpreter、TeamSelector、PlanBuilder、EvidenceLedger、RecoveryManager 与 FirstLoopAdapter 接到既有 contracts。
3. 为 owner/task/attempt、证据唯一性、取消/重试、归档幂等和包级导出建立回归测试。
4. 执行 compileall、pytest 和 ruff；记录命令、版本和失败原因。
5. 交给独立只读 M2 评审；发现问题后定点修复并复验。

## 通过条件

- 所有运行状态来自真实事件或明确的确定性契约。
- 不创建第二套任务/预算/权限存储。
- 14 项首批契约测试、静态检查与导入检查通过。
- 本批完成不等于真实模型多 Agent、浏览器、桌面壳或 G3 通过。
