# Packet P1 审查报告：refactor-dept-id-ssot-20260714

| 绑定项 | 值 |
| --- | --- |
| P1 实现提交 | `8a16e8760f34490ba720eb8a662766cc1ddd340d`（rebase 后，patch-id 与旧 base 版 `ed9dd2bb…` 一致） |
| P1 EXT merge | `defd157739ab1815eafeccfe420348ab452eae1a` |
| 证据提交 | `cbbe5e2`（含 playwright trace/截图、ci_summary、spec/tasks/summary） |
| 伴生修复 | `a073811`、`df0c5d5`、`9968418`（alembic 005 degenerate sequence 三连修） |
| 验收分支 | `feature-chaotang-ext`（按用户 2026-07-14 23:28"先在 ext 干活"裁决） |
| 审查时间 | 2026-07-15 00:30 (Asia/Shanghai) |
| 审查方式 | 逐行 diff 预审（23:55–00:19）+ 独立重跑 + 证据核对 |

## 独立复核（审查者自跑，非采信）

| 项 | Codex 证据 | 独立复核 | 判定 |
| --- | --- | --- | --- |
| 后端 SSOT+golden | 8+34 passed | 我自跑 42 passed（含 30 条 golden 全过，语义零漂移） | PASS |
| 前端全量 node | 1015：1008/7 | 我自跑 1012：1005/7（自跑时点早于其最终版，+3/+6 均为新守门）；**7 个失败与 P0 基线逐项同名，零新增** | PASS |
| tsc / 三层 doctor | 0 错误 | 我自跑一致 | PASS |
| patch-id 连续性 | 旧/新 base 同 `ed9dd2bb…` | rebase 未夹带语义变化 | PASS |
| 生产 DB / lockfile | hash 前后不变 | 与 P0 基线值一致 | PASS |
| 浏览器冒烟 | 隔离 runtime（18081/3002）走通 下旨→军机处→御前裁决→史馆，trace 留存；诚实声明"播种质门前置，不构成真实模型证据" | 证据文件在 `ci_result/artifacts/`，边界声明合规 | PASS |

## 代码结论（逐行审）

- 后端：`MINISTRY_KEYWORDS`/`DEPARTMENT_PERSONAS` 等硬编码字典全删，统一从
  `departments.yaml v1_taxonomy` 经 `department_identity.py` 派生；命名空间
  （canonical/runtime/agent）显式分离+碰撞检测+import 时 fail-fast——正确。
- 前端：`dept.ts` `DEPARTMENT_IDENTITIES` 唯一身份总表，四套旧命名收编为显式
  aliases；unified/ministry 注册表只留职责展示字段，名称派生——正确。
- 旧 smoke 打 404 的诊断证据（退役路径）与新规范 smoke 分开留存——诚实。

## 发现（不阻塞 GO，须登记跟进）

| ID | Severity | 内容 | 处置 |
| --- | --- | --- | --- |
| F1 | MEDIUM | 后端 YAML 与前端 dept.ts 两个 SSOT 之间无机器 parity 守门（前端 contracts 0 处引用 departments.yaml），agent_code 对齐靠人眼 | P2 开工前补一个跨端 parity 测试（读 YAML 断言与 dept.ts agent_code/aliases 一致），或列 P1 residual 由 Codex 快速补丁 |
| F2 | LOW | `ministry-registry.ts` 用 `MINISTRY_IDS[0]` 位置索引取身份，key 为字面量——数组重排时 key≠id 静默错位 | 改字面量调用，任意后续 Packet 顺手不算越界（单文件微修） |

## 流程偏差（记录在案）

| ID | 内容 | 裁定 |
| --- | --- | --- |
| D1 | P1 在 Claude 正式 GO 前合入 ext（原铁律 10 停审门顺序被"直合 ext+用户批复"新流程替代） | 用户 23:28 裁决"先在 ext 干活"+分级审批（代码逐行批）已覆盖；本报告即为事后独立审查，内容全绿，偏差**追认** |
| D2 | alembic 005 三连修（a073811/df0c5d5/9968418）属 P5 领地，以验证阻塞修复名义随 P1 落地 | 可接受，但**必须登记进 P5 范围递减清单**：P5 执行时计入这三笔、不得重复修 |
| D3 | `task/p2-flow-store-legacy-tripwire` 分支在 P1 GO 前创建，且承载的是 P1 收尾内容（分支名与内容错位） | P2 开工前重切干净分支，从含本报告的 ext HEAD 起步 |
| D4 | `integration/full-court-v1`（f9b3e88）已落后 ext，campaign 实际改为直合 ext | 需一次显式裁决：**建议正式退役 integration 线**（归档 `archive/integration-full-court-v1-2a92646`），方案文本相应修订——与用户"在 ext 干活"裁决一致；不得留一条半死线当第二事实源 |

## 裁决

PACKET_REVIEW_GO

（GO 附带条件：F1 在 P2 开工前补守门；D2 登记 P5 清单；D4 由用户批一次分支线裁决。）
