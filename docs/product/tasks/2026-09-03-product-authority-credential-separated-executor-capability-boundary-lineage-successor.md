# Product Authority Credential-Separated Executor Capability Boundary Lineage Successor

任务 ID：`PRODUCT-AUTHORITY-CREDENTIAL-SEPARATED-EXECUTOR-CAPABILITY-BOUNDARY-LINEAGE-SUCCESSOR-20260903`

冻结基线：`b05ddbc7d722bd364dbee5e9cee31fce07bda5de`

冻结基线 tree：`e6c6df9dff01ddb5bc1a006741ac383e44e3c33d`

> 治理状态：`DRAFT / NON_AUTHORIZING / READY_FOR_OWNER_CONFIRMATION`
>
> 本 successor 只处理 `origin/ext-dev` 从 `8282247208f3d79a8158aa7dc3138a49b1b919fb`
> 前进到 `d5574ea6587724c80edd4c5c1487c1c0e8e1a5b3`，再经
> `b05ddbc7d722bd364dbee5e9cee31fce07bda5de` 修复 Harness baseline 自洽后的 forward-only lineage
> 纠正。它不创建第二套 Product Authority、不消费旧 one-child、不部署生产。

## Status

Draft

## Product Definition

`PRODUCT-AUTHORITY-CREDENTIAL-SEPARATED-EXECUTOR-CAPABILITY-BOUNDARY-CORRECTIVE-SUCCESSOR-20260903`
已经在 `8282247208f3d79a8158aa7dc3138a49b1b919fb` 上冻结并普通快进落地。其后 `origin/ext-dev`
又按普通单亲谱系前进到：

1. `2dffd64932ed83a88cde52565c2067e8540b65e7`：
   `feat(scene-packs): add Scene Pack V1 board loop`
2. `d5574ea6587724c80edd4c5c1487c1c0e8e1a5b3`：
   `docs(governance): draft agentic org project organization amendment`
3. `b05ddbc7d722bd364dbee5e9cee31fce07bda5de`：
   `fix(harness): restore d557 baseline self-consistency`

只读 diff 证明上述三笔远端新增/前置修复提交没有触及本包 future exact3 candidate paths：

- `deploy/systemd/chaotang-product-verifier@.service`
- `scripts/reference/chaotang-product-verifier-broker.py`
- `scripts/reference/test_chaotang_product_verifier_broker.py`

但旧 exact3 候选工作区仍绑定 `8282247208f3d79a8158aa7dc3138a49b1b919fb`，不得直接 re-anchor、commit
或 push 到新远端。本包以当前最新 `b05ddbc7… / e6c6df9…` 作为唯一 base，重新冻结同一 exact3 能力边界修复范围。
旧候选字节只作为 donor evidence；未来 candidate 必须在本 successor approval 落地后从最新基线重新物化、重新验证、重新三审。

本包的业务目标是让 credential-separated product verifier executor 的 capability boundary 在真实
systemd/root 非生产验收中闭合：`CAP_SETPCAP`、`CAP_NET_ADMIN`、`CAP_SYS_ADMIN` 只能短暂存在于
`--serve-stdio` supervisor setup；进入请求字节读取、snapshot/cleanup helper、ingest、worker 或 gate exec
前必须降到已批准 legacy 或零 capability 状态。

## Acceptance Criteria

- [ ] approval commit 必须是 `b05ddbc7d722bd364dbee5e9cee31fce07bda5de` 的直接单亲子，只包含本 Task、Packet、Plan 三条新增治理路径。
- [ ] future candidate 只允许修改 exact3：
  `deploy/systemd/chaotang-product-verifier@.service`、
  `scripts/reference/chaotang-product-verifier-broker.py`、
  `scripts/reference/test_chaotang_product_verifier_broker.py`。
- [ ] future candidate 必须保持三文件 `M / 100644`，不得出现第四路径、治理文件、authority 文件、临时文件或生产部署文件。
- [ ] service unit 的 `CapabilityBoundingSet` 必须精确包含
  `CAP_CHOWN CAP_DAC_OVERRIDE CAP_FOWNER CAP_KILL CAP_SETGID CAP_SETUID CAP_SETPCAP CAP_NET_ADMIN CAP_SYS_ADMIN`；
  `AmbientCapabilities=` 必须保持空。
- [ ] broker 必须在任何 request prelude、request decode、attacker-controlled parse、stdin/socket read 或业务处理前完成
  post-setup capability reduction；`serve-stdio` 不得以 `0x2011eb` 进入请求处理期。
- [ ] `snapshot-stage` 与 `cleanup-stage` helper 在 exec 前必须降到 legacy `0xeb`；`ingest-run`、
  `ingest-git-stage` 与 `worker-launch` 必须保持零 capability 启动合同。
- [ ] private launcher 合同必须为 private network namespace only，owner 绑定 host user namespace；不得重新引入
  `uid_map` / `gid_map` / private user namespace 来伪造 parent-observed host UID/GID。
- [ ] 完整静态矩阵、focused broker tests、Governance Review、Python Review、Security Review 必须全部 GO；
  任一 P0–P2 或 machine/Harness STOP 均不得形成 candidate commit。
- [ ] candidate 普通快进落地后，非生产 installed acceptance 必须只使用已落地主线字节；验收结束后全部相关 systemd unit
  必须停止并保持 disabled。

## Delivery Constraints

- 不允许 re-anchor `8282247…` 旧 approval 或旧 candidate 工作区。
- 不允许继承旧 candidate、测试、审查、通过、authority 或可推送身份。
- 不允许修改 Scene Pack、agentic org amendment、P14、P01、P10、frontend、业务 API、数据库或客户数据。
- 不允许修改 `.harness/approvals/`、`scripts/product-authority.mjs`、Harness 其他路径或创建第二 authority/runtime/ledger。
- 不允许 force-push、merge、rebase、fetch/pull、删除分支/worktree、清理 dirty donor 或部署生产。

## Affected Modules

- 模块：Product Authority credential-separated executor capability boundary lineage successor
- 允许路径：`deploy/systemd/chaotang-product-verifier@.service`；`scripts/reference/chaotang-product-verifier-broker.py`；`scripts/reference/test_chaotang_product_verifier_broker.py`

## Technical Plan

1. 从 `b05ddbc7… / e6c6df9…` 创建本 successor 三文件治理包，并记录
   `8282247… -> 2dffd6… -> d5574e… -> b05ddbc…` 单亲 lineage 与 exact3 零重叠证据。
2. 将当前旧 exact3 工作区字节标记为
   `BYTE_DONOR_ONLY / NO_CANDIDATE_IDENTITY / NO_VERIFICATION_INHERITANCE / REMOTE_BASE_DRIFT`。
3. successor approval commit 普通快进落地后，在最新 base 创建唯一干净 candidate 工作区，byte-for-byte 重物化经三审通过的
   exact3 修复字节。
4. 重新运行 focused broker tests、完整 Harness、Harness self-test、Doctor、Doctor tests、hook self-test、
   `TMPDIR=/tmp` product-authority regression、V2 check/tests 与 `git diff --check`。
5. 重新进行 Governance / Python / Security 三审；只在 P0/P1/P2 全为 0 时创建本地 candidate commit，并在远端未漂移时普通快进。
6. candidate 落地后再执行非生产 root/systemd installed acceptance；验收结束必须停用服务，不得生产部署。

## Implementation Report

当前为治理草案。本轮没有修改产品字节、没有运行 product authority、没有 candidate commit 或 push。

旧 donor 工作区：

- 路径：`/home/ubuntu/Projects/chaotang-os/.worktrees/product-authority-credential-separated-executor-capability-boundary-corrective-successor-candidate-20260903`
- base commit：`8282247208f3d79a8158aa7dc3138a49b1b919fb`
- donor 状态：`BYTE_DONOR_ONLY / NO_CANDIDATE_IDENTITY / NO_VERIFICATION_INHERITANCE / REMOTE_BASE_DRIFT`
- donor exact3 bundle：`sha256:d9aa8c70e855852b6402c247923b7fded23c33a4757ee7b07f4d88f56f8f86ae`
- donor full-index diff：`sha256:95802e1030f90c5cbd26d4f40310e1c8e76578c55aa3cb4be9c131025b4f7d7f`
- donor verification：focused 75 tests pass；Harness 146 pass；Harness self-test 175 pass；Doctor pass；Doctor tests 10/10 pass；
  hook self-test 3 pass；`TMPDIR=/tmp` product-authority regression 12/12 pass；V2 check pass；V2 tests pass；`git diff --check` pass。
- donor reviews：Governance Review GO；Python Review GO；Security Review GO。

Donor file identities:

| Path | Mode | Bytes | Raw SHA-256 | Git blob |
| --- | --- | ---: | --- | --- |
| `deploy/systemd/chaotang-product-verifier@.service` | `100644` | 2532 | `sha256:4533218ea486ce563c589a83897924e3d0ebb3b5e3a5d2eb07bba21a629c97b6` | `93162cb5abc014afd2caa8e69614121525791b20` |
| `scripts/reference/chaotang-product-verifier-broker.py` | `100644` | 159897 | `sha256:a3573ea620df3d326193ce33cd875161a11f6c1a1e468f3e16d08332cb7a3d16` | `59bb25a735f1477cab2b623d8047b950ee0f84fd` |
| `scripts/reference/test_chaotang_product_verifier_broker.py` | `100644` | 119363 | `sha256:13fed0d99aa4e5574c8855a7b2f0383c6fe9e34bcdcef13f0992a1988219592f` | `53fffaea95ab2d18a3c666434260bdddf45bad0a` |

Lineage zero-overlap:

- `2dffd64932ed83a88cde52565c2067e8540b65e7`、`d5574ea6587724c80edd4c5c1487c1c0e8e1a5b3`
  与 `b05ddbc7d722bd364dbee5e9cee31fce07bda5de` 没有修改本包 exact3 candidate paths。
- 新增 Scene Pack 与 agentic org amendment 内容作为独立主线证据保留，不被本 successor 吞并或回退。

## Acceptance Review

本文件只声明 forward-only 治理草案；不声明 APPROVED、GO、candidate、Pilot、Release 或生产部署。
后续必须先普通快进落地本 successor approval，再从 `b05ddbc7…` 后继基线重新物化 exact3 candidate 并重跑完整证据。
