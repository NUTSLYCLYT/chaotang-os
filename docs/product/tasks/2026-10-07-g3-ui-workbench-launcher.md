# G3 UI 工作台与本地启动器整合（2026-10-07）

## Status

Ready

## Product Definition

把已在隔离分支验证过的朝堂按钮语义和六部/司级工作台视觉改进，与当前 G3 本地启动器候选整合为一个可审计候选。界面继续沿用墨底、金线、部色和卷轴视觉；启动器继续使用 standalone 前端的环境变量端口契约。

## Non-goals

- 不改变后端业务 API、任务、权限、模型供应商或结果契约。
- 不新增任务系统、数据库、外部网络、桌面窗口操作或公开部署。
- 不自动合并、发布或替用户确认客户试用。
- 不把 UI 状态条或按钮存在当作真实部门执行证据。

## Acceptance Criteria

- [ ] 统一按钮组件保留既有默认视觉，并支持明确的语义变体、尺寸、焦点和禁用状态。
- [ ] 六部与司级工作台显示真实页面已有的部门、职掌、回奏计数和数据源状态，不生成假数据。
- [ ] 本地 standalone 启动器在默认和自定义端口都能启动、健康检查、停止并释放端口。
- [ ] 前端 lint、类型检查、全量测试和生产构建通过。
- [ ] 根 Harness、启动器契约测试和跨进程集成验证通过。

## Delivery Constraints

只修改本任务登记的七个文件；不修改后端、权限、任务系统、Harness 规则或远端发布设置。沿用现有朝堂组件和 CSS token，不引入新的 UI 框架或依赖。

## Affected Modules

- 模块：朝堂统一按钮组件、六部/司级工作台、Windows 本地启动器。
- 允许路径：`frontend/src/features/court-visuals/**`、`frontend/src/features/ministries-visual/**`、`scripts/start-local.ps1`、`scripts/start-local.test.mjs`。

- `frontend/src/features/court-visuals/CourtCapabilityButton.tsx`
- `frontend/src/features/court-visuals/CourtCapabilityButton.module.css`
- `frontend/src/features/ministries-visual/DepartmentScene.tsx`
- `frontend/src/features/ministries-visual/OfficeScene.tsx`
- `frontend/src/features/ministries-visual/ministries.module.css`
- `scripts/start-local.ps1`
- `scripts/start-local.test.mjs`

## Technical Plan

1. 将隔离分支已验证的按钮 variant/size 语义和交互状态增量应用到现有 `CourtCapabilityButton`。
2. 在部级和司级工作台顶部显示当前真实视图模型已经提供的状态，不新增数据源。
3. 保留启动器的 `HOSTNAME`/`PORT` 环境变量契约，移除 standalone 不读取的命令行端口参数。
4. 运行前端全量验证、根 Harness、启动器契约和跨进程集成；任何失败保持候选不可接受。

## Implementation Report

产品子提交尚未施工。审批提交只冻结本任务范围和验收矩阵；候选验证后再填写真实 SHA、测试结果和证据摘要。

## Acceptance Review

翰林院需确认：按钮和工作台只改变可理解性与视觉一致性，状态来自现有真实响应；启动器默认/自定义端口和停止回收均有实测证据；没有新增伪造结果、权限或模型调用。

## Rollback

回退本候选产品提交即可恢复当前 `ext-dev` 的 UI 与启动器状态；不修改用户数据库或运行期数据。

## Evidence

候选验证必须记录实际命令、提交 SHA、测试结果和回退目标；不得以分支存在或组件存在代替运行证据。
