# 规格说明：chore-agent-harness-baseline-20260717

## 背景

M0 冻结 2026-07-17 的事实源、运行能力图、黄金样例分层及 known-red 基线，为 M1 契约改造提供不可漂移的参照。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | HEAD=917fbb6；分支 feature-chaotang-ext；后端 2703 passed/37 skipped/7 known failed | capability-baseline.json、known-red-baseline-ledger.md | pytest、双层 doctor | 否 |
| 推测 | 静态审计的 v1_taxonomy 与 keyword overlap 提示存在扫描器投影盲区 | 审计输出 | M1/M2 补充动态投影测试 | 否 |
| 未知问题 | 外部 required-check 尚未配置，Claude 独立复审尚未完成 | integration-lease-gate status | 外部管理员/复审 | 是（发布门） |

## 数据流与调用链

canonical sources → capability-baseline.json → M1 TaskEnvelope/TraceContext、M2 CapabilityCard、M9 KPI；golden-cases.md 作为后续门禁输入；known-red ledger 作为回归比较基线。

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| 部门与专家能力 | departments.yaml、department_identity.py、real_department_engines.py、shangshufang_loop.py | 路由、能力注册、审计门 | 文件快照 + golden tests |
| known-red | known-red-baseline-ledger.md | CI 回归比较 | 仅允许既有 7 项 |

## 范围

只新增 M0 文档与 JSON 基线，不改运行时代码、生产数据或路由行为。

## 非目标

不实现 M1-M10，不修复既有 7 个 known-red，不宣称外部 required-check 或 Claude GO。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| 分支/commit/引擎/红灯或黄金结构变化 | 新建 v2 基线并重新审计 | capability-baseline.json 的 re_freeze_when |
| 工作树存在未纳入变更 | 保留为 out-of-scope，不得伪装成基线内容 | git status |
| 静态审计出现投影盲区 | 记录限制，不能据此判定运行时失败 | ci_summary |

## 风险与回滚边界

删除本 change 目录即可回滚 M0 文档；不得回滚或覆盖并行工作树改动。若基线事实变化，保留旧版本并新建 v2，不改写历史快照。

## 计划确认记录

- 批准人：
- 批准日期：
- 批准范围：
- 明确未批准：

## 验收标准

1. 基线 commit、分支、事实源和引擎映射可复现；2. known-red 精确记录为 7 项；3. 黄金任务覆盖 D0/D1/D2、六部、专署、证据缺失、拒答、冲突与不可逆操作共 50 个最小配额；4. 三层 doctor 与 diff check 通过；5. 范围外脏文件未被纳入。

## 验证计划

运行 backend 全量 pytest（禁用 randomly 插件）、backend/root harness doctor、git diff --check；人工复核审计投影限制与 known-red 对账；提交前检查 staged diff 只含 M0。
