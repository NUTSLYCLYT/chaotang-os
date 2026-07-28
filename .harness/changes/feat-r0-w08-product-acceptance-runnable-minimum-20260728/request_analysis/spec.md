# 规格说明：feat-r0-w08-product-acceptance-runnable-minimum-20260728

## 背景

R0-W08 已在本地 EXT `d7bfb24e0a9ac272891d476bdc7695259579fc9f` 激活，目标是 Product Acceptance Hardening。用户批准创建 isolated RUNNABLE_MINIMUM Packet，优先跑通一份黄金合同的真实闭环证据形状，后续再扩展到完整 W08 验收。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | W08 v2 authority 返回 GO | `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W08` | EXT Master Governance | 否 |
| 已确认事实 | 已在既有 true-loop 下新增 W08 product acceptance harness | `backend/harness/chaotang-true-loop/product_acceptance/` | 后端 harness tests | 否 |
| 已确认事实 | 当前只包含 1 个 RUNNABLE_MINIMUM 黄金合同 | `golden_cases/w08_contracts.json` | validator | 否 |
| 未完成 | 36 黄金合同、10/10 浏览器流、5 人用户测试尚未执行 | 不适用 | W08 后续 Packet | 是，阻止 W08 closeout |

## 数据流与调用链

```text
/shangshufang upload
-> MissionContract
-> EvidencePacket
-> RiskItem
-> FinalMemorial
-> ContractReviewPack
-> ArtifactManifest PDF/DOCX/JSON
-> authorized download
-> /shiguan audit replay
```

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| W08 golden contract case | `backend/harness/chaotang-true-loop/product_acceptance/golden_cases/w08_contracts.json` | W08 validator、后续 browser QA | `test_w08_product_acceptance_harness.py` |
| W08 acceptance validator | `backend/harness/chaotang-true-loop/product_acceptance/scripts/run_w08_acceptance.py` | 后端 harness、QA auditor | CLI exit code and JSON result |
| Backend harness registration | `backend/harness/manifest.json` | `backend/scripts/harness_doctor.py` | manifest required file checks |

## 范围

- 在既有 `chaotang-true-loop` 下新增 W08 产品验收 harness，避免创建第二真实闭环主线。
- 新增 1 个中文制造业/B2B 合成黄金合同样本。
- 新增 focused pytest 覆盖正向和反向验收规则。
- 登记 backend harness manifest。

## 非目标

- 不关闭 W08。
- 不激活 W09。
- 不新增页面、Agent、BFF 或第二状态机。
- 不 push、不部署、不迁移数据库、不操作 3050。
- 不声称 36/36、10/10 或 5 人用户验收已经完成。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| 浏览器流标记为 mock | validator FAIL | negative pytest |
| audit replay 不走 `/shiguan` | validator FAIL | negative pytest |
| ContractReviewPack 缺 PDF/DOCX/JSON 或 lineage | validator FAIL | negative pytest |
| RUNNABLE_MINIMUM 样本有效 | validator PASS | runner CLI |

## 风险与回滚边界

风险：RUNNABLE_MINIMUM 被误读为 W08 完成。缓解：mode 明确为 `RUNNABLE_MINIMUM`，targets 保留完整 W08 数字，Packet 状态为 `VERIFIED_PARTIAL`。

回滚边界：删除本 Packet 新增 `product_acceptance` 目录、focused test，并从 `backend/harness/manifest.json` 移除对应 required/test 项。

## 计划确认记录

- 批准人：User / Product Owner
- 批准日期：20260728
- 批准范围：基于本地 EXT `d7bfb24e` 创建 isolated W08 Product Acceptance RUNNABLE_MINIMUM Packet，优先跑通一份黄金合同验收证据入口。
- 明确未批准：push、部署、数据库迁移、3050 操作、W09 激活、最终 W08 closeout。

## 验收标准

- W08 acceptance runner 返回 `passed: true`、`mode: RUNNABLE_MINIMUM`、`cases: 1`。
- focused pytest 覆盖正向 case 和 mock/replay/artifact-lineage 反向规则。
- 后端 harness manifest 可识别新 harness。

## 验证计划

- `python3 -m pytest -q backend/tests/test_w08_product_acceptance_harness.py`
- `python3 backend/harness/chaotang-true-loop/product_acceptance/scripts/run_w08_acceptance.py`
- `python3 backend/scripts/harness_doctor.py`
- `node scripts/harness-doctor.mjs`
- `git diff --check`
