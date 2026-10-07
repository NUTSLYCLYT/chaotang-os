# 预重建分支清理记录（2026-10-07）

Owner 授权：2026-10-07 会话「把这些都处理好」全面收口指令。

## 决策

- 删除规则：Gitee 远端最后提交日期 ≤ 2026-09-02（ext-dev 从零重建启动之前）的全部分支，共 53 支。
- 保留 master（旧主线锚点，旧架构历史仍可从它追溯）与 2026-09-08 之后全部分支（Sept 7 支 + Oct g3 系列）。
- 其中 7 支为 ext-dev 祖先（对象由 ext-dev 历史永久保留）；46 支不可达分支已全量备份。

## 备份与恢复

- 不可达 46 支：H:/ChaotangBackups/branch-archive-20261007/pre-rebuild-branches.bundle（176MB，git bundle verify 通过）。
- 恢复任一分支：git fetch 该 bundle 的 refs/remotes/origin/<分支名> 到本地新分支名即可。
- ext-dev 祖先 7 支：按 SHA 直接恢复，对象在 Gitee ext-dev 历史中永久存在。

## 完整清单（SHA | 分支 | 最后提交 | 备份位置）

| SHA | 分支 | 最后提交 | 备份位置 |
|---|---|---|---|
| 1cae6c625ece368df7d8d999b154f3971411ead7 | rebuild/harness-only | 2026-07-16 | ext-dev 历史 |
| 24de551ca78eb9147af15161e0603d426d64c491 | pr/p9-hanlin-v2 | 2026-07-18 | bundle |
| 51a6acebff7a8971ecddaa8370d8186e14a1c435 | pr/p8-from-origin | 2026-07-18 | bundle |
| 6815478b0a8f412950d1fcf9f2dc99db91775f97 | pr/p9-from-origin | 2026-07-18 | bundle |
| 79b1eaa530ef60e776dfcbf79c5f52cf4f611830 | safety/pre-convergence-20260718-79b1eaa | 2026-07-18 | bundle |
| ef90198dbbfc2e61a8ffd6094faf334b3ddb765e | pr/p8-guoli-v2 | 2026-07-18 | bundle |
| 1d09d0f94fcd11bc0e2e7af6ab28152473a5d09f | task/backend-runtime-wiring-r1 | 2026-07-19 | bundle |
| 4adec0122998384f1ed1d01c0adecd1fe6030ae8 | task/pkt-a1-jinyiwei-real-fetch | 2026-07-19 | bundle |
| 5a5ac7efcbab26943087c984b0b9182e094586c1 | task/resource-census-p0 | 2026-07-19 | bundle |
| 7daf36ba42b5266a338b128abf055e164657ac9a | wip/governance-closeout-20260719 | 2026-07-19 | bundle |
| 870d10a79c21b8ea9245c4df306faa98936b4fec | task/fix-gongbu-component-scope-p18-v4-latest-20260719 | 2026-07-19 | bundle |
| 8801c6986f43c39ff072c387906c552a3cb93c24 | docs/p0-p15-authority-reconciliation-20260719 | 2026-07-19 | bundle |
| c18f9beb2d66583162bd77804f33ffff8fce0200 | wip/canon-court-01a-red-20260719 | 2026-07-19 | bundle |
| df632e4f7c95b7c53a5ad9cb2a725a1e404976fd | docs/product-r0-freeze-20260718 | 2026-07-19 | bundle |
| e8108707e53b37e82471c9b30b42967a69f95dd9 | docs/agentic-pattern-adoption-20260719 | 2026-07-19 | bundle |
| ea6a844eefb8e13bbb7617f1c48090d4d8cc7e34 | wip/six-capability-canon-docs-20260719 | 2026-07-19 | bundle |
| f1fa0cd6116a4e8405b5e11f425c220ef9122761 | task/fix-p0-p15-execution-authority-reconciliation-next-20260719 | 2026-07-19 | bundle |
| bf99f6091a6a535ae4ef1e6d8534029c866f3419 | task/r0-execution-authority-20260720 | 2026-07-20 | bundle |
| 26faec302276d76d6c04636a5c917ec652dd92db | r0-w02-final-20260721 | 2026-07-21 | bundle |
| 2747a1554b8ade59e6b46d021bcd5e09d3716661 | dev-ext-test | 2026-07-21 | bundle |
| 64febedabe6becdf5e54f06f2e04039567661f1a | docs/r0-w01-closeout-20260721 | 2026-07-21 | bundle |
| 9c84f7e45a7b0167a19969040e8b13d19a2eb6a0 | docs/r0-w01-amendment-repin-20260721 | 2026-07-21 | bundle |
| f4b1d83a8189a928a71487581ba5185982c0cb3b | governance/harness-selective-adoption-20260722 | 2026-07-22 | bundle |
| 4d59fa3e8428406a2d7877741e05eb96651a316d | governance/ui-mainline-control-20260723 | 2026-07-23 | bundle |
| 8bb68fb4c58b889551699a06e9468e87db66361d | docs/r0-trusted-kernel-amendment-20260720 | 2026-07-23 | bundle |
| 3573e66cd43bbfff92dcea87dee3fbd47d57c243 | governance/r0-w06-codex-65330d7f | 2026-07-24 | bundle |
| 61dfef3607000709be2e9955821c0e47fe16574d | governance/r0-w05-amendment-20260723 | 2026-07-24 | bundle |
| a4ab2d82a3f4215f4232c3693f0b2617c63c1d02 | governance/r0-w05-postmerge-closeout-20260724 | 2026-07-24 | bundle |
| a8f7816120b24bcbf12a40e2b971222583f25371 | governance/r0-w05-postmerge-remediation-20260724 | 2026-07-24 | bundle |
| 3d0d6623dfbcc8d94e7c7284618933ff87d09c4f | governance/r0-w06-p26-integration-20260725 | 2026-07-25 | bundle |
| 9089fbaa76c2dcf363e1a7d6cb473ed7be70b8d5 | codex/harness-only-worktree | 2026-07-29 | bundle |
| cc0954b8faccca326d04f877036cd09d699e3d76 | docs/tiandao-ten-agent-ext-handoff-20260803 | 2026-08-03 | bundle |
| 4e9186b434982c396a8390ef30c9fa0e356f2005 | harness-dev | 2026-08-06 | bundle |
| 71c99c2d0c8e40afb355deb5e4ee62c935edc149 | integration/agent-design-convergence-20260804 | 2026-08-06 | bundle |
| ac9ca4c15afc3244aaeee148303574fbc0c145ef | codex/ext-single-mainline-s3-20260808 | 2026-08-08 | bundle |
| 56d0cf67453aea3e54fc8a58fe1c7a24442bdbd9 | codex/ext-transparent-promotion-authority-20260810 | 2026-08-10 | bundle |
| 3974add4c995be4af04dbe92de05be8001e03422 | codex/w08-reviewer-successor-g7-20260811 | 2026-08-11 | bundle |
| 10dd07acaeaeac55a452f29b6d7d4beb538a7147 | codex/ext-d4a-provenance-20260812 | 2026-08-12 | bundle |
| 407dfc59599beb3113a063df0c27c8897fb6cf0a | harness-only | 2026-08-12 | ext-dev 历史 |
| 7dcfa9439be03b6715a19985cd97bca1b38525c7 | codex/ext-d4a-w08-continuation-20260812 | 2026-08-12 | bundle |
| 82da2be55c5a3bee6a02346f6ca859483ae71a4b | codex/ext-d4a-w08-continuation-v3-20260812 | 2026-08-12 | bundle |
| 939186f0331d9784bc8c4ceee393aeb197230ed0 | feature-chaotang-ext | 2026-08-12 | bundle |
| 94957e5bcbe20bb4a235c2ea6d78955993b4072f | codex/ext-d4a-w08-continuation-v2-20260812 | 2026-08-12 | bundle |
| e335ffb74ad4c29f8a925bd632c0363a9c001d06 | codex/ext-w08-contract-quality-20260812 | 2026-08-12 | bundle |
| eb925a252d68a26e8639ceb4c2dc866038075610 | codex/ext-p0c-contract-acceptance-20260813 | 2026-08-13 | bundle |
| 1b4f6efd55315e41013563603c22ce9aefe95f43 | codex/ext-root-harness-convergence-20260815 | 2026-08-15 | ext-dev 历史 |
| 2ef0bb4689517b7a05578f18091e841ec37eca2a | codex/ext-successor-authority-v1-20260815 | 2026-08-15 | ext-dev 历史 |
| 70b25d48c3917ca1ae92725c058d0f0601accc3d | codex/ext-dev-next-stage-20260815 | 2026-08-15 | ext-dev 历史 |
| a86e69dd41e7dcd476807d401c316a91483bffc8 | codex/ext-root-harness-g1-readiness-20260815 | 2026-08-15 | ext-dev 历史 |
| b9fe1ff04b137472c84b35399031b6339c5b1399 | codex/ext-root-harness-g1-a0-authority-20260815 | 2026-08-15 | bundle |
| d9d28b410a8e089a8466784b823c34e3084f64f1 | codex/ext-root-harness-g1-e0-platform-readiness-20260815 | 2026-08-15 | bundle |
| 54c87e620e4157ba05ad10f92bab0f0737538c32 | codex/readiness-fingerprint-repair-20260816 | 2026-08-16 | ext-dev 历史 |
| 66448b80da24acbf2858fcc373588c7f3239328f | dev | 2026-09-02 | bundle |

## 同批清理

- H 盘 worktree 31 → 26：移除 4 个已合并的 g3-20261006 worktree + 1 个 g3-p03-audit-20260930（脏内容已抢救：patch 284K + 1 文件，存于 H:/ChaotangBackups/worktree-rescue-20261007/g3-p03-audit-20260930/）。
- D 盘 OrcaWorkspaces 25 个 worktree 为当日活跃会话，按 ADR 0045 收尾清单由各会话自行回收。
- ChaotangStaging 237 → 5 项：228 项测试产物归档至 H:/ChaotangBackups/staging-archive-20261007/（同盘可逆搬移，附 MANIFEST.md），4 项基础设施保留（git-recovery / python-recovery / playwright-browsers / edge-headless-profile）。
