# 六部视觉演示展示实施计划

> **执行要求：** 依次完成每项并在验证通过后继续；不复用旧 `dev` 的接口、SWR 或业务动作。

**目标：** 以静态演示配置恢复六部总览、部门页和属署页的视觉层级，并明确区分于真实业务数据。

**边界：** 仅改动前端页面、演示组件、测试和六张视觉资产；保留既有登录保护，禁止新增网络请求。

## 1. 建立可验证的静态配置

**文件：** `frontend/src/features/department-demo/departmentDemoData.test.ts`、`frontend/src/features/department-demo/departmentDemoData.ts`

1. 先写失败测试，锁定六个部门、唯一代码、背景资产和演示标签。
2. 用类型化本地配置定义部门、属署和演示待办；不包含实时状态或请求函数。
3. 运行 `npm test -- departmentDemoData.test.ts`。

## 2. 恢复已授权视觉资产

**文件：** `frontend/public/assets/six-ministries/*.webp`

1. 仅从 `dev` 读取六张确认存在的背景资产。
2. 不复制旧组件、API、模拟业务模块或服务端代码。
3. 用测试和文件检查确认每张配置引用的资产存在。

## 3. 实现总览、部门与属署展示

**文件：** `frontend/src/features/department-demo/DepartmentDemoViews.tsx`、`frontend/src/features/department-demo/departmentDemo.module.css`、`frontend/src/app/liubu/**/page.tsx`

1. 总览呈现六部卡片和明确的“演示展示”标记。
2. 部门页使用对应背景并呈现职责、司局和演示待办。
3. 属署页展示该司静态职责说明和返回链接；未知参数调用 `notFound()`。
4. 保持 `requireUser` 与 `CourtShell`。

## 4. 全量验证与交接

**文件：** 任务记录与本计划

1. 运行 `npm test`、`npm run lint`、`npm run typecheck`、`npm run build`。
2. 搜索新增目录，确认不含 `fetch`、`backendClient`、SWR 或旧业务导入。
3. 将结果写入任务记录的 Implementation Report 与 Acceptance Review。
