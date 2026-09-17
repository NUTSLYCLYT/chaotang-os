# Product Authority M0 Root Storage Preimage Persistence Lineage Corrective Successor

Task ID: `PRODUCT-AUTHORITY-M0-ROOT-STORAGE-PREIMAGE-PERSISTENCE-LINEAGE-CORRECTIVE-SUCCESSOR-20260917`

## Status

Draft

`DRAFT / NON_AUTHORIZING / READY_FOR_OWNER_CONFIRMATION`

## Product Definition

本 successor 只冻结一次 forward-only 的持久预映像重建事实与未来 root-stage 安全合同。前序治理提交 `d278975b1d7e696b709b9e72440d0afe5b14baf2` 所绑定的临时源预映像已在重启后消失，状态永久记为 `STOP / FROZEN_SOURCE_PREIMAGE_ABSENT_AFTER_REBOOT / NO_REUSE`；其摘要仅为历史证据，不得继承、恢复或冒充本轮身份。

新预映像位于非系统持久目录 `/home/ubuntu/chaotang-oob-preimages/root-storage-preimage-lineage-v4-20260917/generation-v4/preimage`。它从当前 Git 对象与当前主机工具重新生成，全部对象为普通文件或目录，不含 symlink、hardlink、特殊文件、xattr、capability 或组/全局可写对象。本任务不创建 root stage，也不写 `/etc`、`/opt`、`/var`、`/run` 或 systemd。

## Acceptance Criteria

- [ ] 基线精确绑定 `d278975b1d7e696b709b9e72440d0afe5b14baf2 / 01e348ba6d3726dcb91fca5ef1a2240794d6ae57`，实时 `origin/ext-dev` 不漂移。
- [ ] 前序临时源预映像永久标记为 `ABSENT_AFTER_REBOOT / NO_REUSE`，旧治理摘要不得继承。
- [ ] 新预映像逐条冻结 `389` 条闭合 payload：`251` 文件、`138` 目录、`335,876,716` 文件字节。
- [ ] payload digest 精确为 `sha256:ced8b81f4707d76e25d3b5792131300001895fa1149deba437eb391d2c870e14`。
- [ ] freeze、bundle、installation、exact2 provenance、旧安装只读清单及两个 runtime profile 摘要均可独立复算。
- [ ] `chaotang-product-verifier-broker.py` 的正式 closed validators 接受两个 runtime profile 与 installation manifest。
- [ ] 新 stage 名仅冻结为 `root-stage-installed-preimage-v4-29e50f08`；本轮不得创建该 stage。
- [ ] Task、Packet 与 Plan 严格校验通过，独立 Code/Security Review 均为 `GO / P0=0 / P1=0 / P2=0`。
- [ ] 本轮不运行 authority，不提交、不推送、不安装、不启动服务、不部署。

## Delivery Constraints

- 只允许新增本 Task、对应 Packet 与 Plan 三份治理草案；未来仓库 candidate path 为空。
- 新预映像是非授权 byte evidence，不是安装包批准、root 执行 packet、machine GO、candidate 或 Release。
- 生成器只能从精确 Git 对象与显式 host source 读取字节；不得读取历史 root stage 内容，不得读取凭据或客户数据。
- 未来任何 root-stage 创建、系统安装、服务启动或 installed acceptance 都需要新的精确 Owner 授权及独立机器边界。
- root/OS Owner、Gitee Owner 与完全被控制的 privileged runner 不在本合同防御声明内。

## Affected Modules

- 模块：Product Authority M0 root-storage 持久预映像 lineage 治理合同。
- 允许路径：`docs/product/tasks/2026-09-17-product-authority-m0-root-storage-preimage-persistence-lineage-corrective-successor.md`；`docs/product/tasks/2026-09-17-product-authority-m0-root-storage-preimage-persistence-lineage-corrective-successor.packet.json`；`docs/superpowers/plans/2026-09-17-product-authority-m0-root-storage-preimage-persistence-lineage-corrective-successor.md`。
- 外部证据目录：`/home/ubuntu/chaotang-oob-preimages/root-storage-preimage-lineage-v4-20260917`，只作为非系统冻结证据，不进入提交。
- 禁止路径：`/etc`、`/opt`、`/var`、`/run`、systemd、authority、产品运行时及其他仓库路径。

## Technical Plan

1. 从 `d278975b…` 的 clean detached 工作区读取前序 Packet 结构蓝图、exact9/exact2 Git blobs 和当前 host runtime sources。
2. 先以私有可写模式构造完整目录树，再自底向上冻结模式；所有来源 symlink 只解析为普通文件字节，输出本身禁止 symlink。
3. 生成并验证两个 runtime profile、installation manifest、exact2 provenance、旧安装只读 inventory、bundle 与 freeze attestation。
4. 使用独立只读 verifier 重枚举闭合 payload，并调用正式 broker validator 校验 profile 与 installation closed contract。
5. Packet 冻结全部 389 条记录与所有摘要；严格执行 JSON、重复键、RFC 8785、Task 合同、精确三路径、Harness 和 diff 检查。
6. 完成独立 Code 与 Security Review；任何 P0–P2、第四条治理路径、系统写入或远端漂移立即 STOP。

## Implementation Report

已在隔离非系统目录完成 generation-v4 重建。generation-v1 因父目录过早冻结为只读而失败；generation-v2 因组件 lineage 校验和工具输出边界不完整被独立审查拒绝；generation-v3 因 renderer trust root 未锁死、内部写入未形成完整 dirfd 闭环而被独立审查拒绝。三代均作为失败证据保留且未删除。generation-v4 使用固定非系统输出根、根 FD 逐段 `mkdirat/openat`、Git-blob 蓝图、固定摘要验证器、closed component/base cross-binding 与严格只读校验，已通过独立 payload 重枚举、正式 runtime profile validator、正式 installation validator、无 symlink/hardlink/special/xattr/capability/组或全局可写对象检查。

本轮未写系统路径，未创建 root stage，未安装，未启动服务，未运行 authority，未提交，未推送，未部署。

## Acceptance Review

本 Task 只证明新的持久预映像与治理草案可复算、可审计并保持非授权状态。它不能证明 root stage 已创建、系统已安装、installed acceptance 已通过、product authority 已 GO、Mingshuo exact10 已完成或生产可用。
