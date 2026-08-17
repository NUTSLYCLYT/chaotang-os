# P0 Contract Triage V1 Plan

## 1. Frozen identity

- Task：`P0-CONTRACT-TRIAGE-V1-20260817`
- Base：`157039a1a6968496b8a72753ab14a7a15c8ae316`
- Base tree：`ee2f6c94a2917462cdd24013a2130095e715a112`
- One user result：合成合同在现有 `/study` 主链得到确定性四态，只有 READY 可由用户点击进入既有
  DecreeJob/REPLY/史馆链。
- One fact source：后端纯 `contract_triage` policy；状态、owner、digest、lineage 不接受 client 或模型提供。

## 2. Single-writer sequence

```text
exact 3-file approval packet
  → Owner confirms canonical manifest digest
  → exact single-parent local approval commit
  → Owner confirms approval SHA/tree and authorizes FF push
  → origin/ext-dev == approval commit
  → M0 --authorize GO
  → RED tests in exact 21 product paths
  → minimal GREEN
  → approved matrix + browser A/B/C + independent reviews
  → exact one-child product candidate
  → M0 --verify-candidate PASS
  → Owner confirms candidate SHA/tree and authorizes FF push
```

从 approval commit 形成到产品候选 landed 或作废，仅
`codex/p0-contract-triage-approval-20260817` 拥有本任务写权。远端漂移、路径扩大或 authority STOP 时立即停止；
不 rebase、merge、squash、force 或复用历史测试证据。

## 3. Vertical slice

1. Pure preflight：恰一条 user 消息、规范化、digest、固定 ruleset 与四态。
2. Draft boundary：non-READY 在调用模型前短路并撤销旧 authority；READY 模型 route 必须精确刑部·合同司。
3. Authority lineage：完整 triage context 随既有 authority、job checkpoint 与 archive projection 单向传递。
4. Signature gate：固定扫描和 renderer；危险或不可解析内容以 `UNSAFE_SIGNATURE_CLAIM` 失败关闭。
5. UI boundary：严格 decoder、诚实状态、固定免责声明；READY 也必须人工点击下旨。

## 4. TDD order

1. RED policy：A/B/C、输入规范化、digest、稳定 reasons/missing、未知/不可信字段。
2. RED side effects：B/C model spy=0；旧 READY authority 被撤销；旧 fingerprint 409；0 job/case/artifact/REPLY。
3. RED route/signature：非精确 route、签署许可变体和扫描失败全部 fail closed。
4. RED lineage：reserve/consume/restore、checkpoint、restart/replay、archive projection 与 cross-owner 篡改。
5. RED frontend：四态 closed parser、未知/不一致字段、`canIssue` 三条件、刷新与重复提交。
6. GREEN：每轮只实现使当前 RED 变绿的最小代码，不做范围外重构。

## 5. Browser and user-test proof

- 真实隔离后端与 SQLite，禁止 mock 证明业务完成。
- 浏览器依次执行合成 A/B/C；检查网络、console、刷新、重复提交、旧 fingerprint、史馆回读。
- Round 0：2名非功能开发者，只排阻断故障。
- Round 1：冻结 landed/deployed 身份后5名目标用户，至少4名无帮助完成；严重安全、隐私、越权或伪完成为0。
- 未确认部署 SHA 前不得提供访问链接或写 `USER_TEST_READY`。

## 6. GO / STOP

GO：exact paths、manifest 全矩阵、浏览器 A/B/C、独立 Code/Python/Security/Browser Review 全部通过；non-READY
零执行副作用；READY 仅一个 job/REPLY；owner/digest/ruleset/lineage 可验证；无签署许可。

STOP：远端漂移、authority STOP、第22路径、状态由 LLM/UI 决定、non-READY 调模型或创建副作用、旧 authority
可复用、archive projection 不闭合、出现无约束签署许可、需要 migration/tenant/upload/runtime/Provider/部署扩权。

## 7. Current gate

当前阶段只有三份未提交治理文件。先验证 manifest closed schema、canonical digest、根 Harness、authority 回归、
路径范围和基线身份；然后请求 Owner 对精确 base + 三文件 digest 的本地 approval commit 授权。未经授权不得
commit、push 或开始产品实现。
