# Packet 09-A — Release Evidence V2 M0 Task

> 状态：`M0_APPROVAL_CANDIDATE / NOT_LANDED / PRODUCT_STOP`
>
> Task ID：`PACKET-09A-RELEASE-EVIDENCE-V2-20260821`

## 1. Authority boundary

本任务只定义发布证据 v2 的 schema 与只读 verifier。Owner 尚未接受本 M0 manifest digest，也未授权
approval commit/push；当前产品 authority 必须继续 `STOP`。只有三件套成为 `origin/ext-dev` 精确头后，
机器才可对它的唯一单亲产品 child 授权。P09-B 最终发布回执、产品 push 与部署均是后续独立决定。

固定身份：

- Repository：`gitee.com/msxn/chaotang-os`
- Target：`origin/ext-dev`
- Base commit：`17d6be6538bfbfeeaf5c6fa13eee5d09dd1208a9`
- Base tree：`03eaa2218429c9b25ee88fda02c5e648a5ea632a`
- Reviewed contract：`docs/migrations/2026-08-21-packet-09-release-evidence-contract.draft.md`
- Contract SHA-256：`27728301f51c7fe7bd929d99b45de86c76807b4c9c5eba22e7e42b0e18e8acc5`

## 2. Product objective and value

建立一个封闭、内容寻址、失败不冒充通过的发布证据格式和只读验证器。它让后续 P15、P14、P06 与
真实浏览器验收可以证明同一 commit/tree、同一命令、同一产物和同一回滚点，避免旧日志、手写“全绿”、
NOT_RUN、mock 或仅健康页 200 被当成上线证明。

P09-A 不运行命令、不生成最终 release receipt、不部署；它只定义如何观察、规范化和验证证据。

## 3. Closed implementation scope

产品 child 只能新增 approval manifest 中按字典序冻结的三条路径：

1. `docs/contracts/release-evidence.v2.schema.json`
2. `scripts/release-evidence.mjs`
3. `scripts/release-evidence.test.mjs`

schema 与 verifier 必须实现合同第 6–9 节的 closed JSON、RFC 8785、digest、自引用排除、collection order、
command registry、redaction/result receipt、artifact/storage/browser/review/rollback/conclusion 和预算边界。
工具只读，不运行 pytest、浏览器、Docker、备份、构建、网络、上传、提交、推送或部署。

## 4. Required RED evidence

取得机器施工 GO 后，先在 exact base 新增测试并证明合同 15 个固定节点为预期 RED：缺 schema/verifier、
旧报告不可升级当前 PASS、blocked source 不可读取、严格 JSON/路径/隐私拒绝、identity/check/registry/
artifact/browser/review/rollback/conclusion/P15/authority 三段分权均失败关闭。随后以相同节点转 GREEN，
不得删除、改名或放宽断言。

固定向量还必须覆盖 structured digest wrapper、数组重排、duplicate id/ref、跨对象 splice、计数恒等、
stdout/stderr 双 receipt 角色、目录预算和 v2 无伪 rollback receipt。

## 5. Acceptance

产品 candidate 只有同时满足以下条件才可交 Owner：

1. approval commit 仍是 Gitee `ext-dev` 头，candidate 是其精确单亲子；
2. diff 只有三条 allowlisted paths，无删除、mode drift、merge 或治理路径；
3. 15 个合同节点与全部 fixed vectors 由相同测试文件转 GREEN；
4. verifier 对旧日志、NOT_RUN/BLOCKED、identity splice、secret/path canary 和超预算均 STOP；
5. verifier 只读，测试证明零命令执行、零网络、零 Docker、零生产路径写入；
6. approval verification、V2 check、Root Harness/doctor 与独立 code/security review 全绿；
7. `node scripts/product-authority.mjs --verify-candidate --task PACKET-09A-RELEASE-EVIDENCE-V2-20260821`
   返回 `PASS / canAcceptProductCandidate=true`；
8. Owner 另行确认最终 candidate SHA/tree 以及任何 push。

## 6. Rollback

P09-A 只能是一个无数据迁移的新增产品提交。P15 消费前可独立 revert；一旦已有 P15/P09-B consumer，
不得原地修改 v2 语义或只删除 verifier，必须保留 v2 读取并另立 v3。回滚不删除外部证据、donor、
worktree 或用户未提交资产。

## Status

Draft

## Product Definition

规范性产品是 closed `release-evidence.v2` schema 与只读 verifier，不是发布执行器、最终回执或部署权威。

## Acceptance Criteria

- [ ] 本文第 4–5 节全部成立，approval verification matrix 全绿，candidate 通过精确单亲子校验。
- [ ] code/security 独立复审无 P0/P1，Owner 另行确认最终 candidate SHA/tree。

## Delivery Constraints

只允许 manifest 的三条新增路径；不修改应用 runtime、前后端、数据库、Harness/authority/CI/ADR，
不运行网络、Docker、构建、备份、浏览器、上传、push 或部署。

## Affected Modules

- 模块：Release Evidence v2 closed schema、只读 parser/canonicalizer/verifier 及其固定向量测试。
- 允许路径：严格等于 approval manifest `request.productPaths` 的三条路径。
- 非目标：P09-B、P15 实现、业务功能、最终上线和生产 authority。

## Technical Plan

以 `docs/superpowers/plans/2026-08-21-packet-09a-release-evidence.md` 为规范施工顺序：
authorize → RED → schema → parser/canonicalizer → verifier → fixed vectors → full verification → handoff。

## Implementation Report

尚未实施。当前只完成 V2 名单签收、P09 合同双审与 M0 三件套候选；产品改动数为 0。

## Acceptance Review

当前为 `PENDING_OWNER_M0_DECISION / PRODUCT_STOP`。合同 GO 与本文件均不授权施工、提交或推送。
