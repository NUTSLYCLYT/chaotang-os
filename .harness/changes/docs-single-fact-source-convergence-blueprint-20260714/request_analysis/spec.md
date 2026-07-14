# Spec：唯一事实源融合蓝图

## 目标

基于全朝廷闭环方案，回答多套任务事实源是否可融合，并形成不扩大刑部首发范围、可分 PR 实施、可验证和可回滚的整体施工图。

## 已确认事实

- 正式上书房链以 `DecisionTask`、outbox、`FinalMemorial`、`EmperorDecision`、`ShiguanArchive` 为候选 canonical core。
- chaotang、orchestration/court compat、swarm session 和 frontend local DB 存在并行写面。
- 主页面仍有 `/api/court/shangshufang/*` 与 backend `/api/shangshufang/*` 路径漂移。
- ext 工作区持续变化，当前文档不能证明 immutable RC。

## 决策

采用“一个写内核、多个 adapter、legacy 只读 observation、无永久双写”的绞杀者迁移；运行时实施受 P0-B、测试隔离、prod doctor、PostgreSQL migration 和 exact SHA 硬门约束。

## 非目标

- 不在本 change 修改 API、状态机、数据库或前端。
- 不停止旧服务、不迁移客户数据、不删除 legacy 入口。
- 不扩大首发到全六部。

## 验收

- 蓝图包含目标事实表/写者、融合矩阵、依赖图、逐步任务、验证、退出、回滚、指标与反模式。
- 每一步可以由新会话冷启动执行。
- 根 Harness doctor 通过；独立对抗审查无未关闭 CRITICAL。
