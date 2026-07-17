# 任务：docs-absorption-closeout-20260717

## 任务 1 — 文档查重测试去仓库资产耦合

- 目标：保留真实 `git ls-files` 行为，同时让 fixture 自包含。
- 前置条件：在 P6 合入头精确复现 1 failed。
- 输入：临时 Git 仓库、tracked `docs/qintianjian.md`、模拟新文档。
- 输出：重叠主题告警与 tracked-file 不告警回归。
- 涉及文件：`backend/tests/test_commit_closeout_check.py`。
- 状态 / 数据变化：仅测试；不接生产 DB/服务。
- 验证命令与证据：目标 RED；全文件 9 passed。
- 回滚边界：单测试文件。
- 完成定义：不再依赖主仓历史文档存在。
- 状态：GREEN，待整包 review。

## 任务 2 — KPI 与 Packet 状态对账

- 目标：严格复用 P0 分母，量化 LOC、writer、state-machine、department SSOT 和流量证据。
- 前置条件：固定 `B=f5fa714...`。
- 输入：P0 baseline、P2/P3 telemetry、P4/P6 守门、Git DAG。
- 输出：`kpi-reconciliation.md`、`packet-status.md`。
- 涉及文件：本 change 与 campaign 根记录。
- 状态 / 数据变化：docs-only。
- 验证命令与证据：文档内列出的固定命令和路径。
- 回滚边界：P7 文档提交。
- 完成定义：目标未达项不改口径、不冒充 DONE。
- 状态：VERIFIED；LOC/definition/traffic 未达项已按原口径记录。

## 任务 3 — known-red、mainline 与 deferred 收口

- 目标：核销 P6 七个前端红项和 P7 commit-closeout 红项；汇总剩余边界并映射 Wave。
- 前置条件：P6 review-v2 GO；任务 1 GREEN。
- 输入：known-red ledger、mainline review、各 Packet review/change evidence。
- 输出：更新台账、mainline 状态和 `deferred-register.md`。
- 涉及文件：campaign 根记录与本 change。
- 状态 / 数据变化：docs-only。
- 验证命令与证据：全量测试与路径交叉核对。
- 回滚边界：P7 文档提交。
- 完成定义：OPEN/closed/deferred 数量可逐项相加。
- 状态：VERIFIED；P6 七项 closed，P7 一项 fixed pending review，剩余项均有唯一 owner。

## 任务 4 — 验证、独立审查与集成

- 目标：完成相关/全量验证、三层 doctor、精确 SHA Claude review 和 D6 候选合入。
- 前置条件：任务 1–3 完成、工作树 clean implementation H。
- 输出：CI 摘要、review/approval、候选 merge 与正常 push。
- 涉及文件：本 change 的 CI 与 packet_review 证据。
- 状态 / 数据变化：review 前不合 ext；不部署。
- 验证命令与证据：D6 verifier + normal push。
- 回滚边界：候选 merge 可不发布；已发布后走新 revert change。
- 完成定义：Claude GO、D6 接受、远端 ext 指向候选 merge。
- 状态：PENDING。
