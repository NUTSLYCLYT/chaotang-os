# 任务：主流程最小稳定化

> 本任务必须遵循 `docs/decisions/0028-decree-evidence-flow-governance-baseline.md`，不得修改或绕过该基线。

## Status

Accepted

## Product Definition

- 用户确认：2026-08-14，用户选择方案 A（自包含验收基线）。
- 问题：核心下旨流程可以运行，但验收脚本、忽略证据和本地依赖状态导致干净环境无法稳定复现全绿。
- 目标用户：维护、测试和交付 chaotang-os 的开发人员。
- 目标：不改变业务行为，使标准环境能够严格、可重复地验证主流程，并在同一最终版本连续通过 10 轮完整验收。
- 非目标：新增业务功能、调用真实模型、修改 ADR 0028、部署或提交运行态证据。

## Acceptance Criteria

- [x] 默认合成旨意明确请求管理财务报告并严格产生 `accounting_report`。
- [x] 脚本路径和模块两种启动方式完成相同动态布局验收。
- [x] 后端全量测试不依赖 `.superpowers/` 下预先存在的忽略文件。
- [x] 前后端使用声明依赖完成 lint、typecheck、test、build 和 integration。
- [x] 四项 harness 验证通过，ADR 0028 未改变。
- [x] 同一最终版本连续 10 轮完整合成主流程全部通过，并逐轮记录证据。

## Delivery Constraints

- 范围：验收 runner、相关后端测试、必要的测试临时夹具、稳定化设计/任务/失败记录和验证证据。
- 兼容性：保持下旨、路由、成果、权限、史馆归档和错误分类契约不变。
- 风险与限制：不得通过放宽断言、跳过测试或依赖工作区残留获得绿色结果；真实模型和生产环境不在授权范围。
- 技能计划：Superpowers 路线；设计后使用 `writing-plans`、`test-driven-development`、`systematic-debugging`、`verification-before-completion` 和 `codex-engineering-workflow`。
- Codex-only：否；本任务当前由 Codex 执行，但未调用自动交付或 Claude runner。

## Affected Modules

- 模块：本地合成主流程验收、后端验收测试、前后端依赖环境。
- 允许路径：`backend/tests/`、必要的测试配置、`docs/superpowers/`、`docs/failures/`、本任务文件；如需扩大范围必须重新确认。
- 依赖模块：现有前端 build/start、FastAPI 合成应用、任务 worker、会计成果与归档契约。

## Technical Plan

- 架构边界：只修复验收与环境可重复性，不改变业务执行图或 API 契约。
- 接口与依赖：保持现有 CLI 和依赖声明；两种 Python 调用方式必须等价。
- 实施顺序：先用失败测试固定三个根因，再逐项最小修复，恢复声明依赖，最后执行分层验证和连续 10 轮验收。
- 验证计划：详见 `docs/superpowers/specs/2026-08-14-main-flow-stabilization-design.md` 和 `docs/superpowers/plans/2026-08-14-main-flow-stabilization.md`。
- 技术风险：验收输出可能仍隐含机器路径或运行残留；通过临时目录、进程清理和干净证据检查控制。

## Implementation Report

- 改动摘要：
  - 默认合成旨意改为明确请求户部会计司生成 2025 年管理层综合财务报告，并用意图测试固定为严格 `accounting_report`。
  - 动态布局矩阵改为脚本路径和模块调用共用的延迟加载入口，两种调用方式均完成相同 9 项矩阵。
  - 普通测试不再读取忽略的 `.superpowers/` 运行证据；来源 manifest 仅在调用方显式传入路径时读取。
  - Windows 进程树改为先启动门控 bootstrap、加入 Job Object 后再原子放行真实命令，消除子进程在 Job 分配前逃逸的窗口；停止时显式终止并等待整个 Job。
  - Job 创建、配置、分配、门控放行及 Python 异常纳入单一启动事务，保留原始错误并尽力回收进程树、句柄和 gate；多服务清理会尝试全部进程且不覆盖活动业务异常。
  - Windows 端口回归使用系统分配端口和原子就绪文件，消除“查找空闲端口后再启动”的 TOCTOU 竞态；WinAPI 模拟测试可在 Linux CI 路径执行。
- 自审：
  - 每个实施任务均经过独立审查；Windows 清理路径经过专项多轮审查和最终整差异复审。
  - 最终整差异审查结论为无 Critical、Important 或 Minor，代码层面 Ready to merge。
  - ADR 0028 未修改；最终工作树只有 5 个预期跟踪文件改动，暂存区为空。
- 验证：
  - 最终 Task 5 报告：`D:/workspace/chaotang-os-worktrees/main-flow-stabilization/.superpowers/sdd/main-flow-stabilization-task-5-final-report.md`。
  - 最终 Task 6 报告：`D:/workspace/chaotang-os-worktrees/main-flow-stabilization/.superpowers/sdd/main-flow-stabilization-task-6-final-report.md`。
  - 最终连续轮次目录：`D:/workspace/chaotang-os-worktrees/main-flow-stabilization/.superpowers/sdd/main-flow-stabilization-rounds-final-20260814-133856005`。
  - 7 项候选 SHA-256 在 Task 5、Task 6 和独立证据审查中逐项一致。
- 实际使用的 skill：`using-superpowers`、`brainstorming`、`writing-plans`、`test-driven-development`、`systematic-debugging`、`record-failure`、`codex-engineering-workflow`、`using-git-worktrees`、`subagent-driven-development`、`requesting-code-review`、`verification-before-completion`、`finishing-a-development-branch`。
- 验证命令与结果：
  - `backend/.venv/Scripts/python.exe -m ruff check .`：PASS。
  - `backend/.venv/Scripts/python.exe -m pytest -q`：PASS，3768 passed、4 skipped、3 warnings。
  - `frontend/npm run lint`：PASS。
  - `frontend/npm run typecheck`：PASS。
  - `frontend/npm test`：PASS，671 passed。
  - `frontend/npm run build`：PASS。
  - `node scripts/verify_integration.mjs`：PASS。
  - `node scripts/check_harness.mjs`：PASS，78 个基线文件。
  - `node scripts/check_harness.mjs --self-test`：PASS，154 项。
  - `node .agents/hooks/check-harness.mjs --self-test`：PASS，3 项。
  - `node .agents/skills/product-flow/scripts/run-claude-delivery.mjs --self-test`：PASS，25 项；仅 self-test，未进入交付模式。
  - `git diff --check`：PASS。
  - 最终轮次 01：PASS，日志 `round-01.log`。
  - 最终轮次 02：PASS，日志 `round-02.log`。
  - 最终轮次 03：PASS，日志 `round-03.log`。
  - 最终轮次 04：PASS，日志 `round-04.log`。
  - 最终轮次 05：PASS，日志 `round-05.log`。
  - 最终轮次 06：PASS，日志 `round-06.log`。
  - 最终轮次 07：PASS，日志 `round-07.log`。
  - 最终轮次 08：PASS，日志 `round-08.log`。
  - 最终轮次 09：PASS，日志 `round-09.log`。
  - 最终轮次 10：PASS，日志 `round-10.log`。
  - 10 轮成果 SHA-256 均为 `58752ecc67f104263aadeb00f384b596c939fbd0db756ec0d633f0bae63b790c`，每轮动态矩阵严格 9/9 PASS。
- 作废证据：
  - 首次 Task 6 编排因 Windows PowerShell 将 native stderr 警告提升为终止异常，0 轮计数。
  - 第二次编排的第 1 轮业务 PASS，但中文日志显示被 PS 5.1 错误解码，附加显示字符串校验误判；整目录作废。
  - 后续成功目录均从第 1 轮独立重启，未跨目录拼接；最终候选代码变更后又重新完成了上述最终 10/10。
- 未运行项与原因：
  - 未调用真实模型、真实业务外部数据源、生产写入或部署，因为不在本次授权和验收范围。
  - 依赖恢复执行过 `npm ci` 和 Python 包安装；业务验收本身仅使用本地合成数据。
  - 未执行 stage、commit、push、merge 或 PR，因为用户未授予相应 Git 写权限。
- 剩余风险：
  - 本地验证平台为 Windows；Linux CI 相关 WinAPI 逻辑使用显式平台模拟测试覆盖，但本次未实际运行远端 Ubuntu CI。
  - 安装时 npm 报告 6 个 high 漏洞和 2 个未批准安装脚本；未运行自动 audit fix，以免越过本任务范围。
  - 仍存在 1 个 Starlette/httpx 弃用警告和 2 个既有 Pydantic 负向夹具警告，不影响本次验收退出码。
  - PowerShell 5.1 的 Tee 日志中中文显示可能乱码；最终校验使用 UTF-8 源码哈希和 JSON/ASCII 结构，不依赖显示文本。

## Acceptance Review

- 验收结果：Passed（实现未提交）
- 验收证据：
  - 6 条 Acceptance Criteria 全部满足。
  - 最终 Task 5 完整矩阵全部通过，独立证据审查 APPROVED。
  - 最终 Task 6 在同一候选哈希上独立连续 10/10 通过，独立逐日志证据审查 APPROVED。
  - 最终整差异代码审查无 Critical、Important 或 Minor。
- 未通过项：无。
