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
P4.5b direct 语义封口（契约兼容式，v3 修正）：`direct_completed` 属 Step 0
  冻结 status 契约、前端在消费——**不改既有枚举**。改为加法：DecisionTask
  增加 `execution_state` 派生字段，读模型透出；status 枚举原样保留并在
  ADR 注记"direct_completed=受理完成语义"。

  规格方法论 v6（前五版反复漏的根因：审查者在用发明的事件名写判定表。
  改为交付方法+验收不变量，判定表由 Codex 基于真实词表构建）：

  第一步 **词表盘点**（交付物 event-vocabulary.md）：从代码穷举当前全部
  DecreeExecutionEvent event_type（初查仅有 routing.decided / dispatch.queued /
  dispatch.started / reports.completed / memorial.direct_completed 及 outbox
  的 route.direct/council）与全部执行工件表；**注意现行词表没有任何失败
  事件类型**——若确认失败路径无账本词汇，先补加法事件类型（如
  dispatch.failed / reports.failed），这是本步的一部分。

  第二步 **有序判定表**（first-match-wins + 末行 catch-all）：对真实输入
  （事件集合 × 工件存在性 × mode）逐行匹配，**末行必为 inconsistent+
  quarantine**——全函数性由构造保证，不靠枚举自觉。

  第三步 **性质测试**：全组合穷举断言"有且仅有一行命中"；至少五个真实
  路径 fixture（现行 direct no-op、council 成功、council 失败、council
  部分、回执后补真实执行）。

  验收不变量（判定表内容必须满足，形式不限）：
  a) completed 需要 成功语义终态事件 × 真实工件 两证齐全；
  b) 失败事件一票定性 failed，部分工件不得洗白；
  c) 现行 _execute_direct no-op（outbox_worker.py:62-77）必须落 receipt_only；
  d) 说明性/记账事件不得参与终态判定；
  e) 任何未覆盖组合 → inconsistent+quarantine，永不猜测。
P4.5c 质量门搬门框：quality_gate 调用从 swarm_review 内部抽到独立模块边界
  （import seam），逻辑零改动；架构守门加"生产者模块不得直接判门"断言。
P4.5d CourtReview 构造点冻结：架构守门禁止新增 CourtReview 写入点，
  现有 7 个登记造册（拆表归 FCV1-009，本包只止血）。
P4.5e DepartmentMemorial 供给侧：memorial_from_swarm_result 把现有 sections
  投影成 department_memorials 数组（含 signal/source_label）——P4a 读模型
  主路径即刻激活；一等对象表不建（归 FCV1-007）。
P4.5f tenant 扩展半步（v2 修正——蓝图 Step 1A 禁止假定默认 tenant）：
  加 nullable tenant_id 列（alembic 013 expand-only）；新写入行从真实请求
  上下文取 tenant（user 映射可得则写，不可得则留 NULL 并计入 quarantine
  清单——**禁止填默认租户**）；存量行不回填（归 FCV1-002 按回填 ADR 处理）。
  RED 断言："新写入在有租户上下文时 tenant_id 不得为 NULL"。

每步 RED→GREEN 证据 + DB 三元指纹。全部完成一次停审。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
P5 迁移权威归一（按方案 v2.3 原文执行，注意范围递减登记：
alembic 005 三连修已随 P1 落地，不重复修）

- create_all 降级 dev-only；生产路径启动断言 Alembic head，否则 fail-fast；
- flow_store 手写 DDL/索引补丁迁入正式 alembic 版本后移除；
- expand/contract 双起点证据（旧库升 head / 空库从零到 head）；
- 与 P4.5 的 012/013 迁移串号协调，勿分叉；P4.5 两笔迁移落地时 create_all
  路径仍在（P5 才退役），故 models.py 与 alembic 必须同 commit 同步改，
  autogenerate 白名单核对后再提交——防 DATA-02 已知的"白名单不覆盖新表"坑。

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
