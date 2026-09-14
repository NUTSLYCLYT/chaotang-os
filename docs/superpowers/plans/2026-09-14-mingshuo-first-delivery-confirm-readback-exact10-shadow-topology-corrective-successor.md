# Mingshuo First Delivery Confirm/Readback exact10 Shadow Verification Topology Corrective Successor Plan

Task: `MINGSHUO-FIRST-DELIVERY-CONFIRM-READBACK-V1-EXACT10-SHADOW-TOPOLOGY-CORRECTIVE-SUCCESSOR-20260914`

Base: `d25e301e29bc8cec16b8eabf86d5be12d7737793 / 55d392bd61b4496c0fecd27e4182321a1c8670ef`

Status: `DRAFT / NON_AUTHORIZING / READY_FOR_OWNER_CONFIRMATION`

## Objective

不改变产品范围或 readiness policy，只纠正前序 approval 对现行 closed-pair 失败拓扑的错误假设：exact10 shadow 的同一未知 ordered pair 必然触发两个指定 readiness 节点。新 successor 必须只接受这两个节点，完成产品三审并冻结后续 exact2 prerequisite 所需的真实身份；本轮仍不形成产品 candidate。

## Frozen Boundary

- Approval paths：正式 Approval、Task、Plan 三文件；proposed 临时文件只作为物化 donor，不进入提交。
- Machine authority：唯一受控 lifecycle-controller 进程直接启动唯一一次 `--authorize`，严格解析唯一 JSON 行，将 task、GO、`canExecuteProductWork=true`、approval digest及同一流程读取的 approval commit/remote HEAD冻结在不可由子命令覆盖的进程内状态；再从该 commit object读取正式 approval并重算 canonical digest。每条 shadow verification 前后都必须机械比较当前 HEAD、实时 remote与冻结 GO commit，并复算 commit object中的正式 manifest digest等于GO digest。禁止由调用者通过环境变量、工作树临时文件或子命令回显提供期望值。v00c/v12d 额外锁定矩阵端点；v00b/v12c 锁定直接单亲、三治理路径和模式。远端没有单调 ref-history证明，故只声称所有 authority/verification观测点一致，不声称连续区间从未 move-and-return。
- Product paths：原 exact10 十路径，精确 `10 MODIFY / ALL 100644`，无第十一条路径。
- Predecessor：`d25e301e…` 下旧 authority 已由 Owner 处置为 `ABANDONED_BY_OWNER_UNCONSUMED / NO_REANCHOR / REISSUE_REQUIRED`。
- exact10 donor：bundle `sha256:44bf93000c04c6ae647e9439e46928536698e31b176e5efd152c504683ed85ee`；full-index diff `sha256:6d3465289eb9c517e79a38747ea21164b4e6fbf6b867e9ad79b2320437d25d37`；只具 byte-donor 身份。
- Provisional fingerprints：runtime `sha256:9e8729a88bc797c01d59818fb67d852025a9c679fdd7eb6e8fe63f26cbc8d365`；successor `sha256:6b9521165b821729a3548f3535b90c30aab9b874c81b1b1b437bb5af64d06e34`；三审前不得授权 pair。
- Readiness policy：现有十三 pairs、四 exclusions、69/65 counts、historical review identity、两条 successor-content paths和 `path + NUL + bytes + NUL` 算法全部不变。

## Exact Failure Contract

Backend-full 必须自然结束且 exit code 为 1；结构化包装器必须精确得到以下有序失败集合：

1. `tests/test_six_ministry_readiness_report.py::test_readiness_evidence_is_bound_to_current_implementation`
2. `tests/test_six_ministry_readiness_report.py::test_successor_content_rejects_third_state_drift`

必须精确观察 `5164 passed, 4 skipped, 5 warnings, 2 failed`，并从 pytest 在唯一 POSIX 临时目录生成的 JUnit XML 结构化确认 `5170 tests / 2 failures / 0 errors / 4 skipped`，将 pair-membership assertion 与 successor-fingerprint membership assertion分别绑定到对应 testcase 的 failure element；不得依赖可提前注入的 stdout/stderr 文本切片，不得接受 deselect/xfail/xpass/rerun、第三 failure、ERROR、timeout、输出截断或意外全绿。Root Harness 仍只允许现有单一 readiness diagnostic，因为它按能力族汇总而不是复制 pytest 节点数。

## RED To GREEN

1. 保留前序真实验证证据：focused `234 passed`、Ruff PASS、backend-full `5164 passed / 4 skipped / 2 readiness failed`；不得把旧结果冒充新 successor 的通过证据。
2. 新 machine GO 后，唯一 controller 在进程内冻结并机械绑定 authority JSON、GO commit、实时 remote与commit-object manifest digest，再从 donor逐文件重物化 exact10；v00/v00a/v00b/v00c 在运行其他测试前证明当前 HEAD 是冻结 base 的三治理文件直接单亲子、精确等于实时 `origin/ext-dev`，并机械拒绝任何暂存、未跟踪、exact10 外、增删改名复制、mode/submodule 漂移，核对十文件 raw/blob/mode/bytes、bundle与 full-index diff。controller 在每条后续验证前后重复 GO identity比较。
3. 重新运行确认/归档/下载/readback 的正向、跨租户、非确认终态、重复、并发、commit-then-error、当前证据过期、文件/回执/档案篡改与 generic-boundary 负向测试。
4. 只纠正验证包装器，不修改两个 readiness validators。完整 backend 从“不允许的两个失败”变为“由新 approval 精确声明的两个闭集失败”，这不是把产品 RED 改绿，也不是 readiness 通过。
5. 完整矩阵末尾再次执行同一 exact10 范围与身份锁；三审后机械重算 exact10 bundle、diff、evidence digests与两个 fingerprints。如任一路径、模式或产品字节改变，全部旧摘要和验证失效并重新运行。

## Verification Matrix

- Live remote、approval commit direct-parent、三治理路径、模式与 canonical/raw/bundle identity。
- 外部 lifecycle-controller 在每条 verification 前后锁定冻结 GO task/digest/commit、当前 HEAD、实时 remote及commit-object正式 manifest digest；v00/v00a/v00b/v00c 与 v12a/v12b/v12c/v12d 再在矩阵端点锁定 approval HEAD 的 base/tree/直接单亲/三治理路径身份、实时 `origin/ext-dev == HEAD`，以及 exact10 唯一路径集合、未暂存 `10 MODIFY / ALL 100644`、零未跟踪/暂存、raw/blob/bytes、bundle与 full-index diff；v01 focused；v02 以 JUnit XML 精确计数且逐 failure element 绑定 assertion；v03 exact10 Ruff。
- v04 Harness single readiness diagnostic；v05 self-test；v06–v08 Doctor/hook。
- v09 process-local POSIX temp authority regression；v10–v11 V2 check/tests；v12 diff check。
- Governance Review 检查 predecessor disposition、no-reanchor、验证拓扑与后续 prerequisite顺序。
- Python Review 检查 transaction recovery、tenant isolation、idempotency、file/archive identity、异常映射与测试覆盖。
- Security Review 检查专用/通用 API 边界、未确认态、篡改、凭据/路径泄露、fail-closed 和第二事实源风险。

## Execution Order

1. 严格校验并冻结三文件治理草案，修正首轮及第二轮 Security Review 的范围锁、current-HEAD lineage 与结构化失败拓扑发现，完成独立复审，返回唯一 Approval RFC 8785 canonical digest。
2. Owner 精确确认 digest后，物化正式 approval，创建 `d25e301e…` 的三文件直接单亲治理提交并普通快进；任何远端漂移立即 STOP。
3. 在全新干净 authority工作区由唯一 lifecycle-controller 进程运行一次 machine authority；STOP 不得重试或规避。controller严格解析唯一 JSON，冻结task/decision/执行权/digest/commit/remote于自身内存，从commit object重算正式manifest digest，并在每条shadow验证前后比较当前HEAD与实时remote；不生成可伪造的进程环境receipt。子验证命令不得写回或覆盖这些期望值。
4. GO 后在唯一 detached shadow byte-for-byte 重物化 exact10，运行完整矩阵和独立 Governance/Python/Security 三审。
5. 三审 GO 后冻结 exact10与唯一 proposed pair，立即停止；不创建 candidate commit、不 verify-candidate、不 push产品字节。
6. 另立 readiness exact2 prerequisite；落地后基于最新 ext-dev重签 exact10并全量复验，才可形成真正产品 candidate。

## Stop Conditions

任一 authority 或逐项验证观测点的远端漂移、machine STOP、唯一 authority JSON 缺失或 task/decision/执行权/approval digest不匹配、冻结 GO commit与当前HEAD/实时remote不一致、commit-object正式manifest digest与GO digest不一致、approval HEAD 非冻结 base 的直接单亲子或包含三治理路径外变更、任何暂存/未跟踪/第十一条路径/增删改名复制/mode/submodule 漂移、donor raw/blob/bytes/bundle/full-index diff漂移、JUnit 计数/node/failure element/assertion 归属漂移、完整 backend 计数漂移、除指定两项外的任何 failure/error/timeout、Harness diagnostic变化、validator或readiness policy变化、独立审查 P0–P2、第二 authority/事实源、candidate commit/push、force-push、Pilot、Release或生产部署请求均立即停止对应链路。两次观测间move-and-return不在当前远端可证明范围内，不得对其作连续历史声明。

## Rollback

本轮草案未提交时可直接保留为治理证据，不改变远端。正式 approval若未来落地，其撤回只能通过新的 forward-only corrective successor；禁止删除 donor、改写历史或 force-push。Shadow 本身不提交，停止时只保留隔离工作树和摘要证据。
