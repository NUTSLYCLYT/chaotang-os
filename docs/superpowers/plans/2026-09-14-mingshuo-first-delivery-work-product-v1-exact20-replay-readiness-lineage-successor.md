# Mingshuo Work Product exact20 Replay Readiness Lineage Successor Plan

Task: `MINGSHUO-FIRST-DELIVERY-WORK-PRODUCT-V1-EXACT20-REPLAY-READINESS-LINEAGE-SUCCESSOR-20260914`

State: `DRAFT / NON_AUTHORIZING / READY_FOR_OWNER_CONFIRMATION`

Base: `67ce78f164c4b29987ff89ff8a86a437a7a6c96d / d4ad99650e6c3ed86d11bb0a4bcacdcb34111c1a`

## Goal

在 readiness prerequisite 已落地的最新 ext-dev 上，以全新 one-child authority 重新物化并验证 exact20 donor，交付稳定的 PENDING 方案/报价 WorkProduct。不得 re-anchor 旧 authority，不得修改 donor 字节或扩大到确认、下载、归档、V4 回看。

## Lineage Contract

- `a5239e9c…`：前序 exact20 approval lineage。
- `e4b7e4ca…`：replay corrective approval；其未消费 authority 已放弃且不可恢复。
- `2992668c…`：readiness prerequisite 三文件 governance commit。
- `67ce78f1…`：exact2 validators candidate，当前 canonical base。
- 旧 exact20 二十路径：`BYTE_DONOR_ONLY / NO_CANDIDATE_IDENTITY / NO_VERIFICATION_INHERITANCE`。

后续 approval 必须是 `67ce78f1…` 的直接单亲子；exact20 candidate 必须是该 approval 的直接单亲子。任何远端漂移都要求新的 successor，不允许 rebase/re-anchor 现包。

## Frozen Scope

Candidate 精确为 manifest 的二十路径，结构 `2 ADD + 18 MODIFY`，全部 `100644`。二十个目标 blob 由 approval v16 逐项冻结；candidate bundle 必须为 `sha256:4bc4f1e24b9eaa6ed040b1657e9b0337ebb41e0f8f339d5ac1b2953d2bd86589`。

Donor combined diff `sha256:81fa5073e85143fd6ead48ee6feef487b852b5cbd5b14a40451e88f27821da11` 绑定旧 `e4b7e4ca…` 基线，只作 provenance；新 candidate 必须重新计算相对新 approval 的 diff/evidence identity。

## TDD Sequence

### RED — replay container identity

使用可控 XLSX generator 产生业务 binding 相同但 ZIP container SHA 不同的两次结果，证明未修正实现会把第二次合法请求错误判为 409。不得使用 sleep 或 wall-clock 偶然性。

### GREEN — durable stored identity

Byte-for-byte 重物化 donor 后，第二次请求必须通过 owner-scoped durable intent、已存 PENDING artifact 与 WorkProduct 完整校验返回原 identity。新生成 ZIP SHA 不参与 replay durable identity，但首次创建和已存文件实际 SHA 仍必须严格验证。

### NEGATIVE — fail closed

逐项验证 tenant/owner/project、Fact Pack version/digest、binding、cell projection、artifact/work-product ID 与 digest、saga state、stored metadata/file、OOXML、source hashes、API content type 和错误映射；任何漂移不得生成第二份成果物、跨租户读取或泄漏内部路径。同进程线程并发必须返回同一 identity。验收运行时精确限制为单 Python 进程；多 worker/多进程不获本包授权，也不产生任何已验证声明，后续如需支持必须另立 successor 与确定性竞争测试。

## Verification Matrix

1. focused Mingshuo/ArtifactStorage/report/readiness/sqlite suites。
2. `TMPDIR=/tmp TEMP=/tmp TMP=/tmp` backend-full。
3. exact20 Ruff。
4. root Harness 与 self-test。
5. Doctor check/tests 与 hook self-test。
6. process-only POSIX temp 下 product-authority regression。
7. V2 check/tests。
8. offline build/verifier/RC1 tests。
9. `git diff --check`。
10. 三审 GO、候选身份冻结且 Owner 精确授权后，创建 approval 的直接单亲本地 candidate commit。
11. 对已提交 candidate 运行 v16 exact20 frozen-donor preimage 和 machine `--verify-candidate`；只有 PASS 且具备明确 push 权限时才普通 fast-forward。

任何 candidate 字节变化都会使旧测试与审查证据失效，必须完整重跑。

## Independent Reviews

- Governance Review：新 lineage、no-reanchor、exact20 allowlist、2A+18M、20 blobs、non-goals 与 STOP 条件。
- Python Review：replay/恢复/同进程线程并发事务语义、单进程运行边界、ArtifactStorage 只读核验、确定性测试与异常映射。
- Security Review：tenant/owner isolation、stored file/hash/binding tamper、OOXML/formula 防护、错误与日志泄漏。

任一 P0–P2 为 NO-GO。

## Rollback Boundary

正式 approval 前只需保留/丢弃隔离草案，不影响产品或远端。candidate 未推送前只保留隔离候选；普通 fast-forward 落地后如需回退，必须另立 forward-only successor，禁止改写历史或 force-push。

## STOP Conditions

- Gitee 远端不再精确为批准基线；
- machine authority 或 candidate verification STOP；
- donor、path/status/mode/blob/bundle 任一漂移；
- 出现第二十一条产品路径或 readiness/Harness/authority 变更；
- RED 不可控或修复依赖跳过 stored file SHA、owner/run/binding/WorkProduct 校验；
- 关键验证失败或独立审查出现 P0–P2。

本计划不授权正式 approval 物化、authority、产品实施、测试、commit、push、Pilot、Release 或生产部署。
