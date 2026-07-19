# 任务：docs-absorption-ledger-20260718

## 任务 1：吸收台账登记

- 目标：22 项骨架外创意全量登记，六档裁决。
- 前置条件：业主批准吸收节奏牌 A + 大神会审建议。
- 输入：业主四路挖掘报告 + 本机核实结果。
- 输出：`absorption-ledger.md`。
- 涉及文件：本 change 目录内新增。
- 状态 / 数据变化：无运行态变化，docs-only。
- 验证命令与证据：本机来源 `git branch -a` / `ls` / `git log` 逐项实证；远端标 UNVERIFIED-REMOTE。
- 回滚边界：删文件即回滚。
- 完成定义：每项有档位、裁决列、核实状态、入口命令。

## 任务 2：③ 档文档级吸收（两份）

- 目标：钦天监签字台账协议 + 红蓝对抗部门模板落入本 change。
- 前置条件：原始来源直读（非转述）。
- 输入：`~/CHAOTANG_钦天监_待裁台账.md`、`~/legal-agent` README。
- 输出：`protocol-qintianjian-signoff.md`、`template-red-blue-adversarial.md`。
- 涉及文件：本 change 目录内新增。
- 状态 / 数据变化：无。
- 验证命令与证据：吸收内容与原档比对（本 session 已直读）。
- 回滚边界：删文件即回滚。
- 完成定义：只吸收通用形态，不搬运 openclaw 具体待裁项。

## 任务 3：候选收口

- 目标：docs-only 候选，业主 diff 审批后 commit。
- 前置条件：任务 1–2 完成。
- 输入：本 change 全部文件。
- 输出：staged diff + doctor 证据。
- 涉及文件：本 change 目录。
- 状态 / 数据变化：Git staged；不 commit、不 push。
- 验证命令与证据：`node scripts/harness-doctor.mjs` 0 errors；`git status` 只含本 change 目录。
- 回滚边界：`git restore --staged` + 删目录。
- 完成定义：业主批准前保持 staged。

## 后续（不在本包）

- ① 档三件（户部红线+审计闸、事故日夹具、pack_rd 锚）各开独立 packet。
- 闭环真实度审计包（主线 A 第一步）。
- ② 档在上线收反馈后第一吸收循环裁决。
