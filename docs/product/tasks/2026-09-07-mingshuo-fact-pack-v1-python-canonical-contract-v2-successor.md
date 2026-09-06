# 铭硕 Fact Pack V1 Python Canonical Contract V2 Successor

任务 ID：`MINGSHUO-FACT-PACK-V1-PYTHON-CANONICAL-CONTRACT-V2-SUCCESSOR-20260907`

冻结基线：`origin/ext-dev@2ab21713ec6b6f9b680b482f51cd9616ed9914d3`；tree：`efedf636d91374a2833de99f8886a03c07022fd5`。

> 状态：`DRAFT / NON_AUTHORIZING / READY_FOR_OWNER_EXACT_DIGEST_CONFIRMATION`。本包只纠正两个 predecessor draft 的 review findings。它们均为 `NO_GO / DRAFT_EVIDENCE_ONLY`，不得 re-anchor、物化或提交。

## Status

Draft

## Product Definition

将铭硕 Fact Pack 的唯一语义 evaluator 置于后端 Python；Node 仅为无业务语义的本地兼容 adapter。它不接 API/UI/Scene Pack/报价/确认/下载/史馆。此前 Node-child bridge 因不能证明 egress deny 被拒绝；初版 Python migration 因 wire corpus、projection、interpreter identity 与清退合同不足被拒绝。

Python 是唯一 `PASS/HOLD/BLOCK/STOP`、business reason 与摘要实现；Node 不含事实、证据、价格、日期、发布、知识或安全 gate。

## Acceptance Criteria

- [ ] machine GO 后才可实施 exact7：`4 ADD + 3 MODIFY`，路径严格为 manifest 清单。
- [ ] JSON-wire golden corpus 是唯一跨语言 oracle。每 entry 冻结 exact UTF-8 JSON bytes、UTC clock、人工审计 expected closed output、`legacyNodeSemanticSourceSha256` 与 `pythonCanonicalEvaluatorSourceSha256`；后两者不能混用。JS `NaN`、accessor、`toJSON`、cycle、sparse array、array property 只保留为 Node 自身防御测试，不能冒充 wire equivalence。
- [ ] Python strict parser 拒绝非法 JSON、重复键、unknown field、无效 clock；local-only schema 禁止 remote `$ref` retrieval 并以测试证明不发生网络请求。输入最大 `1048576` bytes、depth `64`、container nodes `32768`；超限为 stable redacted `STOP`。
- [ ] 结果是递归 closed projection：顶层仅 `schemaVersion`、`decision`、`nonAuthorizing`、`errors`、`holdReasons`、`blockReasons`、`evidenceDigest`、`factDigest`、`claimDigest`、`summary`、`businessSuccessMeasured`、`productionPromotionAuthorized`。前三个 reason arrays 只含排序去重的 `[A-Z][A-Z0-9_]{2,95}` strings、每组不超过128。三个 digest 仅 `sha256:<64 lowercase hex>` 或 null。`summary` 仅为 `{schemaVersion,decision,counts,coverage}`；`counts` 键固定为 `facts,claims,evidence,errors,holds,blocks` 的 `0..32768` integer；`coverage` 键固定为 `evidence,claims` 的 `0..1` number。所有对象拒绝未知键、所有数组有上限，禁止 project/SKU/claim/evidence/source/customer/free-text 及原始输入泄漏。
- [ ] Node adapter 仅接受无位置参数的 `--check` 或 `--evaluate-wire`；后者把 stdin bytes 原样传递给固定 Python wire interface。Node test 必须断言 legacy semantic exports 不存在、未知参数拒绝；non-wire JS 值在 Node API boundary 拒绝，并由 Python strict JSON parser 覆盖 wire-input 拒绝。
- [ ] adapter 只在 Linux 的 `/usr/bin/python3.12` regular non-symlink、root-owned、非 group/world-writable、版本精确 `3.12.3` 时可用；固定 repo root cwd、canonical Python source 与 local schema 均为 regular non-symlink，并以 adapter 内冻结的各自 SHA-256 manifest 验证。无 PATH、用户 interpreter/path、secret/proxy forwarding；`shell:false`、argument array、locale-only env。
- [ ] adapter stdin/stdout/stderr 上限为 `1048576/65536/16384` bytes，timeout `5000ms`；任一超限、extra output、nonzero、timeout 或 source identity drift 都输出不含原文的 `STOP`。超时先向独立 process group TERM，等待 `250ms`，再 KILL，随后 wait/reap；测试断言无 orphan child。
- [ ] Python golden 与 Node `--evaluate-wire` 都逐字等于 corpus expected result；adapter equality 不是唯一证明。focused/backend-full/Ruff、Node、Harness/self-test/doctor/doctor-tests/hook、`TMPDIR=/tmp` authority regression、V2/diff和同一最终字节10轮全绿；Governance/Python/Security 三审无 P0/P1/P2。

## Delivery Constraints

- 不改 API、Scene Pack、BFF、前端、数据库、WorkProduct、史馆、军机处、认证、租户、Harness、authority 或系统服务。
- 不读取客户数据、凭据、IMA、MCP、网络、模型或第三方服务；不发布、不报价、不下载、不归档、不部署。
- 不创建 generic subprocess executor；Node adapter 仅为本地 dev compatibility，正式 backend consumer 只能 import Python evaluator。
- PASS 不代表事实真实性、商业成功、人工批准、可交付或生产资格。

## Affected Modules

- 模块：Mingshuo Fact Pack Python canonical evaluator、wire oracle和Node compatibility adapter。

- 允许路径：`backend/app/mingshuo/__init__.py`；`backend/app/mingshuo/fact_pack.py`；`backend/tests/test_mingshuo_fact_pack.py`；`docs/contracts/mingshuo-project-fact-pack.v1.golden.json`；`docs/contracts/mingshuo-project-fact-pack.v1.md`；`scripts/mingshuo-fact-pack.mjs`；`scripts/mingshuo-fact-pack.test.mjs`。

## Technical Plan

1. formal governance commit → machine GO → unique exact7 candidate；漂移或 STOP 立即停。
2. 从现有 Node evaluator 审计后的 JSON-wire fixture 生成 golden corpus；先写 Python RED，保留 JS-only defensive cases。
3. 实现 local-only schema、current business gate、closed serializer 与 source manifest；Node 删除 semantic branches，只作 pinned Python relay。
4. 完整矩阵、10轮、三审、machine verify-candidate PASS 后才可 direct-child commit/fast-forward。

## Implementation Report

本包是 `MINGSHUO-FACT-PACK-V1-PYTHON-CANONICAL-CONTRACT-CORRECTIVE-SUCCESSOR-20260907` 的 forward-only review corrective draft；未写产品、未提交、未推送、未运行客户/网络/生产动作。

## Acceptance Review

`DRAFT_ONLY / PRODUCT_NOT_AUTHORIZED`。任一第二 evaluator、remote ref、raw-field output、identity drift、非-wire coercion、orphan child、范围扩大、机器 STOP 或三审 P0/P1/P2 均停止。
