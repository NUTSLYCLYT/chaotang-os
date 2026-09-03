# Product Authority Credential-Separated Executor Capability Boundary Corrective Plan

任务：`PRODUCT-AUTHORITY-CREDENTIAL-SEPARATED-EXECUTOR-CAPABILITY-BOUNDARY-CORRECTIVE-SUCCESSOR-20260903`

## Objective

Forward-only 修复 `0b323e26584069019662aa723d30fd763424954c` installed acceptance candidate 在真实
systemd/root 验收中暴露的 capability boundary 矛盾，使 credential-separated executor 可以形成非生产、可回滚
Release Candidate 前置能力；不部署生产。

## Scope

治理三文件只冻结 successor 语义。未来产品 candidate 精确为：

1. `deploy/systemd/chaotang-product-verifier@.service`
2. `scripts/reference/chaotang-product-verifier-broker.py`
3. `scripts/reference/test_chaotang_product_verifier_broker.py`

禁止第四路径、socket unit、authority runtime、`.harness/approvals/`、业务 API、数据库、frontend、P14/P01 或生产配置。

## Evidence Baseline

- Base：`0b323e26584069019662aa723d30fd763424954c / 68de194ad8e813ad365c0694812fde38e5f6423e`
- Predecessor approval：`6a2c4dd8d4cf13ed34d5665deef4307ac2801569`
- Old contract：`serviceCapabilityBoundingMask=0xeb` 且禁止 capability 扩张
- Root diagnosis：`_drop_credentials(993,993)` 在旧 installed byte 上因 `/proc/self/setgroups` 与 userns/host uid
  语义不匹配失败；service-like 环境缺少 setup 所需 capability 时 private netns 与 capability bounding drop 无法闭合。
- Donor-only local child：`fe409ea7add7c70bddab88fbb5a44a32e26f011b`，只作为根因证据，不得直接推送或继承验证身份；
  其 `snapshot-stage/cleanup-stage` privileged startup 语义已被安全复审拒绝，最终 candidate 必须更窄。

## TDD Sequence

1. 从 `0b323e…` 创建 governance successor approval commit，三文件新增、`100644`、直接单亲。
2. approval 普通快进后，从该 approval commit 创建唯一干净 candidate 工作区。
3. 重物化 donor 中被接受的 exact3 修复片段，并额外收窄 helper capability：
   - service unit 扩展到精确 `0x2011eb` capability set；
   - broker 在 mutable input 前设置并验证 NNP，只有 `--serve-stdio` 可持有 `0x2011eb`；
   - `snapshot-stage`、`cleanup-stage`、`ingest-run`、`ingest-git-stage`、`worker-launch` 启动态必须零 capability；
   - broker 完成 private netns/loopback/bounding drop/credential drop/capset(0)；
   - tests 绑定 `SYSTEMD_IGNORE_CHROOT=1` 的临时进程环境和 `0x2011eb` 静态期望。
4. 运行 focused broker tests 和完整静态治理矩阵。任何失败先定位首个真实根因，禁止放宽门禁。
5. 完成 Governance/Python/Security 三审；任一 P0–P2 即 STOP。
6. Candidate commit 只能包含 exact3 三条 `M / 100644`。普通快进落地后再运行非生产 root installed acceptance。
7. Installed acceptance 结束必须停止并禁用全部相关 systemd unit；任何 active/enabled 残留即 STOP。

## Security Invariants

- `CAP_SYS_ADMIN`、`CAP_NET_ADMIN`、`CAP_SETPCAP` 只是 `--serve-stdio` root supervisor setup capability，不得到达
  snapshot/cleanup helpers 或 gate exec。
- `AmbientCapabilities` 永远为空；`NoNewPrivileges=1` 必须在 broker 处理任何可变输入前完成并复核。
- 最终 worker/gate 身份必须是专用 uid/gid、无 supplementary groups、五类 capability 全零。
- 不允许 user namespace 冒充 host uid/gid；credential identity 必须由 parent-observed `/proc` 状态证明。
- 不允许改写 Product Authority、创建第二 authority、上传凭据、接触客户数据或发布生产。

## Verification and Rollback

静态矩阵：

- `python3 -I -B scripts/reference/test_chaotang_product_verifier_broker.py`
- `node scripts/check_harness.mjs`
- `node scripts/check_harness.mjs --self-test`
- `node scripts/harness-doctor.mjs --check`
- `node --test scripts/harness-doctor.test.mjs`
- `node .agents/hooks/check-harness.mjs --self-test`
- `TMPDIR=/tmp node --test scripts/product-authority.test.mjs`
- `node scripts/ext-full-value-convergence.mjs --check`
- `node --test scripts/ext-full-value-convergence.test.mjs`
- `git diff --check`

非生产安装验收只能在 candidate 已落地主线后执行，且只用已落地字节。失败时回滚方式是停止并禁用 verifier
socket/service，保留 `/etc`、`/opt`、`/var/lib` 的验收证据摘要，不部署生产。

## Review Notes

Governance Review 检查 lineage、三文件路径、old packet no-reanchor 与普通快进边界。Python Review 检查
credential/drop/network 实现与测试真实性。Security Review 检查 capability 最小性、setup 后归零、root 安装边界、
凭据与生产部署隔离。
