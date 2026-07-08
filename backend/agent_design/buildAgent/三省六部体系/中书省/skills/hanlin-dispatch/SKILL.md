---
name: hanlin-dispatch
description: 翰林院调度 — 当朝堂需要通用执行能力（终端命令、代码执行、浏览器、文件操作、Web 搜索、GitHub 等）时，调度 Hermes Agent 作为翰林院执行。适用于：朝堂 agent 自身无法完成的执行类任务，如写代码、跑脚本、上网查资料、操作 GitHub 等。
version: 1.0.0
metadata:
  openclaw:
    tags: [hanlin, hermes, execution, sidecar, dispatch]
    trigger: 当任务需要终端执行、代码编写、浏览器操作、Web 搜索、或调用外部 API 时
---

# 翰林院调度 (Hanlin Dispatch)

## 概述

翰林院 (Hanlin Academy) 是朝堂的通用执行层，由 Hermes Agent 提供支持。
当中书省或其他朝堂 agent 遇到需要实际执行（而非分析/治理）的任务时，
通过此 skill 将任务委派给翰林院。

## 翰林院能力清单

| 能力类别 | 具体工具 | 场景举例 |
|---------|---------|---------|
| 终端执行 | terminal | 跑脚本、安装依赖、管理服务 |
| 代码编写 | code_execution, file ops | 写 Python/JS、生成配置文件 |
| 浏览器 | browser suite | 网页截图、表单填写、UI 测试 |
| Web 搜索 | web_search, web_fetch | 查资料、对比竞品、获取实时信息 |
| GitHub | github tools | 查 issue、提 PR、代码审查 |
| 自动化 | cronjob, delegation | 定时任务、多步骤流程编排 |
| 多媒体 | image_gen, media tools | 生成图片、处理音视频 |

## 调度方式

### 方式一：CLI 子进程调度（推荐，最简单）

在朝堂 agent 的工具调用中执行：

```bash
/home/ubuntu/hermes-agent/run-hermes-dev.sh chat \
  -q "TASK_DESCRIPTION" \
  -Q --yolo \
  --max-turns 10
```

参数说明：
- `-q "..."` — 单次任务描述（非交互）
- `-Q` — 静默模式，只输出结果
- `--yolo` — 自动批准工具调用（翰林院受朝堂信任）
- `--max-turns 10` — 限制执行轮次防止失控

### 方式二：指定 skill 调度

如果知道任务对应的 hermes skill：

```bash
/home/ubuntu/hermes-agent/run-hermes-dev.sh chat \
  -q "TASK_DESCRIPTION" \
  -Q --yolo \
  -s SKILL_NAME
```

常用 skill 映射：
- `courtos-manor` — 调用庄园 API 分析
- `github-code-review` — GitHub 代码审查
- `codebase-inspection` — 代码库检查
- `jupyter-live-kernel` — 数据分析
- `webhook-subscriptions` — Webhook 管理
- `research-deep-dive` — 深度研究

### 方式三：MCP 桥接（高级，近实时）

Hermes 运行为 MCP Server 后，朝堂可通过 MCP 协议直接调用 hermes 的消息工具：

```bash
# 启动 hermes MCP server（需要 gateway 运行中）
hermes --profile dev mcp serve
```

MCP 工具：`conversations_list`, `messages_send`, `events_poll`, `messages_read` 等。

## 调度协议

1. **朝堂 agent 识别任务类型** — 如果需要"执行"而非"分析"，触发翰林院
2. **构造任务描述** — 用自然语言描述需要翰林院做什么
3. **调用 run-hermes-dev.sh** — 通过终端工具执行
4. **接收结果** — 解析 hermes 的输出
5. **整合回报** — 将翰林院的执行结果整合进朝堂的回报中

## 边界规则

- 翰林院**不做决策**，只做执行。策略和治理权留在朝堂。
- 翰林院**不直接面客**，所有用户交互通过朝堂 bot。
- 翰林院的执行结果必须经朝堂 agent 审核后才返回给用户。
- LLM 路由共享 litellm (127.0.0.1:4444)，翰林院默认用 strong-brain (gemma4)。

## 示例流程

用户通过 Telegram 问："帮我查一下 GitHub 上 anthropics/claude-code 最近的 issue"

1. OpenClaw expert agent 收到消息
2. 识别为"执行类任务"（需要上网 + GitHub 操作）
3. 调用翰林院：
   ```bash
   /home/ubuntu/hermes-agent/run-hermes-dev.sh chat \
     -q "Go to GitHub repo anthropics/claude-code, list the 5 most recent open issues with titles and labels" \
     -Q --yolo --max-turns 10
   ```
4. Hermes 使用 browser/github tools 执行
5. 返回 issue 列表
6. Expert agent 整理格式，回复用户
