# 丞相咨询加载旧后端代码

## Summary

丞相咨询的当前源码和离线测试均满足自由文本契约，但本地 FastAPI 服务仍运行修订前的内存代码，导致合法咨询稳定返回 BFF `502` 和“丞相（咨询）暂时无法回应”。

## Root Cause

后端通过不带 `--reload` 的 Uvicorn 命令于 11:05 启动；共享 DeepSeek 适配器及下旨调用点在 15:02 完成“默认自由文本、仅下旨显式启用 JSON Output”的修订。常驻 Python 进程不会自动加载磁盘上的新函数定义，因此咨询仍执行修订前曾全局启用 JSON Output 的旧内存实现。咨询提示遵循自由文本契约，旧实现的模型调用失败并经 FastAPI 与 BFF 脱敏映射为 `502`。

同一固定诊断请求在旧进程返回 `502`；经 PID、监听端口和启动命令核对后重启后端，加载同一工作树的替换进程立即返回 `200` 和非空咨询回复。这一单变量前后对照排除了前端消息交替、认证、当前磁盘源码和 provider 配置缺失。

## Prevention

- 共享 DeepSeek 适配器保持自由文本默认值，只有需要结构化 JSON 的下旨丞相图可以显式选择 JSON Output；咨询图和通用图不得隐式继承该选择。
- 修改后端运行时代码后，开发者必须重启不带 `--reload` 的 Uvicorn 进程，或在明确使用开发模式时以仓库登记的 reload 命令运行；不能把磁盘测试通过视为常驻服务已经加载新代码。
- 运行态修复必须先核对监听 PID、启动时间、命令行和目标端口，再只重启已确认的服务进程，避免停止相邻工作区或其它 Python 服务。

## Detection

- 自动化回归通过 `backend/tests/test_deepseek_client.py`、`backend/tests/test_deepseek_graph.py`、`backend/tests/test_chancellor_graph.py` 与 `backend/tests/test_chancellor_consult_graph.py` 分别锁定默认自由文本、显式 JSON Output 以及咨询不串扰。
- 当页面出现固定咨询错误时，先记录同源 BFF 的脱敏 HTTP 状态；`502` 后继续核对 FastAPI `GET /health`、端口监听 PID、进程启动时间与相关源码修改时间。若进程早于源码且启动命令无 reload，必须先重启并用同一请求做单变量复验。
- CI 和 `node scripts/check_harness.mjs` 只能验证仓库源码与文档，不能证明本地常驻进程的新鲜度；因此运行态 PID/时间核对是必要的人工检查点，不能由绿色测试替代。

## Evidence

- 产品任务：`docs/product/tasks/2026-07-28-fix-chancellor-consult-unavailable.md`
- 咨询契约：`docs/decisions/0030-chancellor-consult-chat-contract.md`
- DeepSeek 适配器：`backend/app/langgraph_runtime/deepseek_client.py`
- 下旨显式选择：`backend/app/agents/chancellor/graph.py`
- 咨询自由文本保护：`backend/tests/test_chancellor_consult_graph.py`
- 运行证据：旧 PID 20048（11:05、无 reload）对固定请求返回 BFF `502`；替换 PID 29160（15:22）健康检查 `200`，同一固定请求返回 BFF/FastAPI `200` 和非空回复。
