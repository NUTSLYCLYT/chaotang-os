# Packet 14 Exact30 Candidate Successor V3 — Consolidated Governed Plan

## Contract

- Task：`PACKET-14-EXACT30-CANDIDATE-SUCCESSOR-V3-20260824`
- Target：`origin/ext-dev`
- Base/tree：`13a78831395c40b2b1bc73d4d6ff9d89d6854af4` / `d7d9d4a9b41e93e029436ae4f95a4c2fd1af7afd`
- Proposed manifest digest：`sha256:ec466d73c16bd0b86cccc26ea67a028b4165364f94d308cde8b5de76207dbd3d`
- Scope：exact30；两个 work-product BFF cancellation 路径保持独立 exact2；不激活远端 exact32 R3。
- Remediation：artifact no-replace、real generation evidence、observed cleanup、bearer zero-persistence 与 Buildx real-CLI compatibility
  五个 P1；visible provenance、
  confirmation/download fairness 两个 P2；1689-byte sealed oracle 全派生矩阵。
- Exit：exact30 候选通过目标分支 canonical authority、全部测试、独立终审和真实预推并获 Owner 产品授权；随后 exact2。

## Sequence

1. 验证 amendment base/tree、closed schema、exact30、oracle source、三文件摘要和远端稳定性；冻结真实失败证据：合同锁定
   Buildx `v0.35.0` 对 runner 的 `buildx inspect --bootstrap --format {{json .}}` 返回 exit `125 / unknown flag`。不得改变
   productPaths、既有 verification、Docker/Buildx/BuildKit 版本或 exact2 边界。
2. Owner 精确接受摘要后，只普通快进三文件治理包并远端双读。
3. 共享主工作区 legacy authority 保持 fail-closed；不得修改、移植或把它解释为 P14 GO，也不得把活字 LangGraph inventory
   漂移带入 `ext-dev`。
4. 旧候选 `54656b4cfc60d4830eb92a4b4735541b4ea4cef1` 仅作失败审计，不修改、不推送；新治理提交落地后，它因 parent 不匹配
   自动失效，不得重用其 exact authorization。
5. 目标分支 canonical product authority 返回精确 GO 后，建立全新 replacement exact30 product child。
6. Buildx P1 先 RED 后 GREEN：新增真实 CLI surface 回归，runner 改用已实证支持的
   `buildx ls --format {{json .}}`，逐行严格解析每 builder 一条 JSON 的 NDJSON，只接受唯一 current Docker builder 且全部 node
   `Status=running` / `Version=v0.31.1`；禁止 mock JSON 单独充当兼容性证明。
7. 逐路径核对 23 条 donor 差异，吸收并行 R3 的安全语义，不复制工作树、不吸收 exact2/exact32。
8. artifact collision、generation graph、cleanup lifecycle、bearer canary 四组 P1 先 RED 后 GREEN。
9. UI provenance、stable-FD confirmation、Owner-fair download lease 两组 P2 先 RED 后 GREEN。
10. runner 独立解码 sealed base64，candidate 只生成 actual；验证 1689/9f1148…、ZIP entries、动态路径与完整派生矩阵。
11. backend focused/Ruff/installed-wheel isolated full、frontend/release/authority/Harness/Doctor/V2 全绿后执行独立
   code/Python/TypeScript/security 终审；禁止 host/user-site split-brain 证据。
12. 在专用发行版先运行 exact Buildx 命令预检，再运行 root + Docker + Chromium 双 Owner + nft + RED；两者绑定同一候选，
   REALSTACK/GENERATION/DELIVERY-BROWSER 三证明互不替代。
13. 冻结 commit/tree/diff/evidence digest 请求 Owner；授权前不推送、release 或 deploy。
14. 普通快进 exact30 并双读；另立 exact2，之后继续 P06-G → P09-B。

## Proof Matrix

- Scope：path-set digest 必须保持 `45a46a2e70a4e8a526287cadef3740e3b6e833159ba5168e5236576f0ba8c276`。
- Backend：focused、Ruff、isolated runtime-lock installed candidate 全量、collision/DB/file identity 负测；runtime-lock 必须绑定
  candidate commit/tree、wheel digest、app/dist-info 路径并仓外自动清理。
- Frontend：tests/lint/typecheck/build、fixture provenance、confirmation、download fairness、cancellation boundary。
- Privacy：raw bearer crash/failure full-tree canary；generation raw/prefixed/structured contamination。
- Cleanup：11-resource lifecycle、terminal probes、residual/identity/daemon/late-recreate negatives。
- Release：evidence 15/15、offline build/verify 46/46、deployment/RC1 69/69，并在最终候选重跑。
- Toolchain：Docker `29.6.1`、Buildx `v0.35.0`、BuildKit `v0.31.1` 不变；真实
  `buildx ls --format {{json .}}` supported-interface 预检必须 GREEN，旧 inspect unsupported flag RED 必须有自动回归且不能由
  mock executor 替代。
- Governance：product authority 12/12、Root Harness/Doctor、Convergence 20/1、目标分支 canonical authority 精确 GO 与 legacy
  authority fail-closed 状态。
- Real chain：root、Docker identity、Chromium 双 Owner、nft deny、RED、REALSTACK/GENERATION/DELIVERY-BROWSER。

## Stop Conditions

- remote/base/tree/digest/exact30/oracle source/任一 authority 漂移或 STOP；
- host/user-site Python 被用作 installed candidate evidence，或 checkout app 与持久 metadata 发生 split-brain；
- Buildx/BuildKit/Docker 版本漂移、降级，或真实 CLI 仍返回 unsupported option；
- 需要第31路径、试图提交 exact32 或直接使用旧 dirty worktree；
- 五个 P1、两个 P2、任何 P0-P2 或真实链路失败未关闭；
- fixture 冒充 generation、expected/actual 同源、cleanup 合成、bearer 落盘、client 自报 PASS；
- 未经独立授权提交、推送、发布、部署产品，或修改生产数据/secret/现有浏览器 profile。

## Rollback

- 治理草案未提交时只放弃隔离 worktree；旧 V2/V3 本地 commit 保留作审计但不推送。
- 治理提交推送后只能 forward successor，不改写历史。
- 产品 child 失败时保留证据并放弃 child；旧 `54656b…cef1` 与 replacement candidate 都不得改写；不 reset、stash、clean
  或覆盖用户资产。
