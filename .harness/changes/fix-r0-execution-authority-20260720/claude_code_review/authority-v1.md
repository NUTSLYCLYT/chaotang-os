# Claude Code Authority 审查 v1

> 历史报告：绑定中间提交 `62e0c317`，已由本目录的 `*-final.md` exact-HEAD 报告取代，不得作为最终 H 的合入证据。

- 审查模型：Claude Code Opus
- 审查方式：独立只读会话，未修改仓库
- B：`4ed5a0379e87c6ea65ed9a3ad89dca962aa785fe`
- H：`62e0c3176e4c3d99f44e45175dba5ebed670a449`
- tree：`00ec1aa2bc4d4dfb14ce8e838705e2e2ec6d9164`
- binary diff SHA-256：`c555b6d7daaf4abf42d4b7dd4bb4f5f01f3e0f22280106fea558caf5ef198ab7`
- 结论：`GO_WITH_ACTIONS`

## 结论摘要

审查确认 v1 resolver 固定返回 `STOP / canExecuteCanonicalPlan:false`，schema、manifest 和内容针均无 ACTIVE 路径；14 个计划 inventory 与 7 个受管文档摘要一致；未发现双权威、HIGH 或 MEDIUM。

## LOW 与处置

1. `APPROVED_AMENDMENT_REQUIRED` 容易被误读为已批准：改为 `AMENDMENT_APPROVAL_REQUIRED`。
2. 缺少受管文档摘要重钉程序：新增 `.harness/wiki/execution-authority.md`，禁止自动全部重算并要求独立复核。
3. CI 摘要使用直接 Node runner，而注册命令带 `--test`：两条命令分别记录，注册命令保持原样。
4. `--check` 退出 0 可能被误用：文档明确它只验证 inactive guard，唯一施工查询是 `--authorize`。
5. project manifest 注册采用 `JSON.stringify`，键顺序变化会 fail closed：保留为非阻断噪声，后续若需要再改为结构比较。

## 审查边界

Claude Code 会话的 Bash 允许列表不包含 Node，因此未独立执行测试；它独立复算了 Git 身份、diff digest 和受管文件摘要。最终候选仍需重新跑三路 exact-HEAD 审查。本报告不是托管平台 required check。
