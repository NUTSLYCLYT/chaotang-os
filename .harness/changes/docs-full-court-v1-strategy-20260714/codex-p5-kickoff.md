# P5 开工提示词（整段发 Codex）+ 两项待批提案

> P4 已 v2 GO（e7c2997）。方案已出 v2.3（回滚语义改 kill-switch，文本与实现对齐）。

## 发给 Codex 的正文

```text
P4 已 GO。按 FROZEN PLAN v2.3 开工 P5（alembic-single-authority），并执行
一个前置微包。纪律重申：合 ext / push 前必须出示 Claude PACKET_REVIEW_GO
token——P4 的 D6 是最后一次事后追认。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
前置微包 P4.5 语义冻结（用户批准后执行；一 commit 一断言一 migration 的
micro-packet 粒度：免全套 spec/tasks，保留 ci_summary+DB 指纹）

P4.5a EmperorDecision.kind：加列（edict_confirm/compat_dispatch/final_verdict），
  按现有 action 字符串回填（alembic 012）；TDD——先写"无 kind 行必须失败"断言。
P4.5b direct 语义封口：入队时写 direct_enqueued，worker 完成后才置终态；
  先写"worker 完成前状态不得为终态"的 RED 断言。ING-04 缺口就此冻结。
P4.5c 质量门搬门框：quality_gate 调用从 swarm_review 内部抽到独立模块边界
  （import seam），逻辑零改动；架构守门加"生产者模块不得直接判门"断言。
P4.5d CourtReview 构造点冻结：架构守门禁止新增 CourtReview 写入点，
  现有 7 个登记造册（拆表归 FCV1-009，本包只止血）。
P4.5e DepartmentMemorial 供给侧：memorial_from_swarm_result 把现有 sections
  投影成 department_memorials 数组（含 signal/source_label）——P4a 读模型
  主路径即刻激活；一等对象表不建（归 FCV1-007）。
P4.5f tenant 扩展半步：主链新写入行带 tenant_id（nullable+默认租户，
  alembic 013 expand-only）；contract 归 FCV1-002。

每步 RED→GREEN 证据 + DB 三元指纹。全部完成一次停审。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
P5 迁移权威归一（按方案 v2.3 原文执行，注意范围递减登记：
alembic 005 三连修已随 P1 落地，不重复修）

- create_all 降级 dev-only；生产路径启动断言 Alembic head，否则 fail-fast；
- flow_store 手写 DDL/索引补丁迁入正式 alembic 版本后移除；
- expand/contract 双起点证据（旧库升 head / 空库从零到 head）；
- 与 P4.5 的 012/013 迁移串号协调，勿分叉。

完成后末行 PACKET_P5_READY_FOR_CLAUDE_REVIEW。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
附：每日心跳（用户批准后装）：cron 每日在 ext HEAD 跑
真浏览器旅程+代表套件+DB 指纹，红了当天报。
```

## 待用户批的两项（批复词建议直接说"批 微包"/"批 机器闸"）

1. **P4.5 语义冻结微包**（上文 a–f）——三个单向门今天封口最便宜；
   Bezos/Hickey 会审结论在案（2026-07-16）。
2. **D6 机器闸**：pre-push hook 校验 packet-reviews/ 存在对应 GO 报告，
   无 GO 拒推 ext。人门三次被跳，改机器门。
