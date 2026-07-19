# 规格说明：docs-life-agent-service-quality-architecture-20260718

## 背景

整理全域智能服务、成果完成度门禁、MCP/数据源规模、用户体验与编排方案，并评估 OpenClaw、Hermes、Humen/Hume 的适配边界。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | 当前 MCP 配置含 11 个有效 server 定义、35 个工具定义，但部分为 mock/TODO | backend/config/mcp_servers.yaml、backend/mcp_servers | 只读盘点 | 否 |
| 已确认事实 | 原 4 个 `AA` 冲突已在 `fd73a3f`/`9f756ae` 本地解决，当前 behind 0、ahead 30；D6 因发布历史形状不合规拒绝 push | `git status`、预推送模拟，2026-07-18 | Git 与 D6 检查 | 是，阻塞上传 |
| 已确认事实 | M1 仅有最小 TaskEnvelope/TraceContext 与 3 个契约测试，未包含计划全部关键字段 | `backend/src/contracts/task_trace.py`、`backend/tests/test_task_trace_contracts.py` | 只读代码盘点 | 是，阻塞全链契约声明 |
| 已确认事实 | Agent 设计资产约 594 个文件，运行时角色资料 71 套；367 份 Skill 文件仅 43 个唯一目录名 | `find backend/agent_design ...`、`find backend/runtime_prompts ...`，2026-07-18 | 只读盘点 | 否，但需去重和评测 |
| 推测 | 现有大量角色/Skill 资产中有部分可复用，但尚不能推断其生产可用性 | 需后续 Registry、黄金任务和运行证据 | P4-Agent-Skill-Governance | 否 |
| 未知问题 | 真实生产任务的路由准确率、证据接地率、人工改判率、兑现率、成本和 P95 延迟 | 当前无统一真实 KPI 数据 | M7/M9 Outcome 与 Trace | 是，阻塞 world-class 声明 |

## 数据流与调用链

仓库事实与官方资料 → 架构判断 → 根级计划文档；不改变运行时。

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| 产品与服务质量架构 | 根级计划文档 | M1-M10 后续模块 | doctor + 独立复审 |

## 范围

文档、估算、技术适配判断和实施顺序。

## 非目标

不安装第三方项目，不修改 MCP 配置，不接入生产工具，不改变现有运行时。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| 当前本地已收敛但发布候选不合规 | 不用 `--no-verify`；先把真实树差异重铸为单一 Packet 并独立复审 | `git status`、D6 模拟与远端树 diff |
| 设计资产数量很大但未绑定运行证据 | 一律标为资产/候选，不标为 active 或 production-ready | Registry 与黄金评测 |
| 第三方身份或产品含义不唯一 | 分别说明 Humen SDR、Hume AI、human-in-the-loop，不作无来源合并判断 | 官方链接与适配边界 |

## 风险与回滚边界

删除新增文档和 change 目录即可回滚，不影响运行时。

## 计划确认记录

- 批准人：业主
- 批准日期：2026-07-18
- 批准范围：汇总全域服务质量架构、第三方集成原则、执行优先级与后续 Packet 方案为 Markdown 文档
- 后续批准：业主以“下一步”批准执行 P0 本地冲突收敛；已完成两个本地 merge commit
- 明确未批准：不修改运行时、不安装第三方、不绕过 D6、不推送未复审候选

## 验收标准

文档完整覆盖门禁、规模、工具、编排、趋势和第三方适配；根 doctor 与 diff check 通过。

## 验证计划

运行 `node scripts/harness-doctor.mjs` 和 `git diff --check`，核对 staged path 仅含本变更。
