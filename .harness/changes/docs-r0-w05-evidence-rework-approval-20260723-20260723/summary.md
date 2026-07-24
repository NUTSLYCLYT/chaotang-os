# 变更摘要：docs-r0-w05-evidence-rework-approval-20260723-20260723

> 执行授权：`NOT_GRANTED_BY_CHANGE_RECORD`
> 本目录只记录需求与证据；产品实施必须绑定获批 amendment 和 exact-HEAD 执行权威。

| 字段 | 值 |
| --- | --- |
| Change ID | docs-r0-w05-evidence-rework-approval-20260723-20260723 |
| 类型 | docs |
| 状态 | EXACT_OWNER_APPROVED_AUTHORITY_GO_REVIEW_PASS_LOCAL |
| Owner | Product Owner / Canonical Runtime Owner |
| 创建日期 | 20260723 |

## 范围

- 主线：以 `origin/feature-chaotang-ext@67bcc78ec5f80d3d1600c676812ddb4cec958eb3` 为唯一 effective base，提议单独激活 `R0-W05`。
- 产品纵切：合同证据契约 + 补证绑定 + generation-bound 局部重算 + 重审 + 新正式奏折替代旧版本 + 对精确新版本裁决。
- 文件：本 change 记录 exact approval，并提议在 W05 专属 review evidence 完成后原子激活 execution-authority v2；产品实现必须另建 implementation change。
- 验证：当前证明 authority fail closed；最终激活候选须运行 root doctor、authority/amendment tests，并证明 W05=GO、W04/W06=STOP；不得据此宣称 W05 产品验收。

## 明确边界

- 一个 DecisionTask、一条 canonical lineage、一个 CourtReview/FinalMemorial 事实源族，不新增第二套任务、review、final 或 archive writer。
- W05 不改前端页面，不生成 PDF/DOCX/JSON 附件，不使用真实客户合同，不安装 LangGraph，不推送、不合并、不发布。
- exact approval 和 manifest 激活完成前，`R0-W05` 必须保持 `STOP / NO_ACTIVE_WORK_PACKAGE`。
