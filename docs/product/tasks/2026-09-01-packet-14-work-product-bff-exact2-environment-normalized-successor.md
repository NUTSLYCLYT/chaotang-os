# Packet 14 — Work-Product BFF Exact2 Environment-Normalized Successor

## Status

Draft

Task ID: `PACKET-14-WORK-PRODUCT-BFF-CANCEL-EXACT2-ENVIRONMENT-NORMALIZED-SUCCESSOR-20260901`

## Product Definition

在 canonical `ext-dev@8441b881354d2521a7e0b04e4c3bfe05295852c3` 上重新签发 P14 work-product BFF exact2。旧候选 `0443a6c421a502457adacec28bb00e26f75a8473` 的产品字节与逐门验证只作为 byte donor evidence；旧 machine verification 因隔离工作区缺少依赖、随后又使用跨工作区 `node_modules` 符号链接而两次 `STOP / VERIFICATION_FAILED`，不得再次重试、继承 candidate 身份或推送。

本 successor 在产品矩阵内先以 Node `v22.23.1`、npm `10.9.8`、隔离 npm 配置和现有本地 cache 的 offline 内容执行 `npm ci --offline --ignore-scripts`，再对当前工作区真实 `frontend/node_modules` 的 22457 条目录、文件与内部 symlink 记录计算冻结摘要；矩阵结束后重复同一全树校验。cache 本身不是权威身份，权威只绑定 lock、离线安装流程和安装后完整树摘要。该身份用于证明本轮验证执行环境可复现且未被矩阵替换，不冒充 npm 上游来源的独立供应链认证。产品范围仍只建立 artifact ID UTF-8 byte cap、浏览器 `AbortSignal` 传递点和所有响应的 `private, no-store`；完整 backend timeout/cap/cancel、P14 exact30、release supervisor、Pilot 与部署均不在本包。

## Acceptance Criteria

- [ ] approval commit 是 `8441b881…` 的直接单亲子，只含三份新治理文件。
- [ ] `8441b881…` 保留为 immutable lineage base，但其旧 one-child authority 被标记为 `ABANDONED_AFTER_ENVIRONMENT_VERIFICATION_STOP / NO_RETRY / NO_AUTHORITY_INHERITANCE`；只有 `0443a6c…` 产品字节是 byte donor。
- [ ] machine authority 只授权一个新的 exact2 产品 child。
- [ ] candidate 精确 `2 MODIFY / 0 ADD`，模式均为 `100644`，无第三路径。
- [ ] 两文件 byte-for-byte 等于冻结 donor；bundle 为 `sha256:7d6eb6471c2d7a4c2be9a988f4b529a9ab7b5fbfa83c974419728868d925d5fa`，full-index diff 为 `sha256:c40b12b29529b110f86b070b686e40eee7d554bab440c67928f1b77c96c3a539`。
- [ ] 依赖由隔离的 `npm ci --offline --ignore-scripts` 重建；lock digest 为 `sha256:a08cf31a5089fc246380a8ac77f365299e31880995a04722affbdf413e74fb0b`，Node/npm 为 `v22.23.1 / 10.9.8`，真实安装树为 22457 条记录、摘要 `sha256:5622646be4a6238728aa4a45553a46b41f63ca4bebc71cc05ada902aa4386fd8`，矩阵前后相同且无逃逸 symlink。
- [ ] focused、frontend full test/lint/typecheck、`NODE_ENV=production` build、Harness、Doctor、authority regression、V2 与 diff check 全绿。
- [ ] Governance、TypeScript 与 Security 独立复审均无 P0–P2；新的 machine `--verify-candidate` PASS 后才允许普通快进。

## Delivery Constraints

- `8441b881…` 是本 successor 的不可变 ancestry；其旧 one-child authority 不得重试、恢复或继承。旧 candidate `0443a6c…` 只作 byte donor evidence。
- 历史 exact32 worktree 仍为 `BYTE_DONOR_ONLY / NO_CANDIDATE_IDENTITY / NO_VERIFICATION_INHERITANCE / NO_REANCHOR`。
- 不修改 backend client、backend、Harness、authority、readiness、exact30、Pilot 或 release runner。
- 依赖环境必须由 manifest 固定的离线、ignore-scripts、隔离 npm 配置流程在 candidate 内重建；全树记录、模式、内容和 symlink target 必须前后绑定冻结摘要。禁止跨工作区 symlink、在线安装或持久修改 Git/Node/npm 配置。
- 不 merge、cherry-pick、rebase、force-push、发布、Pilot 或部署。
- 新 `--authorize` 运行前后必须分别执行固定传输检查：固定 Gitee URL；从 `/tmp` 非仓库 cwd 运行 `ls-remote`；禁用 global/system Git config；拒绝 local include/includeIf、`url.*.insteadOf`、`core.sshcommand`；使用 `/usr/bin/ssh -F /dev/null`；两次远端都必须精确等于新 approval commit。
- 本 exact2 落地后 P14 仍为 `PRODUCT_STOP`，直到最新基线 exact30 与 candidate-external supervisor 分别闭环。

## Affected Modules

- 模块：Next.js report work-product BFF request boundary。
- 允许路径：`frontend/src/app/api/report-artifacts/[id]/work-product/handler.ts`；`frontend/src/app/api/report-artifacts/[id]/work-product/route.test.ts`。

## Technical Plan

1. 冻结并落地本三文件 forward-only approval。
2. 在新 `--authorize` 前后完成两次固定传输远端检查；GO 后从新 approval 创建唯一干净 candidate worktree。
3. 由 manifest 的隔离离线 provisioning 门重建 node_modules，并在矩阵前后复算完整树摘要。
4. 从 `0443a6c…` 或冻结 exact32 donor 只读重物化 exact2；不得复制第三条路径。
5. 运行完整 manifest 矩阵及 Governance/TypeScript/Security 三审。
6. 新 candidate 只运行一次 machine `--verify-candidate`；PASS 后普通快进，不部署。

## Implementation Report

旧 exact2 产品字节已完成真实 RED→GREEN、focused、frontend tests/lint/typecheck/build、Harness、Doctor、authority regression、V2 与三审，但同一旧 machine authority 两次失败：首次缺少 `typescript/react/next`；第二次跨工作区 node_modules symlink 被 Turbopack fail-closed 拒绝。隔离 npm 配置、使用冻结 lock 和本机 cache 离线 `npm ci --ignore-scripts` 后，安装树稳定为 22457 条记录、摘要 `sha256:5622646be4a6238728aa4a45553a46b41f63ca4bebc71cc05ada902aa4386fd8`；production build 前后摘要不变。前端测试 `681/681`、lint、typecheck、production build 和后半矩阵均独立通过。该证据只证明环境根因、当前安装树身份与 donor 字节，不继承旧 candidate 或 machine PASS，也不冒充外部 registry 的独立供应链认证。

冻结 donor 身份：

- `handler.ts` raw `sha256:6f157d070e01d5caac2cc9738f3787c7cac529f57355714d918100c586c14988`，blob `471e34f994a4b06e9e602a79095f36deac72956a`，2020 bytes。
- `route.test.ts` raw `sha256:bab4f5d6cfec93c03fab9e4e2c5ffda0ded3e6725e83180438c6cfe14ad78b2e`，blob `f8a0b8cb388de74776f8705326c0f2c4a0a2bbd6`，2442 bytes。

## Acceptance Review

Pending。任一 remote/base/donor/lock/dependency identity 漂移、第三路径、验证失败、machine STOP 或独立 P0–P2 均立即停止。本 successor 不得把环境归一化证据冒充 P14 完成或 release 资格。
