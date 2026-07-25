# Codex Skill Preflight Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 Codex 在每个用户回合重新加载并声明适用 skill，并为高风险场景提供确定性路由。

**Architecture:** 用户级 `developer_instructions` 提供跨仓库前置规则；根 `AGENTS.md` 提供项目
路由；项目 `UserPromptSubmit` hook 在每回合注入固定系统提醒。Node 测试直接执行 hook 并校验
输出，不依赖 Codex transcript。

**Tech Stack:** TOML、Markdown、Codex `hooks.json`、Node.js `node:test`

## Global Constraints

- 不读取、输出或改写现有私密配置值。
- 不提交、不推送。
- 保留既有 Stop hook。
- Hook 不持久化用户提示词或 session 数据。

---

### Task 1: 固化全局和仓库 skill 路由

**Files:**
- Modify: `C:\Users\Administrator\.codex\config.toml`
- Modify: `AGENTS.md`

**Interfaces:**
- Consumes: Codex 用户级 `developer_instructions`、仓库自动加载的 `AGENTS.md`
- Produces: 每回合 skill preflight 规则和确定性场景映射

- [ ] **Step 1: 定向确认全局配置尚未定义 `developer_instructions`**
- [ ] **Step 2: 在全局 TOML 顶层增加多行指令，不输出其他配置**
- [ ] **Step 3: 在根 `AGENTS.md` 顶部增加强制映射和 Git 工作区核对规则**
- [ ] **Step 4: 使用 TOML 解析器和文本断言验证配置**

### Task 2: 实现每回合 UserPromptSubmit 门禁

**Files:**
- Create: `.codex/hooks/skill-preflight.test.mjs`
- Create: `.codex/hooks/skill-preflight.mjs`
- Modify: `.codex/hooks.json`

**Interfaces:**
- Consumes: Codex command hook 通过 stdin 发送的 JSON
- Produces: `{"systemMessage":"..."}`，始终以 0 退出且不回显输入

- [ ] **Step 1: 写测试，断言合法和非法输入都返回固定提醒**
- [ ] **Step 2: 在脚本不存在时运行测试并确认 RED**
- [ ] **Step 3: 实现最小无状态 hook**
- [ ] **Step 4: 运行测试并确认 GREEN**
- [ ] **Step 5: 在 `hooks.json` 注册 `UserPromptSubmit` 并保留 Stop hook**

### Task 3: 完整验证

**Files:**
- Verify: `.codex/hooks.json`
- Verify: `AGENTS.md`
- Verify: `C:\Users\Administrator\.codex\config.toml`

**Interfaces:**
- Consumes: 完整配置和仓库检查
- Produces: 新鲜 PASS/FAIL 证据

- [ ] **Step 1: 解析 TOML 和 JSON**
- [ ] **Step 2: 运行 hook 单元测试**
- [ ] **Step 3: 运行 harness、self-test 与 `git diff --check`**
- [ ] **Step 4: 报告需要用户在 Codex 中信任新 hook，并列出未提交文件**
