# 变更：前端不再拥有 BFF 文档

## 意图

记录当前前端线不再拥有 BFF 层的长期边界。

## 决策

- 不新增或恢复 `src/app/api/**` 运行时 route handler。
- 不把 `/chaotang/api/**` 当作前端 API集成路径。
- 前端运行数据通过文档化 adapter 和环境变量控制的 base URL 连接明确外部 API。

## 操作说明

本地前端服务如果需要连接外部 API 外部运行端口，应配置 dev-server 环境，例如：

- `EXTERNAL_RUNTIME_API_URL=http://127.0.0.1:外部运行端口`
- `NEXT_PUBLIC_EXTERNAL_RUNTIME_API_URL=http://127.0.0.1:外部运行端口`
- `NEXT_PUBLIC_CHAOTANG_API_URL=http://127.0.0.1:外部运行端口`
- `NEXT_PUBLIC_API_MODE=real`

连接问题应在环境配置、外部运行可达性、CORS/auth 预期或类型化 client adapter 中修复，不应通过重新引入前端 BFF 修复。

## 验证

- 仅文档变更。

