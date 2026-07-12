# 规格说明：fix-true-chain-health-real-evidence-20260713

## 背景

true-chain 端点固定返回 FALLBACK/degraded，导致 release gate 无论真实链是否运行都无法变绿。

## 范围

只读查询最近已完成的 LIVE_ENGINE/LIVE_SWARM 部门运行及其父 SwarmRun，生成门禁所需 checks/liveReady。

## 非目标

不触发新蜂群、不把质量阻塞伪装成质量通过、不修改执行结果。

## 验收标准

无真实证据时 degraded；存在已完成真实部门执行时 ready；prod-doctor 可据此正确决策。

## 验证计划

TDD、后端 doctor、真实服务 restart、HTTP 探针和 prod-doctor。
