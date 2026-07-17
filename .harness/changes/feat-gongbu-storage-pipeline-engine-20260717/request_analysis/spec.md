# 规格说明：feat-gongbu-storage-pipeline-engine-20260717

## 背景

PKT-1 将储能售后蜂群五阶段设计抽象为安全的确定性工部适配器。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | 工部此前无真实引擎；现新增 `adapt_gongbu` | `backend/src/real_department_engines.py`；audit.py | pytest + audit | 否 |
| 推测 | 真实工具调用与工单写入由后续运行链路承接 | PKT-1 明确不做外部副作用 | 代码审查 | 否 |
| 未知问题 | 真实 telemetry/MCP 接入尚未实现 | 后续运行时 | 本包不阻塞 | 是 |

## 数据流与调用链

任务文本 → scope guard → P0 安全阈值/缺口计算 → 五阶段 court_doc → 现有 L3/L4 contract adapter。

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| court_doc | `adapt_gongbu` | L3/L4 engine lookup | 48 tests + harness doctor |

## 范围

仅新增工部适配器、映射和回归测试；不修改路由关键词表，不实现其他 Packet。

## 非目标

不包含真实 MCP、工单写入、邮件发送、生产数据库变更及 PKT-2/3/4/5。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| 非储能/BMS 任务 | 返回 `None` | 定向测试 |
| 冒烟/漏液/热失控/燃烧 | `P0`、black light、安全三件套 | 定向测试 |
| 缺少设备/遥测/现场信息 | `unknown_gaps` 显式列出 | 定向测试 |

## 风险与回滚边界

删除 `adapt_gongbu` 及注册映射即可回滚，不涉及 schema 或持久化迁移。

## 计划确认记录

- 批准人：
- 批准日期：
- 批准范围：
- 明确未批准：

## 验收标准

工部显示 `adapt_gongbu`；五阶段输出可验证；P0 阈值与 scope guard 有测试；共享引擎回归全绿。

## 验证计划

运行定向 pytest、能力审计、后端/根 harness doctor 和 `git diff --check`。
