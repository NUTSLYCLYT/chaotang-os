# 规格说明：fix-decision-task-single-writer-20260714

## 背景

能力清单已经指定上书房为唯一正式业务主链，但上书房内部仍有四处直接
`DecisionTask(...)`：正式拟旨以及三个专用 workflow。字段序列化与身份边界因此
可能继续漂移，且新增路由可以绕过任何统一创建规则。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | 运行时存在四个直接构造点 | `pytest --run` 的 RED 输出列出 928/1630/1932/2315 | AST + 行为测试 | 是 |
| 推测 | 专用流程字段可能继续与正式拟旨漂移 | 代码差异审查 | Project Agent | 否 |
| 未知问题 | 旧兼容 execution registry 的真实外部调用量 | 遥测尚为空 | 后续 Observe | 否 |

## 数据流与调用链

HTTP workflow profile → `create_decision_task` → SQLAlchemy `DecisionTask` → 调用方同事务内继续写 review/run。

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| DecisionTask 创建 | `src.decision_task_kernel` | 上书房正式与专用流程 | AST 门禁止其他运行时代码直接构造 |

## 范围

新增唯一创建内核；迁移四个现有构造点；保留外部 API、任务状态和来源语义；更新能力清单证据。

## 非目标

不删除专用接口；不迁移旧内存 execution registry；不建设常驻 Worker；不改变正式奏折规则。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| 新增路由直接构造 ORM | 结构门失败 | `test_decision_task_single_writer.py` |
| 专用 workflow 创建任务 | 仍保持既有响应与状态 | `test_shangshufang_loop_api.py` |
| 跨用户访问 | 继续拒绝 | `test_p0b_cross_user_behavioral.py` |

## 风险与回滚边界

风险是字段映射遗漏；由完整上书房接口回归覆盖。回滚为整体撤销本变更提交，数据库
schema 和外部 API 均未变化。

## 计划确认记录

- 批准人：用户
- 批准日期：2026-07-14
- 批准范围：按五关方案继续收口唯一任务事实源
- 明确未批准：无关前端、生产部署和删除兼容入口

## 验收标准

运行时代码除 `decision_task_kernel.py` 外无 `DecisionTask(...)`；四类接口行为不回归；清单和 Harness Doctor 全绿。

## 验证计划

先运行结构性 RED；实现后运行朝堂专项、入口治理测试、后端 doctor、根 doctor和 diff 检查。
