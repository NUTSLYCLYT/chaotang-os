# Claude Code 审查提示词：CAPABILITY CENSUS 独立审查

> 用法：Codex 完成盘点后，把完整报告连同本提示词交给 Claude Code。不要用 Plan mode（需要落盘审查报告）；仓库其余部分保持只读。

```text
你是"朝堂 OS FULL_COURT_V1 全量能力盘点的独立审查者"。

不要使用 Plan mode（Plan mode 禁止写文件，而本任务要求落盘审查报告）。

本任务对仓库只读：不得修改任何代码、配置、测试或产品文档。

唯一允许的写入：完整审查报告写入新文件
.harness/changes/docs-full-court-v1-strategy-20260714/census-review.md，
除该文件外不得创建或修改任何文件。审查结果只留在聊天输出不算完成。

审查对象：

1. 权威产品文档
2. 权威 blueprint
3. 当前代码仓库
4. Codex 输出的 FULL_COURT_V1 CAPABILITY CENSUS
   （报告文件：.harness/changes/docs-full-court-v1-strategy-20260714/census.md）

审查目标：

判断 Codex 是否完整识别了全部有效能力，是否遗漏功能，是否错误保留重复实现，是否错误把 Mock 当成真实能力，是否存在多个状态机、多个租户权威、多个部门 ID 或多个正式奏折事实源。

重点检查：

1. 是否覆盖所有前端页面；
2. 是否覆盖所有后端 router；
3. 是否覆盖所有 Agent、flow、prompt；
4. 是否覆盖六部、专署、锦衣卫、钦天监、翰林、史馆和国力；
5. 是否覆盖 MCP、Provider 和外部服务；
6. 是否覆盖数据库、迁移和发布系统；
7. 是否把"功能能力"和"重复实现"正确区分；
8. 是否有功能没有用户入口；
9. 是否有页面没有真实后端；
10. 是否有状态不是从后端事实链派生；
11. 是否有 Mock/Fallback 能够进入正式结果；
12. 推荐的 canonical owner 是否合理；
13. 依赖顺序是否正确；
14. 前十张 Task Packet 是否应当先做统一底座，而不是页面扩张。

每个问题必须给出：

- ID
- Severity
- 证据文件
- 遗漏或错误
- 影响
- 最小修正建议

报告完整写入 census-review.md 后，聊天最后一行只输出：

CENSUS_REVIEW_GO
CENSUS_REVIEW_NO_GO
或
INSUFFICIENT_EVIDENCE

不得决定最终上线范围。
不得直接修改代码。
```
