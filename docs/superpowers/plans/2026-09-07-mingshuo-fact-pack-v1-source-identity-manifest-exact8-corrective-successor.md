# 铭硕 Fact Pack V1 Source Identity Manifest exact8 Corrective Plan

任务：`MINGSHUO-FACT-PACK-V1-SOURCE-IDENTITY-MANIFEST-EXACT8-CORRECTIVE-SUCCESSOR-20260907`

## Status

Draft

## Product Definition

这是 V2 exact7 的 forward-only source-identity corrective。旧 approval、authority、candidate 和验证身份均不继承。approved provenance Markdown 固定 manifest JSON；manifest 固定 evaluator、schema、golden 与 relay。Python 继续独占 Fact Pack 语义，Node 只负责本地、受限、无网络的 wire relay。

来源通过 `O_NOFOLLOW`、single-link 与稳定 FD 读取；Python 从已验证二进制帧执行 evaluator/schema。未来 `v15-exact8-preimage` 再从候选 Git commit object 绑定八文件状态与内容，阻止自洽复制冒充已批准候选。

## Acceptance Criteria

- [ ] 四治理路径与八产品路径分别闭合、排序、无重叠。
- [ ] source manifest 和四来源的 mode/bytes/SHA 与预映像逐字节一致。
- [ ] interpreter root 安全门保持；repo source 不使用不可复现的 uid 身份。
- [ ] 缺失、重复、额外、乱序、path escape、Unicode confusable、symlink、hardlink、mode、bytes、hash、非法 UTF-8 与 provenance drift 全部 fail-closed。
- [ ] stdin 在流式读取阶段有界；校验字节直接执行；异常 child 必须 TERM → wait → KILL → close/reap。
- [ ] machine gate 核验精确 `5A + 3M`、八 blob identity 与 bundle `sha256:a2d2884cd6910443f9db165280175c4dd95736bdfbb85ffe172c9da703cd0197`。
- [ ] 完整矩阵、十轮同字节稳定性、Governance/Python/Security 三审及 machine verify 全绿。

## Delivery Constraints

- 只允许 formal manifest 中的 exact8；不得接 API/UI/数据库/史馆/军机处/发布/报价/外部模型。
- 当前只冻结草案与预映像，不运行 product authority，不提交或推送产品，不部署。
- canonical approval digest 为 `sha256:5f6f619e5dbac3fbd13aedfeb159e7f2140201eb6c852c4729d0bbcfa49e84ed`。四治理文件 bundle 不写回成员，避免自引用，仅在外部验收回报中冻结。

## Affected Modules

- 模块：Fact Pack Python evaluator、source-provenance contract 与 Node relay。
- 允许路径：formal manifest 的八条 product paths。

## Technical Plan

1. Freeze：从 byte donor 出发，机械形成八路径预映像；用 approval provenance 固定 manifest，再由 manifest 固定四来源。
2. RED：复现 uid contradiction、manifest 缺失、closed-set、symlink/hardlink、非法 UTF-8、无界输入与 child lifecycle 缺口。
3. GREEN：fixed root、stable FD、regular/non-symlink/single-link、mode/bytes/hash、canonical manifest、framed verified bytes、bounded streams、reaped child 与 interpreter root/version 检查。
4. Machine bind：`v15` 从候选 Git commit object 核验八路径精确状态、模式、字节、raw SHA 与 exact8 bundle。
5. Verify：Node focused → Python focused/Ruff → backend-full → Harness/doctor/hook/authority/V2/diff → 十轮稳定性 → 三审 → machine candidate verification。
6. Land：仅在实时远端等于 approval commit、candidate 为其直接单亲子且全部 identity 一致时申请 commit/push。

## Implementation Report

最终预映像 targeted 证据：Node `6/6`、Python `4/4`、Ruff、Node syntax、diff check PASS。exact8 bundle：`sha256:a2d2884cd6910443f9db165280175c4dd95736bdfbb85ffe172c9da703cd0197`。未运行完整 backend、machine authority 或 candidate verification；这些证据不构成 candidate 通过。

## Acceptance Review

Pending Owner exact digest confirmation. STOP on remote drift, path expansion, second semantics, trust-chain divergence, product test failure or review P0–P2.
