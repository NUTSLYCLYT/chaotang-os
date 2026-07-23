# 任务：docs-r0-w05-evidence-rework-approval-20260723-20260723

## 任务 0：exact identity 与执行权威

- 目标：取得只覆盖 R0-W05 的 exact approval，并让 authority 从 STOP 原子翻转为 GO。
- 前置条件：W04 已 `MERGED_AND_VERIFIED`；受保护主线固定为 `67bcc78e`。
- 输入：base commit/tree、amendment digest、本 spec、Owner approval、独立 review。
- 输出：approval evidence；authority manifest 的 effectiveBase/approvalEvidence/active package/ledger 原子更新。
- 涉及文件：本 change 与 `.harness/manifest/execution-authority.v2.json`；不含产品代码。
- 状态 / 数据变化：只激活 `R0-W05`。
- 验证命令与证据：W05 authorize=GO；W04/W06=STOP；authority/amendment/doctor 全绿。
- 回滚边界：revert 治理提交恢复 `activeWorkPackage:null`。
- 完成定义：exact identity、scope、review 和机器 GO 同时成立。

## 任务 1：TDD RED，冻结补证与证据门

- 目标：先证明当前系统不能完成 evidence-bound rework lineage。
- 前置条件：任务 0 GO。
- 输入：W05 amendment、R0 PRD §3.4、本 spec 边界表。
- 输出：失败测试覆盖证据晋升、原文锚点、stale hash、重复补证、跨租户和旧 generation 迟到。
- 涉及文件：后端 tests 与未来 implementation change；文件清单由实施前调查固定。
- 状态 / 数据变化：只增加测试，先不改实现。
- 验证命令与证据：逐条记录预期 RED 及失败原因；不能用 import/fixture 错误冒充行为 RED。
- 回滚边界：未实现前可独立撤销测试纵切。
- 完成定义：每个关键缺口至少有一个公共 API 或真实数据库 seam 的稳定红灯。

## 任务 2：最小证据合同与补证绑定

- 目标：实现 `EvidencePacketV1`、`ContractRiskItemV1`、`ContractReviewPackV1`，并把补证请求绑定到精确 prior memorial/content hash。
- 前置条件：任务 1 对应 RED。
- 输入：安全摄取 output、人工补证要求、旧 FinalMemorial identity。
- 输出：append-only evidence request/packet、合同风险项和 review candidate。
- 涉及文件：后端契约、模型/migration、service/API；不得改前端。
- 状态 / 数据变化：只追加证据和候选，不覆盖原始输入或旧奏折。
- 验证命令与证据：新增测试 GREEN；证据缺失/冲突/过期/未验证继续 fail closed。
- 回滚边界：关闭 W05 flag，保留历史记录。
- 完成定义：所有 high/critical 结论可解析到版本化原文锚点。

## 任务 3：generation-bound 重奏与重审

- 目标：补证完成后创建唯一新 generation，只刷新受影响 section，并重新走 canonical CourtReview/quality/provenance gate。
- 前置条件：任务 2 GREEN。
- 输入：EvidencePacketV1、prior generation、affected section set。
- 输出：新 generation、重算结果、ContractReviewPackV1、重审候选。
- 涉及文件：复用 W04 outbox/execution identity 和 single writer；不建第二编排器。
- 状态 / 数据变化：append-only generation；旧 generation 迟到结果只留审计。
- 验证命令与证据：重复请求幂等、旧 generation fencing、部分失败保持待补证/复核。
- 回滚边界：停止领取新 W05 generation，不回滚审计。
- 完成定义：任何时刻只有一个 current generation 能影响 current review/final。

## 任务 4：奏折替代与精确裁决

- 目标：通过门禁的新奏折追加为新版本，旧版本 immutable superseded；裁决绑定新 content hash。
- 前置条件：任务 3 的新 review 通过质量与来源门。
- 输入：current generation/review/quality/provenance identity。
- 输出：新 FinalMemorial version、supersedes lineage、精确 EmperorDecision binding。
- 涉及文件：canonical formalization/decision API、模型/migration、史馆兼容读取。
- 状态 / 数据变化：不覆盖旧奏折；stale hash 决策失败。
- 验证命令与证据：旧/新版本并存、唯一 current、迟到/重复/跨租户反例、归档精确版本测试。
- 回滚边界：关闭新版本 promotion；旧版本保持可审计但不得错误恢复为 current。
- 完成定义：补证到新奏折再裁决形成一个可重复的公共 API 端到端 GREEN。

## 任务 5：独立审查、验证与静止收口

- 目标：Standards/Spec 双轴 0 MUST，合并后关闭 W05 而不自动激活 W06。
- 前置条件：任务 1–4 全绿。
- 输入：精确 diff、RED/GREEN、migration/rollback 和公共 API 证据。
- 输出：review evidence、候选 checkpoint、合并后 ledger closeout。
- 涉及文件：implementation/review/closeout change。
- 状态 / 数据变化：合并后 W05=`MERGED_AND_VERIFIED`、`activeWorkPackage=null`。
- 验证命令与证据：backend/root doctor、聚焦回归、真实 API seam、合后 authority。
- 回滚边界：flag 停止新分析；不自动启动 W06。
- 完成定义：合后复验通过，且明确“测试通过不等于已发布”。
