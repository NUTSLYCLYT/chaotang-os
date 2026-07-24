# 任务：fix-r0-w05-postmerge-remediation-20260724

WIP 永远为 1；下一个任务只能在前一个任务有命令证据后开始。

## 任务 1：冻结 Packet 与 RED

- 目标：冻结 exact base、接口和 allowlist，为六项 MUST 写公共契约/真实 DB seam RED。
- 前置条件：用户 exact 批准；W05 authority=GO；W06=STOP；新 worktree 从 `3cb508e` 创建。
- 输入：post-merge 双轴、API/安全、数据/迁移审查结论。
- 输出：本 change spec；失败测试；逐项 RED 结果。
- 涉及文件：本 change、聚焦 backend tests。
- 状态 / 数据变化：只增加测试和证据，不修改产品行为。
- 验证命令与证据：最窄 pytest；每个失败必须命中目标行为。
- 回滚边界：删除本 Packet 新增测试和 change；不触碰既有历史。
- 完成定义：六项 MUST 都有稳定 RED。
- 状态：完成；聚焦测试 `33 failed, 24 passed`，失败全部命中批准的缺失行为。

## 任务 2：scope 与 canonical ingress GREEN

- 目标：显式 typed contract scope 在 DecisionTask 创建时冻结，法律问题超范围 fail closed。
- 前置条件：对应 RED 已观察。
- 输入：`ContractIntakeV1`、draft task 请求。
- 输出：`legal_question=contract_risk_screening` 最小 taxonomy、support reason、
  task kernel writer、generation scope snapshot、OpenAPI 投影。
- 涉及文件：contract taxonomy/contracts、task kernel、contracts/shangshufang routers、测试。
- 状态 / 数据变化：只写既有 `decision_tasks.contract_scope_json`；无 migration。
- 验证命令与证据：contract unit + draft API/DB integration tests。
- 回滚边界：revert 该行为簇；旧 JSON 保持 fail closed。
- 完成定义：支持 scope 正向可达，缺失/超范围只进入法律复核。
- 状态：完成；canonical draft/task/generation scope 已贯通，bind 只做规范化
  等价核对，task/generation 快照漂移按 server invariant fail closed。

## 任务 3：状态投影与幂等重放 GREEN

- 目标：用一个纯投影 Interface 隔离领域状态与 durable 状态，并让同一绑定跨 worker
  状态幂等。
- 前置条件：对应 contract/API RED 已观察。
- 输入：generation payload、`OutboxEvent.status`、既有 EvidencePacket。
- 输出：typed response、terminal/in-flight replay 状态矩阵；binding 后 durable=`pending`。
- 涉及文件：generation contract、replay projection module、shangshufang router、测试。
- 状态 / 数据变化：不新增表；不追加重复 packet/audit。
- 验证命令与证据：contract/OpenAPI/API/DB replay tests。
- 回滚边界：revert 状态投影；不改既有 durable rows。
- 完成定义：成功状态重放合法，failure 状态 409，不出现契约外响应。
- 状态：完成；一个纯投影 Interface 覆盖 decision replay、bind retry 与 CAS
  loser，真实 worker 生成 v2 后旧 request hash 仍幂等返回原 generation。

## 任务 4：证据状态生产与 fail-closed GREEN

- 目标：用 immutable artifact 身份和同名版本序确定性产生 Grounded/Conflicted/Stale。
- 前置条件：对应 evidence status RED 已观察。
- 输入：secure-ingest row、磁盘摘要、同任务同文件名版本。
- 输出：EvidencePacket 状态、generation evidence 投影、worker revalidation。
- 涉及文件：secure-ingest evidence module、contract rework、binding router、测试。
- 状态 / 数据变化：只更新当前 generation payload；非 grounded 不 promotion。
- 验证命令与证据：纯契约 + SQLite/file integration + worker gate tests。
- 回滚边界：关闭 W05 或 revert；artifact 与审计记录保留。
- 完成定义：NONE/GROUNDED/CONFLICTED/STALE 可复验且 fail closed。
- 状态：完成；分类限定 tenant/user/task/name 版本边界，worker 只允许单调降级，
  PostgreSQL publication 使用 artifact 表 SHARE 锁阻止最终重验后的 INSERT
  phantom；SQLite 由既有 DecisionTask 写锁围栏。

## 任务 5：广域验证与 exact candidate

- 目标：形成可独立拒绝、验证、回滚的本地候选，不触碰远端。
- 前置条件：任务 2–4 聚焦 GREEN。
- 输入：完整 diff 和命令证据。
- 输出：CI summary、本地 exact candidate SHA、独立双轴 review。
- 涉及文件：allowlist 内实现/测试与本 change。
- 状态 / 数据变化：本地 commit；不 push/merge；manifest 仍 W05 ACTIVE、W06 STOP。
- 验证命令与证据：changed tests、canonical 回归、Ruff、authority、doctors、diff check。
- 回滚边界：`git revert <candidate>`（未来获批后）；本轮不执行 destructive reset。
- 完成定义：验证全绿、review 0 MUST、exact SHA 交 Product Owner/总控。
- 状态：完成；本地实现候选
  `0f2a3e4abd99aef345ac2858daa799c5aadc9dc6` 已冻结。聚焦、相关回归、
  非排除全量、authority/amendment/doctor 均已通过；detached exact-SHA
  Standards 与 Spec 双轴均为 `0 MUST`。候选保持 local only，W06 继续 STOP。
