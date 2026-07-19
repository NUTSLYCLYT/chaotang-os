# 规格说明：fix-p6-residual-test-closure-20260718

## 背景

远端整合提交 `bf7d4cc` 已吸收 P12 的律师 RAG 路径修复与 legacy router
遥测实现，但三个回归测试差异和已知红灯台账核销没有随整合包进入远端。原
`bf7d4cc..9f756ae` 候选又同时恢复 48 个过期 packet 证据文件，经独立 Claude
只读审查判定整体不得发布，只允许把真实测试残余拆成独立 Packet A。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | 远端基线 roster 测试仍断言 `munger` 属观点席，实际 registry 将 `munger-perspective` 放在判官席 | RED：定向基线 `1 failed, 1 passed`，2026-07-18 | Codex 隔离 worktree 实跑 | 是，已由本候选关闭 |
| 已确认事实 | P12 生产树已有 7 个 legacy router 调用遥测，但缺对应回归测试 | `merge-p8-p9.../summary.md` 与新增测试 | 源码直读 + 定向测试 | 是，已补护栏 |
| 已确认事实 | 原 known-red 补丁只追加核销叙述，未同步顶部计数和表格状态 | `known-red-baseline-ledger.md` 原始结构 | Claude + Codex 独立读取 | 是，已重写 |
| 未知问题 | legacy/canonical 是否达到连续 14 天零调用 | 本包无生产流量窗口 | 需部署后观测 | 是，阻断 RETIRED，不阻断本测试包 |

## 数据流与调用链

`persona_registry.roster_summary` → roster 分类契约测试；
`qintianjian /forecast` → 端点组装 → 测试注入空 RAG，避免共享磁盘历史污染；
compat router → `record_legacy_endpoint_call` → 新回归测试验证 7 个入口的 endpoint/operation。

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| roster 分类 | `skills/personas/` 文件与 `persona_registry` 字节阈值 | agent roster 与测试 | 测试断言当前实际分类 |
| 钦天监端点六字段 | `/api/qintianjian/forecast` 端点组装 | 前端/调用者与契约测试 | 测试隔离非契约共享 RAG |
| legacy 调用遥测 | `src.migration_telemetry.record_legacy_endpoint_call` | 退役观测窗口 | 7 个兼容入口回归覆盖 |

## 范围

- 修改 `backend/tests/test_persona_registry.py`。
- 修改 `backend/tests/test_tianjian_verdict.py`。
- 新增 `backend/tests/test_legacy_router_telemetry.py`。
- 重写 known-red 台账，使顶部、表格和核销记录一致。
- 新增唯一 root change `fix-p6-residual-test-closure-20260718`。

## 非目标

- 不改生产实现、API、schema、provider、依赖或运行时数据。
- 不恢复 48 个旧 packet 目录或 P5/docs-only 归档材料。
- 不处理 P8/P9 前端残余；该范围保留给 Packet B。
- 不修 D6 对 `claude-code-review-*.md` 命名失明的问题；另立门禁 change。
- 不把测试全绿扩写为 14 天零调用、router 退役或 campaign DONE。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| 共享磁盘 RAG 含历史数据 | 端点契约测试仍稳定验证六字段 | 注入空 RAG；定向/全量通过 |
| roster 资料厚度变化 | 测试断言当前事实源分类而非裸名旧假设 | registry summary + 定向测试 |
| 测试执行生成 IMA 归档 | 产物不得进入候选 | 隔离 worktree 检查并删除本轮自产物 |
| 全量出现新失败 | 台账新增 OPEN，候选停止 | 全量 `-p no:randomly` |

## 风险与回滚边界

风险集中在测试可能掩盖真实生产问题和台账夸大完成度。通过只隔离不属于端点
契约的共享 RAG、保留生产代码不变、明确 `VERIFIED_PARTIAL` 与 14 天观察门控制。
回滚只需撤销本 packet 的测试、台账和 change 记录，不涉及生产数据迁移。

## 计划确认记录

- 批准人：项目业主
- 批准日期：2026-07-18
- 批准范围：Claude P0 拆包审查 GO 后，先实施 Packet A，再独立复审与 D6 发布。
- 明确未批准：夹带本地领先远端的其他提交、恢复旧 packet、直接推送或宣称总战役完成。

## 验收标准

1. 基线 RED 可复现 roster 旧断言。
2. 三个目标测试文件定向运行 4 passed。
3. 后端全量 0 failed，台账数字与状态精确对应本次运行。
4. 后端/根级 doctor 与 `git diff --check` 通过。
5. 精确 diff 只含声明范围；Claude 独立复审 GO 前不合 ext。

## 验证计划

按 RED → GREEN → 后端全量 → 两层 doctor → diff/边界复核执行。全量只运行一次；
若后续代码变化影响结果，再按受影响范围重跑。
