# Packet 01 — Readiness Compatibility Prerequisite Validator Successor

任务 ID：`PACKET-01-READINESS-COMPATIBILITY-PREREQUISITE-VALIDATOR-SUCCESSOR-20260826`

冻结基线：`eb1469b9a9e04804d218ec2840bf3b1f9630217f`

冻结基线 tree：`61baa914ab5a121b4c584fb8f702cb46d9d4dfff`

> 治理状态：`DRAFT / NON_AUTHORIZING / READY_FOR_OWNER_CONFIRMATION`
>
> 本 Task 只冻结新的 forward-only validator successor 治理合同。它不修改、重物化或授权两个
> validators，不继承旧 donor 的 candidate、验证、通过或 authority 身份，也不授权 commit、push、Pilot、
> Release 或部署。

## Status

Draft

细分状态：`NON_AUTHORIZING / READY_FOR_OWNER_CONFIRMATION / VALIDATOR_BYTES_NOT_REMATERIALIZED`

## Product Definition

旧 readiness validator candidate 因其 approval base 上存在确定性的产品任务合同冲突而停止。该冲突已由
forward-only corrective successor 修复并以普通 fast-forward 落地到 `origin/ext-dev@eb1469b9…`，旧 lineage
Task 当前正式状态为 `Blocked / HISTORICAL_EVIDENCE_ONLY / NO_REANCHOR`。旧双 validator 工作区仍只是一份
保全完好的字节来源，不具有可恢复身份。

本 successor 的产品定义是：在最新 `ext-dev` 上重新签发一份独立、最窄、只绑定两个 readiness validators
的治理合同；未来获得独立批准后，才允许把 donor 两文件 byte-for-byte 重物化到新基线，重新证明第四个
ordered compatibility pair 的负向、GREEN、完整矩阵与双审。当前草案不执行这些产品步骤。

## Lineage And Donor Evidence

旧 donor 工作区：

`/home/ubuntu/Projects/chaotang-os/.worktrees/packet01-readiness-compatibility-prerequisite-lineage-successor-candidate-20260826`

- donor base：`67cb1816dafcbf1558a0ff227dc3886fae02795e`；
- donor base tree：`f672064439355715e5616d61eee9d872297130ce`；
- disposition：`BYTE_DONOR_ONLY / NO_CANDIDATE_IDENTITY / NO_VERIFICATION_INHERITANCE`；
- modified paths 精确为两个 validators；
- 两文件模式均为 `100644`；
- donor bundle：`sha256:6e82e7d29c2afdb1f7fcad8fdb9dc9b99a17a823ea229802a4a81085e47eb32c`；
- combined diff：`sha256:25b1771fcda4a6f048108a632661aea06971587d982edc7e6d743058a318b90d`。

从 donor base 到当前 base 的完整 ancestry 精确为：

1. `67cb1816…` → `1e937ddc…`：新增三份 governance-contract corrective successor 治理文件；
2. `1e937ddc…` → `eb1469b9…`：只修改旧 lineage successor Task，使正式 Status 成为 `Blocked` 并补齐合同章节。

两步均为直接单亲提交，全部 changed paths 都是治理文档，与两个 validator candidatePaths 零重叠。因此
donor 字节可以作为未来新 candidate 的精确输入，但旧 approval、candidate 与验证身份不能跨 lineage 继承。

## Acceptance Criteria

- [x] 新 base 精确绑定 `eb1469b9… / 61baa914…`。
- [x] donor 两路径、raw SHA、Git blob、模式、字节数、diff 与 bundle 已机械冻结。
- [x] `67cb… → 1e937… → eb1469…` 单亲 lineage 与 changed paths 已机械记录。
- [x] intervening changes 与两个 validators 的重叠精确为零。
- [x] existing three pairs、第四 ordered pair、四 exclusions、`69 / 65` 与 exact10 身份保持冻结。
- [x] 新 Task 自身满足当前 `productTaskErrors` 合同。
- [ ] Owner 确认本三文件 canonical/raw/bundle 后，另行授权 approval commit 与 push。
- [ ] 新 approval 落地后，byte-for-byte 重物化 donor 两文件并重新完成全部验证与双审。

## Delivery Constraints

- 当前只允许创建和校验本 Task、packet 与 Plan 三份新治理文件。
- 不修改旧 Task、旧 governance、两个 validators、P01 exact10、Harness、authority、API、数据库或产品代码。
- 不物化 `.harness/approvals/`，不运行产品测试或 authority。
- 不 commit、push、merge、rebase、fetch、pull 或 force-push。
- 当前状态始终为非授权草案；任何远端漂移、第四条草案路径、身份不一致或独立审查 P0–P2 立即 STOP。

## Affected Modules

- 模块：P01 readiness compatibility prerequisite validators（future successor scope）
- 允许路径：`backend/tests/test_six_ministry_readiness_report.py`、`scripts/check_harness.mjs`

上述两条路径只是未来 successor candidatePaths。本轮治理草案的实际写入范围仅为三份新治理文件。

## Technical Plan

1. 冻结最新 `ext-dev` base、donor 双文件身份、两步单亲 lineage 与零重叠证明。
2. 创建只含三份新治理文件的 non-authorizing successor package。
3. Owner 确认摘要后，分别授权本地 approval commit 和普通 fast-forward push。
4. 从落地的新 approval commit 创建唯一 candidate 工作区；只能有一个 validator 字节写入者。
5. 从旧 donor 工作区 byte-for-byte 重物化精确两文件，不继承旧 candidate 或验证结论。
6. 重新证明：现有三 pair 原样同序、只追加唯一第四 pair、集合差 `+1/-0`、总数 `4`，并拒绝单边、
   混搭、篡改、未知状态、第五 pair、第五 exclusion 与 Python/Node 策略分叉。
7. 重新运行 readiness、backend-full、Harness、doctor、hook、authority regression、V2 convergence、
   `git diff --check` 与独立双审；candidate commit/push 分别等待 Owner 授权。
8. validator candidate 落地后，再基于最新 ext-dev 重新签发 P01 Corrective Successor。

Product-authority regression 必须仅对该验证进程设置 `TMPDIR=/tmp`，以避免 Windows `v9fs` 临时目录的
`core.filemode=false` 环境合同不匹配；不得持久修改系统、用户、Git 或 Node 配置。

## Frozen Compatibility Contract

现有三个 ordered pairs 必须原样、同序保留：

```json
[
  ["sha256:013bfb8272e936be85c2d470033787c3b7f105ad6eae2dfe680373df023b5e69", "sha256:709ebaf18862a4c2d78422756ca1e353eeb8dd5925c624ee74d9ebdaf43cc924"],
  ["sha256:c95630be3d79f2641ff6e483f4096b0763b9e5071544f1e0ead0d7e24eb1cba5", "sha256:268cab13e516d0f716f600819f2bddc8242269312d392eca4ed1be2de05ce051"],
  ["sha256:d330b7f177f5bbb761eb359ffffca6f12250e5bbe90d13d0414d0fdefb78e98a", "sha256:709ebaf18862a4c2d78422756ca1e353eeb8dd5925c624ee74d9ebdaf43cc924"]
]
```

唯一允许追加的第四 ordered pair：

```json
["sha256:da31e8098bf76c72ff8d00b073d86e3442b0811223ef3e3bab770af31e89c28e", "sha256:709ebaf18862a4c2d78422756ca1e353eeb8dd5925c624ee74d9ebdaf43cc924"]
```

四项 exclusions、historical file count `69`、runtime-content file count `65`、historical review status
`approved-with-notes`、historical reviewed fingerprint、两条 successor-content paths 和 exact10 bundle
`sha256:df3bb9e9d099433468191457b9e554dc59980aea45724f2bedb4b628305b400a` 均不得改变。

## Implementation Report

- 已完成：远端基线、三个保全工作区、donor 双文件身份、单亲 lineage、changed paths 和零重叠冻结。
- 已完成：三文件 successor 草案及非授权执行顺序设计。
- 未完成：Owner 摘要确认、approval commit/push、validator 重物化、产品验证、candidate commit/push、
  P01 successor、Pilot 或 Release。
- 当前结果：`DRAFT / NON_AUTHORIZING / READY_FOR_OWNER_CONFIRMATION`。

## Acceptance Review

本 Task 只有在 strict JSON、无重复键、`productTaskErrors=[]`、完整 Harness、精确摘要和独立 Governance /
Security Review 均无 P0–P2 后，才可提交 Owner 确认。即使审查 GO，也不自动授权 approval、validator
重物化、candidate、commit、push、Pilot、Release 或部署。
