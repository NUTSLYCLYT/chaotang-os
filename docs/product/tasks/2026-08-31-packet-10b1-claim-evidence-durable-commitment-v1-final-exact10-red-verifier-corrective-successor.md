# Packet 10-B1 — Exact10 RED Verifier Corrective Successor

任务 ID：`PACKET-10B1-CLAIM-EVIDENCE-DURABLE-COMMITMENT-V1-FINAL-EXACT10-RED-VERIFIER-CORRECTIVE-SUCCESSOR-20260831`

## Status

Draft

`NON_AUTHORIZING / READY_FOR_OWNER_CONFIRMATION / FORWARD_ONLY_SUCCESSOR`

## Product Definition

本 successor 以已落地主线的 approval commit `d7561f0bf213959c564f4f37636741792719dff7`、tree `5d2d6ab6afd90c9dc463cc8ccaf67d532120bf6d` 为唯一基线。前序 exact10 authority 已被本地候选 `4cbccf5c5d7a442c96a370734696053931042bf5` 消费；该候选在 machine verify-candidate 阶段返回 `STOP / VERIFICATION_FAILED`，不得重试、恢复、继承或 re-anchor。

产品字节、产品矩阵与三路独立审查均已通过。唯一机器失败来自 `candidate-compatibility-red-evidence` 的解析器：pytest 在机器精简环境中输出 `FAILED <node-id> - <reason>`，旧解析器把整段文字当作 node ID，与冻结 node ID 列表比较后误报 `RED_TOPOLOGY`。实际内层测试精确为冻结五节点、exit code `1`、无 `ERROR/XPASS/XFAIL/SKIPPED`、终态 `5 failed`。

本包只纠正治理 manifest 中的 RED 失败行解析，不修改 `product-authority.mjs`、Harness 或产品实现。新 candidate 必须从被拒绝候选 byte-for-byte 重物化 exact10，并在新的 one-child authority 下重新运行完整矩阵与机器验收；不得继承旧 candidate、验证、审查或 authority 身份。

冻结 exact10 donor：

- donor commit：`4cbccf5c5d7a442c96a370734696053931042bf5`
- donor tree：`a8e5138f8b759fafd54eb97f8d66ff5715c2d6e1`
- exact10 bundle：`sha256:b331117a553c95d616c7c5bbef5a7f2f43c1031453f1f935ebab582ac1294243`
- full-index diff：`sha256:583f451f9ae76baad2a4f92fd9b90f08f300d8375aba81b0f5ca7b928af892d9`
- RED evidence：`sha256:ca92801d75dece6afca63d7bf9172db80590484e197e478d58a5c980ccdcc1be`
- 状态：`BYTE_DONOR_ONLY / NO_CANDIDATE_IDENTITY / NO_VERIFICATION_INHERITANCE`

纠正后的解析器只接受 `FAILED` 后第一个无空格 node ID，并可选忽略 pytest 的 ` - reason` 展示后缀；仍精确要求五个 node ID 同序、exit code `1`、无异常 summary、且仅有一个 `5 failed` 终态。它不得按数量宽松接受其他失败，也不得过滤、跳过或修改测试选择器。

## Acceptance Criteria

- [ ] approval commit 是 `d7561f0b...` 的直接单亲子，只包含本包三份治理文件。
- [ ] 新 authority 只批准一个 exact10 product child，旧 authority 与 `4cbccf5c5...` 永久保持不可继承。
- [ ] candidate 精确为 `0 ADD + 10 MODIFY`，全部 `100644`，无第十一条路径。
- [ ] exact10 十文件 raw/blob/bytes、bundle 与 full-index diff精确匹配冻结 donor。
- [ ] 修正后的 RED verifier 在机器精简环境精确接受冻结五节点及 ` - reason` 后缀，同时拒绝任何节点、顺序、状态或终态漂移。
- [ ] compatibility `102 passed`、focused `274 passed`、P10-A `42 passed`、readiness `13 passed`、Ruff、backend-full、Harness、doctor、hook、authority regression、V2 与 diff check全部通过。
- [ ] Governance、Python、Security 三路独立审查均为 `GO / P0=0 / P1=0 / P2=0`。
- [ ] machine verify-candidate 返回 PASS 后才允许普通 fast-forward；禁止部署。

## Delivery Constraints

- 治理阶段只允许本包三份新文件；产品阶段只允许 manifest exact10。
- 被拒绝候选及其工作区保持不动，仅作 byte donor 和失败证据。
- 不得修改 authority、Harness、runtime registry、readiness 实现、SQLite backup 实现、数据库合同、P10-A、Tenant Principal、史馆或前端。
- 不得放宽测试、删除断言、添加 skip/xfail、改变 backend-full 选择器或伪造 RED。
- 远端漂移、第三种失败拓扑、第十一条路径、任一产品门禁失败或独立审查 P0–P2 时立即 STOP。
- 禁止 force-push、merge、rebase、fetch、pull、Pilot、Release 和生产部署。

## Affected Modules

- 模块：P10-B1 exact10 byte donor；machine-bound compatibility RED evidence parser。
- 允许路径：`backend/app/api/decree_jobs.py`、`backend/app/api/decrees.py`、`backend/app/decree_jobs/models.py`、`backend/app/decree_jobs/storage.py`、`backend/app/decree_jobs/worker.py`、`backend/tests/test_decree_job_storage.py`、`backend/tests/test_decree_job_worker.py`、`backend/tests/test_decree_jobs_api.py`、`backend/tests/test_readiness.py`、`backend/tests/test_sqlite_backup.py`。

## Technical Plan

1. 冻结三文件 canonical/raw/bundle并形成新的三文件 approval commit。
2. 普通 fast-forward approval 后只运行一次新 product authority。
3. 从新 approval commit创建唯一 candidate工作区，byte-for-byte 重物化冻结 exact10。
4. 先独立运行纠正后的 RED verifier，证明精简环境可解析真实五节点；再运行完整冻结矩阵。
5. 三路独立审查 GO 后创建唯一 candidate commit，运行一次 machine verify-candidate。
6. 只有机器 PASS 且远端仍为新 approval 时，普通 fast-forward 推送 candidate；不部署。

## Implementation Report

- 前序 candidate：`4cbccf5c5d7a442c96a370734696053931042bf5`，tree `a8e5138f...`，精确 `10 MODIFY / 100644`。
- 产品证据：compatibility `102 passed`；backend-full `4526 passed, 4 skipped`；focused `274 passed`；P10-A `42 passed`；readiness `13 passed`；全部根级门禁通过。
- 独立复审：Governance、Python、Security 均 `GO / P0=0 / P1=0 / P2=0 / P3=0`。
- 机器失败根因：`DETERMINISTIC_RED_OUTPUT_PARSER_CONTRACT_MISMATCH`，不是产品断言失败。
- 精简环境重放捕获的内层结果仍为精确五节点和 `5 failed in 2.09s`；旧正则错误保留 ` - reason` 后缀。

以上仅为 predecessor evidence。新 successor 必须重新生成 authority、candidate、验证和机器验收身份。

## Acceptance Review

等待 strict JSON、重复键拒绝、Draft 2020-12 schema、`validateApprovalManifest`、`productTaskErrors=[]`、完整 Harness、canonical/raw/bundle及 Governance/Python/Security 独立治理审查。本文件本身不授权产品实施或部署。
