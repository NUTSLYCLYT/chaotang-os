# Product Authority M0 Root Storage OOB Recovery Corrective Successor

Task ID: `PRODUCT-AUTHORITY-M0-ROOT-STORAGE-OOB-RECOVERY-CORRECTIVE-SUCCESSOR-20260917`

## Status

Draft

`DRAFT / NON_AUTHORIZING / READY_FOR_OWNER_CONFIRMATION`

## Product Definition

本 corrective successor 只冻结一个可复算、可审计、尚未执行的完整 installation preimage stage 合同。它把旧的 packet/receipt-only 合同降为历史 predecessor，并绑定已经在隔离临时目录完成重建与双审的完整预映像。未来若另行获得精确 root OOB 授权，可信执行器只能把 Packet 中冻结的 392 条闭合 payload 记录写入一个全新的 root-owned 私有 stage。

现存 `/var/lib/chaotang-product-verifier/root-stage-oob-recovery-v1` 必须原样保留为只读历史证据；本任务不得进入、读取、删除、覆盖或复用它。新 stage 名唯一冻结为 `root-stage-installed-preimage-v3-a548edd3`。

## Acceptance Criteria

- [ ] 基线精确绑定 `a26b76723f516e5b2b679cea1e6486febccee466 / 6c1924520ffa59c93136676bbbdc2486b4f086f6`。
- [ ] 冻结 freeze、bundle、installation、exact2 provenance、旧安装备份清单及两个 runtime profile 摘要。
- [ ] Packet 逐条冻结 392 条 payload 记录：253 文件、139 目录、335,965,043 文件字节；路径集合闭合且 payload digest 可机械复算。
- [ ] 旧 `root-stage-oob-recovery-v1` 仅为 `HISTORICAL_EVIDENCE_ONLY / PRESERVE / NO_DELETE / NO_OVERWRITE / NO_REUSE`。
- [ ] 新 stage 只允许通过已验证 root-parent FD、单一 no-follow source directory FD、逐段 dirfd 遍历、独占创建和完整失败清理形成。
- [ ] 成功 stage 只能包含冻结的 392 条 payload 记录及一份 `root-stage-receipt.json`；任何额外、缺失、模式、所有权、字节或摘要漂移均 STOP。
- [ ] `root-stage-receipt.json` 使用闭合字段与类型、严格 I-JSON、RFC 8785 canonical raw bytes、`0400 root:root`、8 KiB 上限及写后重读摘要复核；写入内容后 `fsync(receipt)`，完成 `fchown`/`fchmod`/`fstat` 后再次 `fsync(receipt)`，再 `fsync(stage-dirfd)`，任何一步失败、额外字段或非 canonical bytes 均 STOP。
- [ ] stage 创建与 READY 复核期间不得执行、导入、加载或调用任何 payload；冻结的 executable mode 仅是后续验收所需的数据身份，不构成执行授权。
- [ ] 本轮不写 `/etc`、`/opt`、`/var` 或 systemd，不创建 root stage，不安装、不启动服务、不运行 authority、不提交、不推送、不部署。
- [ ] 严格校验和独立 Code/Security Review 均为 `GO / P0=0 / P1=0 / P2=0` 后，才可向 Owner 返回唯一 Packet canonical digest。

## Delivery Constraints

- 本轮只允许修正本 Task、Packet 与 Plan 三份现有未提交治理草案。
- 不读取历史 stage 内容，不触碰主仓、系统配置、服务、凭据、客户数据或产品运行时。
- Packet 是非授权治理草案；它不是 root 执行 packet、approval、machine authority、candidate、安装许可或部署许可。
- 本合同只允许复制与验证 payload 字节；禁止 shell、`exec*`、spawn、subprocess、动态加载、解释器导入、hook、service manager 与 runtime-profile 调用。
- root/OS Owner、Gitee Owner 与被完全控制的 privileged runner 不在本合同防御声明内；普通用户可写临时目录、符号链接、路径替换、额外文件和摘要漂移必须 fail closed。
- 后续任何 root stage 创建都必须获得新的、精确绑定本 Packet canonical digest与执行预映像摘要的独立授权。

## Affected Modules

- 模块：Product Authority M0 非生产 installed-acceptance 完整预映像 stage 治理合同。
- 允许路径：`docs/product/tasks/2026-09-17-product-authority-m0-root-storage-oob-recovery-corrective-successor.md`；`docs/product/tasks/2026-09-17-product-authority-m0-root-storage-oob-recovery-corrective-successor.packet.json`；`docs/superpowers/plans/2026-09-17-product-authority-m0-root-storage-oob-recovery-corrective-successor.md`。
- 禁止路径：`/etc`、`/opt`、`/var`、`/run`、systemd、产品代码、authority、前后端运行时及其他仓库路径。

## Technical Plan

1. 从隔离冻结目录机械枚举全部目录和普通文件，按 UTF-8 path 字节序冻结路径、类型、模式、字节数与 raw SHA-256。
2. 按 Packet 声明的 domain-separated RFC 8785 算法复算 392-record payload digest。
3. 冻结全部上位 preimage identities、root-parent identity、历史 stage 处置和唯一新 stage 名。
4. 冻结后续 root executor 的 source-FD、destination-dirfd、O_NOFOLLOW、O_EXCL、fsync、所有权、精确模式、closed receipt、全 payload 不执行与失败清理合同；本轮不执行它。
5. 执行 strict JSON、重复键拒绝、Packet canonical、payload、Task 合同、精确三路径、Harness 和 diff 校验。
6. 完成独立 Code 与 Security Review；任何 P0–P2 或边界漂移立即 STOP。

## Implementation Report

已在隔离临时目录重建并冻结完整预映像，状态为 `PREIMAGE_FROZEN / REVIEWED / NON_INSTALLING`。冻结身份为：

- freeze：`sha256:a548edd3d0b1daf211ef1539e570c0d7d28e3bba2b258a71bf04a34a71fc8fad`
- bundle：`sha256:ee0f581be575ccd352c918f52503590e6fe6e026342c4574e28a11766073e0e5`
- installation：`sha256:9cbc52ecff9440cf41b7f45c73c68064e2c6ceaa76a9bfeddaf807b8ff928e31`
- exact2 provenance：`sha256:84e671374c559057ece0a6909908805edd54bbeabdd66f575b7b2969c2bf94a2`
- old-installation backup inventory：`sha256:74ff3fad4c9b6893299ff77e0db2debfce9d9be19abcf71196cedc60d0c006e2`
- privileged profile：`sha256:17435c3683a868dfc5da4aeb7716ce3bd44253a4ee443a82d0d490a0863a5df0`
- gate profile：`sha256:c073e229ae5c313cc4bb3b0a06ba895807b39702adefb9ef8706fa71917eb193`
- 392-record payload：`sha256:860b2debf95afaef097670ca3b2da087bc66add75c89f94675553eaa08ac6f96`

只读确认历史 stage 已存在且为 `root:root 0700`；本轮未读取其内容。未写系统路径、未安装、未启动服务、未运行 authority、未提交、未推送、未部署。

## Acceptance Review

本 Task 只证明治理草案能够完整绑定已冻结预映像和未来 root-stage 安全边界。它不能证明 root stage 已创建、installed acceptance 已运行、machine authority 已 GO、Mingshuo exact10 已完成、Release Candidate 已形成或生产可用。
