# 任务：M0 单 Owner 产品机器权威

> Task ID：`M0-SOLO-OWNER-PRODUCT-AUTHORITY-20260816`

## Status

Implemented

## Product Definition

- 用户确认：Owner 于 2026-08-16 确认 base/tree、13 条 exact paths、状态机、非目标和验证矩阵；
  G1 corrective 并发落地后，又明确批准以其远端提交为新基线重建同一范围的 M0 候选。
- 问题：聊天批准、任务文档或测试 PASS 仍可能被普通 implementer 误读成产品 GO；旧
  `execution-authority.ext.v1` 依赖当前不存在的 HSM/checkpoint/platform proof，且永不授权产品施工。
- 目标：建立比例化 `product-authority.m0.v1`。Owner 先确认 closed approval manifest digest 并让
  approval commit 独立落地；consumer 才能授权其精确单亲子产品施工，并在候选完成后机械验收。
- 用户价值：产品开工绑定唯一 task/base/path，路径扩大、陈旧基线、自授权同提交和漏跑验证机械失败。
- 非目标：不修改 ADR 0028、旧 ext authority、产品、CI、数据库、外部平台；不创建 HSM、私钥、lease、
  本地授权 ledger 或真实 approval；M0 候选本身不产生产品 GO。

## Frozen Identity and Allowed Paths

- Base：`911124eb6f5acdb9896d5c26c2e607ed3a4d30ce`
- Base tree：`e16c33dc45eb1d1e19be839fbbd21e0d405cae9c`
- Branch：`codex/m0-solo-owner-product-authority-rebased-20260816`
- Exact paths：
  1. `AGENTS.md`
  2. `.harness/agents/project-owner.md`
  3. `.harness/rules/project-boundaries.md`
  4. `.harness/contracts/project-harness.schema.json`
  5. `.harness/contracts/product-approval.schema.json`
  6. `.harness/manifest/project-harness.json`
  7. `scripts/harness-doctor.mjs`
  8. `scripts/harness-doctor.test.mjs`
  9. `scripts/product-authority.mjs`
  10. `scripts/product-authority.test.mjs`
  11. `scripts/check_harness.mjs`
  12. `docs/product/tasks/2026-08-16-m0-solo-owner-product-authority.md`
  13. `docs/superpowers/plans/2026-08-16-m0-solo-owner-product-authority.md`

## Authority State Machine

1. M0 implementation lands with `CONSUMER_AVAILABLE / APPROVAL_NONE / STOP`.
2. Future Owner confirms an exact manifest digest; its approval commit records `APPROVED_FOR_ONE_CHILD`.
3. `--authorize --task <id>` requires the clean approval commit to remain exact Gitee `ext-dev` head.
4. Product candidate is that commit's exact single child and cannot change governance/Harness/authority paths.
5. `--verify-candidate --task <id>` runs shell-free commands and emits digest-only evidence.
6. Owner separately confirms candidate SHA/tree and Git external actions; consumer never pushes or merges.

## Acceptance Criteria

- [x] Approval schema and JS validator are closed and reject unknown/duplicate/unsorted/unsafe fields and paths.
- [x] Approval commit binds repository, branch, request base/tree, exact approval paths, product paths, non-goals and tests.
- [x] Product paths cannot include root governance, authority, Harness, CI or ADR 0028.
- [x] `--authorize` returns product true only at a clean exact approval commit that remains remote `ext-dev` head.
- [x] Candidate must be the exact single child with exact product diff; merge, expansion, deletion or mode drift fails closed.
- [x] Verification supports only fixed `node/npm/python3` executables, `shell:false`, timeout and digest-only output.
- [x] Caller cannot replace the built-in remote-head verifier; direct API and CLI use the same fixed remote check.
- [x] Every verification command is bracketed by exact candidate HEAD/clean-worktree checks; moving/restoring HEAD fails.
- [x] Paths reject ASCII control characters; root/line agent entries, ADRs and current authority docs are protected.
- [x] Root doctor observes only M0 `--status`; M0 implementation has no approval and remains product STOP.
- [x] Existing Harness, doctor, ext authority, hook and product-flow regressions remain green.
- [x] Exact 13 paths and frozen verification protocol are enforced; final handoff withholds PASS without 10 clean rounds.
- [x] Main-session code/security review closed Critical/Important and reports `NO INDEPENDENT REVIEW`.

## Delivery Constraints

- Only the 13 frozen paths may change; product, provider, browser, database and platform behavior are out of scope.
- No real approval manifest, product candidate, external signer, Gitee policy mutation or production data is used.
- No commit or push until the frozen candidate is reported and Owner gives the corresponding exact Git authorization.
- Rollback is one M0 governance commit; old ext authority and G1 observation remain independently usable and STOP.
- M0 落地后默认冻结 Harness；Deferred G2 不是 H1 前置。除新安全事故或 Owner 另行决策外，下一项
  施工应是由独立 approval commit 精确授权的户部 RichMemorial。

## Affected Modules

- 模块：Root observation manifest、M0 approval contract、product authority consumer 与 Harness registration。
- 允许路径：仅 Frozen Identity and Allowed Paths 列出的 13 项。
- 依赖模块：Git immutable object model、Gitee `ext-dev` remote identity、Node child process/crypto；旧 ext
  authority 只复用严格 JSON/canonical digest helper，不改变其 namespace、CLI 或 STOP 语义。

## Technical Plan

- RED→GREEN order: consumer contract/tests → root observation projection → Harness registration → security review.
- Consumer reads immutable Git objects with replace refs disabled, rejects dirty/shallow/wrong-remote repositories and
  rechecks worktree after verification commands.
- Gitee branch head is the proportional concurrency/revocation boundary: movement away from the approval commit makes
  authorization or verification STOP; no mutable repository ledger is introduced.

## Implementation Report

- 改动摘要：新增 closed approval schema、`product-authority.m0.v1` consumer 与 12 项测试；根 manifest
  登记稳定的 consumer/STOP 事实，doctor 只调用 M0 `--status`；Harness 接受结构化 task approval 文件，
  拒绝旧 control-plane 路径和错误文件名。
- RED→GREEN：证明 consumer 缺失、verification cwd symlink 逃逸、测试期间远端移动、候选 HEAD
  被验证命令改变、调用方注入假 remote resolver、控制字符路径、治理入口路径扩权与文件 mode 漂移；
  逐项最小修复并保留回归。
- 整合：保留 G1 corrective 的 schema canonical identity 与逐段 symlink 拒绝，并让新增的 M0 authority
  observation 复用同一逐段检查；新增回归证明中间 symlink 不能替换 product authority consumer。
- 安全复核：把根/前后端 `AGENTS.md`、`CLAUDE.md`、全部 ADR 与当前 ext root/M0 治理 task/plan
  加入 product path 保护清单，防止未来产品 approval 把治理入口伪装成产品路径修改；普通产品任务文档
  仍可按精确 approval 正常进入产品候选。
- 验证加固：每条 verification command 前后都绑定同一候选 HEAD 并检查 clean worktree；回归覆盖命令
  移走 HEAD，以及两条命令先移走再恢复 HEAD 的规避尝试。authority 公共 API 不接受调用者替换远端
  verifier；approval schema 与运行时同时拒绝路径控制字符。
- 验证：M0 12/12、doctor 10/10、Harness 146/172、ext authority 11/11、hook 3、product-flow 25；
  schema meta-validation 2/2。M0/root/ext status 全部保持产品 false。
- Review：`NO INDEPENDENT REVIEW`；主会话 code/security review 无未关闭 Critical/Important。
- 未运行项：真实 approval、产品、浏览器、provider、生产数据、Gitee policy mutation 和 OS 级 egress
  sandbox 均不属于 M0 实现候选。
- 剩余风险：Owner 会话、OS/Gitee owner 和 runner 是显式信任根；验证命令的外部网络隔离须由后续
  产品任务及执行环境保证，consumer 只限制 tool/args/cwd/timeout、shell 和输出泄露。单条已批准命令
  内部瞬时修改并完全恢复宿主状态仍属于 runner/OS 信任边界，M0 不宣称提供 syscall 级隔离。

## Acceptance Review

- 当前结论：`CANDIDATE / CONDITIONAL PASS / PRODUCT STOP / NO INDEPENDENT REVIEW`。
- 已有证据：RED→GREEN、CLI 本机 bare-remote 纵切、schema、既有 Harness 与旧 authority 回归全绿。
- 待完成：对本文件不再变更后的冻结 fingerprint 连续执行 10 轮，并报告本地候选身份；commit/push
  仍需后续精确授权。

## 2026-09-15 Protected-path Governance Repair

- 状态：`IMPLEMENTED_BY_OWNER_AUTHORIZED_PROTECTED_PATH_GOVERNANCE_REPAIR`；本段不追溯改写 2026-08-16
  的历史候选结论，也不为本次 exact9 自行生成 product authority。
- 同一 `product-authority.m0.v1` 新增 opt-in `product-authority.m0.approval.v2`。历史 v1 approval 保持兼容；
  v2 必须携带 closed `preAuthorizationReceipt`，并在任何 GO 前完成自动 receipt gate。
- receipt gate 不再允许 same-UID helper。现有 authority 只构造 closed approval-source request；root-owned
  credential-separated broker 用 `SO_PEERCRED` 绑定 dedicated controller，在独立 UID、namespace 与
  per-connection cgroup 内执行 sealed runner/controller/verifier，并返回 closed inner/outer receipt。
- source graph 精确为 approval commit、直接 base commit、approval root tree、全部 recursive subtree/blob；
  base tree 只由 base commit body 机械核验，不物化，不允许额外 object、replace ref 或仓库配置覆盖。
- 固定 path-binding record/schema digest 分别为
  `sha256:7ba1eeb23769551d2be58f136c1038e8897f5141755f5a34ac2cf0c39fa0c572` 与
  `sha256:9afc472beb987bfe1c233e61f3247a5f509d52aa37d375f124cb451a3ccdf049`；18 项结果缺失、重复或重排均 STOP。
- v2 GO 的 `evidenceDigest` 绑定 approval、source manifest、challenge、双层 receipt、live peer、service cgroup、
  controller/verifier/runner、remote 与 path-binding；authority 还须确认 worker service inactive、同 cgroup empty。
  stdout 不包含 helper stderr、配置、路径内容、credential、proxy 或 controller/verifier 源码。
- 明确非承诺：不防已控制的 Owner、OS owner、Gitee owner 或整个 runner；不新增第二 authority、第二 Harness、
  HSM、私钥或持久授权状态。仓库实现不等于 installed acceptance；本轮不安装、不启用、不启动服务。
