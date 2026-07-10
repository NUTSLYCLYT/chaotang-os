# 单测计划

## 覆盖范围

- 前端类型契约与页面编译。
- 后端锦衣卫采证、端点和确定性 vet 规则。

## 命令

- `tsc --noEmit`
- `pytest tests/test_jinyiwei_agent.py tests/test_jinyiwei_endpoint.py tests/test_jinyiwei_vet.py`

## 未覆盖风险

- 未在本机执行真实 Tavily 外网请求；已有端点测试覆盖 LIVE_SEARCH、CALLER_FINDINGS 与 FALLBACK 分支。

