# 军机处多部门夹具失配导致假 502

## Summary

军机处案件账本的离线成功夹具声明了两个部门，却只提供一条部议。严格的生产 API 契约正确拒绝了这组不一致证据并返回 502，使测试出现可复发的“假 502”。

## Root Cause

测试夹具没有维护跨集合不变量：`departments` 与 `ministry_opinions` 必须数量相等，并且部议顺序必须与部门顺序一一对应。生产端在证据不完整或错位时安全关闭是正确行为，根因是离线成功夹具与契约不一致。

## Prevention

成功路径夹具以 `departments` 为唯一来源，按部门列表的既定顺序逐项生成对应部议，使两个集合天然保持等长和顺序一致。不得放宽生产 API、吞掉不一致证据或增加测试专用分支来掩盖夹具错误。

## Detection

变更军机处案件夹具或证据聚合逻辑后，运行：

```text
cd backend
python -m pytest tests/test_junjichu_cases_api.py
python -m pytest
python -m ruff check .
cd ..
node scripts/check_harness.mjs
```

定向 API 测试负责暴露部门与部议的数量或顺序失配；完整 pytest 检查相邻证据流回归；Ruff 检查静态质量；harness 校验失败记录结构及仓库治理约束。

## Evidence

- [军机处案件 API 测试](../../backend/tests/test_junjichu_cases_api.py)
- [敕令 API 严格契约实现](../../backend/app/api/decrees.py)
- [敕令证据流治理基线](../decisions/0028-decree-evidence-flow-governance-baseline.md)
- [开发群体司局能力任务](../product/tasks/2026-07-27-dev-swarm-bureau-capabilities.md)
