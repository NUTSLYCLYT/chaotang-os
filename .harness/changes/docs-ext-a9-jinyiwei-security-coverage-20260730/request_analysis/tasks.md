# 任务：docs-ext-a9-jinyiwei-security-coverage-20260730

## Task 0: Asset identity and coverage

- 目标：证明候选分支是否仍有待吸收代码库存。
- 前置条件：EXT exact HEAD 固定。
- 输入：`feature-chaotang-ext`、`task/pkt-a1-jinyiwei-real-fetch`。
- 输出：`SUPERSEDED_BY_EXT_HEAD` 资产结论。
- 涉及文件：本 Packet。
- 状态 / 数据变化：`COMPLETE`；不改变运行数据。
- 验证命令与证据：`git rev-list --left-right --count ...` 返回 `365 0`。
- 回滚边界：删除本 docs Packet；不涉及运行时回滚。
- 完成定义：历史候选独有提交为 0，禁止重复 merge。

## Task 1: Security coverage matrix

- 目标：建立外联、身份、租户、输入、来源信任、限流、存储和失败语义覆盖表。
- 前置条件：Task 0 完成。
- 输入：当前 EXT 锦衣卫、SEC、ownership 和 rate limiter 实现。
- 输出：`security_coverage_matrix.md`。
- 涉及文件：本 Packet。
- 状态 / 数据变化：`COMPLETE`；docs only。
- 验证命令与证据：源码检索、聚焦 pytest、root doctor。
- 回滚边界：docs-only revert。
- 完成定义：每个控制有状态、证据、风险级别和后续动作。

## Task 2: P1 TDD RED candidate

- 目标：用命名失败测试证明跨租户/缺租户 fill-gap、mandatory/closed-world
  source authority、caller with/without sources no-persist，以及前端
  `CALLER_FINDINGS` 非 LIVE 表达。
- 前置条件：用户已复核书面规格；runtime scope amendment 已获批；W08
  authority 仍为 GO。
- 输入：本 Packet P1 findings。
- 输出：ownership、authority、persistence 和 frontend/browser 四组因目标缺口
  而失败的命名回归测试；每组记录预期失败指纹。
- 涉及文件：scope amendment 中列出的 focused backend/frontend tests。
- 状态 / 数据变化：`READY_AFTER_THIS_PACKET_COMMIT`；尚未修改运行数据。
- 验证命令与证据：focused pytest 明确 RED 原因。
- 回滚边界：测试提交可独立 revert。
- 完成定义：除 mandatory-keyword 契约专测外，测试不是 TypeError、语法、
  auth redirect、network 或 fixture 失败，并在旧行为下稳定复现目标缺口。

## Task 3: P1 minimum remediation

- 目标：复用 tenant + user ownership SSOT，并阻止 caller 自证 server trust。
- 前置条件：Task 2 RED；精确实现计划批准。
- 输入：失败测试和信任来源设计。
- 输出：最小运行时修复。
- 涉及文件：scope amendment 中列出的 14 个 runtime/test/frontend 文件。
- 状态 / 数据变化：`READY_AFTER_THIS_PACKET_COMMIT`；caller assertion 将不再写入
  tenant 共享证据池，现有数据库行不重写。
- 验证命令与证据：Task 2 RED 转 GREEN，加现有锦衣卫聚焦 suite。
- 回滚边界：单个 runtime/test 提交 revert；不迁移或重写现有数据库行。
- 完成定义：跨租户拒绝；caller assertion 不再成为 shared verified evidence。
  锦衣卫前端不再把 caller assertion 显示成真实来源。

## Task 4: P2 bounded network hardening

- 目标：typed input、长度/数量上限、检索限流、generic error 和来源规范化。
- 前置条件：Task 3 通过；P2 scope 获批。
- 输入：本 Packet P2 findings。
- 输出：小范围端点加固及测试。
- 涉及文件：以实施计划批准清单为准。
- 状态 / 数据变化：`NOT_STARTED / NOT_AUTHORIZED_BY_THIS_PACKET`。
- 验证命令与证据：focused tests + backend doctor + root doctor。
- 回滚边界：与 Task 3 分提交，可独立回滚。
- 完成定义：网络调用在验证和限流之后发生；错误不泄露内部细节。

## Task 5: Independent review and EXT integration

- 目标：在 exact candidate 上完成独立安全与代码审查。
- 前置条件：所有批准任务通过 fresh verification。
- 输入：exact commit/tree、diff、测试输出、安全矩阵。
- 输出：HIGH 0 / MEDIUM 0 review 和 Codex acceptance。
- 涉及文件：review evidence；不在审查中修改实现。
- 状态 / 数据变化：`NOT_STARTED`。
- 验证命令与证据：reviewer 重跑聚焦测试和 doctors。
- 回滚边界：不通过则拒绝 integration，不覆盖 EXT。
- 完成定义：只有验收后的最小 Packet 才允许受控 fast-forward 进入本地 EXT。
