# G3 新任务默认 50,000 token 与完整本地启动修复

## Status

Ready

## Product Definition

让新的真实 DecreeJob 使用既有 Fusion 预算账本的 50,000 token 默认上限，同时保留旧任务已承诺的预算不可变；修复 Windows 本地 standalone 启动时静态资源未同步的问题，使客户试用页面可正常加载。默认预算仍然 fail-closed，超限、取消、未知用量和失败归类逻辑不变。

## Delivery Constraints

预算实现复用 `backend/app/fusion/task_token_budget.py` 已有的 50,000 schema、旧表迁移和 cap immutable 约束。执行器不再向每个任务硬编码 20,000，而是让新任务采用 Fusion 的默认 50,000；已经存在的 20,000 任务通过账本的不可变 cap 继续保持 20,000，不能用重试或重启静默扩额。不得把 API key、运行库、node_modules、.venv、.next 或外部服务凭据带入提交。

## Affected Modules

- 模块：`backend/app/decree_jobs` 执行器与预算账本接线；`scripts/start-local.ps1` 本地生产启动器。

- 允许路径：`backend/app/decree_jobs/executor.py`, `backend/tests/test_decree_job_executor.py`, `scripts/start-local.ps1`, `scripts/start-local.test.mjs`
- `backend/app/decree_jobs/executor.py`
- `backend/tests/test_decree_job_executor.py`
- `scripts/start-local.ps1`
- `scripts/start-local.test.mjs`

上书房、军机处和结果卡仍使用现有任务、权限、预算和归档契约；本任务不新建任务系统，不绕过权限，不伪造结果。

## Acceptance Criteria

- [ ] 新任务调用 `TaskTokenBudget` 时使用既有 50,000 默认；旧任务 cap 仍通过 immutable 检查保留。
- [ ] 执行器单测明确断言不再传入硬编码 20,000，并覆盖旧 cap 不被扩充的账本测试。
- [ ] 本地生产启动后 `/_next/static/*` 与 `public/*` 返回 200；开发模式行为不变。
- [ ] 启动器测试、预算测试、执行器测试、Harness 检查和差异检查通过。
- [ ] 真实页面重跑时必须记录真实模型、实际消耗、任务状态、失败原因或结果归档；不得用模拟结果代替。

## Technical Plan

1. 先将当前批准提交快进到 Gitee `ext-dev`，由 M0 复核精确 base、manifest 和远端 HEAD。
2. 在执行器中删除固定 20,000 参数，传入 `None` 让 Fusion 账本为新任务创建 50,000 cap；旧任务读取已有 cap，不做迁移扩额。
3. 更新最小回归测试，证明新任务默认 50,000、旧任务 20,000 不变；同时应用 standalone 静态资源同步修复。
4. 运行 Windows 单测、ruff、启动器测试、Harness 和差异检查，再用真实 DeepSeek 重跑页面闭环。
5. 生成真实成功或失败证据；只有结果、验收和史馆归档均可见时才申请候选确认。

## Implementation Report

待 M0 授权后填写。当前已有真实页面证据表明：注册、登录、丞相咨询和拟旨成功；两次办理在 20,000 账本下以 `provider_budget_exceeded` 失败，未伪造结果。standalone 静态资源修复在本地通过 6 项启动器测试和 HTTP 200 复核，尚未进入产品候选。

## Acceptance Review

待产品候选生成后填写：批准提交、候选 SHA/tree、验证命令、真实 DeepSeek 任务 ID、实际 token 消耗、军机处状态、翰林验收和史馆归档证据。不得以本任务的基础测试代替 G3 封闭试用门槛。

## Non-goals

- 不迁移或扩充已经开始的 20,000 token 任务。
- 不修改外部模型凭据、provider 路由或网络门禁。
- 不新增 HTTP API、数据库表、任务系统、权限系统或桌面窗口操作。
- 不实现部门工作台 UI；该 UI 作为后续独立任务接在圣旨展示面板内。
- 不合并、推送、部署或公开发布。

## Rollback

只回退本任务候选的四个产品文件；保留外部证据文件和旧任务账本。回退前停止本地服务并保存任务账本，不能删除或重置已发生的用量。