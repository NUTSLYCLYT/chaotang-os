# Claude Code 独立审查交接单

## 审查对象

M0「事实源与黄金基线冻结」，提交 `a1c918d`，当前分支 `feature-chaotang-ext`。

## 必审文件

- `capability-baseline.json`
- `golden-cases.md`
- `request_analysis/spec.md`
- `ci_result/ci_summary.md`
- `summary.md`

## 审查问题

1. commit、分支、事实源和部门能力映射是否可复现且无自相矛盾？
2. 7 项 known-red 是否与 ledger 精确一致，是否错误掩盖新失败？
3. 50 个黄金样例配额是否覆盖计划声明的维度，并能被后续门禁消费？
4. 是否明确区分静态审计投影限制、外部 required-check 缺失与运行时事实？
5. 是否存在越界改动、错误发布信号或不可回滚的事实覆盖？

## 审查结论格式

输出 `GO`、`GO_WITH_ACTIONS` 或 `NO_GO`，逐项列出证据路径和阻塞级别。未取得独立结论前，不进入 M1 运行时代码改造。

## 禁止事项

审查期间不得修改运行时代码、不得重写 known-red ledger、不得将工作树中两个范围外未跟踪路径纳入本 change。
