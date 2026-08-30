# P10-B1 Durable Commitment Compatibility Prerequisite Successor Plan

## 目标

在 `642848e8bfc960c709372b2fa8c453f189a8ad61 / 6661fb313b52c4773cd67f8717996ddfa98019a7` 上，用唯一 exact6 protected-path successor解除 canonical exact8 shadow 的两个确定性前置阻断，不提交shadow、不扩大P10-B1运行时范围。

## 顺序

1. 冻结exact8八文件identity、bundle、full-index diff、schema digest、65-path runtime fingerprint、successor fingerprint、验证证据和三审结论；authority置为 `ABANDONED_UNCONSUMED / PREREQUISITE_REISSUE_REQUIRED`。
2. 物化本三文件 governance-repair packet，完成strict JSON、闭合合同、Task合同、Harness与独立治理/安全审查。不得把受保护路径伪装进product approval；`PRODUCT_PATH_PROTECTED`只是M0拒绝，不是替代GO，exact6本地实施权仅来自Owner对本packet精确范围的授权。
3. 三文件治理commit普通快进后，在Owner持续授权下实施精确exact6；不修改authority、不自定义GO。
4. 在干净隔离candidate中先形成 registry old/new、observed backup identity、ordered pair原子性和混搭拒绝的真实RED。
5. 只修改exact6；registry保持唯一，backup绑定实际observed digest，validators仅在旧五对后原子追加第六对。
6. 运行focused、backend-full、Ruff、Harness/self-test/doctor/hook、authority regression、V2与diff check。
7. Governance、Python与Security独立审查均无P0–P2且未提交工作树矩阵通过后，创建一次本地单亲candidate commit；然后运行commit结构、mode、diff与hermetic live remote-parent门禁并冻结exact6 identities。
8. 报告精确candidate SHA/tree/parent/scope/bundle/evidence；依据`project-owner.md`等待Owner对该identity和普通fast-forward外部动作的明确确认，未确认STOP。确认后、push前再次运行同一live remote-parent门禁；漂移立即STOP。
9. exact6落地后基于最新ext-dev新签final exact8 successor；从冻结shadow byte-for-byte重物化，重新跑完整矩阵、三审和machine verification后才允许普通快进。

## Exact6 closed contracts

- storage raw identity继续由`8b38c49...`证明；runtime registry observer使用不同闭合投影，其 `decree_jobs.sqlite3` 集合精确为 old `fa4e21...` 与 new `5372895a...`。raw `8b38c49...`、single-ALTER runtime `5d928d42...`、任何第三值、重复、反序或环境注入均拒绝。
- registry document从`chaotang.runtime-data-registry.v2`升为`v3`，以`schemaContractDigests`显式非空有序tuple表达精确predecessor/current compatibility并保持单一RuntimeDataEntry事实源；其他entry均为显式singleton，多值访问不得选择first/default，registry digest随closed shape重算。
- backup capture从同一connection返回实际observed digest；snapshot前后精确相等，manifest写observed，manifest/restore verification同时要求membership与actual==record，禁止new↔old合法值互换和降级。
- readiness现有五对原样同序；只追加 dormant future tuple `[cc42339...,709ebaf1...]`，总数6。exact6自身与落地后observed pair仍必须是现有第五对 `[a6d109de...,709ebaf1...]`；第六对不是exact6当前身份。runtime、successor单边allowlist与笛卡尔积禁止。
- exact6四条registry/backup路径不在69文件review集合内，两个validator是已有exclusions，因此第六pair精确绑定未来final exact8字节，不因exact6自漂移。
- exact6 前后若机械复算不是第五对立即STOP；只有final exact8 byte-for-byte重物化后才允许observed pair切换为第六对。

## 负向矩阵

- old/new/unknown schema、raw identity冒充runtime digest、single-ALTER digest、第三digest、空/重复/反序tuple、runtime环境扩展。
- source old→snapshot new、source new→manifest old、restore digest替换、manifest篡改、backup默认digest冒充observed。
- runtime-only、successor-only、旧runtime+新successor、新runtime+旧successor、第七pair、第五exclusion、Python/Node顺序或策略分叉。
- exact6第七路径、exact8 shadow漂移、远端漂移、machine STOP、P0–P2均fail-closed。

## 验证与审查

以approval manifest冻结矩阵为准；后端全测必须全绿，不再允许此前45项前置失败。Python审查关注dataclass兼容、schema集合与backup/restore identity；Security审查关注downgrade、manifest substitution、环境扩展和fail-open；Governance审查关注单事实源、旧五pair与历史边界不变。

## 回滚边界

approval与candidate均为单亲普通快进提交。未通过machine verification不推送candidate；已落地exact6可由后续forward-only corrective successor修复，不force-push、不改历史、不删除shadow或donor。不得部署。
