# Packet 01 — Battery Safety M0 Successor Plan

状态：`READY_FOR_CANONICAL_AUTHORITY / PRODUCT_STOP_UNTIL_MACHINE_GO`

任务：`PACKET-01-BATTERY-SAFETY-M0-SUCCESSOR-20260825`

基线：`origin/ext-dev@9bf91023604fb873591f1928de31495a28ca0284`

canonical approval digest：
`sha256:3bd07a0181a03652a629046dc9583e6cf01477bc9473487835214d98ff1ecdbf`

proposed file raw checksum（仅传输校验）：
`sha256:f7c51a3fbf1c337598ff518ebd7113d800236db2ed0eda35ebfefcada9ba395f`（6459 bytes）

## Phase 0 — Freeze And Owner Confirmation

1. 完成本 Task、Plan 和 proposed approval 的全部内容修改后再冻结字节；冻结后任何变化都要重新摘要、复审和确认。
2. 对 proposed JSON 运行 schema/parser，并分别记录 RFC8785 canonical approval digest 与 raw file checksum；两者不得混称。
3. Owner 必须精确确认 canonical approval digest；宽泛“全面融合”不替代该身份确认。
4. 只有取得一次性 approval commit 授权，才把 proposed JSON 的相同字节放入
   `.harness/approvals/PACKET-01-BATTERY-SAFETY-M0-SUCCESSOR-20260825.json`。
5. 正式 approval、Task、Plan 核对完毕后删除 `docs/migrations/...approval.proposed.json`，确认 changed paths
   精确等于 approvalCommitPaths；创建 approval commit 后 `git status --porcelain` 必须为空。
6. 只有取得单独 push 授权，才普通 fast-forward 推送精确三文件 approval commit。

Owner 已于 2026-08-25 完成第 3 项确认，并分别授权第 4–6 项中的一次 approval commit 与该提交的
fast-forward push；同时条件授权 machine GO 后重物化 exact9 及创建一次本地 candidate commit。
candidate push 仍未授权。

## Phase 1 — Canonical Authority

1. 远端必须精确等于 successor approval commit，工作树必须干净。
2. 运行：
   `node scripts/product-authority.mjs --authorize --task PACKET-01-BATTERY-SAFETY-M0-SUCCESSOR-20260825`。
3. 只有结果为 `GO / APPROVED_FOR_ONE_CHILD`，且 approval digest 精确等于本计划首部的 canonical digest，
   才进入产品阶段；否则 STOP。

## Phase 2 — Exact9 Rematerialization

1. 以旧 `dce861a4..e67beabc` exact9 差异作为只读内容输入，不复用旧 candidate identity。
2. 先在隔离环境复现冻结 RED，确认失败来自缺少电池安全行为，而非依赖或环境。
3. 在 successor approval 的唯一单亲工作树中重放同一产品字节；不得修改 Four-Gate 四文件。
4. 核对 changed paths 恰好为 exact9、`2 ADD + 7 MODIFY`、文件模式均为 `100644`。
5. 冻结 pre-commit patch/tree 身份；若需第十路径、修补 approval/Task/Plan 或远端漂移，立即 STOP 并重做治理。

## Phase 3 — Candidate Commit And Fresh Verification

1. 在产品字节冻结后，取得一次性本地 candidate commit 授权；未获授权不得创建 commit。
2. 创建 approval commit 的唯一单亲 candidate，且只含 exact9。
3. 运行一次 `node scripts/product-authority.mjs --verify-candidate --task PACKET-01-BATTERY-SAFETY-M0-SUCCESSOR-20260825`；
   它必须按 proposed approval 的九条冻结 command/args/cwd/timeout 全部通过；其中
   `candidate-exact9-byte-identity` 必须同时匹配 9 个 mode/blob OID 和 full-index binary patch digest
   `sha256:ad7ea7901d67a94212aa44d970eb68604faaed479db7c55d1481bb1da1fcae96`。
4. 在候选 SHA/tree 不变的前提下完成独立代码审查与安全审查；任何 P0–P2 未关闭都必须 STOP。

## Phase 4 — Closed 10-Round Final Acceptance

十轮不是新的 product-authority matrix，也不加入第十命令；它是同一冻结九项 matrix 的稳定性复验。

1. 记录 candidate SHA/tree、canonical approval digest，并确认工作树干净、远端仍精确等于 approval commit。
2. 连续 10 次运行同一个精确命令：
   `node scripts/product-authority.mjs --verify-candidate --task PACKET-01-BATTERY-SAFETY-M0-SUCCESSOR-20260825`。
3. 每次调用都由 authority 以冻结 timeout 重跑以下九项：backend full pytest、Packet 01 focused pytest、
   exact9 Ruff、exact9 byte identity、product-authority regression、Root Harness、Harness Doctor、
   EXT V2 convergence check、EXT V2 convergence regression。
4. 每轮保存完整 JSON 结果到仓库外证据目录，至少含轮次、exit code、candidate SHA/tree、approval digest、
   evidence digest 和执行时间；仓内保持 clean。
5. 只有 10/10 均为 `PASS / CANDIDATE_ELIGIBLE_FOR_OWNER_ACCEPTANCE`，且 candidate SHA/tree 与 approval digest
   全部相同，才可声明最终验收候选成立。任一失败、字节/配置/验收流程变化或远端漂移都从第 1 轮重计。

本 Packet 只修改后端 exact9；不存在前端产品差异，因此不虚构“前端离线主链”作为本 approval 的证明。
跨前端、浏览器、真实模型、发布包或外部 supervisor 验收属于独立 Packet。

## Phase 5 — Owner Acceptance And Delivery

1. 向 Owner 提交精确 candidate SHA/tree、canonical approval digest、10 个 evidence digest 和独立复审结论。
2. Owner 按这些身份明确接受 candidate；候选创建不自动授权 push。
3. 若另获 push 授权，只普通 fast-forward 推送精确 candidate，不夹带后继提交。
4. merge、pilot、release 和 deploy 均不属于本 Task，并继续需要各自独立 authority。

## Later Packets — Excluded From This Authority

以下价值已完成只读审计，但必须使用独立任务和 authority：

- legacy import-cycle 修复及双向 import-order 测试；
- `origin/dev@6332d597b` 的真实会计源表/勾稽子集；
- 受控 Excel/PDF renderer 内核；
- single-pass acceptance 治理；
- protected supervisor 与 release-execution。

禁止把这些内容混入 Packet 01 exact9。

9bf Four-Gate 工作包已经因自身 base drift 条件进入
`DRAFT_NON_AUTHORIZING_STOP / TERMINATED_BY_BASE_DRIFT / TASK_LOCAL_STOP / AUTHORITY_NOT_INHERITED`；
它仅保留为审计证据，
其未实施 consumer 不参与本 M0，本 successor 不继承或重开其 authority。

## Stop And Rollback

远端漂移、第十路径、authority STOP、矩阵/轮次失败、候选身份漂移、工作树污染或新 P0–P2 均立即停止。
回滚只允许未来新候选整提交 revert，并需独立授权；不得 reset、force-push 或局部回退。
