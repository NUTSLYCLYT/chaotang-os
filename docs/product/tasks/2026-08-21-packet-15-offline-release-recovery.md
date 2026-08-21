# Packet 15 — Offline Release / Recovery Runtime M0 Task

> 状态：`M0_AMENDMENT_CANDIDATE / NOT_LANDED / PRODUCT_STOP`
>
> Task ID：`PACKET-15-OFFLINE-RELEASE-RECOVERY-V2-20260821`

## 1. Authority boundary

本任务只定义 P15 的修订单亲产品施工边界。旧 M0 在首轮候选验证中暴露了 writer-stop 时序与
runtime test closure 两个不可同时满足的合同循环，因此旧授权不得继续使用。Owner 尚未接受本 amendment
manifest digest，也未授权 amendment commit/push；当前产品 authority 必须继续 `STOP`。修订合同必须先以
独立 governance evidence commit 落到 `ext-dev`，随后 approval 三件套以该提交为 base 成为新的精确头，
机器才可授权唯一产品 child。候选接受、产品 push、外部构建网络、Docker、部署、生产备份和恢复均需后续独立决定。

固定身份：

- Repository：`gitee.com/msxn/chaotang-os`
- Target：`origin/ext-dev`
- Base commit：`be2ae54a3c6ee571b558c37f67ab051ac3830c91`
- Base tree：`8f0b136a0e6a273bb8cdfc22bb99094180d70fdd`
- Reviewed contract：`docs/migrations/2026-08-21-packet-15-offline-release-recovery-contract.draft.md`
- Contract SHA-256：`aa88b6deed3273f72e40aaf10731a267e99b529d792d7ded45a26471a58b4fc8`
- P09-A schema SHA-256：`250d2c7df7f4c8f53b4198e8b7a72c0ebf106b3e32a89dee172b5a56657b1fa6`
- P09-A verifier SHA-256：`f001d50ef4c03bb16aaf51f91531b78651121147cb2ee9e78af9a8a24f8f1e99`

## 2. Product objective and value

把 ext-dev 从“服务能启动”提升为“被批准的代码可复现、七个 SQLite 运行库可一致备份、备份可在新空目录恢复、
离线发布包可验真、部署形状符合 loopback 单机合同”。用户由此能在上线测试前证明运行版本、数据恢复点、
依赖锁、镜像与回滚身份一致，而不是依赖健康页、浮动镜像或手写 PASS 日志。

P15 不增加发布控制台或第二流水线，不执行生产部署、生产停写、生产备份或生产恢复。

## 3. Closed implementation scope

产品 child 只能修改 approval manifest 中按字典序冻结的 26 条路径。实现必须包含：

1. 七库 closed runtime-data registry 与 readiness 共用 digest；
2. `ONLINE_PER_DATABASE` 与 `COLD_RELEASE` SQLite backup、verify、new-root rehearse；
3. backend runtime lock、BUILD/RUNTIME/TEST 三闭包与标准库-only 离线 wheel verifier；
4. ADR 0041 的 loopback 单 backend 部署合同；
5. provisional/final offline bundle builder、包外 expectation verifier 与 RC1 合成 runner；
6. P09-A evidence schema/verifier 的精确绑定，且所有输出保持 nonauthorizing。

历史 donor `dd28a1c133f0c0327086ded8006998d22163f1bd` 只作语义参考；不得 merge、cherry-pick、复制整树、
复用脏 worktree 或预制 PASS 日志。

## 4. Required RED evidence

取得机器施工 GO 后，先以合同 18 个固定节点建立 RED。必须证明：缺 backup/registry/lock/builder/verifier/runner；
旧 deployment checker 错误接受 80/443 + domain/TLS；旧 donor 漏 `runtime_bindings.sqlite3`；所有路径、SQLite、
WAL、artifact、timeNano、writer-stop、wheel、ZIP、bundle、expectation、DNS/TLS、Docker、authority 与回滚边界失败关闭。

RED 不得通过删除旧测试、降低严格性、使用网络/daemon/生产数据、扩大 allowlist 或把 NOT_RUN 写成 PASS 获得。

## 5. Acceptance

产品 candidate 只有同时满足以下条件才可交 Owner：

1. approval commit 仍是 Gitee `ext-dev` 头，candidate 是其精确单亲子；
2. diff 严格等于 26 条 allowlisted paths，无治理、ADR、CI、业务 API、页面或数据库 schema 变化；
3. 18 个固定节点及正负向 fixed vectors 全绿；
4. 七库 registry/readiness/backup/release manifest digest exact，未知/敏感 entry 失败关闭；
5. backup 只写新空目标，cold stream 覆盖 capture + pre-manifest content verify；standalone verify/rehearse
   持同一 rollout lock并重验 writer identity，rehearse 不提供原地覆盖；
6. runtime lock 的 BUILD/RUNTIME/TEST closure、root-owned wheelhouse、loopback compose/Caddy、offline
   bundle/expectation 与 P09-A exact；
7. M0 verification 本身零网络、零 Docker daemon、零生产路径；wheelhouse 只允许由候选身份锁定后的
   独立只读网络任务预置，candidate 只读消费；外部 disposable-host 验收另行授权；
8. 后端/前端全矩阵、Ruff、lint/typecheck/build、V2、Root Harness/doctor 与独立 code/Python/security/release review 全绿；
9. `node scripts/product-authority.mjs --verify-candidate --task PACKET-15-OFFLINE-RELEASE-RECOVERY-V2-20260821`
   返回 `PASS / canAcceptProductCandidate=true`；
10. Owner 另行确认最终 candidate SHA/tree 和任何产品 push。

## 6. Rollback

候选未部署前只能回退该唯一产品 child。P15 不执行数据 schema migration，也不自动 restore。部署后回滚必须消费
previous immutable release 与匹配的 `COLD_RELEASE` backup，并另行取得生产 authority。P14/P11 等后继提升
registry schema 后必须保留其 strict floor，禁止启动不认识新 registry digest 的旧 P15 image。

## Status

Draft

## Product Definition

规范性产品是 closed runtime-data registry、安全 SQLite backup/rehearse、可复现 runtime lock、loopback 部署合同、
offline bundle verifier 与合成验收 runner；不是部署平台或生产恢复器。

## Acceptance Criteria

- [ ] 本文第 4–5 节全部成立，approval verification matrix 全绿，candidate 通过精确单亲子校验。
- [ ] code/Python/security/release 独立复审无 P0/P1，Owner 另行确认最终 candidate SHA/tree。

## Delivery Constraints

只允许 manifest 的 26 条产品路径；不修改业务 API、页面、数据库 schema、Harness/authority/CI/ADR。
M0 verification 不运行网络、Docker daemon、生产备份、恢复、部署、上传或 push，只可从已批准的
root-owned wheelhouse 执行隔离 candidate build/test。

## Affected Modules

- 模块：运行数据登记/readiness、SQLite backup/rehearse、runtime lock、Docker/Compose/Caddy、offline release tools。
- 允许路径：严格等于 approval manifest `request.productPaths` 的 26 条路径。
- 非目标：业务行为、第二控制面、P09-B、P14/P06、生产基础设施与任何真实 secret。

## Technical Plan

以 `docs/superpowers/plans/2026-08-21-packet-15-offline-release-recovery.md` 为规范施工顺序：
authorize → RED → registry/backup → lock/images → bundle/verifier → runner → full verification → handoff。

## Implementation Report

首轮产品候选已完成 registry/backup/deploy/release 基础实现与大部分矩阵，但独立复审确认旧 M0 的
writer-stop 时间链和 TEST tooling closure 不可施工。已完成的代码保留为未提交候选，必须在本 amendment
落地后重放到新的精确单亲 child；当前没有产品 commit/push。

## Acceptance Review

当前为 `PENDING_OWNER_M0_AMENDMENT_DECISION / PRODUCT_STOP`。本文件不授权 amendment 提交、产品施工、
产品提交、推送或部署。
