# 任务：六部 Readiness 复审证据前向修复

> Task ID：`SIX-MINISTRY-READINESS-PROVENANCE-FORWARD-FIX-20260816`

## Status

Ready

## Product Definition

- 事实基线：`origin/ext-dev` 已前移到双编排重新批准提交
  `61971de5c2375be20462372582d8465c6e789a26`，不能通过 force-push 或历史改写替换；该批准建立在
  readiness provenance 缺口仍存在的父提交上，所以治理修复落地后必须再次重签。
- 问题：该基线的 Python verifier 只在 review status 为批准态时检查第三个历史指纹，且 Python 与
  根 Harness 都同时接受 `approved` 和 `approved-with-notes`。这允许把真实的
  `approved-with-notes` 静默抬升为 `approved`，形成 review provenance 冒领。
- 目标：用一个普通 forward-only 子提交，让 Python verifier 与根 Harness 同时精确锁定历史状态
  `approved-with-notes` 和历史指纹，并覆盖 status-only 与 null-fingerprint 降级负例。
- 非目标：不改 readiness report/schema、历史 reviewed fingerprint、67 文件内容指纹、产品运行时、
  API、数据库、Provider、前端、双编排候选或远端历史。

## Acceptance Criteria

- [ ] Python verifier 无条件要求历史 review status 精确等于 `approved-with-notes`。
- [ ] Python verifier 无条件要求 reviewed fingerprint 精确等于历史 `a6c2…`。
- [ ] Python 负例覆盖 `changes-requested/null`、`approved` status-only、批准态 null fingerprint。
- [ ] 根 Harness 使用同一精确 status/fingerprint，并有 `approved` status-only 自测。
- [ ] 69→67 双验证器排除边界、当前内容 `6f4158…` 和历史 review `a6c2…` 保持不变。
- [ ] 全后端 pytest、readiness 专项、Harness、Harness self-test、doctor、M0 regression 与 hooks 全绿。
- [ ] 独立 code/security review 无未关闭 finding。
- [ ] approval commit 是冻结 base 的精确单亲子且只含 3 个 approval paths；candidate 是 approval 的
  精确单亲子且只含 2 个 candidate paths。

## Delivery Constraints

- Base：`61971de5c2375be20462372582d8465c6e789a26`
- Base tree：`0f83ce146163588d1a820fe2a74b2e3d460bf813`
- 禁止 force-push、rebase/改写 `ext-dev`、删除旧候选或修改未列入 packet 的路径。
- approval 只在 Owner 确认 packet canonical digest 后推送。
- candidate 只在 Owner 确认精确 candidate SHA/tree 后推送。
- 回滚：revert 单一 forward-only candidate，不回退或覆盖既有远端历史。

## Affected Modules

- 模块：六部 readiness Python verifier、根 Harness readiness validator、治理审批证据。
- 允许路径：
  1. `backend/tests/test_six_ministry_readiness_report.py`
  2. `scripts/check_harness.mjs`
  3. `docs/product/tasks/2026-08-16-six-ministry-readiness-provenance-forward-fix.md`
  4. `docs/product/tasks/2026-08-16-six-ministry-readiness-provenance-forward-fix.packet.json`
  5. `docs/superpowers/plans/2026-08-16-six-ministry-readiness-provenance-forward-fix.md`

## Technical Plan

- approval 阶段只冻结本 task、machine-readable packet 与 plan，形成 base 的精确单亲子。
- candidate 阶段只把已验证的 status/fingerprint fail-closed 修补应用到两个 validator。
- Python 与 Node 使用同一历史 status、历史 fingerprint、双验证器排除集和当前内容 fingerprint。
- 先运行 provenance RED，再专项 GREEN；最终在精确提交状态执行 packet 九项验证与独立双审。
- 远端只允许普通 fast-forward；任何基线漂移都停止并重新签发，绝不改写历史。

## Verification

使用 packet 冻结的九条离线命令；任何失败、范围扩大或远端基线移动立即 STOP。

## Implementation Report

- 改动摘要：Pending Owner digest confirmation。
- 验证：Pending。
- 独立复审：Pending。

## Acceptance Review

- 结果：Pending。
- 未通过项：Owner 尚未确认本 packet canonical digest。
