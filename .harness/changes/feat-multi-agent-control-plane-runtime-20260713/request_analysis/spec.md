# 规格说明：feat-multi-agent-control-plane-runtime-20260713

## 背景

蓝图要求把并发 Agent 的任务、租约、资源、构建与发布证据纳入可审计控制面。本变更是实现总记录，S0 先冻结跨步骤的数据契约和基线口径。

## 范围

定义 task、lease、release evidence JSON Schema；登记根级事实源、状态语义、验证命令和历史基线。

## 非目标

S0 不实现数据库、资源锁、Git/CI 门禁、发布指挥权或密钥治理，也不宣称生产门禁已生效。

## 验收标准

正例被接受、缺字段/非法版本/未知字段等反例被拒绝；manifest 引用全部存在；根 doctor 为 0 errors。

## 验证计划

先运行契约测试取得 RED，再补实现取得 GREEN；最后运行根 harness doctor。
