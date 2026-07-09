---
name: code-review
description: 对前端改动做面向风险和回归的代码审查。
---

# 代码审查 Skill

## 审查重点

- 行为是否满足 spec。
- 是否越过前端工程边界或跨线 API 契约边界。
- 是否削弱 source label、鉴权、租户、发布或风险门。
- 是否引入重复事实源或平行契约。
- 是否需要测试但没有测试。

## 输出

写入 `coding/review/code_review_v1.md`：

- Findings：按严重程度列问题。
- Open questions：仍需确认的问题。
- Verdict：`APPROVED`、`APPROVED_WITH_NOTES` 或 `CHANGES_REQUIRED`。

没有问题时也要明确写“未发现阻断问题”，并说明剩余风险。
