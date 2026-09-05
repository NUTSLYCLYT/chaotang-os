# 铭硕事实包合同集中纠偏 successor

任务 ID：`MINGSHUO-SOLUTION-HUB-V1-FACT-PACK-CONTRACT-CORRECTIVE-SUCCESSOR-20260905`

## Status

Draft

治理说明：DRAFT / NON_AUTHORIZING / READY_FOR_OWNER_CONFIRMATION。正式 approval JSON 的 APPROVED_FOR_ONE_CHILD 是机器消费状态；文档状态、旧报告与本任务本身均不产生产品 GO。

## Product Definition

Owner 于本轮明确第一交付里程碑：铭硕真实需求到证据化方案与报价草案、人工确认、下载及归档。Owner 允许原 exact4 内纠正已确认缺陷，明确解除旧 donor byte-for-byte 要求，并继续既有 approval、machine authority、验证、独立审查、直接单亲候选与普通快进条件链；不部署生产。本包是该完整里程碑的前置合同修复，不代表工作台或业务闭环已实现。

目标用户：铭硕方案/销售工程师。问题：旧非授权离线 checker 对无效结构、拒绝证据、无价格授权和非法日期错误 PASS。目标：四组缺陷集中关闭，并令 validate/summary 对错误输入一致失效关闭。

- base: 67f01c0028e0b1592f2db3b764b374213e380f0d
- tree: 1e8ea1ec042a8e1c7419c6d5a8a587064986fde8
- byte donor: e278fb9dda62febe04fca41c6f7e6955aac994a6 / c7534267ef2c44bdaa52f16d93b3309ca101ada8
- donor parent: 0cae055589a18373137b76f44113cbbcd03091b8
- donor bundle: sha256:df91b1fbcd8c4191344b1d56eeb6fdd80ce0322ea795c4840d60a8b88b7ac86a
- lineage: 0cae055589a18373137b76f44113cbbcd03091b8 -> 72170468848010dcb1282c0a135e7495108607bf -> 67f01c0028e0b1592f2db3b764b374213e380f0d; each edge is a direct single-parent edge.
- Delta: one capability-registry approval then 16 readonly-registry projection paths, with zero overlap against the four product paths below.
- Old donor and temporary 7217046 lineage draft: BYTE_DONOR_ONLY / NO_CANDIDATE_IDENTITY / NO_VERIFICATION_INHERITANCE / NO_REANCHOR.


## Acceptance Criteria

- [ ] MFP-01：实际执行版本化 closed schema；每层 required、未知键、type/null、enum/const、pattern/length、array bounds/uniqueItems 拒绝非法形状；validate 与 summary 不得误放行或因非法 JSON 形状抛异常。
- [ ] MFP-02：被引用证据仅 ADOPTED 且未过期者合格；PROPOSED/REJECTED、缺失或悬空引用 HOLD；摘要覆盖率使用同一规则。格式非法优先 STOP。
- [ ] MFP-03：PRICE 事实或 quoteStatus 非 NOT_REQUESTED 时必须有声明为 APPROVED 且审批人非空的 price authority；缺失则 BLOCK。此为离线声明一致性，不声称验证真实服务器权限。
- [ ] MFP-04：validUntil 必须为真实日历日期，now 必须为有效 UTC 日期/时间；非法值 STOP，过期 HOLD，当天可用。闰日与无效时钟有负测。
- [ ] 保持 STOP > BLOCK > HOLD > PASS；所有输出 nonAuthorizing=true，businessSuccessMeasured=false，productionPromotionAuthorized=false。安全/来源/发布/知识晋级规则不回退。
- [ ] 原六组测试及新增反例通过；新增反例必须在旧 donor 实现上形成真实 RED，不用缺少模块替代。
- [ ] 仅四条 ADD，全部 100644；无第五条产品路径。schema、合同、校验器和测试保持一致。
- [ ] machine GO 后才实施；新候选为新 approval 的直接单亲子，通过 machine verify 后才普通快进。
- [ ] 独立 Governance、TypeScript/contract、Security Review 无未关闭 P0/P1/P2；证据绑定最终 raw/blob/bundle/commit/tree，旧证据不继承。

## Delivery Constraints

- 技能计划：codex-engineering-workflow；Superpowers 所需阶段使用项目允许的 Codex 原生等价流程，不安装额外插件。Codex-only：是。
- 产品范围：原 exact4，只做已确认四组缺陷及其相邻输入/输出一致性修复；不扩展为通用规则引擎或第二 authority。
- 不修改 backend/frontend/API/database、Harness、authority、readiness、租户运行时或史馆 writer，不接 IMA/外部模型/发布通道，不读取真实客户数据或凭据。
- 不自动生成或批准危险配方/设备/EHS操作。离线 checker 只校验声明和结构，不能证明内容真实、安全、认证适用或真实授权。
- 测试允许进程级 POSIX TMPDIR=/tmp；不修改持久环境或 Git 配置。保留原 Git hooks，不跳过门禁。
- 本轮立项依据为 Owner 的明确纠偏授权，不伪称 Owner 已确认尚未计算的 digest。报告实际 digest，并沿已有条件链执行。

## Affected Modules

- 模块：铭硕离线事实包合同和确定性校验。
- 允许路径：`docs/contracts/mingshuo-project-fact-pack.schema.json`；`docs/contracts/mingshuo-project-fact-pack.v1.md`；`scripts/mingshuo-fact-pack.mjs`；`scripts/mingshuo-fact-pack.test.mjs`。
- 依赖模块：既有非授权摘要/严格 JSON 工具可只读复用；不得另建事实源或修改依赖文件。

精确产品路径：
- `docs/contracts/mingshuo-project-fact-pack.schema.json`
- `docs/contracts/mingshuo-project-fact-pack.v1.md`
- `scripts/mingshuo-fact-pack.mjs`
- `scripts/mingshuo-fact-pack.test.mjs`

approvalCommitPaths：
- `.harness/approvals/MINGSHUO-SOLUTION-HUB-V1-FACT-PACK-CONTRACT-CORRECTIVE-SUCCESSOR-20260905.json`
- `docs/product/tasks/2026-09-05-mingshuo-solution-hub-v1-fact-pack-contract-corrective-successor.md`
- `docs/superpowers/plans/2026-09-05-mingshuo-solution-hub-v1-fact-pack-contract-corrective-successor.md`

## Technical Plan

1. 核实实时远端仍为 base、工作区 clean，冻结 strict JSON/schema/manifest/Task 合同、三文件 raw/bundle/canonical 及治理审查。
2. 三文件 approval 独立提交、普通快进，运行一次新 task product authority；非 GO 停止。
3. 从 donor 重物化 exact4 作失败基线，先扩充原测试路径，复现四组真实 RED；保留失败输出与输入。
4. 最小实现 closed schema 实际校验、证据合格规则、价格声明条件、日期/时钟和 summary 失效关闭。
5. 最终版本运行 manifest 完整九项矩阵：diff、focused、CLI check、root Harness/self-test/doctor、authority regression、V2 check/tests。按既有工程规范保存10轮完整矩阵的新鲜证据；任一失败停止计数，修正后重新验证。不将这些非生产检查视为真实 Pilot。
6. 三审 GO 后冻结四文件 raw/blob/mode/bytes、full-index diff、RED/GREEN/verification/candidate evidence。提交一次直接单亲 candidate；machine verify 再检查 exact4 和远端，PASS 后普通快进并复核远端。
7. 不在本包声称 V2、铭硕运行时或真实商业成功完成；后续独立范围接入既有任务/交付/归档链。

## Implementation Report

当前仅编制治理包，未实施产品。2026-09-05 新鲜双审及主控内存复现确认 donor NO-GO：缺失 nested shape、REJECTED evidence、PRICE+NOT_REQUESTED+MISSING authority、空审批人、2027-99-99 和错误 sourcePolicy 均误 PASS；无效 now 可绕过到期或抛异常。旧 PASS 不能覆盖这些反例。

证据：项目外持久目录 mingshuo-lineage-r2-20260905/donor-readonly-probes.json，raw SHA-256 412e0339b179ca71b30607d5599bda0c993fca688ee8acaa3b10ced16c5c505b。

## Acceptance Review

Pending。当前不宣称实现通过。远端漂移、machine STOP、scope 扩大、产品副作用或独立 P0/P1/P2 均停止落地；有缺陷的 candidate 只保留证据。回滚通过后续独立 forward-only 提交，不 force-push、不删除旧证据。
