# 任务：fix-canon-idempotency-authority-p25-20260719

## 任务 1：历史与权限裁决

- 输入：P19 B/H/R/M、`7daf/d41`、P21 B/H/R/M、用户批准语句、`docs/README.md`。
- 输出：`authority-adjudication.md`。
- 完成定义：区分“中央删除”“兄弟线未集成”“产品 SSOT”“工程 authority”。
- 状态：`COMPLETE`。

## 任务 2：当前 authority 纠偏

- 更新 P21 atomic spec header、summary、request spec、tasks/rollback/governance/CI 解释。
- 保持 P21 `packet_review/` 两文件零 diff。
- 单一状态变化：`ARCHIVED_SPEC_EVIDENCE -> CURRENT_ENGINEERING_SPEC`。
- 状态：`COMPLETE / RUNTIME_UNCHANGED`。

## 任务 3：验证 H

- 运行 focused 11-file facts regression、root/backend doctor、`git diff --check`。
- 检查只新增一个 P25 root change、P21 packet review 不变、`docs/plans` 零 diff。
- 状态：`COMPLETE / 72 PASSED / 4 SKIPPED / DOCTORS_GO`。

## 任务 4：独立 review 与 D6

- 固定中央 B 与实现 H。
- review-only R 只新增 P25 `review-v1.md`、`approval-v1.json`。
- no-ff M first parent 必须是 B，且 M tree 等于 R tree。
- 状态：`V1_NO_GO_MEDIUM_CLOSED / NEW_H_REVIEW_PENDING`。

## 任务 5：上传与报告

- 推送 M 到 `origin/feature-chaotang-ext`。
- 报告提交 SHA、验证、100/100 的精确含义与 runtime 下一步。
- 状态：`PENDING`。
