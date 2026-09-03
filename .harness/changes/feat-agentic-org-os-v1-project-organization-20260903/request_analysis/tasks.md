# Tasks：军机处专项骨架 V1

## 1. 数据契约

- 定义 `ProjectOrganization`。
- 明确与 `SceneRun`、`BoardMission` 的引用关系。
- 保留 owner/tenant 隔离。

## 2. 后端 API

- 创建专项。
- 从 owned SceneRun 创建专项。
- 查询专项列表与详情。
- 安全状态更新。

## 3. 前端军机处

- `/junjichu` 增加“设立专项”入口。
- 新增专项列表和详情页。
- 展示项目纲领、成员矩阵、任务卡、验收标准和阻塞项。

## 4. Scene Pack 接入

- 场景结果页增加“设立军机处专项”按钮。
- 从 SceneRun 创建专项后跳转专项详情。

## 5. 测试

- 后端 targeted pytest。
- 前端 node:test / typecheck / lint / build。
- root harness。
- 如授权，补 Playwright MCP 演示路径。
