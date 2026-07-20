# 规格说明：docs-r0-trusted-kernel-amendment-20260720

## 背景

产品宪法与 R0/R1 PRD 已把首个 Offer 冻结为中文、中国大陆法域、制造业/B2B 日常合同决策包；旧 M0–M10 仍是宽平台计划，不能直接作为 R0 施工单。G0 inactive guard 已本地验证并推送，但未完成 hosted PR/merge，因此当前只允许起草修正案。

## 当前实现与证据

| 分类 | 结论 | 证据 | 验证 / Owner | 阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | 产品 SSOT 与 22 条 R0 REQ 已冻结 | `PROJECT_PRODUCT.md`、R0 PRD | 文档对账 / Product | 否 |
| 已确认事实 | G0 本地 exact-head verified，远端任务分支已推送 | G0 CI/review summary、`bf99f609` | Git + Claude Code | 是：未 hosted merge |
| 已确认事实 | Direct 伪完成、全局 IMA、合同协议/成果包缺失 | 后端/前端只读代码审计 | 子代理 + 主会话 | 是 |
| 已确认事实 | 前端 core、evaluators、flows、prod doctor 有现行红灯 | 2026-07-20 只读复跑 | 独立审计 | 是 |
| 推测 | 现有 canonical 骨架可支撑合同纵切 | DecisionTask/outbox/门下/FinalMemorial/史馆资产 | 每 Packet RED 验证 | 否 |
| 未知问题 | 文件阈值、OCR 最低线、支持 taxonomy、成果格式、数据来源与法律/数据 Owner | PRD OQ-02～OQ-06、OQ-09/OQ-10 | amendment §5 按最晚 Packet 前置阻断；OQ-01 由本修正案关闭 | 是 |

## 数据流与调用链

```text
SecureContractObject
→ MissionContractV1 draft + exact confirm
→ DecisionTask
→ ChancellorRouteDecision
→ OutboxEvent / canonical executor
→ EvidencePacketV1 / ContractRiskItemV1
→ Menxia + Yushi gates
→ unique FinalMemorial
→ ContractReviewPackV1
→ ArtifactManifestV1
→ server-derived DeliveryStatus
→ EmperorDecision bound to memorial hash/version
→ ArchiveReceipt / Shiguan readback
```

## 接口、数据结构与事实源

| 契约 | 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| Mission/Support/Decision/Status V1 | 后端 Pydantic/OpenAPI | 前端、worker、export | additive version + cross-language fixtures |
| SecureContractObject | 对象存储元数据 + 后端 authz | intake/OCR/analysis/download | immutable digest；旧 IMA 不兼容 |
| Idempotency/lineage/completion | canonical runtime/DB | API、worker、projection | single writer、状态迁移、故障注入 |
| Evidence/Risk/ReviewPack | 合同 review service + gates | FinalMemorial、UI、export | 原文锚点和五裁决一致性 |
| ArtifactManifest | artifact service | delivery、download、archive | hash/version/authz/expiry |
| Release identity | immutable build + release evidence | prod doctor / rollback | exact SHA/digest/schema/runtime identity |

## 范围

- 编制 amendment，完成 22/22 唯一 REQ 映射。
- 提交 amendment validator 与负例测试，验证 22/22 REQ、9/9 退出门及 fail-closed 批准控制。
- 冻结 W00–W09、依赖、Owner 角色、RED、迁移、验证、回滚和 WIP 限制。
- 冻结第一条合成采购 DOCX golden slice 和 `/shangshufang` 页面边界。
- 设计 approval/effective-base/digest 与 execution-authority v2 的交接协议。

## 非目标

- 不实现 execution-authority v2 或任何产品 runtime。
- 不修改前端、后端、数据库、provider、生产配置或 Gitee 设置。
- 不清理 97 个历史分支或 93 个 worktree。
- 不提交当前工作树的三份状态报告或 `shangshufang-live.png`。

## 边界条件

| 条件 | 预期行为 | 证据 |
| --- | --- | --- |
| G0 未合入 | amendment 保持 PROPOSED，effectiveBase=PENDING | summary/amendment |
| 用户笼统同意 | 只记录方向，不替代未来 exact digest/base 批准 | approval protocol |
| 历史分支有独有资产 | 只作 source-only，按新基线重制 RED/GREEN | amendment §8 |
| 任一 REQ 或退出门缺失/重复/错 Owner | committed validator 与人工审查失败 | 22 条 REQ + 9 条退出门映射表 |
| W02–W09 同时被激活 | v2 必须 STOP | W01 RED 设计 |
| required check 不可验证 | 只能 PASS_LOCAL / NOT_ENFORCED | W00/W09 |

## 风险与回滚边界

- 最大风险是把 docs-only 修正案误报为施工批准；通过显式 PENDING 字段、v1 STOP 和未来 exact digest 批准阻断。
- stacked draft 在 G0 squash/rebase 后会更换 base；合入前必须 rebase、重算 digest 并重审。
- 本变更只有治理文档与只读校验脚本；回滚为 revert 本 change，不触及产品 runtime 或运行数据。

## 计划确认记录

- 方向确认人：用户
- 方向确认日期：20260720
- 已确认：从全局收敛、立即起草最优方案、采用产品减法与质量闭环。
- 尚未批准：未来 exact amendment digest、effective base、W01 v2 实现及 W02–W09 runtime。

## 验收标准

- 22/22 R0 REQ 各有且只有一个实现包。
- G01–G09 各有且只有一个度量包，覆盖首个有用风险中位数、缺证显式标记率与 release identity。
- W00–W09 各有前置、价值、RED、退出证据和回滚。
- 第一条 golden slice、页面/API 边界、明确不做和历史 source-only 规则无歧义。
- G0 未合入和 Owner 未批准时不出现 ACTIVE/ENFORCED/R0 COMPLETE 声明。
- root doctor 与 diff check 通过；Claude Code 三路审查无未关闭 HIGH/MEDIUM。

## 验证计划

1. `node --test scripts/r0-amendment-check.nodetest.mjs`，覆盖真实文档与缺失/重复/控制移除负例。
2. `node scripts/r0-amendment-check.mjs`，要求 `22/22_UNIQUE`、`9/9_OWNED`、`canAuthorizeRuntime=false`。
3. `node scripts/execution-authority.mjs --authorize` 仍返回 STOP。
4. `node scripts/harness-doctor.mjs`。
5. `git diff --check` 与精确 scope review。
6. Claude Code Authority、Security、Git/Evidence 三路只读审查。
