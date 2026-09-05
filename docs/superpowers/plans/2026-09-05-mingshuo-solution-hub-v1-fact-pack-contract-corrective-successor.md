# 铭硕 exact4 合同纠偏实施计划

任务 ID：`MINGSHUO-SOLUTION-HUB-V1-FACT-PACK-CONTRACT-CORRECTIVE-SUCCESSOR-20260905`

## Status

Draft

本计划 NON_AUTHORIZING，Owner 已允许修改原 exact4 的已确认缺陷，不再要求 donor 字节一致。

## Baseline and lineage

- base: 67f01c0028e0b1592f2db3b764b374213e380f0d
- tree: 1e8ea1ec042a8e1c7419c6d5a8a587064986fde8
- byte donor: e278fb9dda62febe04fca41c6f7e6955aac994a6 / c7534267ef2c44bdaa52f16d93b3309ca101ada8
- donor parent: 0cae055589a18373137b76f44113cbbcd03091b8
- donor bundle: sha256:df91b1fbcd8c4191344b1d56eeb6fdd80ce0322ea795c4840d60a8b88b7ac86a
- lineage: 0cae055589a18373137b76f44113cbbcd03091b8 -> 72170468848010dcb1282c0a135e7495108607bf -> 67f01c0028e0b1592f2db3b764b374213e380f0d; each edge is a direct single-parent edge.
- Delta: one capability-registry approval then 16 readonly-registry projection paths, with zero overlap against the four product paths below.
- Old donor and temporary 7217046 lineage draft: BYTE_DONOR_ONLY / NO_CANDIDATE_IDENTITY / NO_VERIFICATION_INHERITANCE / NO_REANCHOR.


## Goal and scope

先完成铭硕真实需求到交付归档闭环的离线合同前置；本包不声称完整纵切完成。

- `docs/contracts/mingshuo-project-fact-pack.schema.json`
- `docs/contracts/mingshuo-project-fact-pack.v1.md`
- `scripts/mingshuo-fact-pack.mjs`
- `scripts/mingshuo-fact-pack.test.mjs`

四条均 ADD/100644。approval 仅三条：
- `.harness/approvals/MINGSHUO-SOLUTION-HUB-V1-FACT-PACK-CONTRACT-CORRECTIVE-SUCCESSOR-20260905.json`
- `docs/product/tasks/2026-09-05-mingshuo-solution-hub-v1-fact-pack-contract-corrective-successor.md`
- `docs/superpowers/plans/2026-09-05-mingshuo-solution-hub-v1-fact-pack-contract-corrective-successor.md`

## RED / GREEN plan

1. 新 approval 落地且新 task machine GO 后，物化旧四文件形成可执行基线。
2. 在同一测试文件增加真实反例：每层结构/未知键/枚举、被拒绝或拟议证据、PRICE与报价/审批人组合、闰日/非法日期/空或null时钟、summary错误输入。
3. 运行 focused 证明旧实现断言失败，保留 RED。不是模块缺失 RED，不继承旧测试结论。
4. 实际使用 schema 的版本化约束。不得仅 JSON.parse schema 后自报有效；对错误形状提前 STOP。
5. 引用 ADOPTED 且未过期证据才能计覆盖；缺证据 HOLD。PRICE 或报价需声明 APPROVED+非空 approver，否则 BLOCK。
6. 日期为有效日历日期；now 为合法 UTC 日期/时间，非法 STOP。validate和summary对非法输入均给出确定性结果。
7. 旧危险标志、外部发布、知识晋级和第二事实源负测保持。规则优先 STOP/BLOCK/HOLD/PASS，不赋予任何生产/价格/渠道真实授权。

## Verification and reviews

运行 approval manifest 九项冻结矩阵。正式验收按当前工程规范在同一版本完成10轮全矩阵，逐条保存stdout/stderr/exit/digests。进程级POSIX临时目录可用；不更改持久配置。

独立 Governance、TypeScript/contract、Security 三审。任一 P0–P2 或门禁失败禁止 candidate 落地；纠偏只限本 exact4，范围扩大停止。

## Commit and recovery

三文件治理单亲提交→普通快进→一次 authority→exact4 TDD→完整验证/三审→最终字节与证据冻结→本地单亲 candidate→machine verify→普通快进。远端检查每次绑定对应冻结身份；不 re-anchor 已签发 approval。

旧 donor与临时草案保持只读。无生产部署、真实客户资料、外部发布、API/DB/Harness改动。回滚需求留给独立 forward-only change，不改写历史。

## Milestone checklist

- [ ] 本包：铭硕事实包校验真实失效关闭。
- [ ] 后继：V2 需求输入接入既有拟旨/任务事实。
- [ ] 后继：证据化方案与报价草案，人工确认、下载、归档和反馈。
- [ ] 后继：同版本浏览器、黄金任务、真实监督 Pilot、回滚 RC；未完成不得计为通过。
