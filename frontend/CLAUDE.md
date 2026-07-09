@AGENTS.md

# Claude 入口

本文件只做极简启动提示。前端事实源是同目录 `AGENTS.md` 与 `.harness/`，不维护第二套规则。

## 启动顺序

1. 读取 `AGENTS.md`。
2. 读取 `.harness/agents/frontend-owner.md`。
3. 按任务读取 `.harness/rules/` 与 `.harness/wiki/`。
4. 查看 `.harness/changes/` 是否已有对应 change。
5. 修改前端 harness 文档、规则或脚本后运行 `pnpm harness:doctor`。

## 当前边界

`frontend/` 负责页面、组件、浏览器验证、发布门禁和前端工程 harness。非前端运行事实以根级 manifest、API 契约和明确验证输出为准，不在前端入口文档中展开实现细节。
