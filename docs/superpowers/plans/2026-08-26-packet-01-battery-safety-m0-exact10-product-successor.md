# Packet 01 — Battery Safety M0 exact10 Product Successor Plan

状态：`DRAFT / NON_AUTHORIZING / READY_FOR_OWNER_CONFIRMATION / PRODUCT_STOP`

任务：`PACKET-01-BATTERY-SAFETY-M0-EXACT10-PRODUCT-SUCCESSOR-20260826`

基线：`origin/ext-dev@521108316e8609dbea03228d98f801a7c35b5776`

基线 tree：`dd0aa8031b75dca96f1d4ca76bcbbaa6144e9424`

## Phase 0 — Freeze Governance Only

1. 当前只编制 proposed approval、Task、Plan；不得物化 `.harness/approvals/`、运行 authority、修改产品、执行产品测试、commit 或 push。
2. 只读核对远端、base tree、predecessor exact10 donor、完整单亲 lineage、零重叠和 readiness ordered pair。任一漂移立即 STOP，不 re-anchor。
3. proposed approval 使用 `product-authority.m0.approval.v1`；`APPROVED_FOR_ONE_CHILD` 只是未来正式 approval 文件的闭合 schema 值，当前三份草案仍是 non-authorizing。
4. 对三文件执行 strict JSON/duplicate-key、Draft 2020-12 schema、`validateApprovalManifest`、`productTaskErrors=[]`、精确路径/模式/差异、RFC 8785 canonical/raw/bundle 和完整 Harness 检查。
5. Governance Review 与 Security Review 均为只读；任一 P0–P2 先修三文件并重新计算全部摘要。
6. Owner 精确确认 canonical approval digest 后，才可另行授权正式 approval 物化与一次三文件 commit。

## Phase 1 — Future Approval And Authority

以下步骤均需未来新授权：

1. 将 proposed JSON 相同字节物化为 `.harness/approvals/PACKET-01-BATTERY-SAFETY-M0-EXACT10-PRODUCT-SUCCESSOR-20260826.json`；proposed 临时路径不得进入提交。
2. approval commit 必须是当前 base 的直接单亲子，只含 manifest 的三条 `approvalCommitPaths`，模式全部 `100644`。
3. 另获授权后普通 fast-forward 推送；实时远端漂移即 STOP，不 merge/rebase/fetch/pull/force-push。
4. 远端精确等于 approval commit 后运行 machine authority。仅 `GO / APPROVED_FOR_ONE_CHILD` 且 canonical digest 精确匹配 Owner 确认值时，才能申请 product byte 写入。

## Phase 2 — Byte-For-Byte Rematerialization

1. 从新 approval commit 创建唯一干净隔离 candidate 工作区，只允许一个产品字节写入者。
2. 只读重核 donor HEAD `c939bc4d…`、tree `a7ce8710…`、精确十路径、`2 ADD + 8 MODIFY`、全部 `100644`、十文件 raw/blob/bytes、bundle `sha256:df3bb9e…` 与 combined diff `sha256:cd181a1c…`。
3. 将 donor exact10 十文件 byte-for-byte 重物化到新 candidate；不 checkout donor 分支，不 merge/cherry-pick，不继承 candidate、verification 或 authority 身份。
4. 重物化后必须重新得到相同十文件身份、bundle 和 combined diff，且无第十一路径；否则立即 STOP。
5. runtime fingerprint 与 successor fingerprint 分别重新机械计算为 `sha256:da31e809…` 和 `sha256:709ebaf1…`；当前 readiness validators 必须仍原子接受该 ordered pair。

## Phase 3 — New Verification From Zero

在同一未变 candidate bytes 上运行 proposed approval 全矩阵：

1. 20 个安全负向节点，精确覆盖 donor 中新增的全部测试定义：role 注入、P0/P1 draft 前置门与安全路由、P0 同义词与分隔符、软件/物理混合、marker 单调性、P1 non-ready、非法司名 + P0、全部可见输出 guard 与模型层后置门、同步/异步前置门、真实 Registry TOCTOU 和 report provenance/status。
2. exact10 focused pytest。
3. backend-full：执行进程设置 `TMPDIR=/tmp TEMP=/tmp TMP=/tmp`，先确认 Python `tempfile.gettempdir()` 为 `/tmp` 且 POSIX 临时文件 CRUD 正常，再运行 `python3 -m pytest -q`。只改变该验证进程环境，不持久修改任何配置。
4. exact10 Ruff、candidate exact10 structure 和 `git diff --check`。
5. Root Harness、Harness self-test、doctor check/tests、hook self-test、product-authority regression、V2 convergence check/tests。product-authority regression 的进程级 `TMPDIR=/tmp` 同样不得持久化。
6. 任一失败、永久等待、环境 bootstrap/capture 错误、字节漂移、策略分叉或范围扩大立即 STOP；不跳过、不降级、不把环境错误冒充产品通过。

## Phase 4 — Independent Review And Evidence Freeze

1. 全矩阵通过后，由独立 Python Review 与 Security Review 重新审查；predecessor 双审不得继承。
2. Python Review 检查 six findings、18 项历史非-readiness 回归、non-battery replay/crash recovery/idempotency 和 exact10 无越界。
3. Security Review 检查 separator bypass、P1 non-ready、P0/invalid-bureau 优先级、全部用户可见字段、真实 Registry TOCTOU、store/persistence 顺序、provenance/status 和 fail-closed 行为。
4. 任一 P0–P2 为 NO-GO。双审 GO 后冻结十文件 raw/blob/mode/bytes、bundle、combined diff、runtime/successor fingerprint、新 verification evidence digest 和 candidate evidence digest。
5. 完成后 STOP，等待 Owner 对一次本地 candidate commit 的精确授权；machine GO 不自动授权 commit 或 push。

## Phase 5 — Future Candidate Commit And Acceptance

1. 另获授权后，candidate commit 必须是 approval commit 的直接单亲子，只含 exact10、`2 ADD + 8 MODIFY`、全部 `100644`。
2. 提交前后重核 candidate SHA/tree、parent、paths、modes、blobs、raw、bundle、combined diff 和工作树 clean。
3. 若项目 authority 要求连续 candidate verification，则所有轮次必须绑定同一 candidate SHA/tree、approval digest 和验证矩阵；任一失败或字节变化从零开始。
4. candidate push、Pilot、Release、发布和部署均不在本 successor 的自动权限内，分别等待 Owner 授权。

## Evidence And Digest Algorithms

- 文件 raw：对 UTF-8 原始 bytes 做 SHA-256；Git blob 使用标准 Git blob identity。
- exact10 bundle：按 path 字典序组成 `{path,mode:"100644",bytes,rawSha256:"sha256:<hex>"}` JSON array，对 RFC 8785 canonical UTF-8 bytes 做 SHA-256。
- exact10 combined full-index diff：按 path 字典序生成逐路径 full-index binary diff；tracked 相对 donor HEAD，untracked ADD 相对 `/dev/null`；原始 diff bytes 无分隔串联后做 SHA-256。
- 三文件 bundle：同 exact10 bundle 算法，但记录本轮 proposed approval、Task、Plan 三条路径。
- canonical approval digest：strict parse proposed approval 后，对 RFC 8785 canonical UTF-8 bytes 做 SHA-256；不得与 raw SHA 或 bundle digest混称。
- 新验证证据必须记录命令、exit code、candidate SHA/tree、环境归一化、输出摘要与时间；predecessor evidence 只保留历史标签。

## Stop Conditions

- `origin/ext-dev` 离开冻结 base；
- machine authority 非 GO 或 approval digest 不一致；
- donor 或 rematerialized exact10 任一 raw/blob/mode/bytes/bundle/diff 不一致；
- 出现第十一路径、第二写入者、工作树污染或不允许的治理/Harness/validator 修改；
- 负向、focused、backend-full、Ruff、Harness、doctor、authority regression、V2 或 diff-check 任一失败；
- 环境归一化不能保持进程级、测试永久等待或需改变 capture/选择器/并发门禁；
- 独立审查出现 P0–P2。

触发任一条件立即 `STOP / NO_REANCHOR`，保留证据，申请最窄 successor；不得继承旧 authority、候选或验证身份。
